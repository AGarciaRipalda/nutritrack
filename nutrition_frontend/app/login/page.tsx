"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Flame } from "lucide-react"
import { login } from "@/lib/auth"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!email || !password) return

    setIsSubmitting(true)
    setError(null)

    try {
      await login(email, password)
      router.push("/dashboard")
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo iniciar sesión.",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSignUp = () => {
    alert(
      "Para registrarte, envía un correo a admin@metabolic.es solicitando tu cuenta.",
    )
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
              Bienvenido a METABOLIC
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Inicia sesión para continuar
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
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

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-card-foreground"
              >
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 pr-11 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={
                    showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !email || !password}
              className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-50 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
            >
              {isSubmitting ? "Iniciando sesión..." : "Iniciar sesión"}
            </button>

            {error ? (
              <p className="text-sm text-red-500" role="alert">
                {error}
              </p>
            ) : null}
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">o</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <button
            type="button"
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-card-foreground transition-colors hover:bg-muted"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Iniciar sesión con Google
          </button>

          <div className="mt-6 flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => router.push("/reset-password")}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              ¿Olvidaste tu contraseña?
            </button>
            <button
              type="button"
              onClick={handleSignUp}
              className="font-medium text-primary transition-colors hover:text-primary/80"
            >
              ¿No tienes cuenta? Regístrate
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
