import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { Providers } from "./providers"
import { RouteGate } from "@/components/route-gate"

export const metadata: Metadata = {
  title: "METABOLIC | Nutrición y Entrenamiento",
  description:
    "Controla tu nutrición, planifica tus comidas, registra tus entrenamientos y sigue tu progreso físico.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className="antialiased" suppressHydrationWarning>
      <body className="font-sans">
        <Providers>
          <RouteGate>{children}</RouteGate>
        </Providers>
      </body>
    </html>
  )
}
