import { User, Chat } from '../types';
import { cloudSync } from './supabase';

const KEYS = {
  USER: 'zylos_current_user',
  CHATS: 'zylos_chats',
  CONTACTS: 'zylos_contacts',
};

export const DB = {
  saveUser: async (user: User): Promise<void> => {
    localStorage.setItem(KEYS.USER, JSON.stringify(user));
    if (user.id && user.id !== 'me') {
      await cloudSync.upsertProfile(user);
    }
  },
  
  getUser: async (): Promise<User | null> => {
    const data = localStorage.getItem(KEYS.USER);
    return data ? JSON.parse(data) : null;
  },

  discoverContacts: async (localPhones: string[]): Promise<User[]> => {
    return await cloudSync.findRegisteredUsers(localPhones);
  },

  saveChats: async (chats: Chat[]): Promise<void> => {
    // Only save real chats to local storage, filter out temporary UI states
    const persistenceChats = chats.map(c => ({
      ...c,
      unreadCount: c.unreadCount || 0
    }));
    localStorage.setItem(KEYS.CHATS, JSON.stringify(persistenceChats));
  },
  
  getChats: async (): Promise<Chat[]> => {
    const data = localStorage.getItem(KEYS.CHATS);
    if (!data) return [];
    try {
      const parsed = JSON.parse(data) as Chat[];
      // Hydrate Dates
      return parsed.map(chat => {
        if (chat.lastMessage && chat.lastMessage.timestamp) {
          chat.lastMessage.timestamp = new Date(chat.lastMessage.timestamp);
        }
        return chat;
      });
    } catch (e) {
      console.error("Failed to load local chats", e);
      return [];
    }
  },

  sendMessage: async (chatId: string, authUserId: string, message: any, recipientId?: string): Promise<void> => {
    await cloudSync.pushMessage(chatId, authUserId, message, recipientId);
  },

  saveContacts: async (users: User[]): Promise<void> => {
    localStorage.setItem(KEYS.CONTACTS, JSON.stringify(users));
  },
  
  getContacts: async (): Promise<User[]> => {
    const data = localStorage.getItem(KEYS.CONTACTS);
    return data ? JSON.parse(data) : [];
  },

  clearAll: () => localStorage.clear()
};