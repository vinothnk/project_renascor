"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { logError, logInfo } from "@/lib/observability";
import { createClient } from "@/lib/supabase/server";

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function errorRedirect(path: string, message: string) {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function signUp(formData: FormData) {
  const email = formValue(formData, "email");
  const password = formValue(formData, "password");

  if (!email || !password) {
    errorRedirect("/signup", "Email and password are required.");
  }

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  });

  if (error) {
    logError("auth.signup.failed", error, {
      route: "/signup",
      operation: "signUp",
    });
    errorRedirect("/signup", error.message);
  }

  logInfo("auth.signup.completed", {
    route: "/signup",
    operation: "signUp",
  });
  redirect(
    "/login?message=Account created. Check your email to confirm your address, then log in.",
  );
}

export async function logIn(formData: FormData) {
  const email = formValue(formData, "email");
  const password = formValue(formData, "password");

  if (!email || !password) {
    errorRedirect("/login", "Email and password are required.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    logError("auth.login.failed", error, {
      route: "/login",
      operation: "logIn",
    });
    errorRedirect("/login", error.message);
  }

  logInfo("auth.login.completed", {
    route: "/login",
    operation: "logIn",
  });
  redirect("/dashboard");
}

export async function logOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    logError("auth.logout.failed", error, {
      route: "/dashboard",
      operation: "logOut",
    });
  } else {
    logInfo("auth.logout.completed", {
      route: "/dashboard",
      operation: "logOut",
    });
  }

  redirect("/login?message=You have been logged out.");
}
