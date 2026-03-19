"use client"

import { useState } from "react"
import type { ReactNode } from "react"
import { AppSidebar } from "./app-sidebar"
import { Menu } from "lucide-react"

export function AppLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 bg-black print:hidden" />

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 md:hidden print:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile hamburger button */}
      <button
        className="fixed top-4 left-4 z-30 md:hidden p-2 bg-white/10 border border-white/20 rounded-xl text-white backdrop-blur-sm print:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menú"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Layout */}
      <div className="relative flex gap-6 p-4 md:p-6 min-h-screen print:block print:p-0">
        <div className="print:hidden">
          <AppSidebar
            mobileOpen={mobileOpen}
            onMobileClose={() => setMobileOpen(false)}
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed(!collapsed)}
          />
        </div>
        <main className="flex-1 overflow-y-auto pt-12 md:pt-0 min-w-0 print:pt-0">
          {children}
        </main>
      </div>
    </div>
  )
}
