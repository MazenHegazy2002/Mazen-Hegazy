import { createClient } from '@supabase/supabase-js';

// Connection Configuration
const SUPABASE_URL = "https://rqvoqztaslbzhxlqgkvn.supabase.co"; 
const SUPABASE_ANON_KEY = "sb_publishable_uFIV--uEdZ7XUkyLnHcl1w_ShTCnGt3";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Standard UUID validation for Supabase Identity integration.
 */
const isValidUUID = (uuid: string) => {
  if (!uuid) return false;
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return regex.test(uuid);
};

/**
 * Detects if an error is specifically because the table doesn't exist yet.
 * Postgres Error 42P01 = undefined_table.
 */
const isSchemaMissing = (error: any) => {
  if (!error) return false;
  return (
    error.code === '42P01' || 
    error.message?.toLowerCase().includes('relation') || 
    error.message?.toLowerCase().includes('does not exist')
  );
};

export const cloudSync = {
  /**
   * Diagnostic check for the database.
   */
  checkHealth: async () => {
    try {
      const { error } = await supabase.from('profiles').select('id').limit(1);
      if (error) {
        if (isSchemaMissing(error)) return { ok: false, message: "Database Setup Required" };
        return { ok: false, message: "Sync Lagging" };
      }
      return { ok: true, message: "Neural Link Active" };
    } catch {
      return { ok: false, message: "Connection Offline" };
    }
  },

  /**
   * Gracefully syncs profile if table exists.
   */
  upsertProfile: async (user: any) => {
    if (!isValidUUID(user.id)) return null;
    try {
      const { data, error } = await supabase.from('profiles').upsert({
        id: user.id,
        phone: user.phone,
        name: user.name,
        avatar: user.avatar,
        status: 'online',
        last_seen: new Date().toISOString()
      }).select();
      
      if (error && isSchemaMissing(error)) {
        console.warn("[Zylos] Profiles table not found. Operating in local-only mode.");
        return user; // Return local user to keep app moving
      }
      return data?.[0] || user;
    } catch {
      return user;
    }
  },

  getProfileByPhone: async (phone: string) => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('phone', phone).maybeSingle();
      if (error && isSchemaMissing(error)) return null;
      return data;
    } catch {
      return null;
    }
  },

  searchProfiles: async (query: string, phoneMatch: string) => {
    try {
      // Find users by name match or exact phone match
      const { data, error } = await supabase.from('profiles')
        .select('*')
        .or(`name.ilike.%${query}%,phone.eq.${phoneMatch}`)
        .limit(10);
      
      if (error && isSchemaMissing(error)) return [];
      return data || [];
    } catch {
      return [];
    }
  },

  findRegisteredUsers: async (phones: string[]) => {
    if (!phones.length) return [];
    try {
      const { data, error } = await supabase.from('profiles').select('*').in('phone', phones);
      if (error && isSchemaMissing(error)) return [];
      return data || [];
    } catch {
      return [];
    }
  },

  /**
   * Pushes message to global relay if table exists.
   */
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
      
      const { error } = await supabase.from('messages').insert(payload);
      if (error && isSchemaMissing(error)) {
        console.warn("[Zylos] Messages table missing. Message stored locally only.");
      }
    } catch (err) {
      console.error("[Zylos] Relay Lag:", err);
    }
  },

  fetchMessages: async (chatId: string) => {
    try {
      const { data, error } = await supabase.from('messages')
        .select('*')
        .eq('chat_id', String(chatId))
        .order('timestamp', { ascending: true })
        .limit(100);
      
      if (error && isSchemaMissing(error)) return [];
      return data || [];
    } catch {
      return [];
    }
  },

  subscribeToChat: (chatId: string, userId: string, callback: (payload: any) => void) => {
    try {
      const channel = supabase.channel(`chat_${chatId}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages', 
          filter: `chat_id=eq.${chatId}` 
        }, (payload) => {
          if (payload.new.sender_id !== userId) callback(payload.new);
        })
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') console.warn("[Zylos] Realtime sync restricted (Setup missing).");
        });
      return () => { supabase.removeChannel(channel); };
    } catch {
      return () => {};
    }
  },

  pushStatus: async (userId: string, status: { imageUrl: string; caption?: string }) => {
    if (!isValidUUID(userId)) return;
    try {
      const { error } = await supabase.from('statuses').insert({
        user_id: userId,
        image_url: status.imageUrl,
        caption: status.caption,
        timestamp: new Date().toISOString()
      });
      if (error && isSchemaMissing(error)) console.warn("[Zylos] Statuses table missing.");
    } catch (err) {
      console.error("[Zylos] Status Relay Lag:", err);
    }
  },

  fetchStatuses: async () => {
    try {
      const { data, error } = await supabase.from('statuses')
        .select('*, profiles:user_id(name, avatar, phone)')
        .order('timestamp', { ascending: false })
        .limit(50);
      
      if (error && isSchemaMissing(error)) return [];
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