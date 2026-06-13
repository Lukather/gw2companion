# Tailwind CSS Redesign — Implementation Plan

## Decisions Locked In

| Decision | Choice |
|---|---|
| Tailwind version | **v3** (stable, v3.4+) |
| Migration strategy | **B + C** — Page-by-page incremental, GW2 colors in Tailwind config |
| GW2 color tokens | **Option A** — Extend Tailwind theme (`bg-rarity-rare`, `text-profession-guardian`) |
| Component library | **shadcn-svelte** — Accessible components (tables, cards, tabs, buttons, badges) |
| Typography | **Tailwind typography plugin** (`prose` for content areas) |
| Navigation | **Sidebar** — Dashboard-style layout with collapsible sidebar |

## Current State

After reviewing the full frontend, here's what the styling looks like today:

- **`theme.css`** (~180 lines): CSS custom properties defining light/dark theme colors (bg, text, border, brand, rarity, action badges, gold), plus minimal base styles.
- **Every `.svelte` page** has a large `<style>` block (60–250 lines) with hand-rolled CSS: flexbox, grid, spacing, colors, borders, tooltips, animations.
- **No design system** — colors are manually referenced via `var(--xyz)`, spacing is ad-hoc (`0.5rem`, `0.75rem`, `1rem`, etc.), and each component reinvents buttons, cards, tables, badges, toolbars.
- **~6 pages** (Setup, Inventory, Materials, Achievements, Story, Builds) + App shell — total custom CSS is probably **~800–1000 lines**.

### What feels "old-school"

- No consistent spacing/sizing scale — every component picks its own padding/margin values.
- Basic unstyled-browser-app aesthetic — square corners, plain borders, functional but not polished.
- No hover transitions, no elevation/shadows beyond one `box-shadow` var.
- Tables feel like 2010s data grids.
- Typography is just system font stack with no hierarchy beyond `font-weight`.

## What Tailwind Would Bring

| Concern | Current | With Tailwind |
|---|---|---|
| Spacing/sizing | Ad-hoc rem values | Consistent 4px scale (`p-2`, `p-4`, `p-6`...) |
| Colors | CSS vars referenced manually | `bg-brand text-brand-foreground`, `dark:bg-brand-dark` |
| Dark mode | Manual `[data-theme]` + CSS vars | `dark:` prefix on any utility |
| Responsive | Not handled | `sm:`, `md:`, `lg:` prefixes |
| Buttons | Repeated CSS in every component | `btn` utility or component class |
| Cards | Repeated CSS | `bg-card rounded-lg shadow-sm border p-4` |
| Layout | Manual flexbox/grid CSS | `flex gap-4`, `grid grid-cols-3` |
| Tables | Manual | `table-auto w-full text-sm` |
| Typography | Just `font-weight` | `text-sm text-muted-foreground font-semibold` |
| Transitions | Few, manual | `transition-colors duration-200` |

The result: **~80% less custom CSS**, consistent look, modern feel, easier to iterate.

## New Layout: Sidebar + Content

```
┌──────────┬──────────────────────────────────────────┐
│ SIDEBAR  │  HEADER (GW2 Companion + theme toggle)   │
│          ├──────────────────────────────────────────┤
│ ⚔ Invent │                                          │
│ 🧪 Mater │           PAGE CONTENT                   │
│ ⚙ Builds │                                          │
│ 🏆 Achiev │                                          │
│ 📖 Story  │                                          │
│          │                                          │
│ ──────── │                                          │
│ ⚙ Setup  │                                          │
└──────────┴──────────────────────────────────────────┘
```

- **Sidebar**: Collapsible, icons + labels, active page highlighted with brand color
- **Header**: App title, theme toggle, character context (when viewing a specific character)
- **Content**: Full-height scrollable area, page component rendered here
- **Mobile**: Sidebar collapses to icon-only or hamburger menu

## GW2 Color Tokens in Tailwind Config

These extend Tailwind's default palette:

