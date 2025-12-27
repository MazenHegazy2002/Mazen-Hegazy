
export enum MessageType {
  TEXT = 'TEXT',
  VOICE = 'VOICE',
  STICKER = 'STICKER',
  IMAGE = 'IMAGE',
  SYSTEM = 'SYSTEM'
}

export enum MessageStatus {
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ'
}

export interface Reaction {
  emoji: string;
  userId: string;
}

export interface User {
  id: string;
  name: string;
  phone: string;
  avatar: string;
  status: 'online' | 'offline' | 'last seen recently';
}

export interface PrivacySettings {
  lastSeen: 'Everyone' | 'My Contacts' | 'Nobody';
  profilePhoto: 'Everyone' | 'My Contacts' | 'Nobody';
  readReceipts: boolean;
  activeStatus: boolean;
  proxyEnabled: boolean;
  // Translation Settings
  translationEnabled: boolean;
  targetLanguage: string;
  translateAll: boolean;
  specificSourceLanguages: string[];
}

export interface Message {
  id: string;
  senderId: string;
  content: string;
  type: MessageType;
  timestamp: Date;
  duration?: number;
  reactions?: Reaction[];
  status?: MessageStatus;
  translation?: string;
  isEncrypted?: boolean;
}

export interface PlaybackState {
  messageId: string | null;
  chatId: string | null;
  senderName: string | null;
  senderAvatar: string | null;
  content: string | null;
  isPlaying: boolean;
}

export interface CallLog {
  id: string;
  user: User;
  type: 'voice' | 'video';
  direction: 'incoming' | 'outgoing' | 'missed';
  timestamp: Date;
  duration?: number;
}

export interface Chat {
  id: string;
  participants: User[];
  name?: string;
  avatar?: string;
  lastMessage?: Message;
  unreadCount: number;
  isGroup?: boolean;
  isPinned?: boolean;
  isMuted?: boolean;
  isArchived?: boolean;
  folder?: 'All' | 'Personal' | 'Groups' | 'Unread' | 'Secure';
  encryptionFingerprint?: string;
}

export interface StatusUpdate {
  userId: string;
  imageUrl: string;
  timestamp: Date;
  caption?: string;
}

export type AppView = 'chats' | 'calls' | 'status' | 'settings' | 'secure';
