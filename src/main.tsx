import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { migrateLegacyStorage } from './lib/storageMigration.ts'

// Handle Vite dynamic import chunk preload failures after new deployments
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault()
    try {
      const alreadyReloaded = sessionStorage.getItem('baseer_chunk_reload') === 'true'
      if (!alreadyReloaded) {
        sessionStorage.setItem('baseer_chunk_reload', 'true')
        window.location.reload()
      }
    } catch (err) {
      console.warn('vite:preloadError handler failed:', err)
    }
  })

  // Clear previous reload flag on successful script boot
  try {
    sessionStorage.removeItem('baseer_chunk_reload')
  } catch {
    // ignore
  }

  // Auto-reload when a new Service Worker takes control (skipWaiting activated).
  // This ensures users always get the latest version without manual refresh.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      try {
        const alreadyReloaded = sessionStorage.getItem('baseer_sw_reload') === 'true'
        if (!alreadyReloaded) {
          sessionStorage.setItem('baseer_sw_reload', 'true')
          window.location.reload()
        }
      } catch {
        window.location.reload()
      }
    })
    // Clear sw reload flag after boot so next update can reload again
    try {
      sessionStorage.removeItem('baseer_sw_reload')
    } catch {
      // ignore
    }
  }
}

migrateLegacyStorage()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