```js
// tailwind.config.js excerpt
colors: {
  brand: {
    DEFAULT: '#d2691e',     // GW2 orange
    hover: '#b85e0c',
    light: '#fde4c8',
    dark: '#e8824a',        // dark mode brand
  },
  rarity: {
    junk:      { bg: '#aaaaaa', fg: '#333333' },
    basic:     { bg: '#888888', fg: '#ffffff' },
    fine:      { bg: '#62a4da', fg: '#ffffff' },
    masterwork:{ bg: '#3ad93a', fg: '#ffffff' },
    rare:      { bg: '#fcd432', fg: '#333333' },
    exotic:    { bg: '#fbaa34', fg: '#ffffff' },
    ascended:  { bg: '#fb4e6e', fg: '#ffffff' },
    legendary: { bg: '#9c6adb', fg: '#ffffff' },
  },
  profession: {
    guardian:    '#7ab3cf',
    warrior:     '#fcd432',
    engineer:    '#b06b3c',
    ranger:      '#8cd43c',
    thief:       '#c08e7c',
    elementalist:'#f68a6c',
    mesmer:      '#b57dc8',
    necromancer: '#5ba35b',
    revenant:    '#d2691e',
  },
  action: {
    sell:    { bg: '#d4edda', fg: '#155724' },
    salvage: { bg: '#fff3cd', fg: '#856404' },
    keep:    { bg: '#cce5ff', fg: '#004085' },
    use:     { bg: '#e2d9f3', fg: '#3d2b63' },
  },
}
```

Usage: `bg-rarity-exotic-bg text-rarity-exotic-fg`, `text-profession-mesmer`, `bg-action-sell-bg`

## Files That Will Change

| File | Action |
|---|---|
| `frontend/package.json` | Add `tailwindcss`, `postcss`, `autoprefixer`, `@tailwindcss/typography`; add shadcn-svelte deps |
| `frontend/postcss.config.js` | **New** — `tailwindcss` + `autoprefixer` plugins |
| `frontend/tailwind.config.js` | **New** — Theme with GW2 colors, dark mode `class` strategy, typography plugin |
| `frontend/src/app.css` | **New** — `@tailwind base/components/utilities` + shadcn-svelte CSS vars |
| `frontend/src/main.js` | Import `app.css` instead of `theme.css` |
| `frontend/index.html` | Add Inter font (shadcn default), update meta theme-color |
| `frontend/src/App.svelte` | **Major rewrite** — Sidebar layout, replace all `<style>` with Tailwind |
| `frontend/src/pages/Setup.svelte` | Replace `<style>` with Tailwind (shadcn Card, Button, Input) |
| `frontend/src/pages/Inventory.svelte` | Replace `<style>` — shadcn Table, Card, Badge; Tailwind tooltips |
| `frontend/src/pages/Materials.svelte` | Replace `<style>` — same patterns as Inventory |
| `frontend/src/pages/Builds.svelte` | Replace `<style>` — cards, badges, wiki links |
| `frontend/src/pages/Achievements.svelte` | Replace `<style>` — progress bars, cards |
| `frontend/src/pages/Story.svelte` | Replace `<style>` — campaign cards |
| `frontend/src/lib/stores.js` | Possibly add sidebar state (collapsed/expanded) |
| `frontend/src/lib/theme.js` | Update to use Tailwind `dark` class strategy |
| `frontend/src/theme.css` | **Delete** — replaced by `app.css` + Tailwind config |
| `frontend/src/lib/components/` | **New** — shadcn-svelte components (Button, Card, Table, Badge, Input, Tabs, etc.) |

## Implementation Steps

### Phase 1: Foundation (Tailwind + shadcn-svelte setup)

- [ ] **Step 1**: Install Tailwind v3 + PostCSS + Autoprefixer + Typography plugin
  ```bash
  cd frontend && npm install -D tailwindcss@3 postcss autoprefixer @tailwindcss/typography
  npx tailwindcss init -p
  ```
