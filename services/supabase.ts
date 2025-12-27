
import { createClient } from '@supabase/supabase-js';

// Connection Configuration
const SUPABASE_URL = "https://rqvoqztaslbzhxlqgkvn.supabase.co"; 
const SUPABASE_ANON_KEY = "sb_publishable_uFIV--uEdZ7XUkyLnHcl1w_ShTCnGt3";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Zylos Production Helper: Standardized Chat ID Generation
 * Ensures Room Parity across all devices.
 */
export const getChatRoomId = (userId1: string, userId2: string) => {
  return [userId1, userId2].sort().join('--');
};

const isValidUUID = (uuid: string) => {
  if (!uuid) return false;
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return regex.test(uuid);
};

export const cloudSync = {
  checkHealth: async () => {
    try {
      const { error } = await supabase.from('profiles').select('id').limit(1);
      if (error) return { ok: false, message: "Registry Offline" };
      return { ok: true, message: "Neural Link Active" };
    } catch {
      return { ok: false, message: "Link Severed" };
    }
  },

  upsertProfile: async (user: any) => {
    if (!isValidUUID(user.id)) return user;
    try {
      const { data, error } = await supabase.from('profiles').upsert({
        id: user.id,
        phone: user.phone,
        name: user.name,
        avatar: user.avatar,
        status: 'online',
        last_seen: new Date().toISOString()
      }).select();
      return data?.[0] || user;
    } catch (e) {
      return user;
    }
  },

  getProfileByPhone: async (phone: string) => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('phone', phone).maybeSingle();
      return data;
    } catch {
      return null;
    }
  },

  searchProfiles: async (query: string, phoneMatch: string) => {
    try {
      const { data, error } = await supabase.from('profiles')
        .select('*')
        .or(`name.ilike.%${query}%,phone.eq.${phoneMatch}`)
        .limit(10);
      return data || [];
    } catch {
      return [];
    }
  },

  findRegisteredUsers: async (phones: string[]) => {
    if (!phones.length) return [];
    try {
      const { data, error } = await supabase.from('profiles').select('*').in('phone', phones);
      return data || [];
    } catch {
      return [];
    }
  },

  pushMessage: async (chatId: string, senderId: string, msg: any, recipientId?: string) => {
    if (!isValidUUID(senderId)) return;
    try {
      const payload: any = {
        chat_id: String(chatId), 
        sender_id: senderId, 
        content: msg.content,
        type: msg.type || 'TEXT',
        timestamp: new Date().toISOString()
      };
      if (recipientId && isValidUUID(recipientId)) payload.recipient_id = recipientId;
      await supabase.from('messages').insert(payload);
    } catch (err) {
      console.error("[Zylos] Relay Failure:", err);
    }
  },

  fetchMessages: async (chatId: string) => {
    try {
      const { data, error } = await supabase.from('messages')
        .select('*')
        .eq('chat_id', String(chatId))
        .order('timestamp', { ascending: true })
        .limit(200);
      return data || [];
    } catch {
      return [];
    }
  },

  // FIX: Added subscribeToChat to handle room-specific message updates
  subscribeToChat: (chatId: string, userId: string, callback: (payload: any) => void) => {
    try {
      const channel = supabase.channel(`chat_room_${chatId}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages', 
          filter: `chat_id=eq.${chatId}` 
        }, (payload) => {
          if (payload.new.sender_id !== userId) {
            callback(payload.new);
          }
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    } catch {
      return () => {};
    }
  },

  /**
   * Global listener for any message intended for this user.
   * This is what makes it a "real app" - updates chats even when not looking at them.
   */
  subscribeToGlobalMessages: (userId: string, callback: (payload: any) => void) => {
    if (!isValidUUID(userId)) return () => {};
    try {
      const channel = supabase.channel(`global_user_${userId}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages', 
          filter: `recipient_id=eq.${userId}` 
        }, (payload) => {
          callback(payload.new);
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    } catch {
      return () => {};
    }
  },

  pushStatus: async (userId: string, status: { imageUrl: string; caption?: string }) => {
    if (!isValidUUID(userId)) return;
    try {
      await supabase.from('statuses').insert({
        user_id: userId,
        image_url: status.imageUrl,
        caption: status.caption,
        timestamp: new Date().toISOString()
      });
    } catch (err) {}
  },

  fetchStatuses: async () => {
    try {
      const { data, error } = await supabase.from('statuses')
        .select('*, profiles:user_id(name, avatar, phone)')
        .order('timestamp', { ascending: false })
        .limit(50);
      return data || [];
    } catch {
      return [];
    }
  },

  subscribeToStatuses: (callback: (payload: any) => void) => {
    try {
      const channel = supabase.channel('global_broadcast')
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'statuses' 
        }, (payload) => callback(payload.new))
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    } catch {
      return () => {};
    }
  }
};
