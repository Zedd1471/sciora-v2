import fs from "fs";
import path from "path";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { generateSecret, generateTOTPUri, verifyTOTP } from "./totp";

export const MASTER_ADMIN_KEY = process.env.ADMIN_MASTER_KEY || "619000";

const DATA_DIR = path.join(process.cwd(), "data");
const AUTH_FILE = path.join(DATA_DIR, "admin-auth.json");

type AdminAuthData = {
  totpSecret: string;
  updatedAt: string;
};

function ensureAuthDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getLocalAdminSecret(): string | null {
  try {
    ensureAuthDir();
    if (fs.existsSync(AUTH_FILE)) {
      const content = fs.readFileSync(AUTH_FILE, "utf-8");
      const data: AdminAuthData = JSON.parse(content);
      if (data && data.totpSecret) {
        return data.totpSecret;
      }
    }
  } catch (err) {
    console.warn("Failed to read local admin auth file:", err);
  }
  return null;
}

export function saveLocalAdminSecret(secret: string) {
  try {
    ensureAuthDir();
    const data: AdminAuthData = {
      totpSecret: secret,
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.warn("Failed to write local admin auth file:", err);
  }
}

export async function getAdminSecret(): Promise<string | null> {
  // 1. Try local disk first (0ms latency, works offline)
  const localSecret = getLocalAdminSecret();
  if (localSecret) return localSecret;

  // 2. Try Firestore cloud document
  try {
    const snap = await getDoc(doc(db, "admin_settings", "auth"));
    if (snap.exists()) {
      const data = snap.data();
      if (data && data.totpSecret) {
        saveLocalAdminSecret(data.totpSecret);
        return data.totpSecret;
      }
    }
  } catch (err) {
    console.warn("Could not reach Firestore for admin auth secret:", err);
  }

  return null;
}

export async function saveAdminSecret(secret: string): Promise<void> {
  saveLocalAdminSecret(secret);
  try {
    await setDoc(doc(db, "admin_settings", "auth"), {
      totpSecret: secret,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("Could not sync admin auth secret to Firestore:", err);
  }
}

export function isMasterPassword(input: string): boolean {
  if (!input) return false;
  return input.trim() === MASTER_ADMIN_KEY.trim();
}

export async function verifyAdminAttempt(code: string): Promise<{
  valid: boolean;
  isMaster: boolean;
  message?: string;
}> {
  const cleanCode = code.trim();

  // 1. Master Passkey bypass: always authenticates instantly
  if (isMasterPassword(cleanCode)) {
    return { valid: true, isMaster: true };
  }

  // 2. Check 6-digit TOTP against registered secret
  const secret = await getAdminSecret();
  if (!secret) {
    return {
      valid: false,
      isMaster: false,
      message: "No authenticator configured. Master password required.",
    };
  }

  const isValidTotp = await verifyTOTP(cleanCode, secret);
  if (isValidTotp) {
    return { valid: true, isMaster: false };
  }

  return { valid: false, isMaster: false, message: "Invalid 6-digit authenticator code." };
}

export async function initializeOrResetSecret(masterKey: string): Promise<{
  success: boolean;
  secret: string;
  uri: string;
}> {
  if (!isMasterPassword(masterKey)) {
    throw new Error("Invalid Master Admin Password.");
  }

  const secret = generateSecret();
  await saveAdminSecret(secret);
  const uri = generateTOTPUri({
    issuer: "Sciora V2",
    label: "Admin",
    secret,
  });

  return { success: true, secret, uri };
}
