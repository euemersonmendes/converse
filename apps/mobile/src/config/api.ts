import { Platform } from 'react-native';
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
  ReceivedLikeItem,
  StoryGroup,
} from '@converse/shared';

const PRODUCTION_API_URL = 'https://converse-api-diyo.onrender.com';
const LAN_FALLBACK_URL = 'http://192.168.3.233:3001';

export let API_URL = process.env.EXPO_PUBLIC_API_URL || PRODUCTION_API_URL;

export function setApiUrl(url: string) {
  API_URL = url.trim().replace(/\/+$/, '');
}

let authToken: string | null = null;

export function setMobileAuthToken(token: string | null) {
  authToken = token;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch (networkErr) {
    // Fallback automático entre localhost (Simulador) e IP LAN (iPhone físico)
    if (Platform.OS === 'ios' && API_URL !== LAN_FALLBACK_URL) {
      res = await fetch(`${LAN_FALLBACK_URL}${path}`, { ...options, headers });
      API_URL = LAN_FALLBACK_URL;
    } else {
      throw networkErr;
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detailText = Array.isArray(data.details)
      ? data.details.map((d: any) => `${d.path}: ${d.message}`).join(' | ')
      : '';
    throw new Error(detailText ? `${data.error} (${detailText})` : data.error || 'Erro de rede');
  }
  return data as T;
}

export const mobileApi = {
  login: (identifier: string, password: string) =>
    request<AuthSession>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier,
        password,
        deviceId: `mobile-${Platform.OS}`,
        deviceName: Platform.OS === 'ios' ? 'iPhone (Converse App)' : 'Android (Converse App)',
        platform: Platform.OS === 'ios' ? 'mobile_ios' : 'mobile_android',
      }),
    }),

  register: (payload: {
    username: string;
    displayName: string;
    phone: string;
    password: string;
    age?: number;
    city?: string;
    bio?: string;
    avatarUrl?: string;
  }) =>
    request<AuthSession>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        deviceId: `mobile-${Platform.OS}`,
        deviceName: Platform.OS === 'ios' ? 'iPhone (Converse App)' : 'Android (Converse App)',
        platform: Platform.OS === 'ios' ? 'mobile_ios' : 'mobile_android',
      }),
    }),

  forgotPassword: (identifier: string) =>
    request<{ sent: boolean; maskedPhone?: string; channel?: 'twilio' | 'webhook' | 'dev'; devCode?: string }>(
      '/api/auth/forgot-password',
      {
        method: 'POST',
        body: JSON.stringify({ identifier }),
      }
    ),

  resetPassword: (payload: { identifier: string; code: string; newPassword: string }) =>
    request<{ reset: boolean }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  listChats: () => request<{ chats: ChatSummary[] }>('/api/chats'),
  createDirectChat: (peerUserId: string) =>
    request<{ chatId: string; chat: ChatSummary | null }>('/api/chats/direct', {
      method: 'POST',
      body: JSON.stringify({ peerUserId }),
    }),
  getPeople: () =>
    request<{ people: Array<AuthSession['user'] & { isFollowing: boolean }> }>('/api/social/people'),
  toggleFollow: (userId: string) =>
    request<{ following: boolean }>(`/api/social/follow/${userId}`, { method: 'POST' }),
  getMessages: (chatId: string) => request<{ messages: MessageItem[] }>(`/api/chats/${chatId}/messages`),
  markRead: (chatId: string) => request(`/api/chats/${chatId}/read`, { method: 'POST' }),
  sendMessage: (chatId: string, content: string, replyToId?: string | null) =>
    request<{ message: MessageItem }>(`/api/chats/${chatId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        content,
        replyToId,
        clientMessageId: `mob-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      }),
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
  pinMessageInChat: (chatId: string, messageId: string | null) =>
    request(`/api/chats/${chatId}/pin-message`, {
      method: 'POST',
      body: JSON.stringify({ messageId }),
    }),
  createPoll: (chatId: string, question: string, options: string[]) =>
    request<{ message: MessageItem }>(`/api/chats/${chatId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'poll',
        content: `📊 Enquete: ${question}`,
        poll: { question, options, allowMultiple: false },
      }),
    }),
  votePoll: (messageId: string, optionId: string) =>
    request<{ chatId: string; poll: MessageItem['poll'] }>(`/api/chats/messages/${messageId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ optionId }),
    }),
  setDisappearingTimer: (chatId: string, ttlSec: number | null) =>
    request(`/api/chats/${chatId}/disappearing`, {
      method: 'POST',
      body: JSON.stringify({ ttlSec }),
    }),

  getStories: () => request<{ groups: StoryGroup[] }>('/api/social/stories'),
  getPosts: () => request<{ posts: FeedPost[] }>('/api/social/posts'),
  toggleLike: (postId: string) =>
    request<{ liked: boolean; likesCount: number }>(`/api/social/posts/${postId}/like`, { method: 'POST' }),

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

  approvePairing: (payload: { pairingId?: string; pairingCode?: string }) =>
    request<{ approved: boolean }>('/api/pairing/approve', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getDevices: () => request<{ devices: DeviceSession[] }>('/api/pairing/devices'),
  revokeDevice: (sessionId: string) =>
    request<{ revoked: boolean }>(`/api/pairing/devices/${sessionId}`, { method: 'DELETE' }),
};
