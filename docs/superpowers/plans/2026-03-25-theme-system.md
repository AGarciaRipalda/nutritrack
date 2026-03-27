# Theme System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add light / dark / system theme support to the Metabolic Next.js app using next-themes.

**Architecture:** next-themes manages theme state via localStorage and `.dark` class on `<html>`. CSS custom properties in globals.css define the light and dark palettes. A ThemeToggle component in the sidebar and a selector in Settings give the user control.

**Tech Stack:** Next.js 14+, next-themes, Tailwind CSS v4, shadcn/ui

---

## Task 1: Fix globals.css

**File:** `/Users/practica/Desktop/Metabolic/nutrition_frontend/app/globals.css`

**What to do:**
- Remove the top-level `color-scheme: light only` block from `:root` (lines 4-6)
- Remove the `html, body { background-color: #ffffff !important; color: #000000; }` block (lines 8-11)
- Remove the entire `@media (prefers-color-scheme: dark)` block (lines 13-18)
- Rewrite the `:root` block with light mode values
- Rewrite the `.dark` block with AMOLED dark values
- Keep `@custom-variant dark (&:is(.dark *));`, the `@theme inline` block, and the `@layer base` block exactly as-is

**Complete replacement for the `:root` block:**

```css
:root {
  --background: oklch(0.961 0.009 247);
  --foreground: oklch(0.129 0.024 264);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.129 0.024 264);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.129 0.024 264);
  --primary: oklch(0.696 0.17 163);
  --primary-foreground: oklch(1 0 0);
  --secondary: oklch(0.961 0.009 247);
  --secondary-foreground: oklch(0.129 0.024 264);
  --muted: oklch(0.886 0.009 247);
  --muted-foreground: oklch(0.462 0.014 250);
  --accent: oklch(0.696 0.17 163);
  --accent-foreground: oklch(1 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(1 0 0);
  --border: oklch(0.886 0.009 247);
  --input: oklch(1 0 0);
  --ring: oklch(0.696 0.17 163);
  --chart-1: oklch(0.696 0.17 163);
  --chart-2: oklch(0.6 0.15 250);
  --chart-3: oklch(0.7 0.18 50);
  --chart-4: oklch(0.6 0.2 320);
  --chart-5: oklch(0.65 0.16 180);
  --radius: 0.625rem;
  --sidebar: oklch(0.129 0.024 264);
  --sidebar-foreground: oklch(0.961 0.009 247);
  --sidebar-primary: oklch(0.696 0.17 163);
  --sidebar-primary-foreground: oklch(1 0 0);
  --sidebar-accent: oklch(0.205 0.018 264);
  --sidebar-accent-foreground: oklch(0.961 0.009 247);
  --sidebar-border: oklch(0.205 0.018 264);
  --sidebar-ring: oklch(0.696 0.17 163);
}
```

**Complete replacement for the `.dark` block:**

```css
.dark {
  --background: oklch(0.107 0.006 285);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.134 0.007 285);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.134 0.007 285);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.696 0.17 163);
  --primary-foreground: oklch(1 0 0);
  --secondary: oklch(0.205 0.006 285);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.205 0.006 285);
  --muted-foreground: oklch(0.651 0.006 285);
  --accent: oklch(0.696 0.17 163);
  --accent-foreground: oklch(1 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(0.985 0 0);
  --border: oklch(0.205 0.006 285);
  --input: oklch(0.205 0.006 285);
  --ring: oklch(0.696 0.17 163);
  --chart-1: oklch(0.696 0.17 163);
  --chart-2: oklch(0.7 0.15 250);
  --chart-3: oklch(0.75 0.18 50);
  --chart-4: oklch(0.65 0.2 320);
  --chart-5: oklch(0.7 0.16 180);
  --sidebar: oklch(0.107 0.006 285);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.696 0.17 163);
  --sidebar-primary-foreground: oklch(1 0 0);
  --sidebar-accent: oklch(0.205 0.006 285);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(0.205 0.006 285);
  --sidebar-ring: oklch(0.696 0.17 163);
}
```

**Final file structure after edit (full file):**

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

