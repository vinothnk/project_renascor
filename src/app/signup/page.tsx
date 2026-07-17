import Link from "next/link";
import { signUp } from "@/app/auth/actions";

type SignUpPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const params = await searchParams;

  return (
    <main className="grid min-h-screen bg-[#f7f5ef] text-[#171512] lg:grid-cols-[1.1fr_0.9fr]">
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <Link href="/" className="text-sm font-semibold tracking-[0.18em]">
            PROJECT RENASCOR
          </Link>
          <div className="mt-12 border border-[#d9d0bd] bg-[#fffdf8] p-6 sm:p-8">
            <h1 className="text-3xl font-semibold">Create account</h1>
            <p className="mt-3 text-sm leading-6 text-[#6b6256]">
              Start with email and password. Profile details come next.
            </p>

            {params.error ? (
              <p className="mt-6 bg-[#f7e8e4] px-4 py-3 text-sm text-[#7a3327]">
                {params.error}
              </p>
            ) : null}

            <form action={signUp} className="mt-8 space-y-5">
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
                  autoComplete="new-password"
                  minLength={6}
                  required
                  className="mt-2 h-12 w-full border border-[#cfc5b2] bg-white px-4 text-base outline-none transition focus:border-[#171512]"
                />
              </label>
              <button className="h-12 w-full bg-[#171512] text-sm font-semibold text-white transition hover:bg-[#2b2720]">
                Sign up
              </button>
            </form>

            <p className="mt-6 text-sm text-[#6b6256]">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-[#171512]">
                Log in
              </Link>
            </p>
          </div>
        </div>
      </section>

      <section className="hidden bg-[#151713] p-12 text-[#f7f5ef] lg:flex lg:flex-col lg:justify-between">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#aab69a]">
          First checkpoint
        </p>
        <div>
          <h2 className="text-5xl font-semibold leading-tight">
            One account unlocks the protected workspace.
          </h2>
          <p className="mt-6 max-w-md leading-7 text-[#c3cdb8]">
            The first draft keeps registration simple so the auth flow is easy
            to understand and test.
          </p>
        </div>
      </section>
    </main>
  );
}
