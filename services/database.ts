
import { User, Chat, Message } from '../types';
import { cloudSync } from './supabase';

const KEYS = {
  USER: 'zylos_current_user',
  CHATS: 'zylos_chats',
  CONTACTS: 'zylos_contacts',
};

const API_DELAY = 400;

export const DB = {
  // --- USER OPERATIONS ---
  saveUser: async (user: User): Promise<void> => {
    // 1. Save Locally for offline access
    localStorage.setItem(KEYS.USER, JSON.stringify(user));
    
    // 2. Sync to Online Cloud
    await cloudSync.upsertProfile({
      id: user.id,
      name: user.name,
      phone: user.phone,
      avatar: user.avatar,
      status: user.status
    });
  },
  
  getUser: async (): Promise<User | null> => {
    const data = localStorage.getItem(KEYS.USER);
    return data ? JSON.parse(data) : null;
  },

  // --- CONTACT DISCOVERY ---
  discoverContacts: async (localPhones: string[]): Promise<User[]> => {
    // Queries the Online Registry to see who has signed up
    return await cloudSync.findRegisteredUsers(localPhones);
  },

  // --- CHAT & MESSAGE OPERATIONS ---
  saveChats: async (chats: Chat[]): Promise<void> => {
    localStorage.setItem(KEYS.CHATS, JSON.stringify(chats));
    // In a real app, you'd only sync the *diffs* to the cloud here
  },
  
  getChats: async (): Promise<Chat[]> => {
    const data = localStorage.getItem(KEYS.CHATS);
    return data ? JSON.parse(data) : [];
  },

  sendMessage: async (chatId: string, message: Message): Promise<void> => {
    // This is the core "Online" step: Pushing the message to the central DB
    await cloudSync.pushMessage(chatId, message);
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
