import { API_BASE } from "./api-base"

export const SESSION_STORAGE_KEY = "metabolic-session"
const AUTH_CHANGE_EVENT = "metabolic-auth-change"
const ACCESS_REFRESH_MARGIN_MS = 60_000

export interface AuthUser {
  id: string
  email: string
  name?: string
  role?: "user" | "admin"
}

export interface ActiveSession {
  accessToken: string
  refreshToken: string
  user: AuthUser
  expiresAt: string
  refreshExpiresAt: string
  loggedInAt: string
}

interface LoginResponse {
  access_token: string
  refresh_token: string
  token_type: string
  access_expires_at?: string
  refresh_expires_at?: string
  user: AuthUser
}

let refreshPromise: Promise<ActiveSession | null> | null = null

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

function isExpired(expiresAt: string, marginMs = 0) {
  return Date.parse(expiresAt) <= Date.now() + marginMs
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

function normalizeSession(raw: unknown): ActiveSession | null {
  if (!raw || typeof raw !== "object") return null
  const session = raw as Partial<ActiveSession>
  if (
    typeof session.accessToken !== "string" ||
    typeof session.refreshToken !== "string" ||
    typeof session.expiresAt !== "string" ||
    typeof session.refreshExpiresAt !== "string" ||
    typeof session.loggedInAt !== "string" ||
    !session.user
  ) {
    return null
  }
  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    user: session.user,
    expiresAt: session.expiresAt,
    refreshExpiresAt: session.refreshExpiresAt,
    loggedInAt: session.loggedInAt,
  }
}

function sessionFromPayload(payload: LoginResponse, previous?: ActiveSession | null): ActiveSession {
  const expiresAt = payload.access_expires_at || parseTokenExpiry(payload.access_token)
  const refreshExpiresAt = payload.refresh_expires_at

  if (!expiresAt || !refreshExpiresAt) {
    throw new Error("La respuesta de autenticación es inválida.")
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    user: payload.user,
    expiresAt,
    refreshExpiresAt,
    loggedInAt: previous?.loggedInAt ?? new Date().toISOString(),
  }
}

function isLoginResponse(payload: unknown): payload is LoginResponse {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      "access_token" in payload &&
      typeof (payload as LoginResponse).access_token === "string" &&
      "refresh_token" in payload &&
      typeof (payload as LoginResponse).refresh_token === "string"
  )
}

