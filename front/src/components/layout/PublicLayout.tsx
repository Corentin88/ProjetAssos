import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { SiteHeader } from './SiteHeader'
import { SiteFooter } from './SiteFooter'

/** Layout public : lien d'évitement, en-tête, contenu principal, pied de page */
export function PublicLayout() {
  const { pathname } = useLocation()

  // Au changement de page, replacer le focus et la lecture en haut du contenu
  useEffect(() => {
    const main = document.getElementById('contenu-principal')
    main?.focus({ preventScroll: true })
  }, [pathname])

  return (
    <div className="flex min-h-screen flex-col bg-sand">
      <a href="#contenu-principal" className="skip-link">
        Aller au contenu principal
      </a>
      <SiteHeader />
      <main id="contenu-principal" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}

/** Titre de page standardisé (h1 unique par page) */
export function PageHead({
  titre,
  sousTitre,
  children,
}: {
  titre: string
  sousTitre?: string
  children?: React.ReactNode
}) {
  return (
    <div className="border-b border-line bg-white">
      <div className="mx-auto max-w-7xl px-4 py-10 md:py-12">
        <h1 className="text-forest">{titre}</h1>
        {sousTitre ? <p className="mt-3 max-w-3xl text-lg text-mist">{sousTitre}</p> : null}
        {children}
      </div>
    </div>
  )
}
