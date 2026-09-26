"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function CheckEmailPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email");

  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState("");

  async function handleResend() {
    if (!email || resending || resent) return;

    setResending(true);
    setError("");

    try {
      const { error } = await authClient.sendVerificationEmail({
        email,
      });

      if (error) {
        setError(
          error.message ?? "Couldn't resend the verification email."
        );
        return;
      }

      setResent(true);
    } catch (err) {
      console.error("Resend verification error:", err);
      setError("Couldn't resend the verification email.");
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="flex min-h-screen bg-[#14130F] font-sans text-[#F3F0E8]">
      {/* Brand panel */}
      <div className="relative hidden w-[42%] flex-col justify-between bg-[#0D0C09] px-12 py-12 text-[#F3F0E8] lg:flex">
        <div
          className="text-lg"
          style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
        >
          AskSource
        </div>

        <div className="max-w-sm">
          <p
            className="text-[32px] leading-[1.15] text-[#F3F0E8]"
            style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
          >
            Every answer,
            <br />
            traced back to where
            <br />
            it came from.
            <sup className="ml-1 text-base text-[#6E6A5C]">1</sup>
          </p>

          <p className="mt-6 border-t border-[#2A281F] pt-4 text-sm leading-relaxed text-[#8F8A7B]">
            <sup className="mr-1">1</sup>
            No guessing which document said what — every claim links
            straight to its source.
          </p>
        </div>

        <p className="text-xs text-[#5C594C]">
          © {new Date().getFullYear()} AskSource
        </p>
      </div>

      {/* Content panel */}
      <div className="flex w-full items-center justify-center px-6 py-16 lg:w-[58%]">
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <span
              className="text-lg"
              style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
            >
              AskSource
            </span>
          </div>

          <p className="text-[13px] tracking-wide text-[#8F8A7B]">
            Verification sent
            <sup className="ml-1 text-[#6E6A5C]">2</sup>
          </p>

          <h1
            className="mt-3 text-[26px] text-[#F3F0E8]"
            style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
          >
            Check your email
          </h1>

          <p className="mt-2 text-sm text-[#8F8A7B]">
            We sent a verification link to
          </p>

          {email && (
            <p className="mt-1 break-all border-b border-[#3A372F] pb-2 text-sm font-medium text-[#F3F0E8]">
              {email}
            </p>
          )}

          <p className="mt-6 border-l-2 border-[#3A372F] pl-3 text-sm leading-relaxed text-[#8F8A7B]">
            <sup className="mr-1 text-[#6E6A5C]">2</sup>
            Click the link in the email to verify your account and continue.
          </p>

          <button
            type="button"
            onClick={handleResend}
            disabled={resending || resent || !email}
            className="mt-8 w-full border border-[#F3F0E8] py-2.5 text-sm text-[#F3F0E8] transition-colors hover:bg-[#F3F0E8] hover:text-[#14130F] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent disabled:hover:text-[#F3F0E8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8FAAD1]"
          >
            {resent
              ? "Email resent"
              : resending
                ? "Resending…"
                : "Resend email"}
          </button>

          {error && (
            <p className="mt-3 text-center text-xs text-red-400">
              {error}
            </p>
          )}

          <p className="mt-6 text-center text-xs text-[#5C594C]">
            Didn't receive the email? Check your spam folder.
          </p>
        </div>
      </div>
    </main>
  );
}