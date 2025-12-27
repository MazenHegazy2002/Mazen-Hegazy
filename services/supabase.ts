import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = "https://rqvoqztaslbzhxlqgkvn.supabase.co"; 
const SUPABASE_ANON_KEY = "sb_publishable_uFIV--uEdZ7XUkyLnHcl1w_ShTCnGt3";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Validates if a string is a proper UUID. 
 * Supabase foreign keys strictly require UUIDs for user relations.
 */
const isValidUUID = (uuid: string) => {
  if (!uuid) return false;
  // Standard UUID check
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  // If it's a temp ID or zeroes, we allow it for UI purposes but skip DB sync
  if (uuid === '00000000-0000-0000-0000-000000000000') return false;
  return typeof uuid === 'string' && regex.test(uuid);
};

export const cloudSync = {
  checkHealth: async () => {
    try {
      const { error } = await supabase.from('profiles').select('id').limit(1);
      if (error && error.code !== 'PGRST116') throw error; 
      return { ok: true, message: "Neural Link Healthy" };
    } catch (err: any) {
      console.error("[Zylos] Cloud Health Check Failed:", err);
      return { ok: false, message: "Sync Pending" };
    }
  },

  upsertProfile: async (user: any, authUserId?: string) => {
    const targetId = authUserId || user.authId || user.id;
    if (!isValidUUID(targetId)) {
      console.warn('[Zylos] Profile sync skipped: Not a valid UUID.', targetId);
      return null;
    }

    try {
      const { data, error } = await supabase.from('profiles').upsert({
        id: targetId,
        phone: user.phone,
        name: user.name,
        avatar: user.avatar,
        status: 'online',
        last_seen: new Date().toISOString()
      }).select();
      
      if (error) {
        console.error('[Zylos] Upsert Profile Error:', error.message);
        throw error;
      }
      return data?.[0];
    } catch (err) {
      console.error('[Zylos] Handshake Error:', err);
      return null;
    }
  },

  getProfileByPhone: async (phone: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('phone', phone)
        .maybeSingle(); 
      if (error) return null;
      return data;
    } catch (e) {
      return null;
    }
  },

  findRegisteredUsers: async (phones: string[]) => {
    if (!phones.length) return [];
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('phone', phones);
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error("[Zylos] Discovery Error:", err);
      return [];
    }
  },

  pushMessage: async (chatId: string, senderId: string, message: any, recipientId?: string) => {
    if (!isValidUUID(senderId)) return;
    try {
      const payload: any = {
        chat_id: String(chatId), 
        sender_id: senderId, 
        content: message.content,
        type: message.type || 'TEXT',
        timestamp: new Date().toISOString()
      };
      if (recipientId && isValidUUID(recipientId)) {
        payload.recipient_id = recipientId;
      }
      const { error } = await supabase.from('messages').insert(payload);
      if (error) throw error;
    } catch (err) {
      console.error("[Zylos] Message Relay Error:", err);
    }
  },

  fetchMessages: async (chatId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', String(chatId))
        .order('timestamp', { ascending: true })
        .limit(100);
      if (error) throw error;
      return data || [];
    } catch (err) {
      return [];
    }
  },

  subscribeToChat: (chatId: string, userId: string, callback: (payload: any) => void) => {
    const channel = supabase.channel(`chat_${chatId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `chat_id=eq.${chatId}`
      }, (payload) => {
        if (payload.new.sender_id !== userId) callback(payload.new);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  },

  pushStatus: async (userId: string, status: { imageUrl: string; caption?: string }) => {
    if (!isValidUUID(userId)) {
      console.error("[Zylos] Status post blocked: User ID must be a UUID.");
      return;
    }
    try {
      const { error } = await supabase.from('statuses').insert({
        user_id: userId,
        image_url: status.imageUrl,
        caption: status.caption,
        timestamp: new Date().toISOString()
      });
      if (error) throw error;
    } catch (err) {
      console.error("[Zylos] Status Post Error:", err);
      throw err;
    }
  },

  fetchStatuses: async () => {
    try {
      const { data, error } = await supabase
        .from('statuses')
        .select('*, profiles:user_id(name, avatar, phone)')
        .order('timestamp', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data || [];
    } catch (err) {
      return [];
    }
  },

  subscribeToStatuses: (callback: (payload: any) => void) => {
    const channel = supabase.channel('global_traffic')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'statuses' 
      }, (payload) => callback(payload.new))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }
};