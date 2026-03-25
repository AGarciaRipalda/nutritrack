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