- [ ] **Step 2**: Configure `tailwind.config.js`
  - Content paths: `['./src/**/*.{svelte,js,html}']`
  - Dark mode: `'class'` strategy (toggle `.dark` on `<html>`)
  - Extend colors with GW2 tokens (brand, rarity, profession, action)
  - Add typography plugin
- [ ] **Step 3**: Create `frontend/src/app.css` with Tailwind directives and shadcn-svelte CSS variable base
- [ ] **Step 4**: Update `main.js` to import `app.css` instead of `theme.css`
- [ ] **Step 5**: Initialize shadcn-svelte (`npx shadcn-svelte@latest init`)
  - Style: New York (or Default), base color: Zinc or Slate, CSS variables: Yes
- [ ] **Step 6**: Update `lib/theme.js` — toggle `.dark` class on `<html>` instead of `data-theme` attribute; persist in localStorage
- [ ] **Step 7**: Update `index.html` — add Inter font link, dark mode meta tag
- [ ] **Step 8**: Verify: `npm run dev` starts, pages render with Tailwind base styles, theme toggle works

### Phase 2: Sidebar Layout (App shell rewrite)

- [ ] **Step 9**: Add shadcn-svelte components needed for App shell: Button, Separator
- [ ] **Step 10**: Rewrite `App.svelte` — sidebar + header + content layout
  - Sidebar: nav links with icons (use lucide-svelte icons that shadcn uses)
  - Header: app title, theme toggle button, optional character context
  - Content: `<main>` with page component
  - Sidebar collapsed state for mobile (hamburger toggle)
- [ ] **Step 11**: Verify: sidebar navigation works, pages switch, theme toggles, responsive on mobile

### Phase 3: Page-by-Page Redesign

- [ ] **Step 12**: Redesign **Setup.svelte** (simplest page, good starting point)
  - shadcn: Card, Input, Button, Alert (for error/success)
  - Remove all `<style>` block
- [ ] **Step 13**: Redesign **Inventory.svelte** (largest page)
  - shadcn: Table, Card, Badge, Button, Input, Select
  - Character grid: use Card components
  - Summary cards: shadcn Card with colored borders
  - Results table: shadcn Table with rarity badges
  - Tooltips: Tailwind group-hover tooltip pattern
  - Remove all `<style>` block
- [ ] **Step 14**: Redesign **Materials.svelte** — same patterns as Inventory
- [ ] **Step 15**: Redesign **Builds.svelte**
  - shadcn: Card, Badge, Button
  - Specialization cards in a responsive grid
  - Skill bar as flex row of Cards
  - Equipment grid
  - Meta comparison as colored cards/badges
- [ ] **Step 16**: Redesign **Achievements.svelte**
  - shadcn: Card, Progress (custom component based on shadcn patterns)
  - Category sections with progress bars
- [ ] **Step 17**: Redesign **Story.svelte** — campaign cards with completion badges

### Phase 4: Polish

- [ ] **Step 18**: Remove `theme.css` (no longer needed)
- [ ] **Step 19**: Add page transitions (optional: Svelte `fly`/`fade` on page switch)
- [ ] **Step 20**: Test all pages in both light and dark mode
- [ ] **Step 21**: Remove debug `console.log` statements (from SESSION.md stretch goals)

## Verification

1. `npm run dev` — app starts without errors, both frontend (5173) and backend (3000)
2. Setup page: API key input styled, validation errors shown in styled alerts
3. All 5 tabs accessible from sidebar, active tab highlighted
4. Light/dark toggle works, persists across reloads
5. Each page renders correctly in both themes:
   - Inventory: character cards, summary cards, filtered table with rarity badges and tooltips
   - Materials: category filters, action badges, gold formatting
   - Builds: specialization cards, skill bar, meta comparison badges, wiki links
   - Achievements: progress bars, category grouping, near-complete filter
   - Story: campaign cards with completion status
6. Responsive: sidebar collapses on narrow viewports, content remains usable
7. No Svelte warnings in console (each_key_duplicate, etc.)
8. No custom `<style>` blocks remain in any page (or minimal for complex animations)
