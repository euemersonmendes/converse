import { DatabaseSync } from 'node:sqlite';

export function initSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      avatar_url TEXT NOT NULL,
      bio TEXT NOT NULL DEFAULT '',
      age INTEGER NOT NULL DEFAULT 25,
      city TEXT NOT NULL DEFAULT 'São Paulo, SP',
      interests_json TEXT NOT NULL DEFAULT '[]',
      photos_json TEXT NOT NULL DEFAULT '[]',
      looking_for TEXT NOT NULL DEFAULT 'relationship',
      verified INTEGER NOT NULL DEFAULT 0,
      is_online INTEGER NOT NULL DEFAULT 0,
      last_seen_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS device_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      device_id TEXT NOT NULL,
      device_name TEXT NOT NULL,
      platform TEXT NOT NULL,
      is_primary INTEGER NOT NULL DEFAULT 0,
      last_active_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      revoked_at TEXT
    );

    CREATE TABLE IF NOT EXISTS pairing_sessions (
      id TEXT PRIMARY KEY,
      pairing_code TEXT UNIQUE NOT NULL,
      qr_payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      web_device_name TEXT NOT NULL DEFAULT 'Converse Web (Chrome)',
      issued_session_id TEXT,
      issued_token TEXT,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      is_group INTEGER NOT NULL DEFAULT 0,
      is_saved_messages INTEGER NOT NULL DEFAULT 0,
      title TEXT NOT NULL DEFAULT '',
      avatar_url TEXT NOT NULL DEFAULT '',
      disappearing_ttl_sec INTEGER,
      pinned_message_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_members (
      chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      pinned INTEGER NOT NULL DEFAULT 0,
      muted INTEGER NOT NULL DEFAULT 0,
      archived INTEGER NOT NULL DEFAULT 0,
      unread_count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (chat_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      client_message_id TEXT UNIQUE,
      chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'text',
      content TEXT NOT NULL,
      media_url TEXT,
      audio_duration_sec INTEGER,
      reply_to_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'sent',
      edited_at TEXT,
      deleted_at TEXT,
      is_forwarded INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT,
      poll_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS starred_messages (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, message_id)
    );

    CREATE INDEX IF NOT EXISTS idx_messages_chat_created ON messages(chat_id, created_at);

    CREATE TABLE IF NOT EXISTS message_reactions (
      message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      emoji TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (message_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS stories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      media_url TEXT NOT NULL,
      caption TEXT,
      background_color TEXT,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS story_views (
      story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
      viewer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      viewed_at TEXT NOT NULL,
      PRIMARY KEY (story_id, viewer_id)
    );

    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      image_url TEXT NOT NULL,
      caption TEXT NOT NULL,
      location TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS post_likes (
      post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      PRIMARY KEY (post_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS post_comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS swipes (
      from_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (from_user_id, to_user_id)
    );

    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      user_a_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_b_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      UNIQUE(user_a_id, user_b_id)
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS follows (
      follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      following_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      PRIMARY KEY (follower_id, following_id)
    );
  `);

  // Safe additive migrations for existing SQLite databases
  const addColumnIfMissing = (table: string, col: string, def: string) => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === col)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def};`);
    }
  };

  addColumnIfMissing('users', 'boosted_until', 'TEXT');
  addColumnIfMissing('chats', 'is_saved_messages', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing('chats', 'disappearing_ttl_sec', 'INTEGER');
  addColumnIfMissing('chats', 'pinned_message_id', 'TEXT');
  addColumnIfMissing('chat_members', 'archived', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing('messages', 'edited_at', 'TEXT');
  addColumnIfMissing('messages', 'deleted_at', 'TEXT');
  addColumnIfMissing('messages', 'is_forwarded', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing('messages', 'expires_at', 'TEXT');
  addColumnIfMissing('messages', 'poll_json', 'TEXT');
}
