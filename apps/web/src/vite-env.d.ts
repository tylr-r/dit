/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GA_MEASUREMENT_ID?: string
  readonly VITE_ANALYTICS_ENABLED?: string
  readonly VITE_RECAPTCHA_SITE_KEY?: string
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
    FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string
  }
}

export {}
