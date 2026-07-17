import Link from "next/link";
import { redirect } from "next/navigation";
import { logOut } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims) {
    redirect("/login?message=Log in to view the dashboard.");
  }

  const { data: userData } = await supabase.auth.getUser();
  const email = userData.user?.email ?? claimsData.claims.email ?? "Signed in";

  return (
    <main className="min-h-screen bg-[#f7f5ef] text-[#171512]">
      <header className="border-b border-[#ddd4c3] px-6 py-5 sm:px-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="text-sm font-semibold tracking-[0.18em]">
            PROJECT RENASCOR
          </Link>
          <form action={logOut}>
            <button className="text-sm font-semibold text-[#6b6256] transition hover:text-[#171512]">
              Log out
            </button>
          </form>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-10 sm:px-10 lg:grid-cols-[0.75fr_1.25fr]">
        <aside>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#7a6f5d]">
            Protected route
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight">
            Dashboard
          </h1>
          <p className="mt-4 leading-7 text-[#6b6256]">
            This page only renders after Supabase verifies the current session.
          </p>
        </aside>

        <div className="space-y-8">
          <section className="border-y border-[#ddd4c3] py-6">
            <p className="text-sm text-[#6b6256]">Signed in as</p>
            <p className="mt-2 break-all font-mono text-lg">{email}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Authentication checklist</h2>
            <div className="mt-5 divide-y divide-[#ddd4c3] border-y border-[#ddd4c3]">
              {[
                "Supabase project connected",
                "Environment variables loaded",
                "Sign up form wired",
                "Login form wired",
                "Logout action wired",
                "Dashboard route protected",
                "Users table designed",
                "Login persistence confirmed",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center justify-between gap-6 py-4"
                >
                  <span>{item}</span>
                  <span className="font-mono text-xs uppercase tracking-[0.18em] text-[#497942]">
                    Done
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-[#151713] p-6 text-[#f7f5ef]">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#aab69a]">
              Next
            </p>
            <h2 className="mt-4 text-2xl font-semibold">
              Deploy and verify authentication
            </h2>
            <p className="mt-3 max-w-2xl leading-7 text-[#c3cdb8]">
              The next step is to publish the app, add the Supabase environment
              variables to the host, and test sign in on the live URL.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
