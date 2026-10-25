"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { PasswordSchema, UsernameSchema } from "@/lib/password";
import { safeNextPath } from "@/lib/safe-next-path";
import { hitRateLimit } from "@/lib/rate-limit";
import { createSession, deleteSession } from "@/lib/session";
import { createUser, ensureDemoUser, verifyLogin } from "@/lib/users";

const LoginInput = z.object({
  username: z.string().trim().min(1).max(50),
  password: z.string().min(1).max(200),
  next: z.string().max(200).optional(),
});

const SignupInput = z.object({
  username: UsernameSchema,
  password: PasswordSchema,
  next: z.string().max(200).optional(),
});

export type LoginState = { error: string } | null;
export type SignupState = { error: string } | null;

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

export async function signup(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const parsed = SignupInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const badUsername = parsed.error.issues.some((issue) => issue.path[0] === "username");
    return {
      error: badUsername
        ? "Usernames are 3–20 letters, numbers or _."
        : "Passwords need at least 8 characters.",
    };
  }

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const limit = await hitRateLimit(`signup:${ip}`, 5, 3_600_000);
  if (!limit.allowed) {
    return { error: "Too many sign-ups from your network. Try again later." };
  }

  const result = await createUser(parsed.data.username, parsed.data.password);
  if (!result.ok) return { error: "That username is taken." };

  await createSession(result.user);
  redirect(safeNextPath(parsed.data.next));
}

// The shared demo account has no password, so this button is its only way in
export async function tryDemo(): Promise<void> {
  await createSession(await ensureDemoUser());
  redirect("/wallet");
}

export async function logout() {
  await deleteSession();
  redirect("/");
}
