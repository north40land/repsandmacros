import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {})
  // Hand the offline helper the files this page loaded, so the app opens with no signal
  // even if it has only been opened once before.
  navigator.serviceWorker.ready
    .then((reg) => {
      const mine = (url) => url.startsWith(location.origin) && /\/assets\/|icon-|manifest/.test(url)
      const base = location.origin + location.pathname
      const extra = ['icon-180.png', 'manifest.webmanifest'].map((f) => new URL(f, base).href)
      const urls = [base, ...extra, ...performance.getEntriesByType('resource').map((r) => r.name).filter(mine)]
      reg.active?.postMessage({ type: 'precache', urls: [...new Set(urls)] })
    })
    .catch(() => {})
}
