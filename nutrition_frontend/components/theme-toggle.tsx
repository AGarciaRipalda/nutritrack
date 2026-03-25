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
