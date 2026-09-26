"use client";

import { useState } from "react";
import { authClient, useSession } from "@/lib/auth-client";

export default function AuthPage() {
  const { data: session, isPending } = useSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSignUp() {
    const { error } = await authClient.signUp.email({
      email,
      password,
      name: email.split("@")[0],
    });

    if (error) {
      alert(error.message);
    }
  }

  async function handleSignIn() {
    const { error } = await authClient.signIn.email({
      email,
      password,
    });

    if (error) {
      alert(error.message);
    }
  }

  async function handleSignOut() {
    await authClient.signOut();
  }

  if (isPending) {
    return <p>Loading...</p>;
  }

  if (session) {
    return (
      <main>
        <h1>Welcome, {session.user.name}</h1>
        <p>{session.user.email}</p>

        <button onClick={handleSignOut}>Sign Out</button>
      </main>
    );
  }

  return (
    <main>
      <h1>AskSource</h1>

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button onClick={handleSignUp}>Sign Up</button>
      <button onClick={handleSignIn}>Sign In</button>
    </main>
  );
}