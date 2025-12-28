import { cloudSync, getChatRoomId } from './supabase';

type SignalCallback = (type: string, payload: any, senderId: string) => void;

// Simple event emitter for routing signals locally
const listeners: SignalCallback[] = [];

export const signaling = {
    // Called by components (App.tsx, CallOverlay) to listen for signals
    subscribe: (userId: string, onSignal: SignalCallback) => {
        console.log(`[Signaling] Listener registered for ${userId}`);
        listeners.push(onSignal);
        return () => {
            const idx = listeners.indexOf(onSignal);
            if (idx > -1) listeners.splice(idx, 1);
        };
    },

    // Called by App.tsx when it sees a new 'SIGNAL' message in the database stream
    onIncomingSignal: (senderId: string, type: string, data: any) => {
        console.log(`[Signaling] Routing incoming ${type} from ${senderId}`);
        listeners.forEach(cb => cb(type, data, senderId));
    },

    // Sends signal via HTTP (Database Insert) instead of WebSocket
    sendSignal: async (senderId: string, recipientId: string, type: 'offer' | 'answer' | 'candidate' | 'end', data: any) => {
        console.log(`[Signaling] Sending ${type} via DB to ${recipientId} from ${senderId}`);

        // We use a dedicated content payload for the signal data
        const signalPayload = JSON.stringify({ type, data });

        // Calculate chat ID to ensure it maps to a conversation (optional, but good for structure)
        const chatId = getChatRoomId(senderId, recipientId);

        try {
            await cloudSync.pushMessage(
                chatId,
                senderId,
                { type: 'SIGNAL', content: signalPayload },
                recipientId
            );
            console.log(`[Signaling] DB Insert Success: ${type}`);
        } catch (e: any) {
            console.error(`[Signaling] DB Insert Failed: ${e.message}`);
            throw e;
        }
    }
};
