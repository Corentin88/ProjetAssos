import { matchPath, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { SiteHeader } from './SiteHeader'
import { SiteFooter } from './SiteFooter'
import { SkipLink } from '../ui/nav'

/** Layout public : lien d'évitement, en-tête, contenu principal, pied de page */
export function PublicLayout() {
  const { pathname } = useLocation()
  const contenu = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    // L'accueil et la liste des actualités restaurent leur propre position au retour.
    if (!matchPath('/', pathname) && !matchPath('/actualites', pathname)) {
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
  }, [pathname])

  // Au changement de page, replacer le focus et la lecture en haut du contenu
  useEffect(() => {
    contenu.current?.focus({ preventScroll: true })
  }, [pathname])

  return (
    <div className="flex min-h-screen flex-col bg-sand">
      <SkipLink cible="contenu-principal" />
      <SiteHeader />
      <main id="contenu-principal" ref={contenu} tabIndex={-1} className="flex-1 scroll-mt-20 outline-none">
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
