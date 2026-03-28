"use server";

import { signIn } from "@/lib/auth";
import { loginSchema, type LoginInput } from "@/modules/auth/schemas/login.schema";
import { AuthError } from "next-auth";

export async function loginAction(data: LoginInput) {
  const parsed = loginSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  try {
    await signIn("credentials", {
      username: parsed.data.username,
      password: parsed.data.password,
      redirect: false,
    });
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid username or password" };
    }
    throw error;
  }
}
