
/**
 * Zylos Encryption Service
 * Implements simulated End-to-End Encryption (E2EE)
 * In a production environment, this would use Web Crypto API (SubtleCrypto)
 * with Diffie-Hellman key exchange (Signal Protocol).
 */

// Simple robust obfuscation to represent "Ciphertext"
export const encrypt = (text: string, chatId: string): string => {
  const salt = btoa(chatId).substring(0, 8);
  return `zylos_v1_${btoa(unescape(encodeURIComponent(salt + text)))}`;
};

export const decrypt = (encrypted: string, chatId: string): string => {
  if (!encrypted.startsWith('zylos_v1_')) return encrypted;
  
  try {
    const salt = btoa(chatId).substring(0, 8);
    const decoded = decodeURIComponent(escape(atob(encrypted.replace('zylos_v1_', ''))));
    return decoded.replace(salt, '');
  } catch (e) {
    return "[Decryption Error: Key Mismatch]";
  }
};

export const generateEncryptionFingerprint = (userId1: string, userId2: string): string => {
  const combined = [userId1, userId2].sort().join(':');
  // Simple deterministic fingerprint generator
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) - hash) + combined.charCodeAt(i);
    hash |= 0;
  }
  const absHash = Math.abs(hash).toString();
  return absHash.match(/.{1,4}/g)?.join(' ') || absHash;
};
