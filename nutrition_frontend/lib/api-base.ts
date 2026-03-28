const DEFAULT_REMOTE_API_BASE = "https://api.metabolic.es"
const DEFAULT_LOCAL_API_BASE = "http://localhost:8000"

export function resolveApiBase() {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim()
  if (configured) return configured.replace(/\/+$/, "")

  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location
    if (
      protocol === "http:" &&
      (hostname === "localhost" || hostname === "127.0.0.1")
    ) {
      return DEFAULT_LOCAL_API_BASE
    }
  }

  return DEFAULT_REMOTE_API_BASE
}

export const API_BASE = resolveApiBase()
