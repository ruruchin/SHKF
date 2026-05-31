import { TEMPLATES } from './templates.js';

const SVGS = {
  'btn-primary': `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="44" viewBox="0 0 140 44" fill="none">
  <rect width="140" height="44" rx="10" fill="#2663FF"/>
  <text x="70" y="28" text-anchor="middle" fill="#FFFFFF" font-family="Inter,Segoe UI,sans-serif" font-size="14" font-weight="600">Get started</text>
</svg>`,

  'btn-secondary': `<svg xmlns="http://www.w3.org/2000/svg" width="130" height="44" viewBox="0 0 130 44" fill="none">
  <rect x="0.5" y="0.5" width="129" height="43" rx="10" fill="#FFFFFF" stroke="#D9D9DE"/>
  <text x="65" y="28" text-anchor="middle" fill="#1A1A1A" font-family="Inter,Segoe UI,sans-serif" font-size="14" font-weight="500">Learn more</text>
</svg>`,

  'btn-ghost': `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="44" viewBox="0 0 100 44" fill="none">
  <text x="50" y="28" text-anchor="middle" fill="#2663FF" font-family="Inter,Segoe UI,sans-serif" font-size="14" font-weight="600">View all</text>
</svg>`,

  'btn-danger': `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="44" viewBox="0 0 120 44" fill="none">
  <rect width="120" height="44" rx="10" fill="#EF4444"/>
  <text x="60" y="28" text-anchor="middle" fill="#FFFFFF" font-family="Inter,Segoe UI,sans-serif" font-size="14" font-weight="600">Delete</text>
</svg>`,

  'btn-icon': `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44" fill="none">
  <rect width="44" height="44" rx="10" fill="#F5F5F7" stroke="#E0E0E4"/>
  <path d="M22 14v16M14 22h16" stroke="#444" stroke-width="2" stroke-linecap="round"/>
</svg>`,

  'btn-segment': `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="36" viewBox="0 0 200 36" fill="none">
  <rect width="200" height="36" rx="8" fill="#F5F5F7" stroke="#E6E6EA"/>
  <rect x="4" y="4" width="94" height="28" rx="6" fill="#FFFFFF" stroke="#E0E0E4"/>
  <text x="51" y="23" text-anchor="middle" fill="#141414" font-family="Inter,Segoe UI,sans-serif" font-size="12" font-weight="600">Day</text>
  <text x="149" y="23" text-anchor="middle" fill="#808088" font-family="Inter,Segoe UI,sans-serif" font-size="12" font-weight="500">Week</text>
</svg>`,

  'input-field': `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="62" viewBox="0 0 280 62" fill="none">
  <text x="0" y="14" fill="#595959" font-family="Inter,Segoe UI,sans-serif" font-size="12" font-weight="500">Email</text>
  <rect y="22" width="280" height="40" rx="8" fill="#F5F5F7" stroke="#E0E0E4"/>
  <text x="14" y="48" fill="#A6A6AD" font-family="Inter,Segoe UI,sans-serif" font-size="14">you@company.com</text>
</svg>`,

  textarea: `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="100" viewBox="0 0 280 100" fill="none">
  <text x="0" y="14" fill="#595959" font-family="Inter,Segoe UI,sans-serif" font-size="12" font-weight="500">Description</text>
  <rect y="22" width="280" height="78" rx="8" fill="#F5F5F7" stroke="#E0E0E4"/>
  <text x="14" y="48" fill="#A6A6AD" font-family="Inter,Segoe UI,sans-serif" font-size="14">Enter details…</text>
</svg>`,

  'search-bar': `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="44" viewBox="0 0 300 44" fill="none">
  <rect width="300" height="44" rx="10" fill="#F5F5F7" stroke="#E6E6EA"/>
  <circle cx="22" cy="22" r="7" stroke="#808088" stroke-width="2" fill="none"/>
  <path d="M27 27l4 4" stroke="#808088" stroke-width="2" stroke-linecap="round"/>
  <text x="40" y="28" fill="#9999A0" font-family="Inter,Segoe UI,sans-serif" font-size="14">Search…</text>
</svg>`,

  'select-field': `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="62" viewBox="0 0 280 62" fill="none">
  <text x="0" y="14" fill="#595959" font-family="Inter,Segoe UI,sans-serif" font-size="12" font-weight="500">Country</text>
  <rect y="22" width="280" height="40" rx="8" fill="#F5F5F7" stroke="#E0E0E4"/>
  <text x="14" y="48" fill="#141414" font-family="Inter,Segoe UI,sans-serif" font-size="14">United States</text>
  <path d="M252 32l5 5 5-5" stroke="#808088" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`,

  checkbox: `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="28" viewBox="0 0 280 28" fill="none">
  <rect x="0" y="2" width="20" height="20" rx="5" fill="#2663FF"/>
  <path d="M5 14l4 4 8-8" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="32" y="19" fill="#141414" font-family="Inter,Segoe UI,sans-serif" font-size="14" font-weight="500">Remember me</text>
</svg>`,

  'radio-group': `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="72" viewBox="0 0 280 72" fill="none">
  <circle cx="12" cy="16" r="9" stroke="#2663FF" stroke-width="2" fill="none"/>
  <circle cx="12" cy="16" r="4" fill="#2663FF"/>
  <text x="32" y="20" fill="#141414" font-family="Inter,Segoe UI,sans-serif" font-size="14" font-weight="500">Standard</text>
  <circle cx="12" cy="48" r="9" stroke="#D0D0D6" stroke-width="2" fill="none"/>
  <text x="32" y="52" fill="#737378" font-family="Inter,Segoe UI,sans-serif" font-size="14">Express</text>
</svg>`,

  'file-upload': `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="120" viewBox="0 0 320 120" fill="none">
  <rect x="0.5" y="0.5" width="319" height="119" rx="12" fill="#FAFAFB" stroke="#D9D9DE" stroke-dasharray="6 4"/>
  <path d="M160 40v24M148 52h24" stroke="#808088" stroke-width="2" stroke-linecap="round"/>
  <text x="160" y="88" text-anchor="middle" fill="#737378" font-family="Inter,Segoe UI,sans-serif" font-size="13">Drop file or click to upload</text>
</svg>`,

  card: `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="160" viewBox="0 0 320 160" fill="none">
  <rect width="320" height="160" rx="12" fill="#FFFFFF" stroke="#E6E6EA"/>
  <text x="20" y="44" fill="#141414" font-family="Inter,Segoe UI,sans-serif" font-size="18" font-weight="600">Card title</text>
  <text x="20" y="72" fill="#737378" font-family="Inter,Segoe UI,sans-serif" font-size="14">Supporting text for the card content goes here.</text>
</svg>`,

  'stat-widget': `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="88" viewBox="0 0 140 88" fill="none">
  <rect width="140" height="88" rx="12" fill="#F7F7FA" stroke="#EBEBEF"/>
  <text x="16" y="46" fill="#141414" font-family="Inter,Segoe UI,sans-serif" font-size="28" font-weight="600">2,847</text>
  <text x="16" y="68" fill="#808088" font-family="Inter,Segoe UI,sans-serif" font-size="12">Active users</text>
</svg>`,

  'product-card': `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="260" viewBox="0 0 200 260" fill="none">
  <rect width="200" height="260" rx="12" fill="#FFFFFF" stroke="#E6E6EA"/>
  <rect x="12" y="12" width="176" height="120" rx="8" fill="#F0F0F4"/>
  <text x="16" y="156" fill="#141414" font-family="Inter,Segoe UI,sans-serif" font-size="15" font-weight="600">Wireless Headphones</text>
  <text x="16" y="178" fill="#737378" font-family="Inter,Segoe UI,sans-serif" font-size="12">Noise cancelling</text>
  <text x="16" y="220" fill="#141414" font-family="Inter,Segoe UI,sans-serif" font-size="18" font-weight="700">$249</text>
  <rect x="120" y="200" width="68" height="32" rx="8" fill="#2663FF"/>
  <text x="154" y="221" text-anchor="middle" fill="#FFFFFF" font-family="Inter,Segoe UI,sans-serif" font-size="12" font-weight="600">Add</text>
</svg>`,

  'pricing-card': `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="240" viewBox="0 0 220 240" fill="none">
  <rect width="220" height="240" rx="12" fill="#FFFFFF" stroke="#2663FF" stroke-width="2"/>
  <text x="20" y="40" fill="#141414" font-family="Inter,Segoe UI,sans-serif" font-size="16" font-weight="600">Pro</text>
  <text x="20" y="72" fill="#141414" font-family="Inter,Segoe UI,sans-serif" font-size="32" font-weight="700">$29</text>
  <text x="68" y="72" fill="#808088" font-family="Inter,Segoe UI,sans-serif" font-size="14">/mo</text>
  <text x="20" y="108" fill="#737378" font-family="Inter,Segoe UI,sans-serif" font-size="13">✓ Unlimited projects</text>
  <text x="20" y="132" fill="#737378" font-family="Inter,Segoe UI,sans-serif" font-size="13">✓ Priority support</text>
  <rect x="20" y="188" width="180" height="40" rx="10" fill="#2663FF"/>
  <text x="110" y="214" text-anchor="middle" fill="#FFFFFF" font-family="Inter,Segoe UI,sans-serif" font-size="14" font-weight="600">Subscribe</text>
</svg>`,

  'profile-card': `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="120" viewBox="0 0 280 120" fill="none">
  <rect width="280" height="120" rx="12" fill="#FFFFFF" stroke="#E6E6EA"/>
  <circle cx="48" cy="60" r="28" fill="#2663FF"/>
  <text x="92" y="48" fill="#141414" font-family="Inter,Segoe UI,sans-serif" font-size="16" font-weight="600">Alex Morgan</text>
  <text x="92" y="70" fill="#737378" font-family="Inter,Segoe UI,sans-serif" font-size="13">Product Designer</text>
  <text x="92" y="92" fill="#808088" font-family="Inter,Segoe UI,sans-serif" font-size="12">alex@company.com</text>
</svg>`,

  navbar: `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="56" viewBox="0 0 600 56" fill="none">
  <rect width="600" height="56" fill="#FFFFFF" stroke="#EBEBEF"/>
  <text x="24" y="34" fill="#141414" font-family="Inter,Segoe UI,sans-serif" font-size="16" font-weight="600">Logo</text>
  <text x="120" y="34" fill="#666670" font-family="Inter,Segoe UI,sans-serif" font-size="13" font-weight="500">Home</text>
  <text x="180" y="34" fill="#666670" font-family="Inter,Segoe UI,sans-serif" font-size="13" font-weight="500">Products</text>
  <text x="260" y="34" fill="#666670" font-family="Inter,Segoe UI,sans-serif" font-size="13" font-weight="500">Pricing</text>
</svg>`,

  sidebar: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="220" viewBox="0 0 200 220" fill="none">
  <rect width="200" height="220" rx="12" fill="#FAFAFB" stroke="#EBEBEF"/>
  <rect x="12" y="16" width="176" height="32" rx="8" fill="#2663FF" fill-opacity="0.12"/>
  <text x="24" y="37" fill="#2663FF" font-family="Inter,Segoe UI,sans-serif" font-size="13" font-weight="600">Dashboard</text>
  <text x="24" y="72" fill="#737378" font-family="Inter,Segoe UI,sans-serif" font-size="13">Projects</text>
  <text x="24" y="100" fill="#737378" font-family="Inter,Segoe UI,sans-serif" font-size="13">Team</text>
  <text x="24" y="128" fill="#737378" font-family="Inter,Segoe UI,sans-serif" font-size="13">Settings</text>
</svg>`,

  tabs: `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="44" viewBox="0 0 320 44" fill="none">
  <rect width="320" height="44" fill="#FFFFFF" stroke="#EBEBEF"/>
  <text x="24" y="28" fill="#2663FF" font-family="Inter,Segoe UI,sans-serif" font-size="13" font-weight="600">Overview</text>
  <rect x="12" y="41" width="72" height="3" rx="1.5" fill="#2663FF"/>
  <text x="120" y="28" fill="#808088" font-family="Inter,Segoe UI,sans-serif" font-size="13">Analytics</text>
  <text x="210" y="28" fill="#808088" font-family="Inter,Segoe UI,sans-serif" font-size="13">Reports</text>
</svg>`,

  breadcrumb: `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="24" viewBox="0 0 320 24" fill="none">
  <text x="0" y="18" fill="#808088" font-family="Inter,Segoe UI,sans-serif" font-size="13">Home</text>
  <text x="48" y="18" fill="#C0C0C8" font-family="Inter,Segoe UI,sans-serif" font-size="13">/</text>
  <text x="60" y="18" fill="#808088" font-family="Inter,Segoe UI,sans-serif" font-size="13">Projects</text>
  <text x="128" y="18" fill="#C0C0C8" font-family="Inter,Segoe UI,sans-serif" font-size="13">/</text>
  <text x="140" y="18" fill="#141414" font-family="Inter,Segoe UI,sans-serif" font-size="13" font-weight="500">Dashboard</text>
</svg>`,

  pagination: `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="36" viewBox="0 0 280 36" fill="none">
  <rect x="0" y="0" width="36" height="36" rx="8" fill="#F5F5F7" stroke="#E6E6EA"/>
  <text x="18" y="23" text-anchor="middle" fill="#808088" font-family="Inter,Segoe UI,sans-serif" font-size="14">‹</text>
  <rect x="44" y="0" width="36" height="36" rx="8" fill="#2663FF"/>
  <text x="62" y="23" text-anchor="middle" fill="#FFFFFF" font-family="Inter,Segoe UI,sans-serif" font-size="13" font-weight="600">1</text>
  <rect x="88" y="0" width="36" height="36" rx="8" fill="#F5F5F7" stroke="#E6E6EA"/>
  <text x="106" y="23" text-anchor="middle" fill="#444" font-family="Inter,Segoe UI,sans-serif" font-size="13">2</text>
  <rect x="132" y="0" width="36" height="36" rx="8" fill="#F5F5F7" stroke="#E6E6EA"/>
  <text x="150" y="23" text-anchor="middle" fill="#444" font-family="Inter,Segoe UI,sans-serif" font-size="13">3</text>
  <rect x="176" y="0" width="36" height="36" rx="8" fill="#F5F5F7" stroke="#E6E6EA"/>
  <text x="194" y="23" text-anchor="middle" fill="#808088" font-family="Inter,Segoe UI,sans-serif" font-size="14">›</text>
</svg>`,

  'list-item': `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="56" viewBox="0 0 320 56" fill="none">
  <rect width="320" height="56" rx="10" fill="#FAFAFB" stroke="#EBEBEF"/>
  <circle cx="30" cy="28" r="18" fill="#2663FF"/>
  <text x="58" y="26" fill="#1A1A1A" font-family="Inter,Segoe UI,sans-serif" font-size="14" font-weight="500">Alex Morgan</text>
  <text x="58" y="42" fill="#808088" font-family="Inter,Segoe UI,sans-serif" font-size="12">Product Designer</text>
</svg>`,

  badge: `<svg xmlns="http://www.w3.org/2000/svg" width="52" height="24" viewBox="0 0 52 24" fill="none">
  <rect width="52" height="24" rx="12" fill="#E6DEFF"/>
  <text x="26" y="16" text-anchor="middle" fill="#5925DC" font-family="Inter,Segoe UI,sans-serif" font-size="11" font-weight="600">New</text>
</svg>`,

  modal: `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200" fill="none">
  <rect width="400" height="200" rx="16" fill="#FFFFFF" stroke="#E6E6EA"/>
  <text x="24" y="44" fill="#141414" font-family="Inter,Segoe UI,sans-serif" font-size="18" font-weight="600">Delete item?</text>
  <text x="24" y="72" fill="#737378" font-family="Inter,Segoe UI,sans-serif" font-size="14">This action cannot be undone.</text>
  <rect x="228" y="148" width="72" height="36" rx="10" fill="#FFFFFF" stroke="#D9D9DE"/>
  <text x="264" y="171" text-anchor="middle" fill="#444" font-family="Inter,Segoe UI,sans-serif" font-size="13" font-weight="500">Cancel</text>
  <rect x="308" y="148" width="72" height="36" rx="10" fill="#EF4444"/>
  <text x="344" y="171" text-anchor="middle" fill="#FFFFFF" font-family="Inter,Segoe UI,sans-serif" font-size="13" font-weight="600">Delete</text>
</svg>`,

  'toggle-row': `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="48" viewBox="0 0 320 48" fill="none">
  <rect width="320" height="48" rx="10" fill="#FAFAFB" stroke="#EBEBEF"/>
  <text x="16" y="30" fill="#1A1A1A" font-family="Inter,Segoe UI,sans-serif" font-size="14" font-weight="500">Notifications</text>
  <rect x="260" y="12" width="44" height="24" rx="12" fill="#2663FF"/>
  <circle cx="278" cy="24" r="9" fill="#FFFFFF"/>
</svg>`,

  'avatar-group': `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="36" viewBox="0 0 120 36" fill="none">
  <circle cx="18" cy="18" r="16" fill="#2663FF" stroke="#FFFFFF" stroke-width="2"/>
  <circle cx="42" cy="18" r="16" fill="#E85A6F" stroke="#FFFFFF" stroke-width="2"/>
  <circle cx="66" cy="18" r="16" fill="#33C484" stroke="#FFFFFF" stroke-width="2"/>
  <circle cx="90" cy="18" r="16" fill="#F09833" stroke="#FFFFFF" stroke-width="2"/>
</svg>`,

  'progress-bar': `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="32" viewBox="0 0 280 32" fill="none">
  <text x="0" y="14" fill="#737378" font-family="Inter,Segoe UI,sans-serif" font-size="12">Uploading…</text>
  <text x="280" y="14" text-anchor="end" fill="#141414" font-family="Inter,Segoe UI,sans-serif" font-size="12" font-weight="600">68%</text>
  <rect y="20" width="280" height="8" rx="4" fill="#EBEBEF"/>
  <rect y="20" width="190" height="8" rx="4" fill="#2663FF"/>
</svg>`,

  divider: `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="24" viewBox="0 0 320 24" fill="none">
  <line x1="0" y1="12" x2="120" y2="12" stroke="#E6E6EA"/>
  <text x="160" y="16" text-anchor="middle" fill="#808088" font-family="Inter,Segoe UI,sans-serif" font-size="11" font-weight="500">OR</text>
  <line x1="200" y1="12" x2="320" y2="12" stroke="#E6E6EA"/>
</svg>`,

  'alert-success': `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="52" viewBox="0 0 400 52" fill="none">
  <rect width="400" height="52" rx="10" fill="#ECFDF3" stroke="#ABEFC6"/>
  <circle cx="26" cy="26" r="10" fill="#17B26A"/>
  <path d="M22 26l3 3 6-6" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="48" y="30" fill="#067647" font-family="Inter,Segoe UI,sans-serif" font-size="14" font-weight="500">Changes saved successfully</text>
</svg>`,

  'toast-notif': `<svg xmlns="http://www.w3.org/2000/svg" width="340" height="56" viewBox="0 0 340 56" fill="none">
  <rect width="340" height="56" rx="12" fill="#FFFFFF" stroke="#E6E6EA"/>
  <rect x="0" y="12" width="4" height="32" rx="2" fill="#2663FF"/>
  <text x="20" y="24" fill="#141414" font-family="Inter,Segoe UI,sans-serif" font-size="13" font-weight="600">New message</text>
  <text x="20" y="42" fill="#737378" font-family="Inter,Segoe UI,sans-serif" font-size="12">You have 3 unread notifications</text>
</svg>`,

  'empty-state': `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="160" viewBox="0 0 320 160" fill="none">
  <rect x="120" y="20" width="80" height="60" rx="8" fill="#F0F0F4" stroke="#E6E6EA"/>
  <text x="160" y="108" text-anchor="middle" fill="#141414" font-family="Inter,Segoe UI,sans-serif" font-size="15" font-weight="600">No items yet</text>
  <text x="160" y="128" text-anchor="middle" fill="#737378" font-family="Inter,Segoe UI,sans-serif" font-size="13">Create your first project</text>
</svg>`,

  'table-row': `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="48" viewBox="0 0 480 48" fill="none">
  <rect width="480" height="48" fill="#FFFFFF" stroke="#EBEBEF"/>
  <text x="16" y="30" fill="#141414" font-family="Inter,Segoe UI,sans-serif" font-size="13" font-weight="500">Website redesign</text>
  <text x="200" y="30" fill="#737378" font-family="Inter,Segoe UI,sans-serif" font-size="13">In progress</text>
  <text x="320" y="30" fill="#737378" font-family="Inter,Segoe UI,sans-serif" font-size="13">Mar 12</text>
  <rect x="400" y="14" width="64" height="22" rx="11" fill="#E6DEFF"/>
  <text x="432" y="29" text-anchor="middle" fill="#5925DC" font-family="Inter,Segoe UI,sans-serif" font-size="11" font-weight="600">Design</text>
</svg>`,

  'chart-bar': `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="140" viewBox="0 0 280 140" fill="none">
  <text x="0" y="16" fill="#737378" font-family="Inter,Segoe UI,sans-serif" font-size="12" font-weight="500">Weekly revenue</text>
  <rect x="20" y="100" width="32" height="28" rx="4" fill="#2663FF" fill-opacity="0.25"/>
  <rect x="68" y="72" width="32" height="56" rx="4" fill="#2663FF" fill-opacity="0.45"/>
  <rect x="116" y="48" width="32" height="80" rx="4" fill="#2663FF" fill-opacity="0.65"/>
  <rect x="164" y="60" width="32" height="68" rx="4" fill="#2663FF" fill-opacity="0.55"/>
  <rect x="212" y="36" width="32" height="92" rx="4" fill="#2663FF"/>
  <line x1="0" y1="128" x2="280" y2="128" stroke="#EBEBEF"/>
</svg>`,
};

export function getTemplateSvg(templateId) {
  return SVGS[templateId] || null;
}

export function getTemplateName(templateId) {
  return TEMPLATES.find((t) => t.id === templateId)?.name || templateId;
}
