// Базовые аккаунты приложения: k.zorenko, o.karavaev, t.eng
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

const ALLOWED_USERNAMES = new Set(['k.zorenko', 'o.karavaev', 't.eng']);

const USERS = [
  {
    username: 'k.zorenko',
    full_name: 'Константин Зоренко',
    position: 'Сотрудник',
    role: 'designer',
  },
  {
    username: 'o.karavaev',
    full_name: 'Олег Караваев',
    position: 'Сотрудник',
    role: 'designer',
  },
  {
    username: 't.eng',
    full_name: 'Тимур Егналычев',
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

async function listAllUsers() {
  const users = [];
  let page = 1;
  while (page < 100) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 100) break;
    page += 1;
  }
  return users;
}

async function findUserByEmail(email) {
  const users = await listAllUsers();
  return users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) || null;
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
      ban_duration: 'none',
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

async function deactivateOtherUsers() {
  const authUsers = await listAllUsers();
  let deactivated = 0;

  for (const authUser of authUsers) {
    const username = String(authUser.user_metadata?.username || authUser.email?.split('@')[0] || '')
      .trim()
      .toLowerCase();
    if (!username || ALLOWED_USERNAMES.has(username)) continue;

    const { error: banError } = await admin.auth.admin.updateUserById(authUser.id, {
      ban_duration: '876000h',
    });
    if (banError) {
      console.warn(`Skip ban ${username}:`, banError.message);
      continue;
    }

    const { error: profileError } = await admin.from('profiles').update({ is_active: false }).eq('id', authUser.id);
    if (profileError) {
      console.warn(`Skip profile deactivate ${username}:`, profileError.message);
      continue;
    }

    deactivated += 1;
    console.log(`Deactivated ${username}`);
  }

  return deactivated;
}

for (const user of USERS) {
  await upsertUser(user);
}

const deactivated = await deactivateOtherUsers();

console.log('');
console.log('App users ready:');
for (const user of USERS) {
  console.log(`  ${user.username}@${EMAIL_DOMAIN}`);
}
console.log(`  Password: ${DEFAULT_PASSWORD}`);
if (deactivated) console.log(`  Deactivated test/other accounts: ${deactivated}`);
console.log('');
