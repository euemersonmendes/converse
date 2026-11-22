import { useState } from 'react';
import { Search, Pin, Plus, Check, CheckCheck, Mic, Bookmark, VolumeX, Archive, Star, Users, MessageCircle } from 'lucide-react';
import type { ChatSummary, MessageItem, StoryGroup, UserProfile } from '@converse/shared';

export type ChatFilter = 'all' | 'unread' | 'groups' | 'archived' | 'starred' | 'following';

interface ChatListProps {
  chats: ChatSummary[];
  storyGroups: StoryGroup[];
  starredMessages: MessageItem[];
  people: Array<UserProfile & { isFollowing: boolean }>;
  selectedChatId: string | null;
  currentUserId: string;
  onSelectChat: (chatId: string) => void;
  onStartDirectChat: (peerUserId: string) => void;
  onToggleFollow: (userId: string) => void;
  onOpenStory: (group: StoryGroup) => void;
  onCreateStory: () => void;
  onRefreshStarred: () => void;
  onRefreshPeople: () => void;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function ChatList({
  chats,
  storyGroups,
  starredMessages,
  people,
  selectedChatId,
  currentUserId,
  onSelectChat,
  onStartDirectChat,
  onToggleFollow,
  onOpenStory,
  onCreateStory,
  onRefreshStarred,
  onRefreshPeople,
}: ChatListProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ChatFilter>('all');

  const filtered = chats.filter((c) => {
    if (filter === 'archived' && !c.archived) return false;
    if (filter !== 'archived' && c.archived) return false;
    if (filter === 'unread' && c.unreadCount === 0) return false;
    if (filter === 'groups' && !c.isGroup) return false;

    const q = query.toLowerCase().trim();
    if (!q) return true;
    return c.title.toLowerCase().includes(q) || c.lastMessage?.content.toLowerCase().includes(q);
  });

  const pill = (key: ChatFilter, label: string) => (
    <button
      key={key}
      onClick={() => {
        setFilter(key);
        if (key === 'starred') onRefreshStarred();
        if (key === 'following') onRefreshPeople();
      }}
      className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition ${filter === key
        ? 'bg-[#00A884]/20 text-[#00A884] border border-[#00A884]/40'
        : 'bg-[#202C33] text-[#8696A0] hover:text-white border border-transparent'
        }`}
    >
      {label}
    </button>
  );

  return (
    <div className="w-80 lg:w-96 bg-[#111B21] border-r border-[#222E35] flex flex-col shrink-0">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#E9EDEF] tracking-tight">Conversas</h2>
        <button
          onClick={onCreateStory}
          className="text-xs px-2.5 py-1.5 rounded-lg bg-[#202C33] hover:bg-[#2A3942] text-[#00A884] font-medium flex items-center gap-1 transition"
        >
          <Plus className="w-3.5 h-3.5" /> Story
        </button>
      </div>

      {/* Instagram-style Stories Bar */}
      <div className="px-3 py-2.5 flex items-center gap-3 overflow-x-auto border-b border-[#222E35]">
        {storyGroups.map((group) => (
          <button
            key={group.user.id}
            onClick={() => onOpenStory(group)}
            className="flex flex-col items-center gap-1 shrink-0 group"
          >
            <div
              className={`w-13 h-13 rounded-full p-[2.5px] ${group.hasUnseen ? 'ig-ring' : 'bg-[#2A3942]'
                } group-hover:scale-105 transition`}
            >
              <img
                src={group.user.avatarUrl}
                alt={group.user.displayName}
                className="w-full h-full rounded-full object-cover border-2 border-[#111B21]"
              />
            </div>
            <span className="text-[11px] text-[#AEBAC1] max-w-[56px] truncate">
              {group.user.id === currentUserId ? 'Seu story' : group.user.displayName.split(' ')[0]}
            </span>
          </button>
        ))}
      </div>

      {/* Search & Filter Pills */}
      <div className="p-2.5 space-y-2 border-b border-[#222E35]">
        <div className="bg-[#202C33] rounded-lg px-3 py-1.5 flex items-center gap-2.5">
          <Search className="w-4 h-4 text-[#8696A0]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar conversa ou mensagem..."
            className="bg-transparent text-sm text-[#E9EDEF] placeholder-[#8696A0] outline-none w-full"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {pill('all', 'Todas')}
          {pill('following', '👥 Seguindo')}
          {pill('unread', 'Não lidas')}
          {pill('groups', 'Grupos')}
          {pill('archived', 'Arquivadas')}
          {pill('starred', '★ Favoritas')}
        </div>
      </div>

      {/* Following View, Starred Messages View OR Chat Rows */}
      {filter === 'following' ? (
        <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
          {people
            .filter((p) => !query.trim() || p.displayName.toLowerCase().includes(query.toLowerCase()))
            .map((person) => (
              <div
                key={person.id}
                className="p-3 rounded-xl bg-[#132030]/80 border border-white/[0.06] flex items-center gap-3"
              >
                <div className="relative shrink-0">
                  <img src={person.avatarUrl} alt={person.displayName} className="w-11 h-11 rounded-full object-cover" />
                  {person.isOnline && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#00D4FF] border-2 border-[#0D1520]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-[#F0F7FF] truncate">{person.displayName}</div>
                  <div className="text-[11px] text-[#8BA4BE] truncate">@{person.username} • {person.city}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => onToggleFollow(person.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                      person.isFollowing
                        ? 'bg-[#1E3248] text-[#8BA4BE] hover:text-white'
                        : 'bg-[#00D4FF]/15 text-[#00D4FF]'
                    }`}
                  >
                    {person.isFollowing ? 'Seguindo' : 'Seguir'}
                  </button>
                  {person.isFollowing && (
                    <button
                      onClick={() => {
                        setFilter('all');
                        onStartDirectChat(person.id);
                      }}
                      title="Iniciar conversa"
                      className="p-2 rounded-lg converse-btn-gradient text-[#070B12] transition"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          {people.filter((p) => p.isFollowing).length === 0 && (
            <div className="p-6 text-center text-xs text-[#8BA4BE]">
              <Users className="w-6 h-6 mx-auto mb-2 text-[#00D4FF]" />
              Você ainda não segue ninguém. Toque em "Seguir" para adicionar contatos!
            </div>
          )}
        </div>
      ) : filter === 'starred' ? (
        <div className="flex-1 overflow-y-auto divide-y divide-[#222E35]/60 p-2 space-y-1">
          {starredMessages.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#8696A0]">
              Nenhuma mensagem favoritada ainda. Clique na estrela ★ em qualquer mensagem para salvá-la aqui.
            </div>
          ) : (
            starredMessages.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setFilter('all');
                  onSelectChat(m.chatId);
                }}
                className="w-full text-left p-3 rounded-xl bg-[#202C33]/60 hover:bg-[#202C33] transition"
              >
                <div className="flex items-center justify-between text-[11px] text-[#8696A0] mb-1">
                  <span className="flex items-center gap-1 text-amber-400 font-medium">
                    <Star className="w-3 h-3 fill-amber-400" /> Favorita
                  </span>
                  <span>{formatTime(m.createdAt)}</span>
                </div>
                <p className="text-sm text-[#E9EDEF] line-clamp-2">{m.content}</p>
              </button>
            ))
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto divide-y divide-[#222E35]/50">
          {filtered.map((chat) => {
            const isSelected = chat.id === selectedChatId;
            const isMine = chat.lastMessage?.senderId === currentUserId;
            return (
              <button
                key={chat.id}
                onClick={() => onSelectChat(chat.id)}
                className={`w-full px-3.5 py-3 flex items-center gap-3 text-left transition-all border-l-2 ${
                  isSelected
                    ? 'bg-gradient-to-r from-[#00D4FF]/12 to-[#132030] border-[#00D4FF]'
                    : 'border-transparent hover:bg-[#132030]/70'
                }`}
              >
                <div className="relative shrink-0">
                  {chat.isSavedMessages ? (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-500 flex items-center justify-center text-white">
                      <Bookmark className="w-5 h-5 fill-white" />
                    </div>
                  ) : (
                    <img
                      src={chat.avatarUrl}
                      alt={chat.title}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  )}
                  {!chat.isGroup && !chat.isSavedMessages && chat.peerUser?.isOnline && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#00A884] border-2 border-[#111B21]" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-[#E9EDEF] truncate">
                      {chat.isSavedMessages ? 'Mensagens Salvas' : chat.title}
                    </span>
                    <span className={`text-[11px] shrink-0 ${chat.unreadCount > 0 ? 'text-[#00A884]' : 'text-[#8696A0]'}`}>
                      {chat.lastMessage ? formatTime(chat.lastMessage.createdAt) : ''}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <div className="flex items-center gap-1 min-w-0 text-xs text-[#8696A0]">
                      {isMine && chat.lastMessage && (
                        chat.lastMessage.status === 'read' ? (
                          <CheckCheck className="w-3.5 h-3.5 text-[#53BDEB] shrink-0" />
                        ) : chat.lastMessage.status === 'delivered' ? (
                          <CheckCheck className="w-3.5 h-3.5 text-[#8696A0] shrink-0" />
                        ) : (
                          <Check className="w-3.5 h-3.5 text-[#8696A0] shrink-0" />
                        )
                      )}
                      {chat.lastMessage?.type === 'audio' && <Mic className="w-3.5 h-3.5 text-[#00A884] shrink-0" />}
                      <span className="truncate">
                        {chat.lastMessage?.content || (chat.isSavedMessages ? 'Seu bloco de notas pessoal' : 'Nova conversa')}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {chat.muted && <VolumeX className="w-3.5 h-3.5 text-[#8696A0]" />}
                      {chat.archived && <Archive className="w-3.5 h-3.5 text-[#8696A0]" />}
                      {chat.pinned && <Pin className="w-3.5 h-3.5 text-[#8696A0]" />}
                      {chat.unreadCount > 0 && (
                        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#00A884] text-[#111B21] text-[11px] font-bold flex items-center justify-center">
                          {chat.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}

          {filtered.length === 0 && (
            <div className="p-8 text-center text-sm text-[#8696A0]">
              Nenhuma conversa encontrada nesta aba.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
