import { componentNameFromRoute, slugRoute } from './site-builder-blueprint.js';

function esc(str) {
  return String(str ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, ' ');
}

function renderSection(section, idx) {
  const t = section.type;
  switch (t) {
    case 'hero':
      return `
      <section className="section hero" key="${idx}">
        <div className="hero-copy">
          <p className="eyebrow">Продукт</p>
          <h1>${esc(section.title)}</h1>
          <p className="lead">${esc(section.subtitle)}</p>
          <div className="hero-actions">
            <button type="button" className="btn btn-primary">${esc(section.primaryCta || 'Начать')}</button>
            <button type="button" className="btn btn-secondary">${esc(section.secondaryCta || 'Подробнее')}</button>
          </div>
        </div>
      </section>`;
    case 'split-hero':
      return `
      <section className="section split-hero" key="${idx}">
        <div>
          <h2>${esc(section.title)}</h2>
          <p className="lead">${esc(section.subtitle)}</p>
          <button type="button" className="btn btn-primary">${esc(section.primaryCta || 'Продолжить')}</button>
        </div>
        <div className="split-panel" aria-hidden="true" />
      </section>`;
    case 'auth-panel':
      return `
      <section className="section auth-panel" key="${idx}">
        <div className="auth-card">
          <h2>${esc(section.title)}</h2>
          <p className="muted">${esc(section.subtitle)}</p>
          <form className="auth-form" onSubmit={(e) => e.preventDefault()}>
            <label>Email<input type="email" placeholder="you@company.com" /></label>
            <label>Пароль<input type="password" placeholder="••••••••" /></label>
            ${section.mode === 'register' ? '<label>Имя<input type="text" placeholder="Ваше имя" /></label>' : ''}
            <button type="submit" className="btn btn-primary">${section.mode === 'register' ? 'Создать аккаунт' : 'Войти'}</button>
          </form>
        </div>
      </section>`;
    case 'stat-row': {
      const stats = section.stats || [];
      return `
      <section className="section stat-row" key="${idx}">
        <div className="stat-grid">
          ${stats.map((s, i) => `<article className="stat-card" key="${i}"><span className="stat-value">${esc(s.value)}</span><span className="stat-label">${esc(s.label)}</span></article>`).join('')}
        </div>
      </section>`;
    }
    case 'card-grid': {
      const items = section.items || [];
      return `
      <section className="section card-grid-block" key="${idx}">
        ${section.title ? `<h2 className="section-title">${esc(section.title)}</h2>` : ''}
        <div className="card-grid">
          ${items.map((item, i) => `<article className="feature-card" key="${i}"><h3>${esc(item.title)}</h3><p>${esc(item.text)}</p></article>`).join('')}
        </div>
      </section>`;
    }
    case 'data-table': {
      const cols = section.columns || [];
      const rows = section.rows || [];
      return `
      <section className="section data-table-block" key="${idx}">
        <h2 className="section-title">${esc(section.title || 'Таблица')}</h2>
        <div className="table-wrap">
          <table>
            <thead><tr>${cols.map((c, i) => `<th key="${i}">${esc(c)}</th>`).join('')}</tr></thead>
            <tbody>
              ${rows.map((row, ri) => `<tr key="${ri}">${row.map((cell, ci) => `<td key="${ci}">${esc(cell)}</td>`).join('')}</tr>`).join('')}
            </tbody>
          </table>
        </div>
      </section>`;
    }
    case 'chart-panel':
      return `
      <section className="section chart-panel" key="${idx}">
        <div className="chart-head">
          <h2>${esc(section.title || 'График')}</h2>
          <span className="chip">${esc(section.period || 'Период')}</span>
        </div>
        <div className="chart-canvas" role="img" aria-label="График">
          <div className="chart-bars">
            ${[42, 58, 48, 72, 65, 80, 74, 88, 76, 92, 85, 95].map((h, i) => `<span key="${i}" style={{ height: '${h}%' }} />`).join('')}
          </div>
        </div>
      </section>`;
    case 'profile-header':
      return `
      <section className="section profile-header" key="${idx}">
        <div className="avatar" aria-hidden="true">${esc((section.name || 'U')[0])}</div>
        <div>
          <h1>${esc(section.name)}</h1>
          <p className="muted">${esc(section.role)}</p>
          <p>${esc(section.email)}</p>
        </div>
      </section>`;
    case 'settings-form': {
      const fields = section.fields || [];
      return `
      <section className="section settings-form-block" key="${idx}">
        <h2 className="section-title">${esc(section.title || 'Настройки')}</h2>
        <form className="settings-form" onSubmit={(e) => e.preventDefault()}>
          ${fields.map((f, i) => `<label key="${i}">${esc(f)}<input type="text" placeholder="${esc(f)}" /></label>`).join('')}
          <button type="submit" className="btn btn-primary">Сохранить</button>
        </form>
      </section>`;
    }
    case 'onboarding-steps': {
      const steps = section.steps || [];
      const active = Number(section.active) || 0;
      return `
      <section className="section onboarding" key="${idx}">
        <ol className="stepper">
          ${steps.map((step, i) => `<li key="${i}" className="${i === active ? 'active' : ''}">${esc(step)}</li>`).join('')}
        </ol>
      </section>`;
    }
    case 'pricing-cards': {
      const plans = section.plans || [];
      return `
      <section className="section pricing" key="${idx}">
        <div className="pricing-grid">
          ${plans.map((plan, i) => `
            <article className={'price-card' + (plan.highlight ? ' highlight' : '')} key="${i}">
              <h3>${esc(plan.name)}</h3>
              <p className="price">${esc(plan.price)}</p>
              <ul>${(plan.features || []).map((f, fi) => `<li key="${fi}">${esc(f)}</li>`).join('')}</ul>
              <button type="button" className="btn btn-primary">Выбрать</button>
            </article>`).join('')}
        </div>
      </section>`;
    }
    case 'faq': {
      const items = section.items || [];
      return `
      <section className="section faq" key="${idx}">
        <div className="faq-list">
          ${items.map((item, i) => `<details key="${i}"><summary>${esc(item.q)}</summary><p>${esc(item.a)}</p></details>`).join('')}
        </div>
      </section>`;
    }
    case 'cta-band':
      return `
      <section className="section cta-band" key="${idx}">
        <h2>${esc(section.title)}</h2>
        <p>${esc(section.text)}</p>
        <button type="button" className="btn btn-primary">${esc(section.cta || 'Продолжить')}</button>
      </section>`;
    case 'empty-state':
      return `
      <section className="section empty-state" key="${idx}">
        <div className="empty-icon" aria-hidden="true">◇</div>
        <h2>${esc(section.title || 'Пока пусто')}</h2>
        <p>${esc(section.text || 'Добавьте первую запись')}</p>
      </section>`;
    case 'logo-strip': {
      const logos = section.logos || [];
      return `
      <section className="section logo-strip" key="${idx}">
        <div className="logos">${logos.map((l, i) => `<span key="${i}">${esc(l)}</span>`).join('')}</div>
      </section>`;
    }
    case 'testimonial':
      return `
      <section className="section testimonial" key="${idx}">
        <blockquote>«${esc(section.quote)}»</blockquote>
        <cite>${esc(section.author)}</cite>
      </section>`;
    case 'timeline': {
      const events = section.events || [];
      return `
      <section className="section timeline" key="${idx}">
        <ul>${events.map((ev, i) => `<li key="${i}"><strong>${esc(ev.date)}</strong> ${esc(ev.text)}</li>`).join('')}</ul>
      </section>`;
    }
    default:
      return `
      <section className="section" key="${idx}"><h2>${esc(section.title || 'Блок')}</h2></section>`;
  }
}

