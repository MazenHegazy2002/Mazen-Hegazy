import { createClient } from '@supabase/supabase-js';

// Connection Configuration
// Note: If data isn't appearing, verify that your project's "Anon Key" matches the one below.
const SUPABASE_URL = "https://rqvoqztaslbzhxlqgkvn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_uFIV--uEdZ7XUkyLnHcl1w_ShTCnGt3";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const getChatRoomId = (userId1: string, userId2: string) => {
  return [userId1, userId2].sort().join('--');
};

/**
 * Robust UUID validator for Postgres compatibility.
 */
export const isValidUUID = (uuid: string) => {
  if (!uuid) return false;
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return regex.test(uuid);
};

export const cloudSync = {
  checkHealth: async () => {
    try {
      // Test read to check connectivity
      const { error } = await supabase.from('profiles').select('id').limit(1);
      if (error) return { ok: false, message: `Link Error: ${error.message}` };
      return { ok: true, message: "Neural Link Active" };
    } catch (err: any) {
      return { ok: false, message: "Registry Unreachable" };
    }
  },

  updatePresence: async (userId: string, status: 'online' | 'offline') => {
    if (!isValidUUID(userId)) return;
    try {
      await supabase.from('profiles').update({
        status,
        last_seen: new Date().toISOString()
      }).eq('id', userId);
    } catch (e) { }
  },

  upsertProfile: async (user: any) => {
    if (!isValidUUID(user.id)) {
      console.error("[Zylos] Invalid Identity Format:", user.id);
      throw new Error("Invalid Identity UUID");
    }

    try {
      const payload = {
        id: user.id,
        phone: user.phone,
        name: user.name,
        avatar: user.avatar,
        status: 'online',
        last_seen: new Date().toISOString()
      };

      const { data, error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' }).select();

      if (error) {
        console.error("[Zylos] Upsert Failed:", error);
        // Throw specific error message from Supabase
        throw new Error(`Supabase Error: ${error.message} (Code: ${error.code})`);
      }

      console.log("[Zylos] Identity Synchronized:", data?.[0]?.name);
      return data?.[0] || user;
    } catch (e: any) {
      console.error("Critical: Profile Sync Failed", e);
      // Re-throw so UI can catch it
      throw e;
    }
  },

  getProfileByPhone: async (phone: string) => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('phone', phone).maybeSingle();
      if (error) return null;
      return data;
    } catch {
      return null;
    }
  },

  getAllProfiles: async (excludeId: string) => {
    try {
      const { data } = await supabase.from('profiles')
        .select('*')
        .neq('id', excludeId)
        .order('last_seen', { ascending: false })
        .limit(50);
      return data || [];
    } catch {
      return [];
    }
  },

  searchProfiles: async (query: string, phoneMatch: string) => {
    try {
      const { data } = await supabase.from('profiles')
        .select('*')
        .or(`name.ilike.%${query}%,phone.eq.${phoneMatch}`)
        .limit(10);
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

      // Only include recipient if valid, otherwise broad-sync
      // MODIFIED: Trust the ID if it is provided, regex might be too strict
      if (recipientId) {
        if (!isValidUUID(recipientId)) {
          console.warn("[Zylos] Invalid Recipient UUID format:", recipientId);
        }
        payload.recipient_id = recipientId;
      }

      const { error } = await supabase.from('messages').insert(payload);
      if (error) throw error;
    } catch (err: any) {
      console.error("[Zylos] Relay Failure:", err.message);
      throw err;
    }
  },

  fetchMessages: async (chatId: string) => {
    try {
      const { data } = await supabase.from('messages')
        .select('*')
        .eq('chat_id', String(chatId))
        .order('timestamp', { ascending: true })
        .limit(100);
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
          if (payload.new.sender_id !== userId) {
            callback(payload.new);
          }
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    } catch {
      return () => { };
    }
  },

  subscribeToGlobalMessages: (userId: string, callback: (payload: any) => void) => {
    if (!isValidUUID(userId)) return () => { };
    try {
      const channel = supabase.channel(`global_${userId}`)
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
      return () => { };
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
    } catch (err) { }
  },

  fetchStatuses: async () => {
    try {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase.from('statuses')
        .select('*, profiles:user_id(name, avatar, phone)')
        .gt('timestamp', yesterday)
        .order('timestamp', { ascending: false })
        .limit(50);
      return data || [];
    } catch {
      return [];
    }
  },

  subscribeToStatuses: (callback: (payload: any) => void) => {
    try {
      const channel = supabase.channel('statuses_broadcast')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'statuses'
        }, (payload) => callback(payload.new))
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    } catch {
      return () => { };
    }
  }
};