:root {
  --background: oklch(0.961 0.009 247);
  --foreground: oklch(0.129 0.024 264);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.129 0.024 264);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.129 0.024 264);
  --primary: oklch(0.696 0.17 163);
  --primary-foreground: oklch(1 0 0);
  --secondary: oklch(0.961 0.009 247);
  --secondary-foreground: oklch(0.129 0.024 264);
  --muted: oklch(0.886 0.009 247);
  --muted-foreground: oklch(0.462 0.014 250);
  --accent: oklch(0.696 0.17 163);
  --accent-foreground: oklch(1 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(1 0 0);
  --border: oklch(0.886 0.009 247);
  --input: oklch(1 0 0);
  --ring: oklch(0.696 0.17 163);
  --chart-1: oklch(0.696 0.17 163);
  --chart-2: oklch(0.6 0.15 250);
  --chart-3: oklch(0.7 0.18 50);
  --chart-4: oklch(0.6 0.2 320);
  --chart-5: oklch(0.65 0.16 180);
  --radius: 0.625rem;
  --sidebar: oklch(0.129 0.024 264);
  --sidebar-foreground: oklch(0.961 0.009 247);
  --sidebar-primary: oklch(0.696 0.17 163);
  --sidebar-primary-foreground: oklch(1 0 0);
  --sidebar-accent: oklch(0.205 0.018 264);
  --sidebar-accent-foreground: oklch(0.961 0.009 247);
  --sidebar-border: oklch(0.205 0.018 264);
  --sidebar-ring: oklch(0.696 0.17 163);
}

.dark {
  --background: oklch(0.107 0.006 285);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.134 0.007 285);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.134 0.007 285);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.696 0.17 163);
  --primary-foreground: oklch(1 0 0);
  --secondary: oklch(0.205 0.006 285);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.205 0.006 285);
  --muted-foreground: oklch(0.651 0.006 285);
  --accent: oklch(0.696 0.17 163);
  --accent-foreground: oklch(1 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(0.985 0 0);
  --border: oklch(0.205 0.006 285);
  --input: oklch(0.205 0.006 285);
  --ring: oklch(0.696 0.17 163);
  --chart-1: oklch(0.696 0.17 163);
  --chart-2: oklch(0.7 0.15 250);
  --chart-3: oklch(0.75 0.18 50);
  --chart-4: oklch(0.65 0.2 320);
  --chart-5: oklch(0.7 0.16 180);
  --sidebar: oklch(0.107 0.006 285);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.696 0.17 163);
  --sidebar-primary-foreground: oklch(1 0 0);
  --sidebar-accent: oklch(0.205 0.006 285);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(0.205 0.006 285);
  --sidebar-ring: oklch(0.696 0.17 163);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
  /* Added Figtree as the default sans font */
  --font-sans: var(--font-figtree);
  --font-mono: ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

- [ ] Overwrite `app/globals.css` with the full file above

**Commit:**
```bash
git add nutrition_frontend/app/globals.css
git commit -m "fix(css): rewrite globals.css with light/dark theme tokens, remove forced light-mode overrides"
```

---

## Task 2: Fix layout.tsx

**File:** `/Users/practica/Desktop/Metabolic/nutrition_frontend/app/layout.tsx`

**Current line 24:**
```tsx
<html lang="en" className={`${figtree.variable} antialiased light`} style={{ colorScheme: 'light' }} suppressHydrationWarning>
```

**Current line 25:**
```tsx
<body className="font-sans bg-white text-black"><Providers>{children}</Providers></body>
```

**Replace line 24 with:**
```tsx
<html lang="en" className={`${figtree.variable} antialiased`} suppressHydrationWarning>
```

**Replace line 25 with:**
```tsx
<body className="font-sans"><Providers>{children}</Providers></body>
```

Changes summary:
- Remove `light` from `className` on `<html>`
- Remove `style={{ colorScheme: 'light' }}` from `<html>`
- Remove `bg-white text-black` from `<body>` className
- Keep `suppressHydrationWarning` on `<html>` — next-themes requires it

- [ ] Apply both edits to `app/layout.tsx`

