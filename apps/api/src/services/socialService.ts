import { randomUUID } from 'node:crypto';
import { STORY_TTL_HOURS, type FeedComment, type FeedPost, type StoryGroup, type StoryItem, type UserProfile } from '@converse/shared';
import { getDb } from '../db/database.js';
import { HttpError } from '../middleware/errorHandler.js';
import { mapUserRow } from './authService.js';

export function listStoryGroups(viewerId: string): StoryGroup[] {
  const db = getDb();
  const now = new Date().toISOString();

  const rows = db
    .prepare(
      `SELECT s.*, u.username, u.display_name, u.avatar_url, u.verified,
              EXISTS(SELECT 1 FROM story_views sv WHERE sv.story_id = s.id AND sv.viewer_id = ?) as viewed_by_me,
              (SELECT COUNT(*) FROM story_views sv2 WHERE sv2.story_id = s.id) as view_count
       FROM stories s
       JOIN users u ON u.id = s.user_id
       WHERE s.expires_at > ?
       ORDER BY s.created_at ASC`
    )
    .all(viewerId, now) as Array<{
    id: string;
    user_id: string;
    media_url: string;
    caption: string | null;
    background_color: string | null;
    created_at: string;
    expires_at: string;
    username: string;
    display_name: string;
    avatar_url: string;
    verified: number;
    viewed_by_me: number;
    view_count: number;
  }>;

  const groupsMap = new Map<string, StoryGroup>();

  for (const r of rows) {
    const story: StoryItem = {
      id: r.id,
      userId: r.user_id,
      user: {
        id: r.user_id,
        username: r.username,
        displayName: r.display_name,
        avatarUrl: r.avatar_url,
        verified: Boolean(r.verified),
      },
      mediaUrl: r.media_url,
      caption: r.caption,
      backgroundColor: r.background_color,
      viewedByMe: Boolean(r.viewed_by_me),
      viewCount: r.view_count,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
    };

    const existing = groupsMap.get(r.user_id);
    if (existing) {
      existing.stories.push(story);
      if (!story.viewedByMe) existing.hasUnseen = true;
    } else {
      groupsMap.set(r.user_id, {
        user: story.user,
        hasUnseen: !story.viewedByMe,
        stories: [story],
      });
    }
  }

  return Array.from(groupsMap.values()).sort((a, b) => {
    if (a.user.id === viewerId) return -1;
    if (b.user.id === viewerId) return 1;
    return Number(b.hasUnseen) - Number(a.hasUnseen);
  });
}

export function createStory(
  userId: string,
  input: { mediaUrl: string; caption?: string; backgroundColor?: string }
): StoryItem {
  const db = getDb();
  const id = `story-${randomUUID()}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + STORY_TTL_HOURS * 3_600_000).toISOString();

  db.prepare(`
    INSERT INTO stories (id, user_id, media_url, caption, background_color, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, input.mediaUrl, input.caption ?? null, input.backgroundColor ?? null, now.toISOString(), expiresAt);

  const user = db.prepare('SELECT id, username, display_name, avatar_url, verified FROM users WHERE id = ?').get(userId) as any;

  return {
    id,
    userId,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      verified: Boolean(user.verified),
    },
    mediaUrl: input.mediaUrl,
    caption: input.caption ?? null,
    backgroundColor: input.backgroundColor ?? null,
    viewedByMe: false,
    viewCount: 0,
    createdAt: now.toISOString(),
    expiresAt,
  };
}

export function markStoryViewed(storyId: string, viewerId: string): void {
  const db = getDb();
  db.prepare(`
    INSERT OR IGNORE INTO story_views (story_id, viewer_id, viewed_at)
    VALUES (?, ?, ?)
  `).run(storyId, viewerId, new Date().toISOString());
}

