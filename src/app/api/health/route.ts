import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { logError } from "@/lib/observability";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";

type HealthStatus = "ok" | "degraded";

type HealthCheck = {
  status: HealthStatus;
  durationMs?: number;
  error?: string;
};

function envCheck(): HealthCheck {
  const hasUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasPublishableKey = Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  if (hasUrl && hasPublishableKey) {
    return { status: "ok" };
  }

  return {
    status: "degraded",
    error: "Missing required Supabase environment variables.",
  };
}

async function supabaseCheck(): Promise<HealthCheck> {
  const startedAt = Date.now();
  const supabase = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { error } = await supabase
    .from("programs")
    .select("id")
    .limit(1);

  const durationMs = Date.now() - startedAt;

  if (error) {
    logError("health.supabase.failed", error, {
      route: "/api/health",
      operation: "supabaseCheck",
      durationMs,
    });

    return {
      status: "degraded",
      durationMs,
      error: error.message,
    };
  }

  return { status: "ok", durationMs };
}

export async function GET() {
  const checks = {
    env: envCheck(),
    supabase: await supabaseCheck(),
  };
  const status: HealthStatus = Object.values(checks).every(
    (check) => check.status === "ok",
  )
    ? "ok"
    : "degraded";

  return NextResponse.json(
    {
      status,
      service: "project-renascor",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: status === "ok" ? 200 : 503 },
  );
}
