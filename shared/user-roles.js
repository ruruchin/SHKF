/** Роли пользователя и доступные разделы интерфейса. */

export const USER_ROLES = {
  designer: {
    id: 'designer',
    label: 'Дизайнер',
    description: 'Figma, хоткеи, шаблоны, канбан, почта и мокапы',
  },
  frontend: {
    id: 'frontend',
    label: 'Front-end',
    description: 'Канбан, GitHub, Outline, почта и ИИ — без Figma',
  },
  backend: {
    id: 'backend',
    label: 'Back-end',
    description: 'Канбан, GitHub, Outline, почта и ИИ — без Figma',
  },
  pm: {
    id: 'pm',
    label: 'Project Manager',
    description: 'Канбан, почта, агент и заметки',
  },
  full: {
    id: 'full',
    label: 'Все разделы',
    description: 'Полный доступ ко всем инструментам',
  },
};

export const ROLE_PAGES = {
  designer: ['search', 'hotkeys', 'templates', 'nanobanana', 'bannermockup', 'metask', 'mail', 'agent', 'notes', 'setup', 'settings'],
  frontend: ['search', 'metask', 'mail', 'github', 'outline', 'notes', 'agent', 'settings'],
  backend: ['search', 'metask', 'mail', 'github', 'outline', 'notes', 'agent', 'settings'],
  pm: ['search', 'metask', 'mail', 'github', 'outline', 'agent', 'notes', 'settings'],
  full: ['search', 'hotkeys', 'templates', 'nanobanana', 'bannermockup', 'metask', 'agent', 'mail', 'github', 'outline', 'notes', 'setup', 'settings'],
};

export const ROLE_DEFAULT_PAGE = {
  designer: 'hotkeys',
  frontend: 'metask',
  backend: 'metask',
  pm: 'metask',
  full: 'hotkeys',
};

export const DEV_ROLES = new Set(['frontend', 'backend']);

export function normalizeUserRole(role) {
  const id = String(role || '').trim();
  return USER_ROLES[id] ? id : null;
}

export function getPagesForRole(role) {
  const id = normalizeUserRole(role) || 'designer';
  return ROLE_PAGES[id] || ROLE_PAGES.designer;
}

export function getDefaultPageForRole(role) {
  const id = normalizeUserRole(role) || 'designer';
  return ROLE_DEFAULT_PAGE[id] || 'search';
}

export function isPageAllowed(pageId, role) {
  if (!pageId) return false;
  if (pageId === 'hotkey-detail') return getPagesForRole(role).includes('hotkeys');
  return getPagesForRole(role).includes(pageId);
}
