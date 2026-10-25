"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { createApiKey, revokeApiKey } from "@/lib/api-keys";
import { getCurrentUser } from "@/lib/session";

const CreateKeyInput = z.object({ name: z.string().trim().min(1).max(50) });
const RevokeKeyInput = z.object({ id: z.coerce.number().int().positive() });

export type CreateKeyState = { key?: string; error?: string } | null;

export async function createKeyAction(
  _prev: CreateKeyState,
  formData: FormData,
): Promise<CreateKeyState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };

  const parsed = CreateKeyInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Name must be 1–50 characters." };

  const result = await createApiKey(user, parsed.data.name);
  if (!result.ok) {
    return {
      error:
        result.code === "DEMO_NOT_ALLOWED"
          ? "The shared demo account can't create API keys — create your own account."
          : "You can have up to 3 keys. Revoke one first.",
    };
  }

  refresh(); // re-render the table so the new key appears
  return { key: result.key };
}

export async function revokeKeyAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const parsed = RevokeKeyInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  await revokeApiKey(user.id, parsed.data.id);
  refresh(); // re-render the table without the revoked key
}
