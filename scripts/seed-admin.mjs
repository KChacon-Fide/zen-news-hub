import { createClient } from "@supabase/supabase-js";

const required = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ZEN_INITIAL_ADMIN_EMAIL",
  "ZEN_INITIAL_ADMIN_PASSWORD",
];
const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const email = process.env.ZEN_INITIAL_ADMIN_EMAIL;
const password = process.env.ZEN_INITIAL_ADMIN_PASSWORD;
const fullName = process.env.ZEN_INITIAL_ADMIN_NAME || "ZEN Root Admin";

async function findUserByEmail(targetEmail) {
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const found = data.users.find(
      (user) => user.email?.toLowerCase() === targetEmail.toLowerCase(),
    );
    if (found) return found;
    if (data.users.length < 100) return null;
    page += 1;
  }
}

const existing = await findUserByEmail(email);
const userResult = existing
  ? await supabase.auth.admin.updateUserById(existing.id, {
      email_confirm: true,
      user_metadata: {
        ...(existing.user_metadata || {}),
        full_name: fullName,
        must_change_password: true,
      },
    })
  : await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        must_change_password: true,
      },
    });

if (userResult.error) {
  throw userResult.error;
}

const user = userResult.data.user;

const { error: profileError } = await supabase.from("profiles").upsert({
  id: user.id,
  email,
  full_name: fullName,
  display_name: fullName,
  must_change_password: true,
});

if (profileError) throw profileError;

const { error: roleError } = await supabase.from("user_roles").upsert(
  {
    user_id: user.id,
    role: "super_admin",
  },
  { onConflict: "user_id,role" },
);

if (roleError) throw roleError;

await supabase.from("audit_logs").insert({
  actor_id: user.id,
  actor_email: email,
  action: existing ? "admin_seed_refreshed" : "admin_seed_created",
  entity_type: "auth.users",
  entity_id: user.id,
  metadata: { role: "super_admin", must_change_password: true },
});

console.log(`ZEN NEWS admin ready: ${email}`);
