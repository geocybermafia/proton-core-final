import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '../firebase';

export interface SecurityPinMeta {
  enabled: boolean;
  salt: string; // 16-byte random hex salt
  verifier: string; // Hex string of PBKDF2 derived bits (256 bits)
  version: number;
  updatedAt?: number;
}

export interface LockoutStatus {
  isLocked: boolean;
  remainingSeconds: number;
  attemptCount: number;
  messageKa?: string;
  messageEn?: string;
}

interface StoredLockoutData {
  attempts: number;
  lockedUntil: number; // timestamp ms
}

const LOCKOUT_STORAGE_KEY = 'proton_pin_lockout_state';

// Convert ArrayBuffer to Hex String
function bufToHex(buffer: ArrayBuffer): string {
  const byteArray = new Uint8Array(buffer);
  return Array.from(byteArray)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

// Convert Hex String to Uint8Array
function hexToBuf(hex: string): Uint8Array {
  const match = hex.match(/.{1,2}/g);
  if (!match) return new Uint8Array(0);
  return new Uint8Array(match.map((byte) => parseInt(byte, 16)));
}

// Generate cryptographically secure random salt (16 bytes = 128 bits)
export function generateSaltHex(): string {
  const saltBytes = new Uint8Array(16);
  window.crypto.getRandomValues(saltBytes);
  return bufToHex(saltBytes.buffer);
}

// Derive PBKDF2 Verifier from PIN and Salt using Web Crypto API
export async function derivePinVerifier(pin: string, saltHex: string): Promise<string> {
  const encoder = new TextEncoder();
  const pinBytes = encoder.encode(pin);
  const saltBytes = hexToBuf(saltHex);

  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    pinBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const derivedBits = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    256 // 256 bits = 32 bytes
  );

  return bufToHex(derivedBits);
}

// Verify entered PIN against stored salt and verifier
export async function verifyPinWithMeta(enteredPin: string, meta?: SecurityPinMeta): Promise<boolean> {
  if (!meta || !meta.enabled || !meta.salt || !meta.verifier) {
    return false;
  }
  try {
    const computedVerifier = await derivePinVerifier(enteredPin, meta.salt);
    // Safe constant-length comparison
    if (computedVerifier.length !== meta.verifier.length) {
      return false;
    }
    let diff = 0;
    for (let i = 0; i < computedVerifier.length; i++) {
      diff |= computedVerifier.charCodeAt(i) ^ meta.verifier.charCodeAt(i);
    }
    return diff === 0;
  } catch (e) {
    console.error("Error verifying PIN crypto:", e);
    return false;
  }
}

// Create new SecurityPinMeta object from raw PIN
export async function createPinMeta(pin: string): Promise<SecurityPinMeta> {
  const salt = generateSaltHex();
  const verifier = await derivePinVerifier(pin, salt);
  return {
    enabled: true,
    salt,
    verifier,
    version: 1,
    updatedAt: Date.now(),
  };
}

// Check current lockout status
function getStoredLockoutData(): StoredLockoutData {
  try {
    const raw = sessionStorage.getItem(LOCKOUT_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    // Ignore storage errors
  }
  return { attempts: 0, lockedUntil: 0 };
}

function saveStoredLockoutData(data: StoredLockoutData) {
  try {
    sessionStorage.setItem(LOCKOUT_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    // Ignore storage errors
  }
}

export function checkPinLockout(): LockoutStatus {
  const data = getStoredLockoutData();
  const now = Date.now();

  if (data.lockedUntil > now) {
    const remainingSeconds = Math.ceil((data.lockedUntil - now) / 1000);
    return {
      isLocked: true,
      remainingSeconds,
      attemptCount: data.attempts,
      messageKa: `მრავალჯერადი არასწორი მცდელობა. გთხოვთ დაელოდოთ ${remainingSeconds} წამს.`,
      messageEn: `Too many failed attempts. Please wait ${remainingSeconds} seconds.`,
    };
  }

  return {
    isLocked: false,
    remainingSeconds: 0,
    attemptCount: data.attempts,
  };
}

export function registerFailedPinAttempt(): LockoutStatus {
  const data = getStoredLockoutData();
  data.attempts += 1;
  const now = Date.now();

  if (data.attempts >= 5) {
    // 60-second lockout after 5 failures
    data.lockedUntil = now + 60000;
  } else if (data.attempts >= 3) {
    // 15-second delay after 3 failures
    data.lockedUntil = now + 15000;
  }

  saveStoredLockoutData(data);
  return checkPinLockout();
}

export function resetPinLockoutAttempts(): void {
  saveStoredLockoutData({ attempts: 0, lockedUntil: 0 });
}

// Migrate legacy plaintext PIN to PBKDF2 hash & delete plaintext field from Firestore
export async function checkAndMigrateLegacyPin(userId: string, docData: any): Promise<{
  securityPinEnabled?: boolean;
  securityPinMeta?: SecurityPinMeta;
}> {
  if (docData && typeof docData.securityPin === 'string' && docData.securityPin.length > 0) {
    const rawLegacyPin = docData.securityPin;
    try {
      const pinMeta = await createPinMeta(rawLegacyPin);
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        securityPinMeta: pinMeta,
        securityPinEnabled: true,
        securityPin: deleteField(), // Permanently delete raw plaintext PIN from Firestore
      });
      return {
        securityPinEnabled: true,
        securityPinMeta: pinMeta,
      };
    } catch (e) {
      console.error("Failed to migrate legacy plaintext PIN:", e);
    }
  }
  return {
    securityPinEnabled: !!(docData?.securityPinEnabled || docData?.securityPinMeta?.enabled),
    securityPinMeta: docData?.securityPinMeta,
  };
}
