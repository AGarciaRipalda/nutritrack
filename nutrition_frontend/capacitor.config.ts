import type { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
  appId: "com.metabolic.app",
  appName: "Metabolic",
  webDir: "out",
  server: {
    androidScheme: "https",
    cleartext: false,
  },
}

export default config
