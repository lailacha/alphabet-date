import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then((reg) => {
    // Phones keep installed apps open for days: look for a new version
    // whenever the app comes back to the foreground.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update()
    })
  })
  // A new version took over: reload once to show it.
  let reloaded = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return
    reloaded = true
    location.reload()
  })
}
