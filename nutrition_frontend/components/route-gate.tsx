"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  hasActiveSession,
  isAdminUser,
  refreshActiveSession,
  subscribeToAuthChanges,
} from "@/lib/auth"

const PROTECTED_PATHS = [
  "/admin",
  "/dashboard",
  "/diet",
  "/weekly-plan",
  "/training",
  "/progress",
  "/report",
  "/settings",
]

function isProtectedPath(pathname: string) {
  return PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )
}

function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/")
}

export function RouteGate({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isAllowed, setIsAllowed] = useState(() => !isProtectedPath(pathname))

  useEffect(() => {
    let cancelled = false

    const evaluateAccess = async () => {
      if (pathname === "/login") {
        if (!hasActiveSession()) {
          if (!cancelled) setIsAllowed(true)
          return
        }

        const session = await refreshActiveSession()
        if (cancelled) return

        if (session) {
          setIsAllowed(false)
          router.replace("/dashboard")
          return
        }

        setIsAllowed(true)
        return
      }

      if (!isProtectedPath(pathname)) {
        if (!cancelled) setIsAllowed(true)
        return
      }

      if (!hasActiveSession()) {
        if (!cancelled) {
          setIsAllowed(false)
          router.replace("/login")
        }
        return
      }

      const session = await refreshActiveSession()
      if (cancelled) return

      if (!session) {
        setIsAllowed(false)
        router.replace("/login")
        return
      }

      if (isAdminPath(pathname) && !isAdminUser(session.user)) {
        setIsAllowed(false)
        router.replace("/dashboard")
        return
      }

      setIsAllowed(true)
    }

    void evaluateAccess()
    const unsubscribe = subscribeToAuthChanges(() => {
      void evaluateAccess()
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [pathname, router])

  if (!isAllowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="text-sm font-medium text-muted-foreground">
          Cargando...
        </div>
      </div>
    )
  }

  return <>{children}</>
}
