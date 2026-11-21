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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <AffichageProvider>
        <App />
      </AffichageProvider>
    </HashRouter>
  </StrictMode>,
)
