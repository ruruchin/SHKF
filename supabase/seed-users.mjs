import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const USERS = [
  {
    email: process.env.SEED_DESIGNER_EMAIL || 'designer@firuru.local',
    password: process.env.SEED_DESIGNER_PASSWORD,
    full_name: process.env.SEED_DESIGNER_NAME || 'FIRURU Designer',
    role: 'designer',
  },
  {
    email: process.env.SEED_FRONTEND_EMAIL || 'frontend@firuru.local',
    password: process.env.SEED_FRONTEND_PASSWORD,
    full_name: process.env.SEED_FRONTEND_NAME || 'FIRURU Front-end',
    role: 'frontend',
  },
  {
    email: process.env.SEED_BACKEND_EMAIL || 'backend@firuru.local',
    password: process.env.SEED_BACKEND_PASSWORD,
    full_name: process.env.SEED_BACKEND_NAME || 'FIRURU Back-end',
    role: 'backend',
  },
  {
    email: process.env.SEED_PM_EMAIL || 'pm@firuru.local',
    password: process.env.SEED_PM_PASSWORD,
    full_name: process.env.SEED_PM_NAME || 'FIRURU Project Manager',
    role: 'pm',
  },
];

function requireEnv(name, value) {
  if (!value) {
    throw new Error(`Missing ${name}. Copy .env.example to .env and fill it.`);
  }
}

requireEnv('SUPABASE_URL', SUPABASE_URL);
requireEnv('SUPABASE_SERVICE_ROLE_KEY', SERVICE_ROLE_KEY);

for (const user of USERS) {
  requireEnv(`${user.role.toUpperCase()} password`, user.password);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function findUserByEmail(email) {
  let page = 1;
  const perPage = 100;
  while (page < 100) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < perPage) return null;
    page += 1;
  }
  return null;
}

async function upsertUser(user) {
  const existing = await findUserByEmail(user.email);
  let authUser = existing;

  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password: user.password,
      email_confirm: true,
      user_metadata: {
        full_name: user.full_name,
        role: user.role,
      },
    });
    if (error) throw error;
    authUser = data.user;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: {
        full_name: user.full_name,
        role: user.role,
      },
    });
    if (error) throw error;
    authUser = data.user;
  }

  const { error: profileError } = await admin.from('profiles').upsert({
    id: authUser.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    is_active: true,
  });
  if (profileError) throw profileError;

  const { error: settingsError } = await admin.from('user_settings').upsert({
    user_id: authUser.id,
    settings: {},
    app_state: {},
  });
  if (settingsError) throw settingsError;

  console.log(`${existing ? 'Updated' : 'Created'} ${user.role}: ${user.email}`);
}

for (const user of USERS) {
  await upsertUser(user);
}

console.log('Seed complete.');
