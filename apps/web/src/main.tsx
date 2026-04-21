import { Agentation } from 'agentation'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { WebPlatformProvider } from './platform'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WebPlatformProvider>
      <>
        <App />
        {import.meta.env.DEV && <Agentation />}
      </>
    </WebPlatformProvider>
  </StrictMode>,
)
