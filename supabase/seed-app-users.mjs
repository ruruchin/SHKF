// Базовые аккаунты приложения: o.karavaev и t.eng
// Запуск: npm run seed:app-users
// Пароль: DEFAULT_EMPLOYEE_PASSWORD в .env (или INITIAL_EMPLOYEE_PASSWORD)

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../shared/supabase-config.js';

const SUPABASE_URL = process.env.SUPABASE_URL || SUPABASE_CONFIG.url;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL_DOMAIN = process.env.EMPLOYEE_EMAIL_DOMAIN || SUPABASE_CONFIG.emailDomain || 'shkf.local';
const DEFAULT_PASSWORD = process.env.INITIAL_EMPLOYEE_PASSWORD
  || process.env.DEFAULT_EMPLOYEE_PASSWORD
  || '346123LLzSSaaqq';

const USERS = [
  {
    username: 'o.karavaev',
    full_name: 'Олег Караваев',
    position: 'Сотрудник',
    role: 'designer',
  },
  {
    username: 't.eng',
    full_name: 'T. Eng',
    position: 'Сотрудник',
    role: 'designer',
  },
];

function requireEnv(name, value) {
  if (!value) throw new Error(`Missing ${name}. Copy .env.example to .env and fill Supabase keys.`);
}

requireEnv('SUPABASE_URL', SUPABASE_URL);
requireEnv('SUPABASE_SERVICE_ROLE_KEY', SERVICE_ROLE_KEY);

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(email) {
  let page = 1;
  while (page < 100) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 100) return null;
    page += 1;
  }
  return null;
}

async function upsertUser(user) {
  const email = `${user.username}@${EMAIL_DOMAIN}`;
  const metadata = {
    full_name: user.full_name,
    role: user.role,
    username: user.username,
    position: user.position,
    must_change_password: false,
  };

  const existing = await findUserByEmail(email);
  let authUser = existing;

  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: metadata,
    });
    if (error) throw error;
    authUser = data.user;
    console.log(`Updated ${user.username}`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: metadata,
    });
    if (error) throw error;
    authUser = data.user;
    console.log(`Created ${user.username}`);
  }

  const { error: profileError } = await admin.from('profiles').upsert({
    id: authUser.id,
    email,
    username: user.username,
    full_name: user.full_name,
    position: user.position,
    role: user.role,
    is_active: true,
    must_change_password: false,
  });
  if (profileError) throw profileError;

  const { error: settingsError } = await admin.from('user_settings').upsert({
    user_id: authUser.id,
    settings: {},
    app_state: {},
  });
  if (settingsError) throw settingsError;
}

for (const user of USERS) {
  await upsertUser(user);
}

console.log('');
console.log('App users ready:');
for (const user of USERS) {
  console.log(`  ${user.username}@${EMAIL_DOMAIN}`);
}
console.log(`  Password: ${DEFAULT_PASSWORD}`);
console.log('');
