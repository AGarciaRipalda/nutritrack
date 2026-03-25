import type React from "react"
import type { Metadata } from "next"
import { Figtree } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"

const figtree = Figtree({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-figtree",
})

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
    <html lang="en" className={`${figtree.variable} antialiased`} suppressHydrationWarning>
      <body className="font-sans"><Providers>{children}</Providers></body>
    </html>
  )
}