**Commit:**
```bash
git add nutrition_frontend/app/layout.tsx
git commit -m "fix(layout): remove forced light mode from html and body"
```

---

## Task 3: Wire ThemeProvider in providers.tsx

**File:** `/Users/practica/Desktop/Metabolic/nutrition_frontend/app/providers.tsx`

**Verification (no action needed):** `next-themes` v0.4.6 is already installed and `components/theme-provider.tsx` already exists as a thin wrapper around `NextThemesProvider`.

**Complete replacement for `providers.tsx`:**

```tsx
"use client"

import { ThemeProvider } from "@/components/theme-provider"
import { DietDayProvider } from "@/context/DietDayContext"
import { CheatDayProvider } from "@/context/CheatDayContext"
import type { ReactNode } from "react"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <CheatDayProvider>
        <DietDayProvider>{children}</DietDayProvider>
      </CheatDayProvider>
    </ThemeProvider>
  )
}
```

- [ ] Overwrite `app/providers.tsx` with the code above

**Commit:**
```bash
git add nutrition_frontend/app/providers.tsx
git commit -m "feat(theme): wire ThemeProvider in providers.tsx with system default"
```

---

## Task 4: Fix app-layout.tsx background

**File:** `/Users/practica/Desktop/Metabolic/nutrition_frontend/components/app-layout.tsx`

**Current lines 15-16 (the two background divs):**
```tsx
{/* Background - Sporty Light Theme */}
<div className="fixed inset-0 bg-[#f8fafc] print:hidden" />
<div className="fixed inset-0 bg-gradient-to-br from-emerald-50/50 via-white to-blue-50/50 print:hidden" />
```

**Replace with** (a single theme-aware background div):
```tsx
{/* Background */}
<div className="fixed inset-0 bg-background print:hidden" />
```

Also update the mobile hamburger button (line 32) — it uses `bg-white/80 border border-emerald-100`:

**Current:**
```tsx
<button
  className="fixed top-3 left-4 z-30 md:hidden p-2 bg-white/80 border border-emerald-100 rounded-xl text-emerald-700 shadow-sm backdrop-blur-md print:hidden"
```

**Replace with:**
```tsx
<button
  className="fixed top-3 left-4 z-30 md:hidden p-2 bg-card/80 border border-border rounded-xl text-primary shadow-sm backdrop-blur-md print:hidden"
```

- [ ] Remove the two background divs (lines 15-16) and the comment, replace with the single `bg-background` div
- [ ] Update the mobile hamburger button className

**Commit:**
```bash
git add nutrition_frontend/components/app-layout.tsx
git commit -m "fix(layout): replace hardcoded light backgrounds with bg-background token"
```

---

## Task 5: Create ThemeToggle component

**New file:** `/Users/practica/Desktop/Metabolic/nutrition_frontend/components/theme-toggle.tsx`

**Complete file content:**

```tsx
'use client'

import { useTheme } from 'next-themes'
import { Sun, Moon, Monitor } from 'lucide-react'
import { useEffect, useState } from 'react'

const themes = ['light', 'dark', 'system'] as const
type Theme = typeof themes[number]

function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === 'light') return <Sun className="h-4 w-4" />
  if (theme === 'dark') return <Moon className="h-4 w-4" />
  return <Monitor className="h-4 w-4" />
}

function themeLabel(theme: Theme): string {
  if (theme === 'light') return 'Claro'
  if (theme === 'dark') return 'Oscuro'
  return 'Sistema'
}

export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <button className="w-full flex items-center justify-center p-2 rounded-lg text-white/60">
        <Monitor className="h-4 w-4" />
      </button>
    )
  }

  const current = (theme as Theme) ?? 'system'

  function cycle() {
    const idx = themes.indexOf(current)
    const next = themes[(idx + 1) % themes.length]
    setTheme(next)
  }

  return (
    <button
      onClick={cycle}
      title={`Tema: ${themeLabel(current)}`}
      className={`w-full flex items-center gap-2 rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white transition-colors ${
        collapsed ? 'justify-center' : 'justify-start'
      }`}
    >
      <ThemeIcon theme={current} />
      {!collapsed && <span className="text-sm">{themeLabel(current)}</span>}
    </button>
  )
}
```

