import { useEffect, useRef } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, LogIn, LogOut, Menu, UserPlus, X } from 'lucide-react'
import { useDb } from '../../lib/db'
import { authErrorMessage, logout, useCurrentUser } from '../../lib/auth'
import { useToast } from '../../hooks/useToast'
import { unreadNotificationCount } from '../../lib/selectors'
import { asset } from '../../lib/assets'
import { buttonClasses } from '../ui/form'
import { Avatar } from '../ui/misc'
import { LIENS_PUBLICS } from './siteNavigation'
import { CommandesAffichage, useAffichage } from './Affichage'

const FAVICON = asset('favicon.svg')
const ECRAN_LARGE = '(min-width: 80rem)'

function lienClasse({ isActive }: { isActive: boolean }): string {
  return `inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-base font-bold transition-colors ${
    isActive ? 'bg-leaf-pale text-forest underline decoration-2 underline-offset-4' : 'text-bark hover:bg-sand hover:text-forest'
  }`
}

export function SiteHeader() {
  useDb()
  const navigate = useNavigate()
  const { key } = useLocation()
  const dialogMobile = useRef<HTMLDialogElement>(null)
  const { navigationCompacte } = useAffichage()
  const utilisateur = useCurrentUser()
  const { toast } = useToast()
  const compteAccessible = utilisateur?.statut === 'actif'
  const unread = compteAccessible ? unreadNotificationCount(utilisateur.id) : 0

  const closeMenu = () => dialogMobile.current?.close()

  // Fermer aussi le dialogue lors d'un retour navigateur ou d'un passage au menu de bureau.
  useEffect(() => {
    dialogMobile.current?.close()
  }, [key])

  useEffect(() => {
    const ecran = window.matchMedia(ECRAN_LARGE)
    const fermerSurGrandEcran = (event: MediaQueryListEvent) => {
      if (event.matches && !navigationCompacte) dialogMobile.current?.close()
    }
    ecran.addEventListener('change', fermerSurGrandEcran)
    return () => ecran.removeEventListener('change', fermerSurGrandEcran)
  }, [navigationCompacte])

  const onDeconnexion = async () => {
    closeMenu()
    try {
      await logout()
      navigate('/')
    } catch (error) {
      toast(authErrorMessage(error), 'erreur')
    }
  }

  const liensPublics = (onNavigate?: () => void) =>
    LIENS_PUBLICS.map(({ to, label }) => (
      <NavLink key={to} to={to} end={to === '/'} className={lienClasse} onClick={onNavigate}>
        {label}
      </NavLink>
    ))

  const liensSession = (onNavigate?: () => void) => (
    utilisateur ? (
      <>
        {compteAccessible ? (
          <NavLink to="/mon-compte" className={lienClasse} onClick={onNavigate}>
            <Avatar user={utilisateur} size="sm" />
            Mon compte
            {unread > 0 ? (
              <span className="rounded-full bg-ocre-pale px-2 text-sm font-bold text-ocre-dark">
                <span aria-hidden="true">{unread}</span>
                <span className="sr-only">
                  {unread} {unread === 1 ? 'notification non lue' : 'notifications non lues'}
                </span>
              </span>
            ) : null}
          </NavLink>
        ) : null}
        {compteAccessible && utilisateur.role === 'administrateur' ? (
          <NavLink to="/admin" className={lienClasse} onClick={onNavigate}>
            <LayoutDashboard aria-hidden="true" className="h-5 w-5 shrink-0" />
            Administration
          </NavLink>
        ) : null}
        <button
          type="button"
          onClick={onDeconnexion}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-base font-bold text-brique hover:bg-brique-pale"
        >
          <LogOut aria-hidden="true" className="h-5 w-5 shrink-0" />
          Déconnexion
        </button>
      </>
    ) : (
      <>
        <NavLink to="/connexion" className={lienClasse} onClick={onNavigate}>
          <LogIn aria-hidden="true" className="h-5 w-5 shrink-0" />
          Connexion
        </NavLink>
        <NavLink
          to="/inscription"
          onClick={onNavigate}
          className={({ isActive }) => `${buttonClasses('primaire', 'petit')} ${isActive ? 'underline decoration-2 underline-offset-4' : ''}`}
        >
          <UserPlus aria-hidden="true" className="h-5 w-5 shrink-0" />
          Créer un compte
        </NavLink>
      </>
    )
  )

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5">
        <Link to="/" className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg sm:gap-3">
          <img src={FAVICON} alt="" className="h-9 w-9 shrink-0 rounded-lg sm:h-10 sm:w-10" />
          <span className="font-bold leading-tight text-forest">Foyer Rural d’Arches</span>
        </Link>

        {/* Navigation desktop */}
        <nav aria-label="Navigation principale" className={`hidden shrink-0 items-center gap-0.5 ${navigationCompacte ? '' : 'xl:flex'}`}>
          {liensPublics()}
        </nav>

        {/* Actions de session (desktop) */}
        <nav aria-label="Compte et session" className={`hidden shrink-0 items-center gap-1 ${navigationCompacte ? '' : 'xl:flex'}`}>
          {liensSession()}
        </nav>

        <div className="flex shrink-0 items-center gap-1">
          <CommandesAffichage />
          {/* Bouton menu mobile */}
          <button
            type="button"
            onClick={() => dialogMobile.current?.showModal()}
            className={`inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-2 rounded-xl border border-line bg-white px-2 text-base font-bold text-forest hover:bg-sand ${navigationCompacte ? '' : 'xl:hidden'}`}
            aria-haspopup="dialog"
            aria-controls="menu-site"
          >
            <Menu aria-hidden="true" className="h-5 w-5 shrink-0" />
            <span className="sr-only sm:not-sr-only">Menu</span>
          </button>
        </div>
      </div>

      {/* Menu mobile : fenêtre de dialogue accessible */}
      <dialog
        id="menu-site"
        ref={dialogMobile}
        aria-labelledby="titre-menu-site"
        className="fixed top-0 right-0 left-auto m-0 max-h-dvh w-full max-w-sm overflow-hidden rounded-b-2xl bg-white p-0 text-bark shadow-xl sm:h-dvh sm:rounded-none"
        onClick={(event) => {
          if (event.target === event.currentTarget) closeMenu()
        }}
      >
        <div className="flex max-h-dvh flex-col sm:h-full">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 py-3">
            <h2 id="titre-menu-site" className="text-xl text-forest">Navigation</h2>
            <button
              type="button"
              onClick={closeMenu}
              className={buttonClasses('secondaire', 'petit')}
            >
              <X aria-hidden="true" className="h-5 w-5" />
              Fermer
            </button>
          </div>
          <div className="min-h-0 overflow-y-auto p-4">
            <nav aria-label="Navigation principale" className="grid gap-1">
              {liensPublics(closeMenu)}
            </nav>
            <nav aria-label="Compte et session" className="mt-3 grid gap-1 border-t border-line pt-3">
              {liensSession(closeMenu)}
            </nav>
          </div>
        </div>
      </dialog>
    </header>
  )
}
