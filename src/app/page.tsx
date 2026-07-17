import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f7f5ef] text-[#171512]">
      <section className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="flex flex-col justify-between px-6 py-6 sm:px-10 lg:px-14">
          <nav className="flex items-center justify-between">
            <Link href="/" className="text-sm font-semibold tracking-[0.18em]">
              PROJECT RENASCOR
            </Link>
            <Link
              href="/login"
              className="text-sm font-medium text-[#5c574d] transition hover:text-[#171512]"
            >
              Log in
            </Link>
          </nav>

          <div className="max-w-2xl py-20 lg:py-0">
            <p className="mb-5 font-mono text-xs uppercase tracking-[0.22em] text-[#7a6f5d]">
              Auth foundation
            </p>
            <h1 className="text-5xl font-semibold leading-[0.95] tracking-normal sm:text-7xl lg:text-8xl">
              Project Renascor
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[#5c574d]">
              A clean starting point for account creation, login, session
              persistence, and protected app pages.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex h-12 items-center justify-center bg-[#171512] px-6 text-sm font-semibold text-white transition hover:bg-[#2b2720]"
              >
                Create account
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex h-12 items-center justify-center border border-[#c9c0ae] px-6 text-sm font-semibold text-[#171512] transition hover:border-[#171512]"
              >
                View dashboard
              </Link>
            </div>
          </div>

          <p className="max-w-md text-sm leading-6 text-[#756d61]">
            Built with Next.js, TypeScript, Tailwind CSS, and Supabase Auth.
          </p>
        </div>

        <div className="relative min-h-[420px] overflow-hidden bg-[#151713] text-[#f7f5ef]">
          <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(#2d332a_1px,transparent_1px),linear-gradient(90deg,#2d332a_1px,transparent_1px)] [background-size:42px_42px]" />
          <div className="relative flex h-full flex-col justify-between p-6 sm:p-10 lg:p-14">
            <div className="flex items-center justify-between font-mono text-xs uppercase tracking-[0.18em] text-[#aab69a]">
              <span>Session</span>
              <span>Secured</span>
            </div>
            <div className="space-y-7">
              <div>
                <p className="font-mono text-sm text-[#aab69a]">/dashboard</p>
                <h2 className="mt-3 max-w-lg text-4xl font-semibold leading-tight sm:text-5xl">
                  Protected pages stay closed until the session is valid.
                </h2>
              </div>
              <div className="grid gap-px overflow-hidden border border-[#394034] bg-[#394034] sm:grid-cols-3">
                {["Sign up", "Log in", "Persist"].map((item) => (
                  <div key={item} className="bg-[#151713] p-5">
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#aab69a]">
                      Ready
                    </p>
                    <p className="mt-8 text-xl font-semibold">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
