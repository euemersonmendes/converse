import { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Send } from 'lucide-react';
import type { StoryGroup } from '@converse/shared';

interface StoryViewerModalProps {
  group: StoryGroup;
  currentUserId: string;
  onClose: () => void;
  onViewStory: (storyId: string) => void;
  onReplyStory: (storyId: string, targetUserId: string, content: string) => Promise<void>;
}

export function StoryViewerModal({
  group,
  currentUserId,
  onClose,
  onViewStory,
  onReplyStory,
}: StoryViewerModalProps) {
  const [index, setIndex] = useState(0);
  const [reply, setReply] = useState('');
  const [sentFeedback, setSentFeedback] = useState(false);

  const story = group.stories[index];

  useEffect(() => {
    if (story) {
      onViewStory(story.id);
    }
  }, [story?.id]);

  if (!story) return null;

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    await onReplyStory(story.id, group.user.id, reply.trim());
    setReply('');
    setSentFeedback(true);
    setTimeout(() => setSentFeedback(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
      <div className="relative w-full max-w-sm h-[82vh] bg-[#0D1520] rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        {/* Progress Bars */}
        <div className="absolute top-3 inset-x-3 z-20 flex gap-1">
          {group.stories.map((s, i) => (
            <div key={s.id} className="h-1 flex-1 rounded-full bg-white/30 overflow-hidden">
              <div className={`h-full bg-white ${i <= index ? 'w-full' : 'w-0'}`} />
            </div>
          ))}
        </div>

        {/* User Header */}
        <div className="absolute top-6 inset-x-4 z-20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={group.user.avatarUrl} alt={group.user.displayName} className="w-9 h-9 rounded-full object-cover border border-white/40" />
            <div>
              <div className="text-sm font-semibold text-white drop-shadow">{group.user.displayName}</div>
              <div className="text-[11px] text-white/80">
                {new Date(story.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full bg-black/40 text-white hover:bg-black/70">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Media */}
        <img src={story.mediaUrl} alt={story.caption || 'Story'} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70 pointer-events-none" />

        {/* Navigation Arrows */}
        {index > 0 && (
          <button
            onClick={() => setIndex((i) => i - 1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        {index < group.stories.length - 1 && (
          <button
            onClick={() => setIndex((i) => i + 1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {/* Caption & Reply */}
        <div className="absolute bottom-4 inset-x-4 z-20 space-y-3">
          {story.caption && (
            <p className="text-sm text-white text-center bg-black/40 backdrop-blur-sm rounded-xl px-3 py-2">
              {story.caption}
            </p>
          )}

          {group.user.id !== currentUserId && (
            <form onSubmit={handleReply} className="flex items-center gap-2">
              <input
                type="text"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={sentFeedback ? 'Resposta enviada no chat! ✓' : `Responder para ${group.user.displayName.split(' ')[0]}...`}
                className="flex-1 bg-black/50 border border-white/25 rounded-full px-4 py-2 text-sm text-white placeholder-white/70 outline-none"
              />
              <button type="submit" className="w-10 h-10 rounded-full bg-[#00D4FF] text-[#0D1520] flex items-center justify-center">
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
