// DEPRECATED — не использовать в проде. Актуальные аккаунты: npm run seed:app-users
// Тестовый сотрудник @test для проверки командного чата.
// Запуск: npm run seed:test-user
// Логин в приложении: test  ·  пароль: TEST_USER_PASSWORD или DEFAULT_EMPLOYEE_PASSWORD из .env

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../shared/supabase-config.js';

const SUPABASE_URL = process.env.SUPABASE_URL || SUPABASE_CONFIG.url;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL_DOMAIN = process.env.EMPLOYEE_EMAIL_DOMAIN || SUPABASE_CONFIG.emailDomain || 'shkf.local';

const TEST_USER = {
  username: 'test',
  full_name: 'test',
  position: 'Тестовый аккаунт',
  role: 'designer',
  email: `test@${EMAIL_DOMAIN}`,
  password: process.env.TEST_USER_PASSWORD || process.env.DEFAULT_EMPLOYEE_PASSWORD || 'TestChat123!',
};

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

async function main() {
  const metadata = {
    full_name: TEST_USER.full_name,
    role: TEST_USER.role,
    username: TEST_USER.username,
    position: TEST_USER.position,
    must_change_password: false,
  };

  const existing = await findUserByEmail(TEST_USER.email);
  let authUser = existing;

  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password: TEST_USER.password,
      email_confirm: true,
      user_metadata: metadata,
    });
    if (error) throw error;
    authUser = data.user;
    console.log('Updated existing test user');
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: TEST_USER.email,
      password: TEST_USER.password,
      email_confirm: true,
      user_metadata: metadata,
    });
    if (error) throw error;
    authUser = data.user;
    console.log('Created test user');
  }

  const { error: profileError } = await admin.from('profiles').upsert({
    id: authUser.id,
    email: TEST_USER.email,
    username: TEST_USER.username,
    full_name: TEST_USER.full_name,
    position: TEST_USER.position,
    role: TEST_USER.role,
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

  console.log('');
  console.log('Test chat user ready:');
  console.log(`  Login:    ${TEST_USER.username}`);
  console.log(`  Email:    ${TEST_USER.email}`);
  console.log(`  Password: ${TEST_USER.password}`);
  console.log('');
  console.log('Open Команда → Сотрудники → test, or log in as test in a second app window.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
