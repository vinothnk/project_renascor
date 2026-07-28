import Link from "next/link";
import { redirect } from "next/navigation";
import { logIn } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#0b0d0c] text-[#f5f1ea]">
      <section className="mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 overflow-x-hidden lg:grid-cols-[0.95fr_1.05fr]">
        <div className="min-w-0 px-5 py-5 sm:px-8 lg:flex lg:min-h-screen lg:flex-col lg:justify-between lg:px-10">
          <header className="flex h-12 items-center justify-between">
            <Link
              href="/login"
              className="text-sm font-bold tracking-[0.18em] text-[#f8f3ec]"
            >
              RENASCOR
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-10 items-center justify-center rounded-full border border-[#343936] px-4 text-sm font-semibold text-[#d6d0c8] transition hover:border-[#f5f1ea] hover:text-white"
            >
              New user
            </Link>
          </header>

          <div className="w-full max-w-[340px] py-8 sm:max-w-lg sm:py-10 lg:max-w-none lg:py-0">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#ff4348]">
              Training log access
            </p>
            <h1 className="mt-4 max-w-xl text-3xl font-semibold leading-[1.06] text-white sm:text-5xl">
              Log in to continue your training record.
            </h1>
            <p className="mt-4 max-w-[340px] text-base leading-7 text-[#b7b0a7] sm:max-w-md">
              Your account tells Renascor whether to restore an existing
              dashboard or start a first-time setup flow.
            </p>
          </div>

          <div className="hidden border-t border-[#242826] pt-6 text-sm leading-6 text-[#928b83] lg:block">
            Built for quick set logging, durable workout history, and quiet
            progress tracking.
          </div>
        </div>

        <div className="min-w-0 px-5 pb-8 sm:px-8 lg:flex lg:min-h-screen lg:items-center lg:px-10 lg:py-10">
          <section className="w-full max-w-[350px] min-w-0 rounded-[18px] border border-[#272b29] bg-[#121514] p-5 shadow-2xl shadow-black/30 sm:max-w-md sm:p-7 lg:max-w-none">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#8d9790]">
                  Welcome
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  Sign in
                </h2>
              </div>
              <div className="shrink-0 rounded-full bg-[#1c211f] px-3 py-1 text-xs font-semibold text-[#aeb7b0]">
                Secure session
              </div>
            </div>

            {params.message ? (
              <p className="mt-5 rounded-[10px] border border-[#31422c] bg-[#172216] px-4 py-3 text-sm leading-5 text-[#bfe6b4]">
                {params.message}
              </p>
            ) : null}
            {params.error ? (
              <p className="mt-5 rounded-[10px] border border-[#512b2d] bg-[#211314] px-4 py-3 text-sm leading-5 text-[#ffb8b8]">
                {params.error}
              </p>
            ) : null}

            <form action={logIn} className="mt-7 space-y-5">
              <label className="block">
                <span className="text-sm font-semibold text-[#f5f1ea]">
                  Email
                </span>
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  required
                  className="mt-2 h-14 w-full rounded-[12px] border border-[#303633] bg-[#090b0a] px-4 text-base text-white outline-none transition placeholder:text-[#6f7771] focus:border-[#ff4348] focus:ring-4 focus:ring-[#ff4348]/15"
                  placeholder="you@example.com"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-[#f5f1ea]">
                  Password
                </span>
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="mt-2 h-14 w-full rounded-[12px] border border-[#303633] bg-[#090b0a] px-4 text-base text-white outline-none transition placeholder:text-[#6f7771] focus:border-[#ff4348] focus:ring-4 focus:ring-[#ff4348]/15"
                  placeholder="Enter your password"
                />
              </label>

              <button className="h-14 w-full rounded-[14px] bg-[#ff343a] text-base font-bold text-white shadow-lg shadow-[#ff343a]/20 transition hover:bg-[#ff4d52] focus:outline-none focus:ring-4 focus:ring-[#ff343a]/25 active:scale-[0.99]">
                Log in
              </button>
            </form>

            <div className="mt-6 grid gap-3 border-t border-[#252a27] pt-5 sm:grid-cols-2">
              <Link
                href="/signup"
                className="flex min-h-16 flex-col justify-center rounded-[12px] border border-[#303633] px-4 transition hover:border-[#aeb7b0]"
              >
                <span className="text-sm font-semibold text-white">
                  First time here?
                </span>
                <span className="mt-1 text-sm text-[#aeb7b0]">
                  Create your account
                </span>
              </Link>
              <div className="flex min-h-16 flex-col justify-center rounded-[12px] border border-[#252a27] bg-[#171b19] px-4">
                <span className="text-sm font-semibold text-white">
                  Already logged in?
                </span>
                <span className="mt-1 text-sm text-[#aeb7b0]">
                  You will be sent to the dashboard
                </span>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