- [ ] Create `components/theme-toggle.tsx` with the content above

**Commit:**
```bash
git add nutrition_frontend/components/theme-toggle.tsx
git commit -m "feat(theme): add ThemeToggle component that cycles light/dark/system"
```

---

## Task 6: Add ThemeToggle to sidebar

**File:** `/Users/practica/Desktop/Metabolic/nutrition_frontend/components/app-sidebar.tsx`

**What to do:** Import `ThemeToggle` and add it at the bottom of the `SidebarContent` card, below the `<nav>` block, separated by a thin divider.

**Add import** at the top of the file (after existing imports):
```tsx
import { ThemeToggle } from '@/components/theme-toggle'
```

**Current code** (verbatim lines 101-123 of `app-sidebar.tsx`):
```tsx
      {/* Navigation */}
      <nav className="space-y-1 mt-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Button
              key={item.href}
              variant="ghost"
              className={`w-full text-white/80 hover:bg-white/10 hover:text-white transition-all duration-300 h-11 ${
                collapsed ? "justify-center px-2" : "justify-start"
              } ${isActive ? "bg-white/20 text-white border border-white/30" : ""}`}
              asChild
              onClick={onClose}
            >
              <Link href={item.href} title={collapsed ? item.label : undefined}>
                <item.icon className={`h-5 w-5 shrink-0 ${collapsed ? "" : "mr-3"}`} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            </Button>
          )
        })}
      </nav>
    </Card>
```

**Replace with:**
```tsx
      {/* Navigation */}
      <nav className="space-y-1 mt-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Button
              key={item.href}
              variant="ghost"
              className={`w-full text-white/80 hover:bg-white/10 hover:text-white transition-all duration-300 h-11 ${
                collapsed ? "justify-center px-2" : "justify-start"
              } ${isActive ? "bg-white/20 text-white border border-white/30" : ""}`}
              asChild
              onClick={onClose}
            >
              <Link href={item.href} title={collapsed ? item.label : undefined}>
                <item.icon className={`h-5 w-5 shrink-0 ${collapsed ? "" : "mr-3"}`} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            </Button>
          )
        })}
      </nav>

      {/* Theme toggle */}
      <div className="mt-auto pt-4 border-t border-white/10">
        <ThemeToggle collapsed={collapsed} />
      </div>
    </Card>
```

### Sidebar white opacity class audit

All hardcoded `bg-white/*`, `border-white/*`, and `text-white/*` opacity classes present in `app-sidebar.tsx`:

| Class | Location |
|---|---|
| `bg-white/10` | Card root className (background) |
| `border-white/20` | Card root className (border) |
| `border-white/10` | Header row bottom border |
| `text-white/60` | Subtitle "Nutrición y Entrenamiento" |
| `text-white/60` | Close button (mobile) |
| `text-white/60` | Collapse button (desktop) |
| `text-white/80` | Nav button default text |
| `bg-white/10` | Nav button hover background |
| `bg-white/20` | Active nav item background |
| `border-white/30` | Active nav item border |

Sidebar stays dark in both light and dark modes — these white opacity classes are correct and intentional. The sidebar card uses a `bg-white/10` glass effect over a dark gradient, which remains appropriate regardless of the app theme. No changes required.

- [ ] Add the `ThemeToggle` import to `app-sidebar.tsx`
- [ ] Add the theme toggle bottom section inside `SidebarContent`, after `</nav>` and before `</Card>`

**Commit:**
```bash
git add nutrition_frontend/components/app-sidebar.tsx
git commit -m "feat(sidebar): add ThemeToggle at the bottom of the sidebar nav"
```

---

## Task 7: Add theme selector to Settings page

**Step 7a — Create the client component**

**New file:** `/Users/practica/Desktop/Metabolic/nutrition_frontend/components/appearance-settings.tsx`

