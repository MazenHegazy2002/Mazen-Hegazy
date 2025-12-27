
import { createClient } from '@supabase/supabase-js';

/**
 * Zylos Cloud Engine (Powered by Supabase/Postgres)
 * 
 * Target Project: rqvoqztaslbzhxlqgkvn
 */

const SUPABASE_URL = "https://rqvoqztaslbzhxlqgkvn.supabase.co"; 
const SUPABASE_ANON_KEY = "sb_publishable_uFIV--uEdZ7XUkyLnHcl1w_ShTCnGt3";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const isCloudConfigured = () => !!(SUPABASE_URL && SUPABASE_ANON_KEY);

export const cloudSync = {
  // Register or Update user profile on the online server
  upsertProfile: async (user: any) => {
    if (!isCloudConfigured()) return;
    
    try {
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        phone: user.phone,
        name: user.name,
        avatar: user.avatar,
        status: user.status,
        last_seen: new Date().toISOString()
      }, { onConflict: 'phone' });
      
      if (error) console.error('[CloudSync] Upsert Profile Error:', error.message);
    } catch (err) {
      console.warn('[CloudSync] Profile sync failed (Table may not exist yet):', err);
    }
  },

  // Discover which phone numbers are registered in the cloud
  findRegisteredUsers: async (phones: string[]) => {
    if (!isCloudConfigured() || phones.length === 0) return [];
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('phone', phones);
        
      if (error) {
        console.error('[CloudSync] Discovery Error:', error.message);
        return [];
      }
      return data || [];
    } catch (err) {
      console.warn('[CloudSync] Contact discovery failed:', err);
      return [];
    }
  },

  // Send message to the online database
  pushMessage: async (chatId: string, message: any) => {
    if (!isCloudConfigured()) return;
    
    try {
      const { error } = await supabase.from('messages').insert({
        chat_id: chatId,
        sender_id: message.senderId,
        content: message.content,
        type: message.type,
        timestamp: message.timestamp
      });
      
      if (error) console.error('[CloudSync] Push Message Error:', error.message);
    } catch (err) {
      console.warn('[CloudSync] Message push failed:', err);
    }
  },

  // Subscribe to real-time updates for a specific chat
  subscribeToChat: (chatId: string, callback: (payload: any) => void) => {
    if (!isCloudConfigured()) return () => {}; 
    
    const channel = supabase.channel(`chat:${chatId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `chat_id=eq.${chatId}`
      }, (payload) => callback(payload.new))
      .subscribe();
      
    return () => supabase.removeChannel(channel);
  }
};
