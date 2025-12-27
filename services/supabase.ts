
import { createClient } from '@supabase/supabase-js';

/**
 * Zylos Core Cloud Engine
 * Optimized for Public Launch with RLS Security
 */

const SUPABASE_URL = "https://rqvoqztaslbzhxlqgkvn.supabase.co"; 
const SUPABASE_ANON_KEY = "sb_publishable_uFIV--uEdZ7XUkyLnHcl1w_ShTCnGt3";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper to validate if a string is a valid UUID
const isValidUUID = (uuid: string) => {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return typeof uuid === 'string' && regex.test(uuid);
};

export const cloudSync = {
  getSession: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  },

  checkHealth: async () => {
    try {
      const { error } = await supabase.from('profiles').select('id').limit(1);
      if (error && error.code !== 'PGRST116') throw error; 
      return { ok: true, message: "Secure Neural Link" };
    } catch (err) {
      return { ok: false, message: "Encryption Offline" };
    }
  },

  upsertProfile: async (user: any, authUserId?: string) => {
    try {
      const targetId = authUserId || user.authId || user.id;
      if (!isValidUUID(targetId)) {
        console.warn('[Zylos Cloud] Profile Sync Aborted: Invalid UUID.', targetId);
        return null;
      }

      const { data, error } = await supabase.from('profiles').upsert({
        id: targetId,
        phone: user.phone,
        name: user.name,
        avatar: user.avatar,
        status: 'online',
        last_seen: new Date().toISOString()
      }).select();
      
      if (error) throw error;
      return data?.[0];
    } catch (err) {
      console.error('[Zylos Cloud] Profile Sync Failed.', err);
      return null;
    }
  },

  getProfileByPhone: async (phone: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('phone', phone)
      .single();
    if (error) return null;
    return data;
  },

  findRegisteredUsers: async (phones: string[]) => {
    if (phones.length === 0) return [];
    try {
      const cleanedPhones = phones.map(p => p.replace(/[\s\-\(\)]/g, ''));
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('phone', cleanedPhones);
        
      if (error) throw error;
      return data || [];
    } catch (err) {
      return [];
    }
  },

  pushMessage: async (chatId: string, authUserId: string, message: any, recipientAuthId?: string) => {
    try {
      // Both sender and recipient MUST be valid UUIDs for PostgreSQL foreign key constraints
      if (!isValidUUID(authUserId)) {
        console.error("Cloud push rejected: Sender ID is not a valid UUID.");
        return;
      }

      const payload: any = {
        chat_id: chatId,
        sender_id: authUserId, 
        content: message.content,
        type: message.type,
        timestamp: new Date().toISOString()
      };

      if (recipientAuthId && isValidUUID(recipientAuthId)) {
        payload.recipient_id = recipientAuthId;
      }

      const { error } = await supabase.from('messages').insert(payload);
      if (error) throw error;
    } catch (err) {
      console.error("Cloud Delivery Failed:", err);
    }
  },

  fetchMessages: async (chatId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('timestamp', { ascending: true })
        .limit(100);
      
      if (error) throw error;
      return data || [];
    } catch (err) {
      return [];
    }
  },

  subscribeToChat: (chatId: string, authUserId: string, callback: (payload: any) => void) => {
    const channel = supabase.channel(`chat:${chatId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `chat_id=eq.${chatId}`
      }, (payload) => {
        // Double check sender ID as text to be safe
        if (String(payload.new.sender_id) !== String(authUserId)) {
          callback(payload.new);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  },

  pushStatus: async (authUserId: string, status: { imageUrl: string; caption?: string }) => {
    try {
      if (!isValidUUID(authUserId)) return;
      
      const { error } = await supabase.from('statuses').insert({
        user_id: authUserId,
        image_url: status.imageUrl,
        caption: status.caption,
        timestamp: new Date().toISOString()
      });
      if (error) throw error;
    } catch (err) {
      console.error("Status Push Failed:", err);
    }
  },

  fetchStatuses: async () => {
    try {
      const { data, error } = await supabase
        .from('statuses')
        .select(`
          *,
          profiles:user_id (name, avatar, phone)
        `)
        .order('timestamp', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data || [];
    } catch (err) {
      return [];
    }
  },

  subscribeToStatuses: (callback: (payload: any) => void) => {
    const channel = supabase.channel('global-statuses')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'statuses' 
      }, (payload) => {
        callback(payload.new);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }
};
