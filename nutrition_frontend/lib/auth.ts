import { API_BASE } from "./api-base"

export const SESSION_STORAGE_KEY = "metabolic-session"
const AUTH_CHANGE_EVENT = "metabolic-auth-change"

export interface AuthUser {
  id: string
  email: string
  name?: string
  role?: "user" | "admin"
}

export interface ActiveSession {
  accessToken: string
  user: AuthUser
  expiresAt: string
  loggedInAt: string
}

interface LoginResponse {
  access_token: string
  token_type: string
  user: AuthUser
}

function emitAuthChange() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT))
}

function decodeBase64Url(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/")
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4)

  if (typeof window !== "undefined" && typeof window.atob === "function") {
    const binary = window.atob(padded)
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  }

  return Buffer.from(padded, "base64").toString("utf-8")
}

function parseTokenExpiry(accessToken: string) {
  const [, payload] = accessToken.split(".")
  if (!payload) return null

  try {
    const parsed = JSON.parse(decodeBase64Url(payload)) as { exp?: number }
    if (typeof parsed.exp !== "number") return null
    return new Date(parsed.exp * 1000).toISOString()
  } catch {
    return null
  }
}

function isExpired(expiresAt: string) {
  return Date.parse(expiresAt) <= Date.now()
}

function parseErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "detail" in payload) {
    const detail = (payload as { detail?: unknown }).detail
    if (typeof detail === "string" && detail.trim()) return detail
  }
  return fallback
}

function writeActiveSession(session: ActiveSession, notify = true) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
  if (notify) {
    emitAuthChange()
  }
}

export function readActiveSession(): ActiveSession | null {
  if (typeof window === "undefined") return null

  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)
  if (!raw) return null

  try {
    const session = JSON.parse(raw) as ActiveSession
    if (!session.accessToken || !session.expiresAt || isExpired(session.expiresAt)) {
      clearActiveSession()
      return null
    }
    return session
  } catch {
    clearActiveSession()
    return null
  }
}

export function hasActiveSession() {
  return readActiveSession() !== null
}

export function getAccessToken() {
  return readActiveSession()?.accessToken ?? null
}

export function getCurrentSessionUser() {
  return readActiveSession()?.user ?? null
}

export function isAdminUser(user: AuthUser | null | undefined) {
  return user?.role === "admin"
}

export function clearActiveSession() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(SESSION_STORAGE_KEY)
  emitAuthChange()
}

export function subscribeToAuthChanges(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {}
  }

  const handler = () => callback()
  window.addEventListener(AUTH_CHANGE_EVENT, handler)
  window.addEventListener("storage", handler)
  return () => {
    window.removeEventListener(AUTH_CHANGE_EVENT, handler)
    window.removeEventListener("storage", handler)
  }
}

export async function login(email: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  })

  const payload = (await res.json().catch(() => null)) as
    | LoginResponse
    | { detail?: unknown }
    | null

  if (!res.ok) {
    throw new Error(parseErrorMessage(payload, "No se pudo iniciar sesión."))
  }

  if (
    !payload ||
    !("access_token" in payload) ||
    typeof payload.access_token !== "string"
  ) {
    throw new Error("La respuesta de autenticación es inválida.")
  }

  const expiresAt = parseTokenExpiry(payload.access_token)
  if (!expiresAt) {
    throw new Error("No se pudo validar el token recibido.")
  }

  const session: ActiveSession = {
    accessToken: payload.access_token,
    user: payload.user,
    expiresAt,
    loggedInAt: new Date().toISOString(),
  }
  writeActiveSession(session)
  return session
}

export async function fetchCurrentUser(accessToken = getAccessToken()) {
  if (!accessToken) return null

  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  })

  if (!res.ok) {
    throw new Error("La sesión no es válida.")
  }

  return (await res.json()) as AuthUser
}

export async function refreshActiveSession() {
  const session = readActiveSession()
  if (!session) return null

  try {
    const user = await fetchCurrentUser(session.accessToken)
    if (!user) {
      clearActiveSession()
      return null
    }

    const refreshed: ActiveSession = { ...session, user }
    writeActiveSession(refreshed, false)
    return refreshed
  } catch {
    clearActiveSession()
    return null
  }
}
