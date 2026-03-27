"use client"

import { useState } from "react"
import type { ReactNode } from "react"
import { AppSidebar } from "./app-sidebar"
import { Menu } from "lucide-react"

export function AppLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="min-h-screen relative overflow-hidden font-sans">
      {/* Background */}
      <div className="fixed inset-0 bg-background print:hidden" />

      {/* Decorative patterns */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none print:hidden"
           style={{ backgroundImage: 'radial-gradient(#10b981 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }} />

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/20 backdrop-blur-sm md:hidden print:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Layout */}
      <div className="relative flex gap-4 p-3 md:p-6 min-h-screen print:block print:p-0">
        <div className="print:hidden">
          <AppSidebar
            mobileOpen={mobileOpen}
            onMobileClose={() => setMobileOpen(false)}
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed(!collapsed)}
          />
        </div>
        <main className="flex-1 min-w-0 print:pt-0">
          {/* Mobile hamburger button — inside content flow, aligned with cards */}
          <div className="md:hidden mb-2 print:hidden">
            <button
              className="p-2 bg-card/80 border border-border rounded-xl text-primary shadow-sm backdrop-blur-md"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menú"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
          <div className="max-w-[1680px] mx-auto h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
