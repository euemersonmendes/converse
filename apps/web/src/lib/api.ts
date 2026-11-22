import type {
  AuthSession,
  BoostStatus,
  ChatSummary,
  DeviceSession,
  DiscoverCandidate,
  DiscoverFilters,
  FeedPost,
  MatchResult,
  MessageItem,
  PairingSession,
  ReceivedLikeItem,
  StoryGroup,
} from '@converse/shared';

const API_BASE = import.meta.env.VITE_API_URL || '';

function getToken(): string | null {
  return localStorage.getItem('converse_web_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Erro na requisição') as Error & { code?: string; status?: number };
    err.code = data.code;
    err.status = res.status;
    throw err;
  }
  return data as T;
}

export const api = {
  // Pairing & Auth
  createPairingSession: (webDeviceName: string) =>
    request<PairingSession>('/api/pairing/session', {
      method: 'POST',
      body: JSON.stringify({ webDeviceName }),
    }),

  getPairingStatus: (pairingId: string) =>
    request<{ status: PairingSession['status']; session?: AuthSession }>(`/api/pairing/session/${pairingId}`),

  getMe: () => request<{ user: AuthSession['user']; sessionId: string }>('/api/auth/me'),

  getDevices: () => request<{ devices: DeviceSession[] }>('/api/pairing/devices'),

  revokeDevice: (sessionId: string) =>
    request<{ revoked: boolean }>(`/api/pairing/devices/${sessionId}`, { method: 'DELETE' }),

  // Chats
  listChats: () => request<{ chats: ChatSummary[] }>('/api/chats'),

  createDirectChat: (peerUserId: string) =>
    request<{ chatId: string; chat: ChatSummary | null }>('/api/chats/direct', {
      method: 'POST',
      body: JSON.stringify({ peerUserId }),
    }),

  getMessages: (chatId: string) => request<{ messages: MessageItem[] }>(`/api/chats/${chatId}/messages`),

  sendMessage: (
    chatId: string,
    payload: {
      type?: 'text' | 'image' | 'audio' | 'story_reply';
      content: string;
      mediaUrl?: string | null;
      audioDurationSec?: number | null;
      replyToId?: string | null;
      clientMessageId?: string;
    }
  ) =>
    request<{ message: MessageItem }>(`/api/chats/${chatId}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  markRead: (chatId: string) => request<{ updatedIds: string[] }>(`/api/chats/${chatId}/read`, { method: 'POST' }),

  togglePinChat: (chatId: string) => request<{ pinned: boolean }>(`/api/chats/${chatId}/pin`, { method: 'POST' }),

  toggleArchiveChat: (chatId: string) =>
    request<{ archived: boolean }>(`/api/chats/${chatId}/archive`, { method: 'POST' }),

  toggleMuteChat: (chatId: string) => request<{ muted: boolean }>(`/api/chats/${chatId}/mute`, { method: 'POST' }),

  setDisappearingTimer: (chatId: string, ttlSec: number | null) =>
    request<{ disappearingTtlSec: number | null }>(`/api/chats/${chatId}/disappearing`, {
      method: 'POST',
      body: JSON.stringify({ ttlSec }),
    }),

  pinMessageInChat: (chatId: string, messageId: string | null) =>
    request<{ pinnedMessage: ChatSummary['pinnedMessage'] }>(`/api/chats/${chatId}/pin-message`, {
      method: 'POST',
      body: JSON.stringify({ messageId }),
    }),

  editMessage: (messageId: string, content: string) =>
    request<{ message: MessageItem }>(`/api/chats/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    }),

  deleteMessage: (messageId: string) =>
    request<{ deleted: boolean }>(`/api/chats/messages/${messageId}`, { method: 'DELETE' }),

  toggleStarMessage: (messageId: string) =>
    request<{ starred: boolean }>(`/api/chats/messages/${messageId}/star`, { method: 'POST' }),

  getStarredMessages: () => request<{ messages: MessageItem[] }>('/api/chats/starred'),

  forwardMessage: (messageId: string, targetChatIds: string[]) =>
    request<{ messages: MessageItem[] }>(`/api/chats/messages/${messageId}/forward`, {
      method: 'POST',
      body: JSON.stringify({ targetChatIds }),
    }),

  createPoll: (chatId: string, question: string, options: string[], allowMultiple = false) =>
    request<{ message: MessageItem }>(`/api/chats/${chatId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'poll',
        content: `📊 Enquete: ${question}`,
        poll: { question, options, allowMultiple },
      }),
    }),

  votePoll: (messageId: string, optionId: string) =>
    request<{ chatId: string; poll: MessageItem['poll'] }>(`/api/chats/messages/${messageId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ optionId }),
    }),

  reactToMessage: (messageId: string, emoji: string) =>
    request<{ chatId: string; reactions: MessageItem['reactions'] }>(`/api/chats/messages/${messageId}/react`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    }),

  // Discover / Match (Tinder-grade)
  getDiscover: (filters?: DiscoverFilters) => {
    const params = new URLSearchParams();
    if (filters?.minAge) params.set('minAge', String(filters.minAge));
    if (filters?.maxAge) params.set('maxAge', String(filters.maxAge));
    if (filters?.maxDistanceKm) params.set('maxDistanceKm', String(filters.maxDistanceKm));
    if (filters?.lookingFor) params.set('lookingFor', filters.lookingFor);
    const qs = params.toString();
    return request<{ candidates: DiscoverCandidate[]; boost: BoostStatus }>(`/api/discover${qs ? `?${qs}` : ''}`);
  },

  getLikesReceived: () => request<{ likes: ReceivedLikeItem[] }>('/api/discover/likes-received'),

  rewindSwipe: () => request<{ candidate: DiscoverCandidate }>('/api/discover/rewind', { method: 'POST' }),

  activateBoost: () => request<{ boost: BoostStatus }>('/api/discover/boost', { method: 'POST' }),

  swipe: (targetUserId: string, action: 'like' | 'super_spark' | 'pass') =>
    request<MatchResult>('/api/discover/swipe', {
      method: 'POST',
      body: JSON.stringify({ targetUserId, action }),
    }),

  // Social
  getStories: () => request<{ groups: StoryGroup[] }>('/api/social/stories'),

  createStory: (mediaUrl: string, caption?: string) =>
    request('/api/social/stories', {
      method: 'POST',
      body: JSON.stringify({ mediaUrl, caption }),
    }),

  viewStory: (storyId: string) => request(`/api/social/stories/${storyId}/view`, { method: 'POST' }),

  replyToStory: (storyId: string, targetUserId: string, content: string) =>
    request<{ chatId: string }>(`/api/social/stories/${storyId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ targetUserId, content }),
    }),

  getPosts: () => request<{ posts: FeedPost[] }>('/api/social/posts'),

  createPost: (imageUrl: string, caption: string, location?: string) =>
    request<{ post: FeedPost }>('/api/social/posts', {
      method: 'POST',
      body: JSON.stringify({ imageUrl, caption, location }),
    }),

  toggleLike: (postId: string) =>
    request<{ liked: boolean; likesCount: number }>(`/api/social/posts/${postId}/like`, { method: 'POST' }),

  addComment: (postId: string, content: string) =>
    request(`/api/social/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  getPeople: () =>
    request<{ people: Array<AuthSession['user'] & { isFollowing: boolean }> }>('/api/social/people'),

  toggleFollow: (userId: string) =>
    request<{ following: boolean }>(`/api/social/follow/${userId}`, { method: 'POST' }),
};
