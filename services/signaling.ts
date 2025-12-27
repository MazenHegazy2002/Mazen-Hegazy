
import { supabase } from './supabase';

type SignalCallback = (type: string, payload: any) => void;

export const signaling = {
    subscribe: (userId: string, onSignal: SignalCallback) => {
        console.log(`[Signaling] Subscribing to channel: calls:${userId}`);
        const channel = supabase.channel(`calls:${userId}`)
            .on('broadcast', { event: 'signal' }, (payload) => {
                console.log(`[Signaling] Received signal on calls:${userId}:`, payload.payload.type);
                onSignal(payload.payload.type, payload.payload.data);
            })
            .subscribe((status) => {
                console.log(`[Signaling] Channel calls:${userId} status:`, status);
            });

        // Cleanup function
        return () => {
            console.log(`[Signaling] Unsubscribing from calls:${userId}`);
            supabase.removeChannel(channel);
        };
    },

    sendSignal: async (recipientId: string, type: 'offer' | 'answer' | 'candidate' | 'end', data: any) => {
        console.log(`[Signaling] Sending ${type} to calls:${recipientId}`);
        const channel = supabase.channel(`calls:${recipientId}`);

        channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await channel.send({
                    type: 'broadcast',
                    event: 'signal',
                    payload: { type, data }
                });
                console.log(`[Signaling] Sent ${type} to calls:${recipientId}`);

                // Give it a moment to flush, then leave
                setTimeout(() => {
                    supabase.removeChannel(channel);
                }, 1000);
            }
        });
    }
};