export function listFeedPosts(viewerId: string): FeedPost[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT p.*, u.username, u.display_name, u.avatar_url, u.verified, u.city,
              (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) as likes_count,
              EXISTS(SELECT 1 FROM post_likes pl2 WHERE pl2.post_id = p.id AND pl2.user_id = ?) as liked_by_me,
              (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id) as comments_count
       FROM posts p
       JOIN users u ON u.id = p.user_id
       ORDER BY p.created_at DESC`
    )
    .all(viewerId) as any[];

  return rows.map((r) => {
    const commentRows = db
      .prepare(
        `SELECT pc.*, u.username, u.display_name, u.avatar_url
         FROM post_comments pc
         JOIN users u ON u.id = pc.user_id
         WHERE pc.post_id = ?
         ORDER BY pc.created_at DESC
         LIMIT 3`
      )
      .all(r.id) as any[];

    const recentComments: FeedComment[] = commentRows.reverse().map((c) => ({
      id: c.id,
      postId: c.post_id,
      userId: c.user_id,
      user: {
        id: c.user_id,
        username: c.username,
        displayName: c.display_name,
        avatarUrl: c.avatar_url,
      },
      content: c.content,
      createdAt: c.created_at,
    }));

    return {
      id: r.id,
      userId: r.user_id,
      user: {
        id: r.user_id,
        username: r.username,
        displayName: r.display_name,
        avatarUrl: r.avatar_url,
        verified: Boolean(r.verified),
        city: r.city,
      },
      imageUrl: r.image_url,
      caption: r.caption,
      location: r.location,
      likesCount: r.likes_count,
      likedByMe: Boolean(r.liked_by_me),
      commentsCount: r.comments_count,
      recentComments,
      createdAt: r.created_at,
    };
  });
}

export function createPost(userId: string, input: { imageUrl: string; caption: string; location?: string }): FeedPost {
  const db = getDb();
  const id = `post-${randomUUID()}`;
  const now = new Date().toISOString();

  db.prepare('INSERT INTO posts (id, user_id, image_url, caption, location, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    id,
    userId,
    input.imageUrl,
    input.caption,
    input.location ?? null,
    now
  );

  const posts = listFeedPosts(userId);
  return posts.find((p) => p.id === id)!;
}

export function togglePostLike(postId: string, userId: string): { liked: boolean; likesCount: number } {
  const db = getDb();
  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(postId);
  if (!post) throw new HttpError(404, 'Publicação não encontrada.');

  const existing = db.prepare('SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?').get(postId, userId);
  if (existing) {
    db.prepare('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?').run(postId, userId);
  } else {
    db.prepare('INSERT INTO post_likes (post_id, user_id, created_at) VALUES (?, ?, ?)').run(
      postId,
      userId,
      new Date().toISOString()
    );
  }

  const countRow = db.prepare('SELECT COUNT(*) as c FROM post_likes WHERE post_id = ?').get(postId) as { c: number };
  return { liked: !existing, likesCount: countRow.c };
}

export function addPostComment(postId: string, userId: string, content: string): FeedComment {
  const db = getDb();
  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(postId);
  if (!post) throw new HttpError(404, 'Publicação não encontrada.');

  const id = `comm-${randomUUID()}`;
  const now = new Date().toISOString();
  db.prepare('INSERT INTO post_comments (id, post_id, user_id, content, created_at) VALUES (?, ?, ?, ?, ?)').run(
    id,
    postId,
    userId,
    content.trim(),
    now
  );

  const user = db.prepare('SELECT id, username, display_name, avatar_url FROM users WHERE id = ?').get(userId) as any;
  return {
    id,
    postId,
    userId,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
    },
    content: content.trim(),
    createdAt: now,
  };
}

export function listFollowingUsers(userId: string): UserProfile[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT u.* FROM users u
       JOIN follows f ON f.following_id = u.id
       WHERE f.follower_id = ?
       ORDER BY u.is_online DESC, u.display_name ASC`
    )
    .all(userId) as any[];
  return rows.map(mapUserRow);
}

export function listPeopleDirectory(userId: string): Array<UserProfile & { isFollowing: boolean }> {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT u.*,
              EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = ? AND f.following_id = u.id) as is_following
       FROM users u
       WHERE u.id != ?
       ORDER BY is_following DESC, u.display_name ASC`
    )
    .all(userId, userId) as any[];

  return rows.map((r) => ({
    ...mapUserRow(r),
    isFollowing: Boolean(r.is_following),
  }));
}

export function toggleFollowUser(followerId: string, targetUserId: string): { following: boolean } {
  if (followerId === targetUserId) {
    throw new HttpError(400, 'Você não pode seguir a si mesmo.');
  }
  const db = getDb();
  const target = db.prepare('SELECT id FROM users WHERE id = ?').get(targetUserId);
  if (!target) throw new HttpError(404, 'Usuário não encontrado.');

  const existing = db
    .prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?')
    .get(followerId, targetUserId);

  if (existing) {
    db.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?').run(followerId, targetUserId);
    return { following: false };
  }

  db.prepare('INSERT INTO follows (follower_id, following_id, created_at) VALUES (?, ?, ?)').run(
    followerId,
    targetUserId,
    new Date().toISOString()
  );
  return { following: true };
}
