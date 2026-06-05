---
name: mobbin-site-builder
description: Build multi-page sites and web apps using Mobbin UI references. Use when the user asks to scaffold, layout, or code landing pages, dashboards, SaaS apps, or multi-page React sites in the figma-hotkeys / SHKF repo.
---

# Mobbin-backed site builder

## When to use

- User asks to **верстать**, **собрать сайт**, **многостраничное приложение**, landing, dashboard, admin, portal.
- User wants UI quality at **Mobbin / strong SaaS** level (Attio, Linear, Intercom tier), not generic AI UI.

## Workflow

1. **Search Mobbin** (MCP `user-Mobbin`):
   - `search_flows` for onboarding, checkout, settings, multi-step journeys (`limit` 3–5).
   - `search_screens` for individual patterns: hero, pricing, tables, empty states (`platform`: `web` or `ios`, `mode`: `deep`, `limit` 8–12).
2. **Extract patterns** (do not copy brands): navigation model, grid, type scale, card density, form layout, CTA hierarchy, sidebar vs top nav.
3. **Plan pages**: minimum 3 routes for apps; marketing site = home + product + pricing or docs.
4. **Implement** in repo:
   - Prefer existing stack in `site/` (React + Vite + GSAP) when task is this product site.
   - For greenfield prototypes: React 18 + Vite + react-router-dom, CSS variables, semantic HTML, Russian copy.
5. **Cite refs** in summary: Mobbin URLs used, what pattern each informed.

## SHKF in-app agent

The Electron app exposes **ИИ Агент → «Сайт / App»** or `/site …` which calls `agent-site-build` with Mobbin + design memory. User can set **Mobbin API key** in Settings → ИИ Агент.

## Quality bar

- Desktop-first 1280px+, breakpoint ~768px.
- Realistic Russian UI copy; no lorem ipsum.
- Shared layout component; one file per page/route.
- Accessible focus states and heading order.
- No purple-gradient cliché unless user asks.

## MCP tool names

Server: `user-Mobbin`

- `search_screens` — required: `query`, `platform` (`ios`|`web`)
- `search_flows` — required: `query`, `platform`

Read tool schemas under `mcps/user-Mobbin/tools/` before calling.
