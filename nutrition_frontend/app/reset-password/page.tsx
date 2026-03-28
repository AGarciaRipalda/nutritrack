"use client"

import { FormEvent, Suspense, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Eye, EyeOff, Flame } from "lucide-react"
import { confirmPasswordReset, requestPasswordReset } from "@/lib/auth"

function ResetPasswordPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")?.trim() ?? ""
  const isConfirmMode = useMemo(() => token.length > 0, [token])

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const handleRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!email) return

    setIsSubmitting(true)
    setError(null)
    setStatus(null)

    try {
      const message = await requestPasswordReset(email)
      setStatus(message)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo solicitar el reseteo.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleConfirm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!password || !confirmPassword) return
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.")
      return
    }

    setIsSubmitting(true)
    setError(null)
    setStatus(null)

    try {
      await confirmPasswordReset(token, password)
      router.push("/dashboard")
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo restablecer la contraseña.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="rounded-3xl border border-border bg-card p-8 shadow-xl">
          <div className="mb-6 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 shadow-lg dark:from-emerald-600 dark:to-emerald-800">
              <Flame className="h-7 w-7 text-white" />
            </div>
          </div>

          <div className="mb-8 text-center">
            <h1 className="text-xl font-bold text-card-foreground">
              {isConfirmMode ? "Nueva contraseña" : "Recuperar acceso"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isConfirmMode
                ? "Define una nueva contraseña para tu cuenta"
                : "Solicita el reseteo de tu contraseña"}
            </p>
          </div>

          {isConfirmMode ? (
            <form className="space-y-4" onSubmit={handleConfirm}>
              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-sm font-medium text-card-foreground"
                >
                  Nueva contraseña
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={8}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 pr-11 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="confirm-password"
                  className="mb-1.5 block text-sm font-medium text-card-foreground"
                >
                  Repite la contraseña
                </label>
                <div className="relative">
                  <input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    minLength={8}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 pr-11 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((value) => !value)}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || password.length < 8 || confirmPassword.length < 8}
                className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-50 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
              >
                {isSubmitting ? "Guardando..." : "Guardar nueva contraseña"}
              </button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={handleRequest}>
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-sm font-medium text-card-foreground"
                >
                  Correo electrónico
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="correo@ejemplo.com"
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  autoComplete="email"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !email}
                className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-50 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
              >
                {isSubmitting ? "Enviando..." : "Solicitar reseteo"}
              </button>
            </form>
          )}

          {status ? <p className="mt-4 text-sm text-emerald-500">{status}</p> : null}
          {error ? <p className="mt-4 text-sm text-red-500">{error}</p> : null}

          <div className="mt-6 text-center text-sm">
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="text-primary transition-colors hover:text-primary/80"
            >
              Volver al inicio de sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
          <div className="text-sm text-muted-foreground">Cargando...</div>
        </div>
      }
    >
      <ResetPasswordPageContent />
    </Suspense>
  )
}
