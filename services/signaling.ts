
import { supabase } from './supabase';

type SignalCallback = (type: string, payload: any) => void;

export const signaling = {
    subscribe: (userId: string, onSignal: SignalCallback) => {
        const channel = supabase.channel(`calls:${userId}`)
            .on('broadcast', { event: 'signal' }, (payload) => {
                onSignal(payload.payload.type, payload.payload.data);
            })
            .subscribe();

        // Cleanup function
        return () => {
            supabase.removeChannel(channel);
        };
    },

    sendSignal: async (recipientId: string, type: 'offer' | 'answer' | 'candidate' | 'end', data: any) => {
        const channel = supabase.channel(`calls:${recipientId}`);
        channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await channel.send({
                    type: 'broadcast',
                    event: 'signal',
                    payload: { type, data }
                });
                // We only use this channel to send one message, then we can leave
                // However, keeping it open for a bit might be safer, but for now we trust broadcast
                // Optimization: Use a global channel if latency is high, but per-user is more secure-ish.
                // Actually, for broadcast to work, the RECIPIENT must be subscribed to `calls:recipientId`.
                // The SENDER just needs to publish to it.
            }
        });
    }
};
