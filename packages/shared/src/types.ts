export type PresenceStatus = 'online' | 'offline';

export type MessageType = 'text' | 'image' | 'audio' | 'story_reply' | 'match_intro' | 'poll';

export interface PollOption {
  id: string;
  text: string;
  voterIds: string[];
}

export interface PollData {
  question: string;
  allowMultiple: boolean;
  options: PollOption[];
}

export type MessageDeliveryStatus = 'sent' | 'delivered' | 'read';

export type DevicePlatform = 'mobile_ios' | 'mobile_android' | 'web_chrome' | 'web_safari' | 'web_browser';

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  phone: string;
  avatarUrl: string;
  bio: string;
  age: number;
  city: string;
  interests: string[];
  verified: boolean;
  isOnline: boolean;
  lastSeenAt: string;
  lookingFor: 'relationship' | 'friendship' | 'networking' | 'all';
}

export interface AuthSession {
  token: string;
  sessionId: string;
  deviceId: string;
  platform: DevicePlatform;
  user: UserProfile;
}

export interface DeviceSession {
  id: string;
  userId: string;
  deviceId: string;
  deviceName: string;
  platform: DevicePlatform;
  isPrimary: boolean;
  lastActiveAt: string;
  createdAt: string;
  revokedAt: string | null;
}

export interface PairingSession {
  pairingId: string;
  pairingCode: string; // 8-character human-enterable code (e.g., "ABCD-1234")
  qrPayload: string;   // JSON or URI payload encoded in QR
  expiresAt: string;
  status: 'pending' | 'approved' | 'expired';
}

export interface MessageReaction {
  emoji: string;
  userId: string;
  userDisplayName: string;
}

export interface MessageItem {
  id: string;
  clientMessageId?: string;
  chatId: string;
  senderId: string;
  type: MessageType;
  content: string;
  mediaUrl?: string | null;
  audioDurationSec?: number | null;
  replyToId?: string | null;
  replyToPreview?: {
    id: string;
    senderName: string;
    content: string;
    type: MessageType;
  } | null;
  status: MessageDeliveryStatus;
  reactions: MessageReaction[];
  editedAt?: string | null;
  deletedAt?: string | null;
  isStarred?: boolean;
  isForwarded?: boolean;
  expiresAt?: string | null;
  poll?: PollData | null;
  createdAt: string;
}

export interface ChatSummary {
  id: string;
  isGroup: boolean;
  isSavedMessages?: boolean;
  title: string;
  avatarUrl: string;
  peerUser?: UserProfile | null;
  lastMessage?: MessageItem | null;
  unreadCount: number;
  pinned: boolean;
  muted: boolean;
  archived: boolean;
  disappearingTtlSec: number | null;
  pinnedMessage?: Pick<MessageItem, 'id' | 'content' | 'type' | 'senderId'> | null;
  updatedAt: string;
}

export interface StoryItem {
  id: string;
  userId: string;
  user: Pick<UserProfile, 'id' | 'username' | 'displayName' | 'avatarUrl' | 'verified'>;
  mediaUrl: string;
  caption?: string | null;
  backgroundColor?: string | null;
  viewedByMe: boolean;
  viewCount: number;
  createdAt: string;
  expiresAt: string;
}

export interface StoryGroup {
  user: Pick<UserProfile, 'id' | 'username' | 'displayName' | 'avatarUrl' | 'verified'>;
  hasUnseen: boolean;
  stories: StoryItem[];
}

export interface FeedComment {
  id: string;
  postId: string;
  userId: string;
  user: Pick<UserProfile, 'id' | 'username' | 'displayName' | 'avatarUrl'>;
  content: string;
  createdAt: string;
}

export interface FeedPost {
  id: string;
  userId: string;
  user: Pick<UserProfile, 'id' | 'username' | 'displayName' | 'avatarUrl' | 'verified' | 'city'>;
  imageUrl: string;
  caption: string;
  location?: string | null;
  likesCount: number;
  likedByMe: boolean;
  commentsCount: number;
  recentComments: FeedComment[];
  createdAt: string;
}

export interface DiscoverCandidate {
  user: UserProfile;
  compatibilityScore: number;
  sharedInterests: string[];
  distanceKm: number;
  photos: string[];
  isBoosted?: boolean;
}

export interface DiscoverFilters {
  minAge?: number;
  maxAge?: number;
  maxDistanceKm?: number;
  lookingFor?: 'relationship' | 'friendship' | 'networking' | 'all';
}

export interface ReceivedLikeItem {
  user: UserProfile;
  action: 'like' | 'super_spark';
  likedAt: string;
}

export interface BoostStatus {
  active: boolean;
  expiresAt: string | null;
}

export interface MatchResult {
  matched: boolean;
  matchId?: string;
  chatId?: string;
  matchedUser?: UserProfile;
}

export const SOCKET_EVENTS = {
  // Pairing (WhatsApp Web style)
  PAIRING_JOIN: 'pairing:join',
  PAIRING_APPROVED: 'pairing:approved',
  SESSION_REVOKED: 'session:revoked',

  // Presence & Typing
  PRESENCE_UPDATE: 'presence:update',
  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',

  // Messaging
  CHAT_JOIN: 'chat:join',
  MESSAGE_SEND: 'message:send',
  MESSAGE_NEW: 'message:new',
  MESSAGE_STATUS: 'message:status',
  MESSAGE_REACT: 'message:react',
  MESSAGE_REACTION_UPDATED: 'message:reaction_updated',
  MESSAGE_EDIT: 'message:edit',
  MESSAGE_EDITED: 'message:edited',
  MESSAGE_DELETE: 'message:delete',
  MESSAGE_DELETED: 'message:deleted',
  CHAT_MESSAGE_PINNED: 'chat:message_pinned',
  POLL_UPDATED: 'poll:updated',

  // Calls (Audio / Video signaling)
  CALL_INVITE: 'call:invite',
  CALL_ACCEPT: 'call:accept',
  CALL_REJECT: 'call:reject',
  CALL_END: 'call:end',

  // Social / Match
  MATCH_NEW: 'match:new',
} as const;
