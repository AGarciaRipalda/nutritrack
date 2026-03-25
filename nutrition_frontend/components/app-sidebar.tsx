"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  LayoutDashboard,
  Utensils,
  CalendarDays,
  Dumbbell,
  TrendingUp,
  FileBarChart,
  Settings,
  Apple,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react"
import { LevelBadge } from "@/components/level-badge"
import type { GamificationStatus } from "@/lib/api"
import { fetchGamification } from "@/lib/api"
import { ThemeToggle } from '@/components/theme-toggle'

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Inicio" },
  { href: "/diet", icon: Utensils, label: "Dieta de hoy" },
  { href: "/weekly-plan", icon: CalendarDays, label: "Plan semanal" },
  { href: "/training", icon: Dumbbell, label: "Entrenamiento" },
  { href: "/progress", icon: TrendingUp, label: "Seguimiento" },
  { href: "/report", icon: FileBarChart, label: "Informe semanal" },
  { href: "/settings", icon: Settings, label: "Configuración" },
]

interface SidebarContentProps {
  collapsed: boolean
  onToggleCollapse: () => void
  onClose?: () => void
  showClose?: boolean
}

function SidebarContent({ collapsed, onToggleCollapse, onClose, showClose }: SidebarContentProps) {
  const pathname = usePathname()
  const [gamification, setGamification] = useState<GamificationStatus | null>(null)

  useEffect(() => {
    fetchGamification().then(setGamification).catch(() => null)
  }, [])

  return (
    <Card
      className={`backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl flex flex-col transition-all duration-300 ${
        collapsed ? "w-16 p-3" : "w-64 p-5"
      }`}
    >
      {/* Header row */}
      <div
        className={`pb-4 border-b border-white/10 flex items-center ${
          collapsed ? "justify-center" : "justify-between"
        }`}
      >
        {collapsed ? (
          <Apple className="h-7 w-7 text-emerald-400 shrink-0" />
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <Apple className="h-7 w-7 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white leading-tight">METABOLIC</h1>
              <p className="text-white/60 text-xs truncate">Nutrición y Entrenamiento</p>
            </div>
          </div>
        )}

        {showClose ? (
          <button onClick={onClose} className="text-white/60 hover:text-white p-1 ml-2 shrink-0">
            <X className="h-5 w-5" />
          </button>
        ) : (
          <button
            onClick={onToggleCollapse}
            className="text-white/60 hover:text-white p-1 shrink-0 hidden md:block"
            aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {/* Level badge */}
      {gamification && (
        <div className="mt-4">
          <LevelBadge status={gamification} collapsed={collapsed} />
        </div>
      )}

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
  )
}

interface AppSidebarProps {
  mobileOpen: boolean
  onMobileClose: () => void
  collapsed: boolean
  onToggleCollapse: () => void
}

export function AppSidebar({ mobileOpen, onMobileClose, collapsed, onToggleCollapse }: AppSidebarProps) {
  return (
    <>
      {/* Desktop sidebar — inline */}
      <div className="hidden md:block shrink-0 sticky top-6 self-start">
        <SidebarContent
          collapsed={collapsed}
          onToggleCollapse={onToggleCollapse}
        />
      </div>

      {/* Mobile sidebar — fixed drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-30 md:hidden p-4 transition-transform duration-300 ease-in-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarContent
          collapsed={false}
          onToggleCollapse={() => {}}
          onClose={onMobileClose}
          showClose
        />
      </div>
    </>
  )
}
