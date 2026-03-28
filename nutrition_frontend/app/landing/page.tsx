"use client"

import { useRouter } from "next/navigation"

const features = [
  {
    emoji: "🥗",
    title: "Plan de dieta IA",
    description:
      "Menús diarios y semanales personalizados generados con inteligencia artificial.",
  },
  {
    emoji: "💪",
    title: "Seguimiento de entrenos",
    description:
      "Registra tus sesiones, ejercicios, series y progresión de carga.",
  },
  {
    emoji: "📈",
    title: "Progreso real",
    description:
      "Visualiza tu evolución de peso con gráficas y tendencias semanales.",
  },
  {
    emoji: "🎯",
    title: "Metas personalizadas",
    description:
      "Objetivos adaptativos según tu goal: perder, mantener o ganar masa.",
  },
]

export default function LandingPage() {
  const router = useRouter()

  const handleRegister = () => {
    alert(
      "Para registrarte, envía un email a admin@metabolic.es solicitando tu cuenta."
    )
  }

  const handleLogin = () => {
    router.push("/login")
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero Section */}
      <section className="flex min-h-screen flex-col items-center justify-center px-4 py-20">
        {/* Logo */}
        <div className="relative mb-6">
          {/* Light mode: multiply blends away the dark bg */}
          <img
            src="/logo-metabolic.png"
            alt="METABOLIC logo"
            className="h-40 w-auto object-contain drop-shadow-[0_0_25px_rgba(16,185,129,0.4)] mix-blend-lighten dark:mix-blend-normal dark:drop-shadow-[0_0_35px_rgba(16,185,129,0.6)] sm:h-48"
          />
          {/* Light mode: radial fade to smooth edges */}
          <div className="pointer-events-none absolute inset-[-20px] bg-[radial-gradient(ellipse_at_center,_transparent_40%,_var(--background)_70%)] dark:bg-[radial-gradient(ellipse_at_center,_transparent_40%,_var(--background)_70%)]" />
        </div>

        {/* Title */}
        <h1 className="mb-8 text-center text-6xl font-black tracking-tight sm:text-7xl md:text-8xl">
          METABOLIC
        </h1>

        {/* Buttons */}
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <button
            onClick={handleLogin}
            className="rounded-full bg-slate-900 px-8 py-3.5 text-base font-semibold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-xl dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
          >
            Iniciar sesión
          </button>
          <button
            onClick={handleRegister}
            className="rounded-full border-2 border-slate-900 bg-transparent px-8 py-3.5 text-base font-semibold text-slate-900 transition-all hover:-translate-y-0.5 hover:bg-slate-900 hover:text-white dark:border-emerald-500 dark:text-emerald-400 dark:hover:bg-emerald-500 dark:hover:text-slate-950"
          >
            Registrarse
          </button>
        </div>

        {/* Subtitle */}
        <p className="mt-8 max-w-md text-center text-base leading-relaxed text-muted-foreground">
          Tu mejor aliado para la nutrición, el entrenamiento y el seguimiento
          de tu progreso físico.
        </p>
      </section>

      {/* Features Section */}
      <section className="mx-auto max-w-4xl px-4 py-20 sm:px-6">
        <div className="grid gap-5 sm:grid-cols-2">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-border bg-card p-7 shadow-sm transition-shadow hover:shadow-md"
            >
              <span className="mb-4 inline-block text-3xl">
                {feature.emoji}
              </span>
              <h3 className="mb-2 text-lg font-bold text-card-foreground">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 py-24 text-center">
        <h2 className="mb-4 text-4xl font-black tracking-tight sm:text-5xl md:text-6xl">
          Empieza hoy.
        </h2>
        <p className="mb-10 text-lg text-muted-foreground">
          Tu cuerpo te lo agradecerá.
        </p>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <button
            onClick={handleLogin}
            className="rounded-full bg-slate-900 px-10 py-4 text-base font-semibold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-xl dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
          >
            Iniciar sesión
          </button>
          <button
            onClick={handleRegister}
            className="rounded-full border-2 border-slate-900 bg-transparent px-10 py-4 text-base font-semibold text-slate-900 transition-all hover:-translate-y-0.5 hover:bg-slate-900 hover:text-white dark:border-emerald-500 dark:text-emerald-400 dark:hover:bg-emerald-500 dark:hover:text-slate-950"
          >
            Registrarse
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card px-6 py-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            © 2026 METABOLIC. Todos los derechos reservados.
          </p>
          <p className="text-sm text-muted-foreground">
            Hecho con{" "}
            <span className="text-red-500">❤️</span> para tu salud
          </p>
        </div>
      </footer>
    </div>
  )
}
