"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, deleteSession } from "@/lib/session";
import { verifyLogin } from "@/lib/users";

const LoginInput = z.object({
  username: z.string().trim().min(1).max(50),
  password: z.string().min(1).max(200),
  next: z.string().max(200).optional(),
});

export type LoginState = { error: string } | null;

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = LoginInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter your username and password." };

  const user = await verifyLogin(parsed.data.username, parsed.data.password);
  if (!user) {
    // Never say which field was wrong: that would confirm valid usernames to an attacker
    return { error: "Invalid username or password." };
  }

  await createSession(user);
  redirect(safeNextPath(parsed.data.next)); // redirect() throws, so nothing runs after it
}

export async function logout() {
  await deleteSession();
  redirect("/");
}

// Only allow paths on our own site. Without this, a phishing link like
// /login?next=https://evil.com would send users to an attacker right after a real login
// (an "open redirect"). Parsing with URL also catches tricks like "//evil.com" and "/\evil.com".
function safeNextPath(next: string | undefined) {
  if (!next) return "/favorites";
  const base = "http://internal";
  const url = new URL(next, base);
  return url.origin === base ? `${url.pathname}${url.search}` : "/favorites";
}
