import { useState } from 'react';
import { Heart, MessageCircle, MapPin, BadgeCheck, Plus, Send } from 'lucide-react';
import type { FeedPost } from '@converse/shared';

interface FeedViewProps {
  posts: FeedPost[];
  onToggleLike: (postId: string) => void;
  onAddComment: (postId: string, content: string) => Promise<void>;
  onCreatePost: (imageUrl: string, caption: string, location?: string) => Promise<void>;
  onStartChat: (userId: string) => void;
}

export function FeedView({ posts, onToggleLike, onAddComment, onCreatePost, onStartChat }: FeedViewProps) {
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [showNewPost, setShowNewPost] = useState(false);
  const [newImg, setNewImg] = useState('');
  const [newCaption, setNewCaption] = useState('');
  const [newLocation, setNewLocation] = useState('');

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newImg.trim() || !newCaption.trim()) return;
    await onCreatePost(newImg.trim(), newCaption.trim(), newLocation.trim() || undefined);
    setNewImg('');
    setNewCaption('');
    setNewLocation('');
    setShowNewPost(false);
  };

  return (
    <div className="flex-1 bg-[#070B12] overflow-y-auto py-6 px-4">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#F0F7FF]">Momentos</h2>
            <p className="text-xs text-[#8BA4BE]">Compartilhe seu dia com suas conexões</p>
          </div>
          <button
            onClick={() => setShowNewPost((s) => !s)}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#E1306C] to-[#1D4ED8] text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg hover:opacity-95 transition"
          >
            <Plus className="w-4 h-4" />
            Nova Publicação
          </button>
        </div>

        {showNewPost && (
          <form
            onSubmit={handlePublish}
            className="bg-[#0D1520] border border-[#1C2E42] rounded-2xl p-4 space-y-3"
          >
            <input
              type="url"
              required
              value={newImg}
              onChange={(e) => setNewImg(e.target.value)}
              placeholder="URL da foto (ex: https://images.unsplash.com/...)"
              className="w-full bg-[#132030] rounded-xl px-3.5 py-2 text-sm text-[#F0F7FF] outline-none"
            />
            <input
              type="text"
              required
              value={newCaption}
              onChange={(e) => setNewCaption(e.target.value)}
              placeholder="Escreva uma legenda..."
              className="w-full bg-[#132030] rounded-xl px-3.5 py-2 text-sm text-[#F0F7FF] outline-none"
            />
            <input
              type="text"
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              placeholder="Localização (opcional)"
              className="w-full bg-[#132030] rounded-xl px-3.5 py-2 text-sm text-[#F0F7FF] outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewPost(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-[#8BA4BE] hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-[#00D4FF] text-[#0D1520] text-xs font-bold"
              >
                Publicar
              </button>
            </div>
          </form>
        )}

        {posts.map((post) => (
          <article key={post.id} className="bg-[#0D1520] border border-[#1C2E42] rounded-2xl overflow-hidden shadow-lg">
            {/* Post Header */}
            <div className="p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full p-[2px] ig-ring">
                  <img
                    src={post.user.avatarUrl}
                    alt={post.user.displayName}
                    className="w-full h-full rounded-full object-cover border-2 border-[#0D1520]"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-semibold text-[#F0F7FF]">{post.user.displayName}</span>
                    {post.user.verified && <BadgeCheck className="w-3.5 h-3.5 text-[#53BDEB]" />}
                  </div>
                  {post.location && (
                    <div className="flex items-center gap-1 text-[11px] text-[#8BA4BE]">
                      <MapPin className="w-3 h-3" />
                      <span>{post.location}</span>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => onStartChat(post.userId)}
                className="text-xs px-3 py-1.5 rounded-lg bg-[#132030] hover:bg-[#1E3248] text-[#00D4FF] font-medium transition"
              >
                Enviar DM
              </button>
            </div>

            {/* Image with double click to like */}
            <div onDoubleClick={() => !post.likedByMe && onToggleLike(post.id)} className="cursor-pointer bg-black">
              <img src={post.imageUrl} alt={post.caption} className="w-full max-h-[460px] object-cover" />
            </div>

            {/* Actions & Caption */}
            <div className="p-4 space-y-2.5">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => onToggleLike(post.id)}
                  className="flex items-center gap-1.5 text-sm text-[#F0F7FF] hover:opacity-80 transition"
                >
                  <Heart
                    className={`w-5 h-5 ${post.likedByMe ? 'fill-[#E1306C] text-[#E1306C]' : 'text-[#AEBAC1]'}`}
                  />
                  <span>{post.likesCount}</span>
                </button>
                <div className="flex items-center gap-1.5 text-sm text-[#AEBAC1]">
                  <MessageCircle className="w-5 h-5" />
                  <span>{post.commentsCount}</span>
                </div>
              </div>

              <p className="text-sm text-[#F0F7FF]">
                <span className="font-semibold mr-2">{post.user.username}</span>
                {post.caption}
              </p>

              {/* Comments */}
              {post.recentComments.length > 0 && (
                <div className="space-y-1 pt-1">
                  {post.recentComments.map((c) => (
                    <div key={c.id} className="text-xs text-[#D1D7DB]">
                      <span className="font-semibold text-white mr-1.5">{c.user.username}</span>
                      {c.content}
                    </div>
                  ))}
                </div>
              )}

              {/* Comment input */}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const val = commentInputs[post.id]?.trim();
                  if (!val) return;
                  await onAddComment(post.id, val);
                  setCommentInputs((prev) => ({ ...prev, [post.id]: '' }));
                }}
                className="flex items-center gap-2 pt-2 border-t border-[#1C2E42]"
              >
                <input
                  type="text"
                  value={commentInputs[post.id] || ''}
                  onChange={(e) => setCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value }))}
                  placeholder="Adicione um comentário..."
                  className="flex-1 bg-transparent text-xs text-[#F0F7FF] placeholder-[#8BA4BE] outline-none"
                />
                <button type="submit" className="text-[#00D4FF] hover:text-[#38BDF8] p-1">
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
