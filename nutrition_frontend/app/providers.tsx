"use client"

import { DietDayProvider } from "@/context/DietDayContext"
import type { ReactNode } from "react"

export function Providers({ children }: { children: ReactNode }) {
  return <DietDayProvider>{children}</DietDayProvider>
}