function buildHeaders(initHeaders?: HeadersInit, accessToken?: string) {
  const headers = new Headers(initHeaders ?? {})
  if (API_BASE.includes("ngrok")) {
    headers.set("ngrok-skip-browser-warning", "true")
  }
  if (typeof Intl !== "undefined") {
    headers.set("X-User-Timezone", Intl.DateTimeFormat().resolvedOptions().timeZone)
  }
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`)
  }
  return headers
}

async function parseJsonSafely<T>(response: Response) {
  return (await response.json().catch(() => null)) as T | null
}

async function performRefresh(session: ActiveSession): Promise<ActiveSession | null> {
  if (isExpired(session.refreshExpiresAt)) {
    clearActiveSession()
    return null
  }

  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: buildHeaders({ Accept: "application/json", "Content-Type": "application/json" }),
    body: JSON.stringify({ refresh_token: session.refreshToken }),
  })

  const payload = await parseJsonSafely<LoginResponse | { detail?: unknown }>(response)
  if (!response.ok || !payload || !("access_token" in payload) || !("refresh_token" in payload)) {
    clearActiveSession()
    return null
  }

  const refreshed = sessionFromPayload(payload, session)
  writeActiveSession(refreshed)
  return refreshed
}

export function readActiveSession(): ActiveSession | null {
  if (typeof window === "undefined") return null

  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)
  if (!raw) return null

  try {
    const session = normalizeSession(JSON.parse(raw))
    if (
      !session ||
      isExpired(session.refreshExpiresAt) ||
      isExpired(session.expiresAt, ACCESS_REFRESH_MARGIN_MS)
    ) {
      if (!session || isExpired(session.refreshExpiresAt)) {
        clearActiveSession()
        return null
      }
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
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: buildHeaders({
      Accept: "application/json",
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({ email, password }),
  })

  const payload = await parseJsonSafely<LoginResponse | { detail?: unknown }>(response)

  if (!response.ok) {
    throw new Error(parseErrorMessage(payload, "No se pudo iniciar sesión."))
  }

  if (!isLoginResponse(payload)) {
    throw new Error("La respuesta de autenticación es inválida.")
  }

  const session = sessionFromPayload(payload)
  writeActiveSession(session)
  return session
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const response = await authorizedFetch(`${API_BASE}/auth/change-password`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  })

  const payload = await parseJsonSafely<LoginResponse | { detail?: unknown }>(response)
  if (!response.ok) {
    throw new Error(parseErrorMessage(payload, "No se pudo cambiar la contraseña."))
  }
  if (!isLoginResponse(payload)) {
    throw new Error("La respuesta de autenticación es inválida.")
  }

  const session = sessionFromPayload(payload, readActiveSession())
  writeActiveSession(session)
  return session
}

export async function requestPasswordReset(email: string) {
  const response = await fetch(`${API_BASE}/auth/reset-password/request`, {
    method: "POST",
    headers: buildHeaders({
      Accept: "application/json",
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({ email }),
  })

  const payload = await parseJsonSafely<{ detail?: unknown; message?: unknown }>(response)
  if (!response.ok) {
    throw new Error(parseErrorMessage(payload, "No se pudo solicitar el reseteo."))
  }

  return typeof payload?.message === "string"
    ? payload.message
    : "Si existe una cuenta para ese correo, ya hay un proceso de reseteo en marcha."
}

export async function confirmPasswordReset(token: string, newPassword: string) {
  const response = await fetch(`${API_BASE}/auth/reset-password/confirm`, {
    method: "POST",
    headers: buildHeaders({
      Accept: "application/json",
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({
      token,
      new_password: newPassword,
    }),
  })

  const payload = await parseJsonSafely<LoginResponse | { detail?: unknown }>(response)
  if (!response.ok) {
    throw new Error(parseErrorMessage(payload, "No se pudo restablecer la contraseña."))
  }
  if (!isLoginResponse(payload)) {
    throw new Error("La respuesta de autenticación es inválida.")
  }

  const session = sessionFromPayload(payload)
  writeActiveSession(session)
  return session
}

export async function fetchCurrentUser(accessToken = getAccessToken()) {
  if (!accessToken) return null

  const response = await fetch(`${API_BASE}/auth/me`, {
    headers: buildHeaders({ Accept: "application/json" }, accessToken),
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error("La sesión no es válida.")
  }

  return (await response.json()) as AuthUser
}

export async function refreshAccessSession(force = false) {
  const session = readActiveSession()
  if (!session) return null

  if (!force && !isExpired(session.expiresAt, ACCESS_REFRESH_MARGIN_MS)) {
    return session
  }

  if (!refreshPromise) {
    refreshPromise = performRefresh(session).finally(() => {
      refreshPromise = null
    })
  }

  return refreshPromise
}

export async function refreshActiveSession() {
  const session = await refreshAccessSession()
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
    const retried = await refreshAccessSession(true)
    if (!retried) {
      clearActiveSession()
      return null
    }

    try {
      const user = await fetchCurrentUser(retried.accessToken)
      if (!user) {
        clearActiveSession()
        return null
      }
      const refreshed: ActiveSession = { ...retried, user }
      writeActiveSession(refreshed, false)
      return refreshed
    } catch {
      clearActiveSession()
      return null
    }
  }
}

export async function authorizedFetch(
  input: string | URL,
  init?: RequestInit,
  options?: { retryOnUnauthorized?: boolean },
) {
  const retryOnUnauthorized = options?.retryOnUnauthorized ?? true
  let session = await refreshAccessSession()
  const requestInit: RequestInit = {
    ...init,
    headers: buildHeaders(init?.headers, session?.accessToken),
  }

  let response = await fetch(input, requestInit)
  if (response.status !== 401 || !retryOnUnauthorized) {
    return response
  }

  session = await refreshAccessSession(true)
  if (!session) {
    clearActiveSession()
    return response
  }

  response = await fetch(input, {
    ...init,
    headers: buildHeaders(init?.headers, session.accessToken),
  })

  if (response.status === 401) {
    clearActiveSession()
  }

  return response
}

export async function logout() {
  const session = readActiveSession()
  try {
    if (session) {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        headers: buildHeaders(
          {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          session.accessToken,
        ),
        body: JSON.stringify({ refresh_token: session.refreshToken }),
      })
    }
  } finally {
    clearActiveSession()
  }
}
