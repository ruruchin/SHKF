// Создание/обновление аккаунтов сотрудников БЕЗ саморегистрации.
// Логин вида "k.zorenko" -> внутренний email "k.zorenko@<EMPLOYEE_EMAIL_DOMAIN>".
// Запуск: node supabase/seed-employees.mjs
// Требуется .env с SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY.
// Список сотрудников берётся из supabase/employees.json (см. employees.example.json).

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL_DOMAIN = process.env.EMPLOYEE_EMAIL_DOMAIN || 'firuru.local';

function requireEnv(name, value) {
  if (!value) throw new Error(`Missing ${name}. Copy .env.example to .env and fill it.`);
}

requireEnv('SUPABASE_URL', SUPABASE_URL);
requireEnv('SUPABASE_SERVICE_ROLE_KEY', SERVICE_ROLE_KEY);

const VALID_ROLES = ['designer', 'frontend', 'backend', 'pm', 'full'];

function loadEmployees() {
  const file = path.join(__dirname, 'employees.json');
  if (!existsSync(file)) {
    throw new Error('supabase/employees.json не найден. Скопируйте employees.example.json в employees.json и заполните.');
  }
  const list = JSON.parse(readFileSync(file, 'utf-8'));
  if (!Array.isArray(list) || !list.length) throw new Error('employees.json должен быть непустым массивом.');
  return list.map((raw) => {
    const username = String(raw.username || '').trim().toLowerCase();
    if (!username) throw new Error('У каждого сотрудника должен быть username (например "k.zorenko").');
    const role = VALID_ROLES.includes(raw.role) ? raw.role : 'designer';
    return {
      username,
      email: raw.email || `${username}@${EMAIL_DOMAIN}`,
      password: raw.password || process.env.DEFAULT_EMPLOYEE_PASSWORD,
      full_name: String(raw.full_name || '').trim(),
      position: String(raw.position || '').trim(),
      role,
    };
  });
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
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

async function upsertEmployee(user) {
  if (!user.password) {
    throw new Error(`Нет пароля для ${user.username}. Укажите "password" в employees.json или DEFAULT_EMPLOYEE_PASSWORD в .env.`);
  }

  const metadata = {
    full_name: user.full_name,
    role: user.role,
    username: user.username,
    position: user.position,
    must_change_password: true,
  };

  const existing = await findUserByEmail(user.email);
  let authUser = existing;

  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password: user.password,
      email_confirm: true,
      user_metadata: metadata,
    });
    if (error) throw error;
    authUser = data.user;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: metadata,
    });
    if (error) throw error;
    authUser = data.user;
  }

  const { error: profileError } = await admin.from('profiles').upsert({
    id: authUser.id,
    email: user.email,
    username: user.username,
    full_name: user.full_name,
    position: user.position,
    role: user.role,
    is_active: true,
    must_change_password: true,
  });
  if (profileError) throw profileError;

  const { error: settingsError } = await admin.from('user_settings').upsert({
    user_id: authUser.id,
    settings: {},
    app_state: {},
  });
  if (settingsError) throw settingsError;

  console.log(`${existing ? 'Updated' : 'Created'} ${user.username} (${user.role}) — ${user.email}`);
}

const employees = loadEmployees();
for (const user of employees) {
  await upsertEmployee(user);
}

console.log(`Seed complete: ${employees.length} employee(s).`);
