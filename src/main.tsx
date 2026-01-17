import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const gaMeasurementId = import.meta.env.VITE_GA_MEASUREMENT_ID

if (gaMeasurementId) {
  const existingScript = document.getElementById(`ga-gtag-${gaMeasurementId}`)
  if (!existingScript) {
    const script = document.createElement('script')
    script.id = `ga-gtag-${gaMeasurementId}`
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`
    document.head.appendChild(script)
  }

  const dataLayer = (window.dataLayer = window.dataLayer || [])
  const gtag = window.gtag || ((...args: unknown[]) => dataLayer.push(args))
  window.gtag = gtag
  window.gtag('js', new Date())
  window.gtag('config', gaMeasurementId)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
