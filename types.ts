
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
  duration?: number; // for voice notes
  reactions?: Reaction[];
  status?: MessageStatus; // for read receipts
  translation?: string; // Translated content
  isEncrypted?: boolean;
}

export interface CallLog {
  id: string;
  user: User;
  type: 'voice' | 'video';
  direction: 'incoming' | 'outgoing' | 'missed';
  timestamp: Date;
  duration?: number; // in seconds
}

export interface Chat {
  id: string;
  participants: User[];
  name?: string; // For groups
  avatar?: string; // For groups
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
