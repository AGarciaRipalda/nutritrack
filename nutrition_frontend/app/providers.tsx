"use client"

import { DietDayProvider } from "@/context/DietDayContext"
import { CheatDayProvider } from "@/context/CheatDayContext"
import type { ReactNode } from "react"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <CheatDayProvider>
      <DietDayProvider>{children}</DietDayProvider>
    </CheatDayProvider>
  )
}
