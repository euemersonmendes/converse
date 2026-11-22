import { useEffect, useMemo, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { Phone, PhoneOff, Video } from 'lucide-react';
import {
  SOCKET_EVENTS,
  type AuthSession,
  type BoostStatus,
  type ChatSummary,
  type DeviceSession,
  type DiscoverCandidate,
  type FeedPost,
  type MessageItem,
  type ReceivedLikeItem,
  type StoryGroup,
  type UserProfile,
} from '@converse/shared';
import { api } from './lib/api';
import { createAuthedSocket } from './lib/socket';
import { PairingScreen } from './components/PairingScreen';
import { SidebarRail, type WebTab } from './components/SidebarRail';
import { ChatList } from './components/ChatList';
import { ChatWindow } from './components/ChatWindow';
import { DiscoverView } from './components/DiscoverView';
import { FeedView } from './components/FeedView';
import { StoryViewerModal } from './components/StoryViewerModal';
import { LinkedDevicesModal } from './components/LinkedDevicesModal';

interface ActiveCallState {
  direction: 'outgoing' | 'incoming';
  status: 'ringing' | 'connected';
  mode: 'audio' | 'video';
  peerId: string;
  peerName: string;
  peerAvatar: string;
  chatId: string;
}

export function App() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [booting, setBooting] = useState(true);
  const [activeTab, setActiveTab] = useState<WebTab>('chats');

  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messagesByChat, setMessagesByChat] = useState<Record<string, MessageItem[]>>({});
  const [typingByChat, setTypingByChat] = useState<Record<string, string[]>>({});
  const [starredMessages, setStarredMessages] = useState<MessageItem[]>([]);

  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [activeStoryGroup, setActiveStoryGroup] = useState<StoryGroup | null>(null);
  const [candidates, setCandidates] = useState<DiscoverCandidate[]>([]);
  const [likesReceived, setLikesReceived] = useState<ReceivedLikeItem[]>([]);
  const [boost, setBoost] = useState<BoostStatus>({ active: false, expiresAt: null });
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [people, setPeople] = useState<Array<UserProfile & { isFollowing: boolean }>>([]);

  const [showDevices, setShowDevices] = useState(false);
  const [devices, setDevices] = useState<DeviceSession[]>([]);
  const [activeCall, setActiveCall] = useState<ActiveCallState | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const selectedChatIdRef = useRef<string | null>(null);
  selectedChatIdRef.current = selectedChatId;

  const clearSession = () => {
    localStorage.removeItem('converse_web_token');
    localStorage.removeItem('converse_web_session');
    socketRef.current?.disconnect();
    socketRef.current = null;
    setSession(null);
  };

  useEffect(() => {
    const savedToken = localStorage.getItem('converse_web_token');
    const savedRaw = localStorage.getItem('converse_web_session');
    if (!savedToken || !savedRaw) {
      setBooting(false);
      return;
    }

    api
      .getMe()
      .then((me) => {
        const parsed = JSON.parse(savedRaw) as AuthSession;
        setSession({ ...parsed, user: me.user, sessionId: me.sessionId });
      })
      .catch(() => clearSession())
      .finally(() => setBooting(false));
  }, []);

  const loadInitialData = async () => {
    const [chatsRes, storiesRes, discoverRes, likesRes, postsRes, starredRes, peopleRes] = await Promise.all([
      api.listChats(),
      api.getStories(),
      api.getDiscover(),
      api.getLikesReceived(),
      api.getPosts(),
      api.getStarredMessages(),
      api.getPeople(),
    ]);
    setChats(chatsRes.chats);
    setStoryGroups(storiesRes.groups);
    setCandidates(discoverRes.candidates);
    setBoost(discoverRes.boost);
    setLikesReceived(likesRes.likes);
    setPosts(postsRes.posts);
    setStarredMessages(starredRes.messages);
    setPeople(peopleRes.people);

    if (!selectedChatIdRef.current && chatsRes.chats.length > 0) {
      setSelectedChatId(chatsRes.chats[0].id);
    }
  };

  useEffect(() => {
    if (!session) return;
    loadInitialData().catch(() => {});

    const socket = createAuthedSocket(session.token);
    socketRef.current = socket;

    socket.on(SOCKET_EVENTS.SESSION_REVOKED, () => {
      alert('Esta sessão do Converse Web foi desconectada pelo seu celular.');
      clearSession();
    });

    socket.on(SOCKET_EVENTS.MESSAGE_NEW, (msg: MessageItem) => {
      setMessagesByChat((prev) => {
        const existing = prev[msg.chatId] || [];
        if (existing.some((m) => m.id === msg.id)) return prev;
        return { ...prev, [msg.chatId]: [...existing, msg] };
      });

      setChats((prev) => {
        const updated = prev.map((c) => {
          if (c.id !== msg.chatId) return c;
          const isCurrentlyOpen = selectedChatIdRef.current === msg.chatId;
          return {
            ...c,
            lastMessage: msg,
            updatedAt: msg.createdAt,
            archived: false,
            unreadCount:
              msg.senderId !== session.user.id && !isCurrentlyOpen ? c.unreadCount + 1 : c.unreadCount,
          };
        });
        return updated.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
      });

      if (selectedChatIdRef.current === msg.chatId && msg.senderId !== session.user.id) {
        api.markRead(msg.chatId).catch(() => {});
      }
    });

    socket.on(SOCKET_EVENTS.MESSAGE_EDITED, (edited: MessageItem) => {
      setMessagesByChat((prev) => {
        const list = prev[edited.chatId];
        if (!list) return prev;
        return { ...prev, [edited.chatId]: list.map((m) => (m.id === edited.id ? edited : m)) };
      });
    });

    socket.on(SOCKET_EVENTS.MESSAGE_DELETED, (payload: { chatId: string; messageId: string; deletedAt: string }) => {
      setMessagesByChat((prev) => {
        const list = prev[payload.chatId];
        if (!list) return prev;
        return {
          ...prev,
          [payload.chatId]: list.map((m) =>
            m.id === payload.messageId
              ? { ...m, deletedAt: payload.deletedAt, content: '🚫 Mensagem apagada', mediaUrl: null, poll: null }
              : m
          ),
        };
      });
    });

    socket.on(
      SOCKET_EVENTS.CHAT_MESSAGE_PINNED,
      (payload: { chatId: string; pinnedMessage: ChatSummary['pinnedMessage'] }) => {
        setChats((prev) =>
          prev.map((c) => (c.id === payload.chatId ? { ...c, pinnedMessage: payload.pinnedMessage } : c))
        );
      }
    );

    socket.on(
      SOCKET_EVENTS.POLL_UPDATED,
      (payload: { chatId: string; messageId: string; poll: MessageItem['poll'] }) => {
        setMessagesByChat((prev) => {
          const list = prev[payload.chatId];
          if (!list) return prev;
          return {
            ...prev,
            [payload.chatId]: list.map((m) => (m.id === payload.messageId ? { ...m, poll: payload.poll } : m)),
          };
        });
      }
    );

    socket.on(
      SOCKET_EVENTS.MESSAGE_STATUS,
      (payload: { chatId: string; messageIds: string[]; status: 'read' }) => {
        setMessagesByChat((prev) => {
          const list = prev[payload.chatId];
          if (!list) return prev;
          const idSet = new Set(payload.messageIds);
          return {
            ...prev,
            [payload.chatId]: list.map((m) => (idSet.has(m.id) ? { ...m, status: payload.status } : m)),
          };
        });
      }
    );

    socket.on(
      SOCKET_EVENTS.MESSAGE_REACTION_UPDATED,
      (payload: { chatId: string; messageId: string; reactions: MessageItem['reactions'] }) => {
        setMessagesByChat((prev) => {
          const list = prev[payload.chatId];
          if (!list) return prev;
          return {
            ...prev,
            [payload.chatId]: list.map((m) =>
              m.id === payload.messageId ? { ...m, reactions: payload.reactions } : m
            ),
          };
        });
      }
    );

    socket.on(SOCKET_EVENTS.TYPING_START, (payload: { chatId: string; userId: string }) => {
      if (payload.userId === session.user.id) return;
      setTypingByChat((prev) => {
        const current = prev[payload.chatId] || [];
        if (current.includes(payload.userId)) return prev;
        return { ...prev, [payload.chatId]: [...current, payload.userId] };
      });
    });

    socket.on(SOCKET_EVENTS.TYPING_STOP, (payload: { chatId: string; userId: string }) => {
      setTypingByChat((prev) => ({
        ...prev,
        [payload.chatId]: (prev[payload.chatId] || []).filter((id) => id !== payload.userId),
      }));
    });

    socket.on(SOCKET_EVENTS.PRESENCE_UPDATE, (payload: { userId: string; isOnline: boolean; lastSeenAt: string }) => {
      setChats((prev) =>
        prev.map((c) =>
          c.peerUser?.id === payload.userId
            ? { ...c, peerUser: { ...c.peerUser, isOnline: payload.isOnline, lastSeenAt: payload.lastSeenAt } }
            : c
        )
      );
    });

    socket.on(SOCKET_EVENTS.MATCH_NEW, () => {
      api.listChats().then((res) => setChats(res.chats)).catch(() => {});
    });

    // Call signaling
    socket.on(
      SOCKET_EVENTS.CALL_INVITE,
      (payload: { callerId: string; callerName?: string; callerAvatar?: string; chatId: string; mode: 'audio' | 'video' }) => {
        setActiveCall({
          direction: 'incoming',
          status: 'ringing',
          mode: payload.mode || 'audio',
          peerId: payload.callerId,
          peerName: payload.callerName || 'Chamada Converse',
          peerAvatar: payload.callerAvatar || '',
          chatId: payload.chatId,
        });
      }
    );
    socket.on(SOCKET_EVENTS.CALL_ACCEPT, () => {
      setActiveCall((prev) => (prev ? { ...prev, status: 'connected' } : null));
    });
    socket.on(SOCKET_EVENTS.CALL_REJECT, () => setActiveCall(null));
    socket.on(SOCKET_EVENTS.CALL_END, () => setActiveCall(null));

    return () => {
      socket.disconnect();
    };
  }, [session?.token]);

  useEffect(() => {
    if (!session || !selectedChatId) return;
    socketRef.current?.emit(SOCKET_EVENTS.CHAT_JOIN, { chatId: selectedChatId });

    api.getMessages(selectedChatId).then((res) => {
      setMessagesByChat((prev) => ({ ...prev, [selectedChatId]: res.messages }));
    });

    api.markRead(selectedChatId).then(() => {
      setChats((prev) => prev.map((c) => (c.id === selectedChatId ? { ...c, unreadCount: 0 } : c)));
    });
  }, [selectedChatId, session?.token]);

  const handlePaired = (newSession: AuthSession) => {
    localStorage.setItem('converse_web_token', newSession.token);
    localStorage.setItem('converse_web_session', JSON.stringify(newSession));
    setSession(newSession);
  };

  const selectedChat = useMemo(
    () => chats.find((c) => c.id === selectedChatId) || null,
    [chats, selectedChatId]
  );

  const unreadTotal = useMemo(() => chats.reduce((acc, c) => acc + c.unreadCount, 0), [chats]);

  if (booting) {
    return (
      <div className="min-h-screen bg-[#070B12] flex items-center justify-center text-[#8BA4BE] text-sm">
        Carregando Converse Web...
      </div>
    );
  }

  if (!session) {
    return <PairingScreen onPaired={handlePaired} />;
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-[#070B12] text-[#F0F7FF]">
      <SidebarRail
        user={session.user}
        activeTab={activeTab}
        unreadTotal={unreadTotal}
        onChangeTab={setActiveTab}
        onOpenDevices={async () => {
          const res = await api.getDevices();
          setDevices(res.devices);
          setShowDevices(true);
        }}
        onLogout={clearSession}
      />

      {activeTab === 'chats' && (
        <>
          <ChatList
            chats={chats}
            storyGroups={storyGroups}
            starredMessages={starredMessages}
            people={people}
            selectedChatId={selectedChatId}
            currentUserId={session.user.id}
            onSelectChat={(id) => setSelectedChatId(id)}
            onStartDirectChat={async (peerUserId) => {
              const direct = await api.createDirectChat(peerUserId);
              const chatsRes = await api.listChats();
              setChats(chatsRes.chats);
              setSelectedChatId(direct.chatId);
            }}
            onToggleFollow={async (userId) => {
              const res = await api.toggleFollow(userId);
              setPeople((prev) => prev.map((p) => (p.id === userId ? { ...p, isFollowing: res.following } : p)));
            }}
            onOpenStory={(group) => setActiveStoryGroup(group)}
            onRefreshStarred={() => api.getStarredMessages().then((r) => setStarredMessages(r.messages))}
            onRefreshPeople={() => api.getPeople().then((r) => setPeople(r.people))}
            onCreateStory={async () => {
              const url = window.prompt('Cole a URL da imagem para o seu Story (24h):');
              if (!url) return;
              const caption = window.prompt('Legenda opcional:') || undefined;
              await api.createStory(url, caption);
              const res = await api.getStories();
              setStoryGroups(res.groups);
            }}
          />

          <ChatWindow
            chat={selectedChat}
            allChats={chats}
            messages={selectedChat ? messagesByChat[selectedChat.id] || [] : []}
            currentUserId={session.user.id}
            typingUserIds={selectedChat ? typingByChat[selectedChat.id] || [] : []}
            onSendMessage={(payload) => {
              if (!selectedChat) return;
              const clientMessageId = `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
              socketRef.current?.emit(SOCKET_EVENTS.MESSAGE_SEND, {
                chatId: selectedChat.id,
                ...payload,
                clientMessageId,
              });
            }}
            onTyping={(isTyping) => {
              if (!selectedChat) return;
              socketRef.current?.emit(isTyping ? SOCKET_EVENTS.TYPING_START : SOCKET_EVENTS.TYPING_STOP, {
                chatId: selectedChat.id,
              });
            }}
            onReact={(messageId, emoji) => {
              socketRef.current?.emit(SOCKET_EVENTS.MESSAGE_REACT, { messageId, emoji });
            }}
            onEditMessage={async (messageId, newContent) => {
              const res = await api.editMessage(messageId, newContent);
              setMessagesByChat((prev) => ({
                ...prev,
                [res.message.chatId]: (prev[res.message.chatId] || []).map((m) =>
                  m.id === messageId ? res.message : m
                ),
              }));
            }}
            onDeleteMessage={async (messageId) => {
              await api.deleteMessage(messageId);
            }}
            onToggleStar={async (messageId) => {
              const res = await api.toggleStarMessage(messageId);
              if (selectedChat) {
                setMessagesByChat((prev) => ({
                  ...prev,
                  [selectedChat.id]: (prev[selectedChat.id] || []).map((m) =>
                    m.id === messageId ? { ...m, isStarred: res.starred } : m
                  ),
                }));
              }
            }}
            onPinMessage={async (chatId, messageId) => {
              const res = await api.pinMessageInChat(chatId, messageId);
              setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, pinnedMessage: res.pinnedMessage } : c)));
            }}
            onForwardMessage={async (messageId, targetChatIds) => {
              await api.forwardMessage(messageId, targetChatIds);
            }}
            onCreatePoll={async (chatId, question, options, allowMultiple) => {
              await api.createPoll(chatId, question, options, allowMultiple);
            }}
            onVotePoll={async (messageId, optionId) => {
              await api.votePoll(messageId, optionId);
            }}
            onTogglePin={async (chatId) => {
              const res = await api.togglePinChat(chatId);
              setChats((prev) =>
                prev
                  .map((c) => (c.id === chatId ? { ...c, pinned: res.pinned } : c))
                  .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt))
              );
            }}
            onToggleMute={async (chatId) => {
              const res = await api.toggleMuteChat(chatId);
              setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, muted: res.muted } : c)));
            }}
            onToggleArchive={async (chatId) => {
              const res = await api.toggleArchiveChat(chatId);
              setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, archived: res.archived } : c)));
            }}
            onSetDisappearing={async (chatId, ttlSec) => {
              const res = await api.setDisappearingTimer(chatId, ttlSec);
              setChats((prev) =>
                prev.map((c) => (c.id === chatId ? { ...c, disappearingTtlSec: res.disappearingTtlSec } : c))
              );
            }}
            onStartCall={(mode) => {
              if (!selectedChat?.peerUser) return;
              socketRef.current?.emit(SOCKET_EVENTS.CALL_INVITE, {
                targetUserId: selectedChat.peerUser.id,
                chatId: selectedChat.id,
                mode,
                callerName: session.user.displayName,
                callerAvatar: session.user.avatarUrl,
              });
              setActiveCall({
                direction: 'outgoing',
                status: 'ringing',
                mode,
                peerId: selectedChat.peerUser.id,
                peerName: selectedChat.peerUser.displayName,
                peerAvatar: selectedChat.peerUser.avatarUrl,
                chatId: selectedChat.id,
              });
            }}
          />
        </>
      )}

      {activeTab === 'discover' && (
        <DiscoverView
          candidates={candidates}
          likesReceived={likesReceived}
          boost={boost}
          onSwipe={async (targetUserId, action) => {
            const result = await api.swipe(targetUserId, action);
            setCandidates((prev) => prev.filter((c) => c.user.id !== targetUserId));
            setLikesReceived((prev) => prev.filter((l) => l.user.id !== targetUserId));
            if (result.matched) {
              const chatsRes = await api.listChats();
              setChats(chatsRes.chats);
            }
            return result;
          }}
          onRewind={async () => {
            try {
              const res = await api.rewindSwipe();
              setCandidates((prev) => [res.candidate, ...prev.filter((c) => c.user.id !== res.candidate.user.id)]);
            } catch (err) {
              alert(err instanceof Error ? err.message : 'Nenhum perfil recente para voltar.');
            }
          }}
          onActivateBoost={async () => {
            const res = await api.activateBoost();
            setBoost(res.boost);
          }}
          onApplyFilters={async (filters) => {
            const res = await api.getDiscover(filters);
            setCandidates(res.candidates);
            setBoost(res.boost);
          }}
          onOpenChat={(chatId) => {
            setSelectedChatId(chatId);
            setActiveTab('chats');
          }}
        />
      )}

      {activeTab === 'feed' && (
        <FeedView
          posts={posts}
          onToggleLike={async (postId) => {
            const res = await api.toggleLike(postId);
            setPosts((prev) =>
              prev.map((p) => (p.id === postId ? { ...p, likedByMe: res.liked, likesCount: res.likesCount } : p))
            );
          }}
          onAddComment={async (postId, content) => {
            await api.addComment(postId, content);
            const res = await api.getPosts();
            setPosts(res.posts);
          }}
          onCreatePost={async (imageUrl, caption, location) => {
            await api.createPost(imageUrl, caption, location);
            const res = await api.getPosts();
            setPosts(res.posts);
          }}
          onStartChat={async (userId) => {
            if (userId === session.user.id) return;
            const direct = await api.createDirectChat(userId);
            const chatsRes = await api.listChats();
            setChats(chatsRes.chats);
            setSelectedChatId(direct.chatId);
            setActiveTab('chats');
          }}
        />
      )}

      {activeStoryGroup && (
        <StoryViewerModal
          group={activeStoryGroup}
          currentUserId={session.user.id}
          onClose={() => setActiveStoryGroup(null)}
          onViewStory={(storyId) => {
            api.viewStory(storyId).catch(() => {});
          }}
          onReplyStory={async (storyId, targetUserId, content) => {
            await api.replyToStory(storyId, targetUserId, content);
            const chatsRes = await api.listChats();
            setChats(chatsRes.chats);
          }}
        />
      )}

      {showDevices && (
        <LinkedDevicesModal
          devices={devices}
          currentSessionId={session.sessionId}
          onClose={() => setShowDevices(false)}
          onRevoke={async (sid) => {
            await api.revokeDevice(sid);
            if (sid === session.sessionId) {
              clearSession();
              return;
            }
            const res = await api.getDevices();
            setDevices(res.devices);
          }}
        />
      )}

      {/* Active Call Modal (Audio / Video) */}
      {activeCall && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0D1520] border border-[#1E3248] rounded-3xl max-w-sm w-full p-8 text-center shadow-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00D4FF]/15 text-[#00D4FF] text-xs font-semibold mb-4">
              {activeCall.mode === 'video' ? <Video className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
              {activeCall.mode === 'video' ? 'Chamada de Vídeo' : 'Chamada de Voz'}
            </div>
            {activeCall.peerAvatar && (
              <img src={activeCall.peerAvatar} alt={activeCall.peerName} className="w-24 h-24 rounded-full object-cover mx-auto border-4 border-[#00D4FF]/50 mb-4" />
            )}
            <h3 className="text-xl font-bold text-white">{activeCall.peerName}</h3>
            <p className="text-sm text-[#8BA4BE] mt-1 mb-8">
              {activeCall.status === 'connected'
                ? 'Conectado • 00:01'
                : activeCall.direction === 'incoming'
                  ? 'Chamando você...'
                  : 'Chamando...'}
            </p>

            <div className="flex items-center justify-center gap-5">
              {activeCall.direction === 'incoming' && activeCall.status === 'ringing' && (
                <button
                  onClick={() => {
                    socketRef.current?.emit(SOCKET_EVENTS.CALL_ACCEPT, {
                      targetUserId: activeCall.peerId,
                      chatId: activeCall.chatId,
                    });
                    setActiveCall((prev) => (prev ? { ...prev, status: 'connected' } : null));
                  }}
                  className="w-14 h-14 rounded-full bg-[#00D4FF] text-[#0D1520] flex items-center justify-center shadow-lg hover:scale-105 transition"
                >
                  <Phone className="w-6 h-6" />
                </button>
              )}

              <button
                onClick={() => {
                  const evt =
                    activeCall.direction === 'incoming' && activeCall.status === 'ringing'
                      ? SOCKET_EVENTS.CALL_REJECT
                      : SOCKET_EVENTS.CALL_END;
                  socketRef.current?.emit(evt, {
                    targetUserId: activeCall.peerId,
                    chatId: activeCall.chatId,
                  });
                  setActiveCall(null);
                }}
                className="w-14 h-14 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-lg hover:scale-105 transition"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
