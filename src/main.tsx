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
}

migrateLegacyStorage()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
