import { type NextRequest, NextResponse } from "next/server";
import { logError, logInfo } from "@/lib/observability";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      logError("auth.callback.failed", error, {
        route: "/auth/confirm",
        operation: "exchangeCodeForSession",
      });

      return NextResponse.redirect(
        new URL(
          `/login?error=${encodeURIComponent("Could not confirm your login link.")}`,
          request.url,
        ),
      );
    }

    logInfo("auth.callback.completed", {
      route: "/auth/confirm",
      operation: "exchangeCodeForSession",
    });
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