function buildPageComponent(page) {
  const name = componentNameFromRoute(page.route);
  const sectionsJsx = (page.sections || []).map((s, i) => renderSection(s, i)).join('\n');
  return `import React from 'react';

export default function ${name}() {
  return (
    <div className="page page-${slugRoute(page.route)}">
      <header className="page-head">
        <h1 className="page-title">${esc(page.name)}</h1>
      </header>
      <div className="page-sections">
        ${sectionsJsx}
      </div>
    </div>
  );
}
`;
}

function buildGlobalCss(tokens) {
  return `:root {
  --accent: ${tokens.accent || '#6E56CF'};
  --accent-soft: ${tokens.accentSoft || '#EEE8FF'};
  --bg: ${tokens.background || '#FFFCF7'};
  --surface: ${tokens.surface || '#fff'};
  --text: ${tokens.text || '#201A16'};
  --muted: ${tokens.muted || '#6B6560'};
  --radius: ${tokens.radius || '12px'};
  --shadow: 0 18px 48px rgba(15, 23, 42, 0.08);
  font-family: Inter, system-ui, -apple-system, Segoe UI, sans-serif;
}

* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); }
a { color: inherit; text-decoration: none; }
button, input { font: inherit; }

.app-shell { min-height: 100vh; display: flex; }
.sidebar { width: 260px; padding: 24px 16px; background: var(--surface); border-right: 1px solid rgba(0,0,0,.06); }
.sidebar .brand { font-weight: 700; font-size: 18px; margin-bottom: 24px; }
.sidebar nav { display: flex; flex-direction: column; gap: 6px; }
.sidebar a { padding: 10px 12px; border-radius: 10px; color: var(--muted); }
.sidebar a.active, .sidebar a:hover { background: var(--accent-soft); color: var(--text); }

.topnav { display: flex; align-items: center; justify-content: space-between; padding: 16px 32px; background: var(--surface); border-bottom: 1px solid rgba(0,0,0,.06); position: sticky; top: 0; z-index: 10; }
.topnav nav { display: flex; gap: 8px; flex-wrap: wrap; }
.topnav a { padding: 8px 12px; border-radius: 999px; color: var(--muted); }
.topnav a.active { background: var(--accent-soft); color: var(--text); }

.main { flex: 1; padding: 32px; max-width: 1200px; margin: 0 auto; width: 100%; }
.page-head { margin-bottom: 24px; }
.page-title { margin: 0; font-size: 28px; }
.page-sections { display: flex; flex-direction: column; gap: 28px; }

.section { background: var(--surface); border-radius: var(--radius); padding: 28px; box-shadow: var(--shadow); }
.section-title { margin: 0 0 16px; font-size: 20px; }
.hero h1 { font-size: 42px; margin: 8px 0; line-height: 1.1; }
.lead, .muted { color: var(--muted); }
.eyebrow { text-transform: uppercase; letter-spacing: .08em; font-size: 12px; color: var(--muted); }
.hero-actions { display: flex; gap: 12px; margin-top: 20px; flex-wrap: wrap; }

.btn { border: none; border-radius: 12px; padding: 12px 18px; cursor: pointer; font-weight: 600; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-secondary { background: var(--accent-soft); color: var(--text); }

.stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; }
.stat-card { padding: 16px; border-radius: 12px; background: var(--bg); }
.stat-value { display: block; font-size: 24px; font-weight: 700; }
.stat-label { color: var(--muted); font-size: 13px; }

.card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
.feature-card { padding: 18px; border-radius: 12px; border: 1px solid rgba(0,0,0,.06); }
.feature-card h3 { margin: 0 0 8px; }

.table-wrap { overflow: auto; }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th, td { text-align: left; padding: 12px; border-bottom: 1px solid rgba(0,0,0,.06); }
th { color: var(--muted); font-weight: 600; }

.chart-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.chip { background: var(--accent-soft); padding: 6px 10px; border-radius: 999px; font-size: 12px; }
.chart-canvas { height: 220px; background: linear-gradient(180deg, var(--accent-soft), transparent); border-radius: 12px; padding: 16px; }
.chart-bars { display: flex; align-items: flex-end; gap: 8px; height: 100%; }
.chart-bars span { flex: 1; background: var(--accent); border-radius: 6px 6px 0 0; min-height: 8px; }

.auth-card { max-width: 420px; margin: 0 auto; }
.auth-form { display: flex; flex-direction: column; gap: 12px; margin-top: 16px; }
.auth-form label { display: flex; flex-direction: column; gap: 6px; font-size: 14px; }
.auth-form input { padding: 12px; border-radius: 10px; border: 1px solid rgba(0,0,0,.12); }

.split-hero { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: center; }
.split-panel { min-height: 200px; border-radius: var(--radius); background: linear-gradient(135deg, var(--accent-soft), var(--bg)); }

.profile-header { display: flex; gap: 20px; align-items: center; }
.avatar { width: 72px; height: 72px; border-radius: 50%; background: var(--accent); color: #fff; display: grid; place-items: center; font-size: 28px; font-weight: 700; }

.settings-form { display: grid; gap: 12px; max-width: 480px; }
.settings-form label { display: flex; flex-direction: column; gap: 6px; }
.settings-form input { padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(0,0,0,.1); }

.stepper { display: flex; gap: 12px; list-style: none; padding: 0; margin: 0; flex-wrap: wrap; }
.stepper li { padding: 8px 14px; border-radius: 999px; background: var(--bg); font-size: 14px; }
.stepper li.active { background: var(--accent); color: #fff; }

.pricing-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
.price-card { padding: 20px; border-radius: var(--radius); border: 1px solid rgba(0,0,0,.08); }
.price-card.highlight { border-color: var(--accent); box-shadow: var(--shadow); }
.price { font-size: 28px; font-weight: 700; }

.cta-band { text-align: center; background: linear-gradient(135deg, var(--accent-soft), var(--surface)); }

.logo-strip .logos { display: flex; flex-wrap: wrap; gap: 20px; color: var(--muted); font-weight: 600; }

.faq details { border-bottom: 1px solid rgba(0,0,0,.06); padding: 12px 0; }

@media (max-width: 768px) {
  .app-shell { flex-direction: column; }
  .sidebar { width: 100%; border-right: none; border-bottom: 1px solid rgba(0,0,0,.06); }
  .main { padding: 20px 16px; }
  .hero h1 { font-size: 32px; }
  .split-hero { grid-template-columns: 1fr; }
}
`;
}

