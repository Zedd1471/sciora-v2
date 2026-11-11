"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  Check,
  XCircle,
  Copy,
  RotateCcw,
  KeyRound,
  Lock,
  ArrowRight,
  Loader2,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";

const DIGITS_TARGET = 6;
const EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

export default function AdminLogin() {
  const router = useRouter();
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);

  // Modes: "login" | "reconfigure-locked" | "setup"
  const [mode, setMode] = useState<"login" | "reconfigure-locked" | "setup">("login");
  const [setupData, setSetupData] = useState<{ secret: string; uri: string } | null>(null);

  // Master password input for unlocking setup/reset
  const [masterPassword, setMasterPassword] = useState("");
  const [masterError, setMasterError] = useState("");
  const [isAuthorizingMaster, setIsAuthorizingMaster] = useState(false);

  // 6-digit OTP input values
  const [otpValues, setOtpValues] = useState<string[]>(Array(DIGITS_TARGET).fill(""));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [isVerifying, setIsVerifying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const [copiedKey, setCopiedKey] = useState(false);
  const [isLocalhost, setIsLocalhost] = useState(false);

  // Check auth configuration status on mount
  useEffect(() => {
    fetch("/api/admin/auth")
      .then((res) => (res.ok ? res.json() : { isConfigured: false }))
      .then((data) => {
        setIsConfigured(data.isConfigured);
        if (!data.isConfigured) {
          setMode("reconfigure-locked");
        } else {
          setMode("login");
        }
      })
      .catch(() => {
        setIsConfigured(false);
        setMode("reconfigure-locked");
      })
      .finally(() => {
        setLoadingConfig(false);
      });

    if (typeof window !== "undefined") {
      setIsLocalhost(
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"
      );
    }
  }, []);

  // Handle 6-digit input verification
  const verifyCode = async (code: string) => {
    if (code.length !== DIGITS_TARGET || isVerifying || isSuccess) return;

    setIsVerifying(true);
    setError("");

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsSuccess(true);
        setTimeout(() => {
          localStorage.setItem("sciora_admin_auth", "true");
          router.push("/admin");
        }, 1000);
      } else {
        setError(data.error || "Invalid 6-digit code or Master Password.");
        setIsVerifying(false);
        setOtpValues(Array(DIGITS_TARGET).fill(""));
        inputRefs.current[0]?.focus();
      }
    } catch {
      setError("Network error. Please try again.");
      setIsVerifying(false);
    }
  };

  // Authorize reconfigure/setup with Master Password
  const handleAuthorizeMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterPassword.trim()) {
      setMasterError("Please enter your Master Admin Password.");
      return;
    }

    setIsAuthorizingMaster(true);
    setMasterError("");

    try {
      const res = await fetch("/api/admin/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ masterPassword: masterPassword.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSetupData({ secret: data.secret, uri: data.uri });
        setMode("setup");
        setMasterPassword("");
        setOtpValues(Array(DIGITS_TARGET).fill(""));
      } else {
        setMasterError(data.error || "Unauthorized: Incorrect Master Admin Password.");
      }
    } catch {
      setMasterError("Could not reach authentication server.");
    } finally {
      setIsAuthorizingMaster(false);
    }
  };

  const handleInputChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const newValues = [...otpValues];
    newValues[index] = digit;
    setOtpValues(newValues);

    if (digit && index < DIGITS_TARGET - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    const fullCode = newValues.join("");
    if (fullCode.length === DIGITS_TARGET && !newValues.includes("")) {
      verifyCode(fullCode);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpValues[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, DIGITS_TARGET);
    if (!pasted) return;

    const newValues = Array(DIGITS_TARGET).fill("");
    for (let i = 0; i < pasted.length; i++) {
      newValues[i] = pasted[i];
    }
    setOtpValues(newValues);

    const nextIndex = Math.min(pasted.length, DIGITS_TARGET - 1);
    inputRefs.current[nextIndex]?.focus();

    if (pasted.length === DIGITS_TARGET) {
      verifyCode(pasted);
    }
  };

  return (
    <main
      id="main-content"
      className="min-h-[100dvh] flex flex-col items-center justify-center p-6 relative overflow-hidden bg-background"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, filter: "blur(8px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.5, ease: EXPO }}
        className="w-full max-w-sm"
      >
        <div className="card-outer border-indigo-500/25 dark:border-indigo-500/20 shadow-lift">
          <div className="card-inner p-8">
            {/* ICON & TITLE */}
            <div className="flex flex-col items-center mb-6 text-center">
              <div className="mb-4 relative">
                <motion.div
                  animate={{
                    boxShadow: [
                      "0 0 0 0 rgba(99,102,241,0.3)",
                      "0 0 0 14px rgba(99,102,241,0)",
                      "0 0 0 0 rgba(99,102,241,0)",
                    ],
                  }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut" }}
                  className="w-14 h-14 rounded-2xl bg-indigo-500/10 dark:bg-indigo-900/40 border border-indigo-500/30 flex items-center justify-center text-accent"
                >
                  <ShieldCheck className="w-7 h-7" aria-hidden="true" />
                </motion.div>
              </div>

              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-accent mb-1.5">
                Lecturer Portal
              </span>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                {mode === "setup"
                  ? "Pair Authenticator"
                  : mode === "reconfigure-locked"
                    ? isConfigured
                      ? "Authorize Reconfiguration"
                      : "Initial Setup Required"
                    : "Admin Gateway"}
              </h1>
              <p className="text-muted mt-1.5 text-xs sm:text-sm leading-relaxed max-w-xs">
                {mode === "setup"
                  ? "Scan this QR code in Google Authenticator or Authy to complete pairing."
                  : mode === "reconfigure-locked"
                    ? isConfigured
                      ? "Enter your Master Admin Password to unlock Authenticator reconfiguration."
                      : "Enter Master Admin Password to configure your Google Authenticator."
                    : "Secured by Google Authenticator or Master Passkey."}
              </p>
            </div>

            {loadingConfig ? (
              <div className="py-10 text-center text-xs text-muted flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-accent" />
                Verifying security configuration...
              </div>
            ) : mode === "reconfigure-locked" ? (
              /* MASTER PASSWORD AUTHORIZATION FORM */
              <form onSubmit={handleAuthorizeMaster} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-strong uppercase tracking-wider mb-1.5">
                    Master Admin Password:
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
                    <input
                      type="password"
                      value={masterPassword}
                      onChange={(e) => {
                        setMasterPassword(e.target.value);
                        setMasterError("");
                      }}
                      placeholder="Enter master password..."
                      autoFocus
                      className="field w-full pl-10 text-sm font-mono tracking-wider"
                    />
                  </div>
                  {masterError && (
                    <p className="mt-1.5 text-xs text-danger flex items-center gap-1">
                      <XCircle className="h-3.5 w-3.5 shrink-0" />
                      {masterError}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isAuthorizingMaster}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold text-sm transition-all shadow-card disabled:opacity-60 cursor-pointer"
                >
                  {isAuthorizingMaster ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                  Unlock Authenticator Setup
                </button>

                {isConfigured && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setMasterError("");
                      setMasterPassword("");
                    }}
                    className="w-full text-center text-xs text-muted hover:text-foreground pt-1 transition-colors"
                  >
                    &larr; Back to Admin Login
                  </button>
                )}
              </form>
            ) : (
              /* LOGIN OR VERIFY VIEW */
              <div className="space-y-6">
                {/* QR CODE (ONLY VISIBLE WHEN EXPLICITLY UNLOCKED BY MASTER KEY) */}
                {mode === "setup" && setupData && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="space-y-3 mb-6"
                  >
                    <div className="flex justify-center bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm">
                      <QRCodeSVG value={setupData.uri} size={160} />
                    </div>
                    <div className="flex flex-col items-center gap-1 p-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-edge text-center">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-muted">
                        Manual Setup Key
                      </span>
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-xs font-bold text-accent select-all">
                          {setupData.secret}
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(setupData.secret);
                            setCopiedKey(true);
                            setTimeout(() => setCopiedKey(false), 2000);
                          }}
                          className="text-xs text-muted hover:text-foreground flex items-center gap-1 cursor-pointer"
                        >
                          {copiedKey ? (
                            <Check className="w-3.5 h-3.5 text-success" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span className="text-[10px]">{copiedKey ? "Copied" : "Copy"}</span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* 6-DIGIT CODE INPUT */}
                <div>
                  <p
                    id="otp-label"
                    className="block text-xs font-semibold text-muted-strong mb-3 uppercase tracking-wider text-center"
                  >
                    {mode === "setup" ? "Verify Code to Finalize" : "Authenticator Code / Passkey"}
                  </p>

                  <motion.div
                    role="group"
                    aria-labelledby="otp-label"
                    animate={error ? { x: [-10, 10, -10, 10, 0] } : {}}
                    transition={{ duration: 0.4 }}
                    className="flex justify-center gap-2"
                    onPaste={handlePaste}
                  >
                    {otpValues.map((val, i) => (
                      <input
                        key={i}
                        ref={(el) => {
                          inputRefs.current[i] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        autoComplete={i === 0 ? "one-time-code" : "off"}
                        maxLength={1}
                        aria-label={`Digit ${i + 1} of ${DIGITS_TARGET}`}
                        aria-invalid={error ? true : undefined}
                        value={val}
                        disabled={isVerifying || isSuccess}
                        onChange={(e) => handleInputChange(i, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(i, e)}
                        autoFocus={i === 0}
                        className={`w-11 h-14 bg-white/60 dark:bg-black/40 border ${error
                            ? "border-danger/60 text-danger"
                            : isSuccess
                              ? "border-success/60 text-success"
                              : "border-edge"
                          } rounded-xl text-center text-2xl font-mono text-foreground focus:border-accent focus:ring-2 focus:ring-accent/30 transition-all duration-200 disabled:opacity-50`}
                      />
                    ))}
                  </motion.div>

                  {/* STATUS / ERROR */}
                  <div className="h-10 mt-4 flex items-center justify-center" aria-live="polite">
                    <AnimatePresence mode="wait">
                      {isVerifying || isSuccess ? (
                        <motion.div
                          key="status"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className={`flex items-center gap-2 font-medium text-xs sm:text-sm ${isSuccess ? "text-success" : "text-accent"
                            }`}
                        >
                          {isSuccess ? (
                            <>
                              <Check className="w-4 h-4 stroke-[2.5]" />
                              <span>Access Granted. Launching Admin...</span>
                            </>
                          ) : (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Verifying code...</span>
                            </>
                          )}
                        </motion.div>
                      ) : error ? (
                        <motion.p
                          key="error"
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 4 }}
                          className="text-xs text-danger font-medium flex items-center gap-1.5 text-center"
                        >
                          <XCircle className="w-4 h-4 shrink-0" />
                          {error}
                        </motion.p>
                      ) : null}
                    </AnimatePresence>
                  </div>
                </div>

                {/* SECURE RECONFIGURE OPTION */}
                {mode === "login" && (
                  <div className="pt-2 border-t border-edge/60 flex flex-col items-center text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setMode("reconfigure-locked");
                        setError("");
                      }}
                      className="text-xs text-muted hover:text-foreground flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5 text-accent" />
                      Pair New Phone or Reset Authenticator
                    </button>
                  </div>
                )}
              </div>
            )}


          </div>
        </div>
      </motion.div>
    </main>
  );
}
