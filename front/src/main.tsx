import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import '@fontsource/atkinson-hyperlegible/400.css'
import '@fontsource/atkinson-hyperlegible/400-italic.css'
import '@fontsource/atkinson-hyperlegible/700.css'
import '@fontsource/atkinson-hyperlegible/700-italic.css'
import './styles/global.css'
import App from './App'
import { AffichageProvider } from './components/layout/Affichage'

// Caddy peut servir la SPA sur un chemin direct. HashRouter attend ce chemin dans le fragment.
const { hash, pathname, search } = window.location
const base = import.meta.env.BASE_URL
if (!hash && pathname.startsWith(base) && pathname !== base) {
  window.history.replaceState(window.history.state, '', `${base}#/${pathname.slice(base.length)}${search}`)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Le champ de recherche suit l’URL et doit rester synchronisé à chaque frappe. */}
    <HashRouter useTransitions={false}>
      <AffichageProvider>
        <App />
      </AffichageProvider>
    </HashRouter>
  </StrictMode>,
)
