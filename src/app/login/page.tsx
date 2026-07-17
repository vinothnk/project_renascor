import Link from "next/link";
import { logIn } from "@/app/auth/actions";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <main className="grid min-h-screen bg-[#f7f5ef] text-[#171512] lg:grid-cols-[0.9fr_1.1fr]">
      <section className="hidden bg-[#151713] p-12 text-[#f7f5ef] lg:flex lg:flex-col lg:justify-between">
        <Link href="/" className="text-sm font-semibold tracking-[0.18em]">
          PROJECT RENASCOR
        </Link>
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#aab69a]">
            Welcome back
          </p>
          <h1 className="mt-4 text-5xl font-semibold leading-tight">
            Continue from the account you already created.
          </h1>
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <Link href="/" className="text-sm font-semibold lg:hidden">
            PROJECT RENASCOR
          </Link>
          <div className="mt-12 border border-[#d9d0bd] bg-[#fffdf8] p-6 sm:p-8 lg:mt-0">
            <h2 className="text-3xl font-semibold">Log in</h2>
            <p className="mt-3 text-sm leading-6 text-[#6b6256]">
              Use your email and password to open the dashboard.
            </p>

            {params.message ? (
              <p className="mt-6 bg-[#edf5e8] px-4 py-3 text-sm text-[#35522f]">
                {params.message}
              </p>
            ) : null}
            {params.error ? (
              <p className="mt-6 bg-[#f7e8e4] px-4 py-3 text-sm text-[#7a3327]">
                {params.error}
              </p>
            ) : null}

            <form action={logIn} className="mt-8 space-y-5">
              <label className="block">
                <span className="text-sm font-medium">Email</span>
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="mt-2 h-12 w-full border border-[#cfc5b2] bg-white px-4 text-base outline-none transition focus:border-[#171512]"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Password</span>
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="mt-2 h-12 w-full border border-[#cfc5b2] bg-white px-4 text-base outline-none transition focus:border-[#171512]"
                />
              </label>
              <button className="h-12 w-full bg-[#171512] text-sm font-semibold text-white transition hover:bg-[#2b2720]">
                Log in
              </button>
            </form>

            <p className="mt-6 text-sm text-[#6b6256]">
              Need an account?{" "}
              <Link href="/signup" className="font-semibold text-[#171512]">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
