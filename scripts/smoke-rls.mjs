import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const envFiles = [".env.local", ".env"];

for (const envFile of envFiles) {
  const envPath = resolve(process.cwd(), envFile);

  if (!existsSync(envPath)) {
    continue;
  }

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const userAEmail = process.env.RLS_TEST_USER_A_EMAIL ?? "rls-athlete-a@example.com";
const userBEmail = process.env.RLS_TEST_USER_B_EMAIL ?? "rls-athlete-b@example.com";
const userPassword = process.env.RLS_TEST_USER_PASSWORD ?? "Renascor-rls-test-2026!";

const requiredEnv = {
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
  SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
};

const missingEnv = Object.entries(requiredEnv)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingEnv.length > 0) {
  console.error(`Missing required environment variables: ${missingEnv.join(", ")}`);
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function userClient() {
  return createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function expectSuccess(label, operation) {
  const result = await operation();

  if (result.error) {
    throw new Error(`${label} failed unexpectedly: ${result.error.message}`);
  }

  console.log(`PASS ${label}`);
  return result;
}

async function expectFailure(label, operation) {
  const result = await operation();

  if (!result.error) {
    throw new Error(`${label} succeeded unexpectedly`);
  }

  console.log(`PASS ${label}`);
  return result;
}

async function expectNoRows(label, operation) {
  const result = await operation();

  if (result.error) {
    throw new Error(`${label} failed unexpectedly: ${result.error.message}`);
  }

  if (!Array.isArray(result.data) || result.data.length !== 0) {
    throw new Error(`${label} returned rows unexpectedly`);
  }

  console.log(`PASS ${label}`);
  return result;
}

async function ensureUser(email) {
  const createResult = await admin.auth.admin.createUser({
    email,
    password: userPassword,
    email_confirm: true,
  });

  if (!createResult.error) {
    return createResult.data.user;
  }

  if (!/already|registered|exists/i.test(createResult.error.message)) {
    throw new Error(`Could not create ${email}: ${createResult.error.message}`);
  }

  let page = 1;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 100,
    });

    if (error) {
      throw new Error(`Could not list users: ${error.message}`);
    }

    const user = data.users.find((candidate) => candidate.email === email);
    if (user) {
      await admin.auth.admin.updateUserById(user.id, {
        password: userPassword,
        email_confirm: true,
      });
      return user;
    }

    if (data.users.length < 100) {
      break;
    }

    page += 1;
  }

  throw new Error(`Could not find existing test user ${email}`);
}

async function signIn(email) {
  const client = userClient();
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: userPassword,
  });

  if (error) {
    throw new Error(`Could not sign in ${email}: ${error.message}`);
  }

  return { client, user: data.user };
}

async function cleanup(userIds) {
  for (const table of [
    "progression_decisions",
    "deload_events",
    "failure_events",
    "workout_sets",
    "workout_exercises",
    "workout_sessions",
    "exercise_training_states",
    "program_enrollments",
    "profiles",
  ]) {
    const { error } = await admin.from(table).delete().in("user_id", userIds);

    if (error) {
      throw new Error(`Cleanup failed for ${table}: ${error.message}`);
    }
  }
}

async function main() {
  console.log("Preparing RLS smoke test users");
  const [testUserA, testUserB] = await Promise.all([
    ensureUser(userAEmail),
    ensureUser(userBEmail),
  ]);

  await cleanup([testUserA.id, testUserB.id]);

  const [{ client: athleteA, user: userA }, { client: athleteB, user: userB }] =
    await Promise.all([signIn(userAEmail), signIn(userBEmail)]);

  const { data: program, error: programError } = await admin
    .from("programs")
    .select("id")
    .eq("slug", "stronglifts-5x5")
    .single();

  if (programError) {
    throw new Error(`Could not find StrongLifts seed program: ${programError.message}`);
  }

  await expectSuccess("authenticated user can upsert own profile", () =>
    athleteA
      .from("profiles")
      .upsert({
        id: userA.id,
        user_id: userA.id,
        display_name: "RLS Athlete A",
        unit_system: "metric",
      })
      .select("user_id")
      .single(),
  );

  await expectFailure("authenticated user cannot upsert another user's profile", () =>
    athleteA
      .from("profiles")
      .upsert({
        id: userB.id,
        user_id: userB.id,
        display_name: "Wrong Owner",
        unit_system: "metric",
      })
      .select("user_id")
      .single(),
  );

  const { data: enrollmentA } = await expectSuccess("user A can insert own enrollment", () =>
    athleteA
      .from("program_enrollments")
      .insert({
        user_id: userA.id,
        program_id: program.id,
        status: "paused",
      })
      .select("id")
      .single(),
  );

  const { data: enrollmentB } = await expectSuccess("user B can insert own enrollment", () =>
    athleteB
      .from("program_enrollments")
      .insert({
        user_id: userB.id,
        program_id: program.id,
        status: "paused",
      })
      .select("id")
      .single(),
  );

  await expectFailure("user A cannot insert an enrollment owned by user B", () =>
    athleteA
      .from("program_enrollments")
      .insert({
        user_id: userB.id,
        program_id: program.id,
        status: "paused",
      })
      .select("id")
      .single(),
  );

  const { data: sessionA } = await expectSuccess("user A can insert own workout session", () =>
    athleteA
      .from("workout_sessions")
      .insert({
        user_id: userA.id,
        program_enrollment_id: enrollmentA.id,
        status: "planned",
      })
      .select("id")
      .single(),
  );

  const { data: sessionB } = await expectSuccess("user B can insert own workout session", () =>
    athleteB
      .from("workout_sessions")
      .insert({
        user_id: userB.id,
        program_enrollment_id: enrollmentB.id,
        status: "planned",
      })
      .select("id")
      .single(),
  );

  await expectFailure("user A cannot attach a workout to user B's enrollment", () =>
    athleteA
      .from("workout_sessions")
      .insert({
        user_id: userA.id,
        program_enrollment_id: enrollmentB.id,
        status: "planned",
      })
      .select("id")
      .single(),
  );

  await expectFailure("user A cannot reassign own workout to user B", () =>
    athleteA
      .from("workout_sessions")
      .update({ user_id: userB.id })
      .eq("id", sessionA.id)
      .select("id")
      .single(),
  );

  const { data: visibleToA } = await expectSuccess("user A can select workout sessions", () =>
    athleteA
      .from("workout_sessions")
      .select("id,user_id")
      .in("id", [sessionA.id, sessionB.id]),
  );

  if (visibleToA.length !== 1 || visibleToA[0].id !== sessionA.id) {
    throw new Error("User A could see another user's workout session");
  }

  console.log("PASS user A sees only their own workout session");

  const anonymous = userClient();
  await expectNoRows("anonymous users cannot read system programs", () =>
    anonymous.from("programs").select("id").limit(1),
  );

  await cleanup([userA.id, userB.id]);
  console.log("RLS smoke test completed");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
