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

  const appearanceDescription = "Elige el tema de la aplicaci" + String.fromCharCode(243) + "n."

  const options = [
    { value: 'light', label: 'Claro', Icon: Sun },
    { value: 'dark', label: 'Oscuro', Icon: Moon },
    { value: 'system', label: 'Sistema', Icon: Monitor },
  ]

  return (
    <Card className="mb-6 min-w-0 overflow-hidden p-4 sm:p-6">
      <h2 className="mb-1 text-lg font-semibold">Apariencia</h2>
      <p className="mb-4 text-sm text-muted-foreground">{appearanceDescription}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {options.map(({ value, label, Icon }) => {
          const isActive = current === value
          return (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={`flex min-w-0 items-center justify-start gap-2 rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors sm:justify-center sm:text-center ${
                isActive
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-foreground hover:bg-muted'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="min-w-0 break-words">{label}</span>
            </button>
          )
        })}
      </div>
    </Card>
  )
}
