# Theme System Design — Metabolic App
**Date:** 2026-03-25

## Overview

Add full light / dark / system theme support to the Metabolic nutrition frontend. Currently the app forces light mode via hardcoded classes and broken CSS variables. The goal is a coherent, accessible theme system that works on iOS (OLED and non-OLED) and desktop.

---

## User Requirements

- Three theme options: **Claro (light)**, **Oscuro (dark)**, **Sistema** (follows device OS setting)
- Quick access via an icon in the sidebar (cycles through the three modes)
- Full selector in **Configuración → Apariencia** with labeled buttons
- Text must be readable in both modes (white-on-white issue already fixed in pages)

---

## Color Palette

### CSS Custom Properties

All tokens are expressed in hex (compatible with Tailwind v4 inline theme). Existing tokens not listed here (accent, destructive, popover, ring, chart-1 through chart-5, radius) must be preserved with appropriate light/dark values — do not remove them.

| Token | Light Mode | Dark Mode (Deep/AMOLED) |
|---|---|---|
| `--background` | `#f1f5f9` | `#09090b` |
| `--foreground` | `#0f172a` | `#fafafa` |
| `--card` | `#ffffff` | `#18181b` |
| `--card-foreground` | `#0f172a` | `#fafafa` |
| `--muted` | `#e2e8f0` | `#27272a` |
| `--muted-foreground` | `#64748b` | `#a1a1aa` |
| `--border` | `#e2e8f0` | `#27272a` |
| `--input` | `#ffffff` | `#27272a` |
| `--primary` | `#10b981` | `#10b981` |
| `--primary-foreground` | `#ffffff` | `#ffffff` |
| `--sidebar` | `#0f172a` | `#09090b` |
| `--sidebar-foreground` | `#f1f5f9` | `#fafafa` |
| `--sidebar-border` | `#1e293b` | `#18181b` |

> The sidebar (`--sidebar`) remains dark in both modes.

> **Note on existing tokens:** `globals.css` uses `oklch()` for some values. When rewriting, convert the above hex values to `oklch()` if the rest of the file already uses that format, to keep consistency. Tokens not in this table (popover, accent, destructive, ring, chart-*, radius) must be audited and given appropriate light/dark values — not deleted.

---

## Architecture

### Files to Modify

| File | Change |
|---|---|
| `app/globals.css` | Rewrite `:root` (light) and `.dark` (AMOLED) CSS variable blocks. Remove `color-scheme: light only` and all `!important` overrides on `html, body`. The `@custom-variant dark` line and `.dark {}` block already exist — rewrite their values, do not duplicate them. |
| `app/providers.tsx` | Add `ThemeProvider` wrapper here (this is where all client providers are composed, not in `layout.tsx` directly). |
| `app/layout.tsx` | On `<html>`: remove hardcoded `light` class and `style={{ colorScheme: 'light' }}`. On `<body>`: remove `bg-white text-black` — these override the theme CSS variables. |
| `components/app-layout.tsx` | Replace hardcoded light background gradient (`bg-[#f8fafc]`, `from-emerald-50/50`, etc.) with `bg-background`. |
| `components/app-sidebar.tsx` | Update semi-transparent overlay colors to use CSS variables where applicable. Sidebar background stays dark. |
| `app/settings/page.tsx` | Add "Apariencia" card section at the top of the settings content, before existing sections. Contains the 3-button theme selector. |

### Files to Create

| File | Purpose |
|---|---|
| `components/theme-toggle.tsx` | Sidebar icon button — cycles light → dark → system; shows active mode icon |
| `components/theme-provider.tsx` | Already exists — thin wrapper around `next-themes`. Verify `next-themes` is installed (`npm ls next-themes`). |

### Files to Delete

| File | Reason |
|---|---|
| `styles/globals.css` | Leftover file — not imported anywhere in the active codebase. Unified into `app/globals.css`. |

---

## ThemeProvider Setup

**`app/providers.tsx`** — add `ThemeProvider` as the outermost wrapper. The file currently wraps children in `<CheatDayProvider><DietDayProvider>` — keep those nested inside `ThemeProvider`:

```tsx
import { ThemeProvider } from '@/components/theme-provider'

export function Providers({ children }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <CheatDayProvider>
        <DietDayProvider>
          {children}
        </DietDayProvider>
      </CheatDayProvider>
    </ThemeProvider>
  )
}
```

- `attribute="class"` → next-themes adds/removes `.dark` class on `<html>`
- `defaultTheme="system"` → respects OS setting on first load
- `enableSystem` → activates system preference detection
- `disableTransitionOnChange` → avoids color flash on theme switch

---

## Theme Toggle Component

### Sidebar icon (`components/theme-toggle.tsx`)

- Uses `useTheme()` from `next-themes`
- Icon: ☀︎ = light, ☾ = dark, ◑ = system
- On click: cycles `light → dark → system → light`
- Placed at the bottom of the sidebar nav, above or replacing any existing placeholder
- Must be a Client Component (`'use client'`)

### Settings selector (`app/settings/page.tsx`)

- New "Apariencia" card at the top of the settings content
- Three buttons: `☀︎ Claro`, `☾ Oscuro`, `◑ Sistema`
- Active button: `bg-primary text-primary-foreground`
- Inactive buttons: `bg-card text-foreground border border-border`
- Uses `useTheme()` — `setTheme('light' | 'dark' | 'system')`
- Must be extracted into a Client Component since the settings page may be a Server Component

---

## CSS Strategy

### `app/globals.css` after rewrite (structure):

```css
@custom-variant dark (&:is(.dark *));  /* already exists — keep as-is */

:root {
  /* light mode tokens */
  --background: ...; /* #f1f5f9 in oklch equivalent */
  --foreground: ...;
  --card: ...;
  /* all other tokens with light values */
}

.dark {
  /* dark mode tokens (AMOLED) */
  --background: ...; /* #09090b */
  --foreground: ...;
  --card: ...;
  /* all other tokens with dark values */
}

@layer base {
  body {
    @apply bg-background text-foreground;
  }
}
```

Remove:
- `color-scheme: light only` from `:root`
- `background-color: #ffffff !important` and `color: #000000 !important` from `html, body`
- The entire `@media (prefers-color-scheme: dark)` block that hardcodes white background

---

## Scope

**In scope:**
- ThemeProvider wiring in `providers.tsx`
- CSS variable rewrite (light + dark + preserve existing tokens)
- Theme toggle component (sidebar icon + settings selector)
- `app-layout.tsx` background fix
- `app-sidebar.tsx` overlay cleanup
- Removing forced light mode from `layout.tsx` (`<html>` and `<body>`)

**Out of scope:**
- Per-user theme persistence beyond what next-themes provides (localStorage by default)
- Animation/transition on theme switch
- Custom accent color selection
- Fixing individual page text colors (already done separately)
