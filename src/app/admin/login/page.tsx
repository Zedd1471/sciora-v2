"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Check, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { generateSecret, generateTOTPUri, verifyTOTP } from "@/lib/totp";
import { useMounted } from "@/lib/useMounted";

const DIGITS_TARGET = 6;
const EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

export default function AdminLogin() {
  const mounted = useMounted();
  const [boot] = useState(() => {
    if (typeof window === "undefined") {
      return { mode: "login" as const, secret: "", uri: "" };
    }
    const storedSecret = localStorage.getItem("sciora_admin_totp_secret");
    if (storedSecret) return { mode: "login" as const, secret: storedSecret, uri: "" };
    // No secret yet — force setup mode.
    const secret = generateSecret();
    return {
      mode: "setup" as const,
      secret,
      uri: generateTOTPUri({ issuer: "Sciora V2", label: "Admin", secret }),
    };
  });
  const mode = mounted ? boot.mode : "login";
  const setupSecret = boot.secret;
  const setupUri = boot.uri;

  const [isVerifying, setIsVerifying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [otpValues, setOtpValues] = useState<string[]>(Array(DIGITS_TARGET).fill(""));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [error, setError] = useState("");
  const router = useRouter();

  const verifyCode = async (code: string) => {
    if (code.length !== DIGITS_TARGET || isVerifying || isSuccess) return;
    
    setIsVerifying(true);
    setError("");

    if (mode === "setup") {
      const isValid = await verifyTOTP(code, setupSecret);
      if (isValid) {
        setIsSuccess(true);
        setTimeout(() => {
          localStorage.setItem("sciora_admin_totp_secret", setupSecret);
          localStorage.setItem("sciora_admin_auth", "true");
          router.push("/admin");
        }, 1200);
      } else {
        setError("Invalid code. Please try again.");
        setIsVerifying(false);
        setOtpValues(Array(DIGITS_TARGET).fill(""));
        inputRefs.current[0]?.focus();
      }
    } else {
      const storedSecret = localStorage.getItem("sciora_admin_totp_secret");
      if (!storedSecret) return setIsVerifying(false);
      
      const isValid = await verifyTOTP(code, storedSecret);
      if (isValid) {
        setIsSuccess(true);
        setTimeout(() => {
          localStorage.setItem("sciora_admin_auth", "true");
          router.push("/admin");
        }, 1200);
      } else {
        setError("Invalid code. Enter exactly 6 digits.");
        setIsVerifying(false);
        setOtpValues(Array(DIGITS_TARGET).fill(""));
        inputRefs.current[0]?.focus();
      }
    }
  };

  const handleInputChange = (index: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    
    const newChar = val.slice(-1);
    const newValues = [...otpValues];
    newValues[index] = newChar;
    setOtpValues(newValues);
    setError("");

    // Auto-advance
    if (newChar !== "" && index < DIGITS_TARGET - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit if all digits are filled
    const currentCode = newValues.join("");
    if (currentCode.length === DIGITS_TARGET) {
      verifyCode(currentCode);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && otpValues[index] === "" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, DIGITS_TARGET);
    if (!pastedData) return;

    const newValues = [...otpValues];
    pastedData.split("").forEach((char, i) => {
      if (i < DIGITS_TARGET) newValues[i] = char;
    });
    setOtpValues(newValues);
    setError("");

    const targetIndex = Math.min(pastedData.length, DIGITS_TARGET - 1);
    inputRefs.current[targetIndex]?.focus();

    if (pastedData.length === DIGITS_TARGET) {
      verifyCode(newValues.join(""));
    }
  };

  return (
    <main
      id="main-content"
      className="min-h-[100dvh] flex items-center justify-center p-6 relative z-10"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, filter: "blur(12px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.6, ease: EXPO }}
        className="w-full max-w-sm"
      >
        <div className="card-outer border-indigo-500/20 dark:border-indigo-500/15">
          <div className="card-inner p-8">
            <div className="flex flex-col items-center mb-8">
              <div className="mb-5 relative">
                <motion.div
                  animate={{ boxShadow: ["0 0 0 0 rgba(99,102,241,0.3)", "0 0 0 14px rgba(99,102,241,0)", "0 0 0 0 rgba(99,102,241,0)"] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut" }}
                  className="w-16 h-16 rounded-2xl bg-indigo-500/10 dark:bg-indigo-900/40 border border-indigo-500/25 flex items-center justify-center"
                >
                  <ShieldCheck className="w-7 h-7 text-accent" aria-hidden="true" />
                </motion.div>
              </div>

              <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-accent mb-2">
                Secure Access
              </span>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                {mode === "setup" ? "Setup Authenticator" : "Admin Gateway"}
              </h1>
              <p className="text-muted mt-2 text-center text-sm leading-relaxed">
                {mode === "setup"
                  ? "Scan this QR code in Google Authenticator or Authy, then enter the code."
                  : "Secured by Authenticator. Enter your 6-digit code."}
              </p>
            </div>

            {mode === "setup" && setupUri && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="flex justify-center mb-6 bg-white p-4 rounded-xl border border-neutral-200 shadow-sm"
              >
                <QRCodeSVG value={setupUri} size={160} />
              </motion.div>
            )}

            <div className="space-y-6">
              <div>
                <p
                  id="otp-label"
                  className="block text-xs font-semibold text-muted-strong mb-3 uppercase tracking-wide text-center"
                >
                  {mode === "setup" ? "Verify Code" : "Authenticator Code"}
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
                      ref={(el) => { inputRefs.current[i] = el; }}
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
                      className={`w-11 h-14 bg-white/60 dark:bg-black/40 border ${error ? 'border-danger/50 text-danger' : isSuccess ? 'border-success/50 text-success' : 'border-edge'} rounded-xl text-center text-2xl font-mono text-foreground focus:border-accent focus:ring-2 focus:ring-accent/30 transition-all duration-200 disabled:opacity-50`}
                    />
                  ))}
                </motion.div>
                
                <div className="h-12 mt-6 flex items-center justify-center" aria-live="polite">
                  <AnimatePresence mode="wait">
                    {(isVerifying || isSuccess) ? (
                      <motion.div
                        key="status"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className={`flex items-center gap-2 font-medium transition-colors duration-300 ${isSuccess ? 'text-success' : 'text-accent'}`}
                      >
                        <div className="relative w-6 h-6 flex items-center justify-center">
                          <AnimatePresence mode="wait">
                            {isSuccess ? (
                              <motion.div
                                key="tick"
                                initial={{ scale: 0, rotate: -90 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                className="absolute inset-0 bg-success rounded-full flex items-center justify-center"
                              >
                                <Check className="w-4 h-4 text-white" strokeWidth={3} />
                              </motion.div>
                            ) : (
                              <motion.div
                                key="spinner"
                                exit={{ scale: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="absolute inset-0 rounded-full border-2 border-accent/30 border-t-accent animate-spin"
                              />
                            )}
                          </AnimatePresence>
                        </div>
                        <motion.span
                          key={isSuccess ? "verified" : "verifying"}
                          initial={{ opacity: 0, x: -5 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          {isSuccess ? "Verified" : "Verifying..."}
                        </motion.span>
                      </motion.div>
                    ) : error ? (
                      <motion.p
                        key="error"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-danger text-sm font-medium flex items-center gap-2"
                        role="alert"
                      >
                        <XCircle className="w-4 h-4" />
                        {error}
                      </motion.p>
                    ) : null}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </main>
  );
}
