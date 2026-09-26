"use client";

import { useState } from "react";
import { authClient, useSession } from "@/lib/auth-client";

type Mode = "signin" | "signup";

type FieldErrors = {
  name?: string;
  email?: string;
  password?: string;
  form?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AuthPage() {
  const { data: session, isPending } = useSession();

  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (mode === "signup" && name.trim().length < 1) {
      next.name = "Enter your name.";
    }
    if (!EMAIL_RE.test(email)) {
      next.email = "Enter a valid email address.";
    }
    if (password.length < 8) {
      next.password = "Use at least 8 characters.";
    }
    return next;
  }

  async function handleSubmit() {
    const fieldErrors = validate();
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    setSubmitting(true);
    const { error } =
      mode === "signup"
        ? await authClient.signUp.email({ email, password, name: name.trim() })
        : await authClient.signIn.email({ email, password });
    setSubmitting(false);

    if (error) {
      console.error("Signup error:", error);
      setErrors({
        form: error.message ?? "Something went wrong. Try again.",
      });
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setErrors({});
  }

  async function handleSignOut() {
    await authClient.signOut();
  }

  if (isPending) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#14130F]">
        <p className="font-sans text-sm text-[#8F8A7B]">Loading…</p>
      </main>
    );
  }

  if (session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#14130F] px-6">
        <div className="w-full max-w-sm text-center">
          <p className="font-sans text-[13px] tracking-wide text-[#8F8A7B]">
            Signed in
          </p>
          <h1
            className="mt-3 text-3xl text-[#F3F0E8]"
            style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
          >
            Welcome back, {session.user.name}
          </h1>
          <p className="mt-2 font-sans text-sm text-[#8F8A7B]">
            {session.user.email}
          </p>
          <button
            onClick={handleSignOut}
            className="mt-8 w-full border border-[#F3F0E8] py-2.5 font-sans text-sm text-[#F3F0E8] transition-colors hover:bg-[#F3F0E8] hover:text-[#14130F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8FAAD1]"
          >
            Sign out
          </button>
        </div>
      </main>
    );
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

      {/* Form panel */}
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

          <h1
            className="text-[26px] text-[#F3F0E8]"
            style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
          >
            {mode === "signup" ? "Create your account" : "Sign in"}
          </h1>
          <p className="mt-1.5 text-sm text-[#8F8A7B]">
            {mode === "signup"
              ? "Start asking questions with sources attached."
              : "Welcome back — enter your details to continue."}
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit();
            }}
            noValidate
            className="mt-8 space-y-5"
          >
            {mode === "signup" && (
              <Field label="Name" error={errors.name}>
                <input
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass(!!errors.name)}
                  placeholder="Ada Lovelace"
                />
              </Field>
            )}

            <Field label="Email" error={errors.email}>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass(!!errors.email)}
                placeholder="you@company.com"
              />
            </Field>

            <Field label="Password" error={errors.password}>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClass(!!errors.password)} pr-16`}
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-0 top-0 h-full px-2 text-xs text-[#8F8A7B] underline decoration-[#3A372F] underline-offset-2 hover:text-[#F3F0E8]"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </Field>

            {errors.form && (
              <p
                role="alert"
                className="border-l-2 border-[#E2725B] pl-3 text-sm text-[#E2725B]"
              >
                {errors.form}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#F3F0E8] py-2.5 text-sm text-[#14130F] transition-colors hover:bg-[#8FAAD1] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8FAAD1]"
            >
              {submitting
                ? mode === "signup"
                  ? "Creating account…"
                  : "Signing in…"
                : mode === "signup"
                  ? "Create account"
                  : "Sign in"}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-[#8F8A7B]">
            {mode === "signup" ? (
              <>
                Already have an account?{" "}
                <button
                  onClick={() => switchMode("signin")}
                  className="text-[#F3F0E8] underline decoration-[#3A372F] underline-offset-2 hover:decoration-[#F3F0E8]"
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                New to AskSource?{" "}
                <button
                  onClick={() => switchMode("signup")}
                  className="text-[#F3F0E8] underline decoration-[#3A372F] underline-offset-2 hover:decoration-[#F3F0E8]"
                >
                  Create an account
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </main>
  );
}

function inputClass(hasError: boolean) {
  return [
    "w-full border-b bg-transparent py-2 text-[15px] text-[#F3F0E8] outline-none transition-colors",
    "placeholder:text-[#5C594C]",
    "focus-visible:border-[#8FAAD1]",
    hasError ? "border-[#E2725B]" : "border-[#3A372F]",
  ].join(" ");
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] text-[#8F8A7B]">{label}</span>
      {children}
      {error && <span className="mt-1.5 block text-xs text-[#E2725B]">{error}</span>}
    </label>
  );
}