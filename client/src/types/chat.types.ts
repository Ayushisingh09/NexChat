export interface User {
  id: string;
  email?: string;
  phone?: string;
  username?: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  isOnline: boolean;
  lastSeen: string;
  lastSeenVisibility?: 'EVERYONE' | 'NOBODY';
  showEmail?: boolean;
  isPublic?: boolean;
  readReceiptsEnabled?: boolean;
  notificationsEnabled?: boolean;
  notificationSound?: boolean;
  role?: 'MEMBER' | 'ADMIN';
  createdAt?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'FILE' | 'POLL';
  mediaUrl?: string;
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  createdAt: string;
  replyTo?: Message | null;
  isDeleted?: boolean;
  isExpired?: boolean;
  forwardedFromId?: string | null;
  reactions?: MessageReaction[];
  editedAt?: string | null;
  starred?: boolean;
  mentionedUserIds?: string[];
  expiresAt?: string | null;
  scheduledAt?: string | null;
  pinnedAt?: string | null;
  pinnedById?: string | null;
  pollOptionCount?: number | null;
  pollVotes?: PollVote[];
  sender?: {
    id: string;
    displayName: string | null;
    avatar?: string | null;
  };
}

export interface PollVote {
  userId: string;
  optionIndex: number;
}

export interface PollData {
  question: string;
  options: string[];
}

export interface ReadReceiptUser {
  id: string;
  displayName: string | null;
  avatar: string | null;
}

export interface MessageReaction {
  emoji: string;
  userId: string;
}

export interface Conversation {
  id: string;
  type: 'DIRECT' | 'GROUP';
  name?: string;
  avatar?: string;
  participants: User[];
  lastMessage?: Message;
  unreadCount: number;
  updatedAt: string;
  pinnedAt?: string | null;
  mutedUntil?: string | null;
  archivedAt?: string | null;
  disappearingTtlSeconds?: number | null;
  description?: string | null;
  isAnnouncementMode?: boolean;
  requiresApproval?: boolean;
  isPublic?: boolean;
  invitePermission?: string;
  messagePermission?: string;
  editPermission?: string;
  notificationPreference?: 'ALL' | 'MENTIONS_ONLY' | 'MUTE';
}