export function buildProjectFromBlueprint(blueprint) {
  const pages = blueprint.pages || [];
  const tokens = blueprint.tokens || {};
  const productName = blueprint.productName || 'App';
  const layout = blueprint.layout === 'top-nav' ? 'top-nav' : 'sidebar';
  const files = [];

  const pageImports = pages.map((p) => {
    const name = componentNameFromRoute(p.route);
    return `import ${name} from './pages/${name}.jsx';`;
  }).join('\n');

  const routes = pages.map((p) => {
    const name = componentNameFromRoute(p.route);
    const path = p.route === '/' ? 'index' : p.route.replace(/^\//, '');
    return path === 'index'
      ? `{ index: true, element: <${name} /> }`
      : `{ path: '${path}', element: <${name} /> }`;
  }).join(',\n        ');

  const navLinks = pages.map((p) => {
    const to = p.route;
    return `<NavLink to="${to}" className={({ isActive }) => isActive ? 'active' : ''}>${esc(p.name)}</NavLink>`;
  }).join('\n          ');

  for (const page of pages) {
    const name = componentNameFromRoute(page.route);
    files.push({ path: `src/pages/${name}.jsx`, content: buildPageComponent(page) });
  }

  const layoutShell = layout === 'sidebar'
    ? `function AppLayout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">${esc(productName)}</div>
        <nav>
          ${navLinks}
        </nav>
      </aside>
      <main className="main"><Outlet /></main>
    </div>
  );
}`
    : `function AppLayout() {
  return (
    <div>
      <header className="topnav">
        <div className="brand">${esc(productName)}</div>
        <nav>
          ${navLinks}
        </nav>
      </header>
      <main className="main"><Outlet /></main>
    </div>
  );
}`;

  files.push({
    path: 'package.json',
    content: JSON.stringify({
      name: slugRoute(productName).replace(/-/g, '') || 'generated-app',
      private: true,
      version: '0.1.0',
      type: 'module',
      scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
      dependencies: {
        react: '^18.3.1',
        'react-dom': '^18.3.1',
        'react-router-dom': '^6.28.0',
      },
      devDependencies: {
        '@vitejs/plugin-react': '^4.3.4',
        vite: '^6.0.3',
      },
    }, null, 2),
  });

  files.push({
    path: 'vite.config.js',
    content: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
`,
  });

  files.push({
    path: 'index.html',
    content: `<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(productName)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`,
  });

  files.push({
    path: 'src/main.jsx',
    content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
`,
  });

  files.push({
    path: 'src/App.jsx',
    content: `import React from 'react';
import { NavLink, Outlet, useRoutes } from 'react-router-dom';
${pageImports}

${layoutShell}

const routes = [
  {
    element: <AppLayout />,
    children: [
      ${routes},
    ],
  },
];

export default function App() {
  return useRoutes(routes);
}
`,
  });

  files.push({ path: 'src/styles.css', content: buildGlobalCss(tokens) });

  const pageList = pages.map((p) => `- \`${p.route}\` — ${p.name} (${(p.sections || []).map((s) => s.type).join(', ')})`).join('\n');

  files.push({
    path: 'README.md',
    content: `# ${productName}

Многостраничный прототип (React + Vite + react-router-dom), собран Site Builder в SHKF.

## Страницы

${pageList}

## Запуск

\`\`\`bash
npm install
npm run dev
\`\`\`

Откройте URL из терминала (обычно http://localhost:5173).

## Структура

- \`src/pages/\` — отдельный файл на каждую страницу
- \`src/App.jsx\` — layout (${layout}) и роутинг
- \`src/styles.css\` — дизайн-токены и блоки UI
`,
  });

  return {
    summary: `${productName}: ${pages.length} страниц, ${pages.reduce((n, p) => n + (p.sections?.length || 0), 0)} UI-блоков (детерминированный scaffold)`,
    assumptions: [
      `Layout: ${layout}`,
      `Тип: ${blueprint.appType || 'saas-app'}`,
      'Каждая страница — отдельный компонент с 2–6 секциями (hero, таблицы, формы, графики и т.д.)',
    ],
    stack: 'react-vite',
    pages: pages.map((p) => ({ route: p.route, name: p.name, purpose: (p.sections || []).map((s) => s.type).join(', ') })),
    designTokens: tokens,
    files,
  };
}
