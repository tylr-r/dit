/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GA_MEASUREMENT_ID?: string
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

export {}
