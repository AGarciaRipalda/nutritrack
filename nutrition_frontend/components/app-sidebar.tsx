"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Apple,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  FileBarChart,
  LayoutDashboard,
  LogOut,
  Settings,
  Shield,
  TrendingUp,
  Utensils,
  X,
} from "lucide-react"
import { LevelBadge } from "@/components/level-badge"
import { ThemeToggle } from "@/components/theme-toggle"
import type { GamificationStatus } from "@/lib/api"
import { fetchGamification } from "@/lib/api"
import {
  getCurrentSessionUser,
  isAdminUser,
  logout,
  subscribeToAuthChanges,
} from "@/lib/auth"

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Inicio" },
  { href: "/diet", icon: Utensils, label: "Dieta de hoy" },
  { href: "/weekly-plan", icon: CalendarDays, label: "Plan semanal" },
  { href: "/training", icon: Dumbbell, label: "Entrenamiento" },
  { href: "/progress", icon: TrendingUp, label: "Seguimiento" },
  { href: "/report", icon: FileBarChart, label: "Informe semanal" },
  { href: "/settings", icon: Settings, label: "Configuración" },
]

const adminNavItem = {
  href: "/admin",
  icon: Shield,
  label: "Administración",
}

interface SidebarContentProps {
  collapsed: boolean
  onToggleCollapse: () => void
  onClose?: () => void
  showClose?: boolean
}

function SidebarContent({
  collapsed,
  onToggleCollapse,
  onClose,
  showClose,
}: SidebarContentProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [gamification, setGamification] = useState<GamificationStatus | null>(
    null,
  )
  const [showAdminNav, setShowAdminNav] = useState(() =>
    isAdminUser(getCurrentSessionUser()),
  )

  useEffect(() => {
    fetchGamification().then(setGamification).catch(() => null)
  }, [])

  useEffect(() => {
    const syncSession = () => {
      setShowAdminNav(isAdminUser(getCurrentSessionUser()))
    }

    syncSession()
    return subscribeToAuthChanges(syncSession)
  }, [])

  const visibleNavItems = showAdminNav ? [...navItems, adminNavItem] : navItems

  return (
    <Card
      className={`flex flex-col rounded-3xl border border-gray-200 bg-white/10 backdrop-blur-xl transition-all duration-300 dark:border-white/20 dark:bg-white/10 ${
        collapsed ? "w-16 p-3" : "w-64 p-5"
      }`}
    >
      <div
        className={`border-b border-gray-200 pb-4 dark:border-white/10 ${
          collapsed
            ? "flex flex-col items-center gap-2"
            : "flex items-center justify-between"
        }`}
      >
        {collapsed ? (
          <>
            <Apple className="h-7 w-7 shrink-0 text-emerald-400" />
            <button
              onClick={onToggleCollapse}
              className="hidden shrink-0 p-1 text-gray-500 hover:text-gray-900 dark:text-white/60 dark:hover:text-white md:block"
              aria-label="Expandir menú"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <div className="flex min-w-0 items-center gap-2">
              <Apple className="h-7 w-7 shrink-0 text-emerald-400" />
              <div className="min-w-0">
                <h1 className="text-xl font-bold leading-tight text-gray-900 dark:text-white">
                  METABOLIC
                </h1>
                <p className="truncate text-xs text-gray-500 dark:text-white/60">
                  Nutrición y entrenamiento
                </p>
              </div>
            </div>
            {showClose ? (
              <button
                onClick={onClose}
                className="ml-2 shrink-0 p-1 text-gray-500 hover:text-gray-900 dark:text-white/60 dark:hover:text-white"
                aria-label="Cerrar menú"
              >
                <X className="h-5 w-5" />
              </button>
            ) : (
              <button
                onClick={onToggleCollapse}
                className="hidden shrink-0 p-1 text-gray-500 hover:text-gray-900 dark:text-white/60 dark:hover:text-white md:block"
                aria-label="Contraer menú"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
          </>
        )}
      </div>

      {gamification ? (
        <div className="mt-4">
          <LevelBadge status={gamification} collapsed={collapsed} />
        </div>
      ) : null}

      <nav className="mt-4 space-y-1">
        {visibleNavItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Button
              key={item.href}
              variant="ghost"
              className={`h-11 w-full text-gray-700 transition-all duration-300 hover:bg-gray-100 hover:text-gray-900 dark:text-white/80 dark:hover:bg-white/10 dark:hover:text-white ${
                collapsed ? "justify-center px-2" : "justify-start"
              } ${
                isActive
                  ? "border border-gray-300 bg-gray-200 text-gray-900 dark:border-white/30 dark:bg-white/20 dark:text-white"
                  : ""
              }`}
              asChild
              onClick={onClose}
            >
              <Link href={item.href} title={collapsed ? item.label : undefined}>
                <item.icon className={`h-5 w-5 shrink-0 ${collapsed ? "" : "mr-3"}`} />
                {!collapsed ? <span>{item.label}</span> : null}
              </Link>
            </Button>
          )
        })}
      </nav>

      <div className="mt-auto space-y-2 border-t border-gray-200 pt-4 dark:border-white/10">
        <Button
          variant="ghost"
          className={`h-11 w-full text-gray-700 transition-all duration-300 hover:bg-gray-100 hover:text-gray-900 dark:text-white/80 dark:hover:bg-white/10 dark:hover:text-white ${
            collapsed ? "justify-center px-2" : "justify-start"
          }`}
          onClick={() => {
            void (async () => {
              await logout()
              onClose?.()
              router.push("/login")
            })()
          }}
        >
          <LogOut className={`h-5 w-5 shrink-0 ${collapsed ? "" : "mr-3"}`} />
          {!collapsed ? <span>Cerrar sesión</span> : null}
        </Button>
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

export function AppSidebar({
  mobileOpen,
  onMobileClose,
  collapsed,
  onToggleCollapse,
}: AppSidebarProps) {
  return (
    <>
      <div className="sticky top-6 hidden shrink-0 self-start md:block">
        <SidebarContent
          collapsed={collapsed}
          onToggleCollapse={onToggleCollapse}
        />
      </div>

      <div
        className={`fixed inset-y-0 left-0 z-30 p-4 transition-transform duration-300 ease-in-out md:hidden ${
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
