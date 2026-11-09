import { describe, it, expect } from "vitest";
import {
  generateAttendanceSecret,
  getLiveAttendanceCode,
  verifyAttendanceCode,
  generateTOTPForStep,
  normalizeStudentId,
  validateStudentIdFormat,
} from "./attendance";

describe("Attendance Utilities", () => {
  it("normalizes student IDs correctly", () => {
    expect(normalizeStudentId("  bth/19/0421 ")).toBe("BTH/19/0421");
    expect(normalizeStudentId("mcb/12a/3456")).toBe("MCB/12A/3456");
    expect(normalizeStudentId("")).toBe("");
  });

  it("validates student ID formats", () => {
    expect(validateStudentIdFormat("BTH/19/0421")).toBe(true);
    expect(validateStudentIdFormat("MCB/12A/3456")).toBe(true);
    expect(validateStudentIdFormat("CSC/2021/1001")).toBe(true);
    expect(validateStudentIdFormat("invalid-id")).toBe(false);
    expect(validateStudentIdFormat("12345")).toBe(false);
    expect(validateStudentIdFormat("")).toBe(false);
  });

  it("generates a valid secret and dynamic TOTP code", async () => {
    const secret = generateAttendanceSecret();
    expect(secret).toBeDefined();
    expect(secret.length).toBeGreaterThan(10);

    const { code, secondsRemaining } = await getLiveAttendanceCode(secret, 20);
    expect(code).toMatch(/^\d{6}$/);
    expect(secondsRemaining).toBeGreaterThanOrEqual(1);
    expect(secondsRemaining).toBeLessThanOrEqual(20);

    // Verify current code passes
    const isValid = await verifyAttendanceCode(code, secret, 20);
    expect(isValid).toBe(true);

    // Verify invalid code fails
    const isInvalid = await verifyAttendanceCode(code === "000000" ? "999999" : "000000", secret, 20);
    expect(isInvalid).toBe(false);
  });

  it("handles window tolerance correctly (current step, ±1 step, and rejects distant steps)", async () => {
    const secret = generateAttendanceSecret();
    const now = Math.floor(Date.now() / 1000);
    const stepSeconds = 20;
    const currentStep = Math.floor(now / stepSeconds);

    const currentCode = await generateTOTPForStep(secret, currentStep);
    const prevCode = await generateTOTPForStep(secret, currentStep - 1);
    const nextCode = await generateTOTPForStep(secret, currentStep + 1);
    const farFutureCode = await generateTOTPForStep(secret, currentStep + 5);
    const farPastCode = await generateTOTPForStep(secret, currentStep - 5);

    expect(await verifyAttendanceCode(currentCode, secret, stepSeconds)).toBe(true);
    expect(await verifyAttendanceCode(prevCode, secret, stepSeconds)).toBe(true);
    expect(await verifyAttendanceCode(nextCode, secret, stepSeconds)).toBe(true);

    // Far past/future should be rejected as expired
    expect(await verifyAttendanceCode(farFutureCode, secret, stepSeconds)).toBe(false);
    expect(await verifyAttendanceCode(farPastCode, secret, stepSeconds)).toBe(false);
  });
});
