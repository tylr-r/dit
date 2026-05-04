import { Agentation } from 'agentation'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { WebPlatformProvider } from './platform'
import { initInputModalityTracking } from './utils/inputModality'

// Prevent <button> from receiving focus on mouse press. Without this, a clicked
// button retains DOM focus, and the browser's :focus-visible heuristic flips on
// as soon as the user presses any key (e.g. a global shortcut), causing the
// focus ring to appear retroactively on a button the user has already moved on
// from. Tab/keyboard navigation still focuses buttons normally.
document.addEventListener('mousedown', (event) => {
  const target = event.target as HTMLElement | null
  if (target?.closest('button')) {
    event.preventDefault()
  }
})

initInputModalityTracking()

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
