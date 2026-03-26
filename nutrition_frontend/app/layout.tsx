import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { Providers } from "./providers"

export const metadata: Metadata = {
  title: "METABOLIC - Nutrition & Training Assistant",
  description: "Track your nutrition, plan meals, log workouts, and monitor your fitness progress",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <body className="font-sans"><Providers>{children}</Providers></body>
    </html>
  )
}
