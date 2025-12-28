
import { supabase } from './supabase';

type SignalCallback = (type: string, payload: any) => void;

export const signaling = {
    subscribe: (userId: string, onSignal: (type: string, data: any, senderId: string) => void) => {
        console.log(`[Signaling] Subscribing to channel: calls:${userId}`);
        const channel = supabase.channel(`calls:${userId}`)
            .on('broadcast', { event: 'signal' }, (payload) => {
                console.log(`[Signaling] Received signal on calls:${userId} from ${payload.payload.senderId}:`, payload.payload.type);
                onSignal(payload.payload.type, payload.payload.data, payload.payload.senderId);
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

    sendSignal: async (senderId: string, recipientId: string, type: 'offer' | 'answer' | 'candidate' | 'end', data: any) => {
        console.log(`[Signaling] Sending ${type} to calls:${recipientId} from ${senderId}`);
        return new Promise<void>((resolve, reject) => {
            const channel = supabase.channel(`calls:${recipientId}`);

            const timeout = setTimeout(() => {
                supabase.removeChannel(channel);
                reject(new Error("Signaling Timed Out (Connection blocked? Check DB Status)"));
            }, 5000);

            channel.subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    clearTimeout(timeout);
                    try {
                        await channel.send({
                            type: 'broadcast',
                            event: 'signal',
                            payload: { type, data, senderId }
                        });
                        console.log(`[Signaling] Sent ${type} to calls:${recipientId}`);

                        // Give it a moment to flush, then leave
                        setTimeout(() => {
                            supabase.removeChannel(channel);
                            resolve();
                        }, 500);
                    } catch (e: any) {
                        supabase.removeChannel(channel);
                        reject(e);
                    }
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    clearTimeout(timeout);
                    supabase.removeChannel(channel);
                    reject(new Error(`Signaling Failed: ${status}`));
                }
            });
        });
    }
};
