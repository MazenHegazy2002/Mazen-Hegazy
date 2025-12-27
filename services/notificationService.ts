
import { MessageType } from '../types';
import { supabase } from './supabase';

/**
 * Zylos Neural Push Service
 * Leverages Web Notification API for free OS-level alerts.
 */

export const NotificationService = {
  // New Method: Subscribe to Web Push (VAPID)
  subscribeToPush: async (userId: string) => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      // NOTE: In production, you need a VAPID Public Key here.
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'
      });
      // Serialize keys
      const p256dh = btoa(String.fromCharCode.apply(null, new Uint8Array(sub.getKey('p256dh') as ArrayBuffer)));
      const auth = btoa(String.fromCharCode.apply(null, new Uint8Array(sub.getKey('auth') as ArrayBuffer)));
      // Save to Supabase
      const { error } = await supabase.from('push_subscriptions').upsert({
        user_id: userId,
        endpoint: sub.endpoint,
        p256dh,
        auth
      });
      if (!error) console.log("[Zylos] Neural Uplink Established (Push Subscribed)");
    } catch (e) {
      console.warn("[Zylos] Push Subscription Failed:", e);
    }
  },

  requestPermission: async () => {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;

    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (e) {
      return false;
    }
  },

  send: (title: string, body: string, icon?: string) => {
    // 1. Fire Native OS Notification
    // Only fire if the app is NOT visible (background) or if the user explicitly wants them
    if (Notification.permission === 'granted' && document.visibilityState !== 'visible') {
      try {
        const options = {
          body: body,
          icon: icon || 'https://rqvoqztaslbzhxlqgkvn.supabase.co/storage/v1/object/public/assets/logo.png',
          badge: icon || '/favicon.ico',
          tag: 'zylos-notification',
          renotify: true,
          silent: false,
        };

        // If service worker is active, use it for better background support
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
          navigator.serviceWorker.ready.then(registration => {
            registration.showNotification(title, options);
          });
        } else {
          // Fallback to standard window notification
          new Notification(title, options);
        }

        // Trigger haptic feedback if supported
        if ('vibrate' in navigator) {
          navigator.vibrate([100, 50, 100]);
        }
      } catch (e) {
        console.warn("Native notification blocked by system settings.");
      }
    }

    // 2. Always trigger In-App Toast for visual feedback
    const event = new CustomEvent('zylos-notification', {
      detail: { title, body, icon, timestamp: new Date() }
    });
    window.dispatchEvent(event);
  },

  sendSystemAlert: (message: string) => {
    NotificationService.send('Zylos System', message);
  }
};