```tsx
'use client'

import { useTheme } from 'next-themes'
import { Sun, Moon, Monitor } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  const current = theme ?? 'system'

  const options = [
    { value: 'light', label: 'Claro', Icon: Sun },
    { value: 'dark', label: 'Oscuro', Icon: Moon },
    { value: 'system', label: 'Sistema', Icon: Monitor },
  ]

  return (
    <Card className="p-6 mb-6">
      <h2 className="text-lg font-semibold mb-1">Apariencia</h2>
      <p className="text-sm text-muted-foreground mb-4">Elige el tema de la aplicación.</p>
      <div className="flex gap-3">
        {options.map(({ value, label, Icon }) => {
          const isActive = current === value
          return (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-foreground border-border hover:bg-muted'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          )
        })}
      </div>
    </Card>
  )
}
```

**Step 7b — Import and render in the settings page**

**File:** `/Users/practica/Desktop/Metabolic/nutrition_frontend/app/settings/page.tsx`

Add the import after the existing imports:
```tsx
import { AppearanceSettings } from "@/components/appearance-settings"
```

**Current code** (verbatim lines 162-178 of `app/settings/page.tsx`, immediately after the loading guard):
```tsx
  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <Card className="backdrop-blur-xl bg-black/5 dark:bg-white/10 border border-black/20 dark:border-white/20 rounded-3xl p-6">
          <div className="flex items-center gap-3">
            <Settings className="h-7 w-7 text-emerald-400" />
            <div>
              <h2 className="text-3xl font-bold text-foreground">Configuración</h2>
              <p className="text-muted-foreground">Gestiona tu perfil, preferencias y eventos</p>
            </div>
          </div>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="profile" className="space-y-6">
```

**Replace with:**
```tsx
  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <Card className="backdrop-blur-xl bg-black/5 dark:bg-white/10 border border-black/20 dark:border-white/20 rounded-3xl p-6">
          <div className="flex items-center gap-3">
            <Settings className="h-7 w-7 text-emerald-400" />
            <div>
              <h2 className="text-3xl font-bold text-foreground">Configuración</h2>
              <p className="text-muted-foreground">Gestiona tu perfil, preferencias y eventos</p>
            </div>
          </div>
        </Card>

        <AppearanceSettings />

        {/* Tabs */}
        <Tabs defaultValue="profile" className="space-y-6">
```

- [ ] Create `components/appearance-settings.tsx` with the full content above
- [ ] Add the `AppearanceSettings` import to `app/settings/page.tsx`
- [ ] Insert `<AppearanceSettings />` as the first element in the settings page content area, before the Tabs component

**Commit:**
```bash
git add nutrition_frontend/components/appearance-settings.tsx nutrition_frontend/app/settings/page.tsx
git commit -m "feat(settings): add Apariencia card with light/dark/system theme selector"
```

---

## Task 8: Delete styles/globals.css

**File to delete:** `/Users/practica/Desktop/Metabolic/nutrition_frontend/styles/globals.css`

First verify it is not imported anywhere:
```bash
grep -r "styles/globals" nutrition_frontend/
```

If the grep returns no results, delete the file:
```bash
rm nutrition_frontend/styles/globals.css
```

If the directory becomes empty, remove it too:
```bash
rmdir nutrition_frontend/styles 2>/dev/null || true
```

- [ ] Run the grep check to confirm no imports
- [ ] Delete `styles/globals.css` (and `styles/` directory if empty)

**Commit:**
```bash
git add -A nutrition_frontend/styles/
git commit -m "chore: delete unused styles/globals.css"
```

---

## Verification Checklist

After all tasks are complete:

- [ ] Run `npm run dev` in `nutrition_frontend/` — no build errors
- [ ] Open the app in a browser — light mode should show slate/white backgrounds, not dark
- [ ] Click the theme toggle in the sidebar — confirm it cycles through light / dark / system icons
- [ ] Set OS to dark mode and select "Sistema" — confirm the app goes dark
- [ ] Open Configuración — confirm the Apariencia card appears at the top with three buttons
- [ ] Confirm the sidebar remains dark in both light and dark modes
- [ ] Check no `color-scheme: light only` or `!important` overrides remain in `globals.css`
