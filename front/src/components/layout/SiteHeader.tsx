import { useRef } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import {
  Home,
  LogIn,
  LogOut,
  Menu,
  LayoutDashboard,
  Newspaper,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { db, session, useDb, logout } from '../../lib/db'
import { unreadNotificationCount } from '../../lib/selectors'
import { asset } from '../../lib/assets'
import { Avatar } from '../ui/misc'

const FAVICON = asset('favicon.svg')

/** Navigation principale (§27) — s'adapte au statut de l'utilisateur */
const LIENS_PUBLICS = [
  { to: '/', label: 'Accueil', icon: Home },
  { to: '/actualites', label: 'Actualités', icon: Newspaper },
  { to: '/association', label: "L'association", icon: Users },
  { to: '/contact', label: 'Contact', icon: Users },
]

function lienClasse({ isActive }: { isActive: boolean }): string {
  return `rounded-lg px-2.5 py-2 font-bold transition-colors ${
    isActive ? 'bg-leaf-pale text-forest' : 'text-bark hover:bg-sand hover:text-forest'
  }`
}

export function SiteHeader() {
  useDb()
  const navigate = useNavigate()
  const dialogMobile = useRef<HTMLDialogElement>(null)

  const sessionUser = session.current
    ? db.users.find((u) => u.id === session.current!.userId) ?? null
    : null

  const unread = sessionUser ? unreadNotificationCount(sessionUser.id) : 0

  const openMenu = () => dialogMobile.current?.showModal()
  const closeMenu = () => dialogMobile.current?.close()

  const onDeconnexion = () => {
    logout()
    navigate('/')
  }

  const navLinks = (onNavigate?: () => void) => (
    <>
      {LIENS_PUBLICS.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.to === '/'}
          className={lienClasse}
          onClick={onNavigate}
        >
          <span className="inline-flex items-center gap-2">
            <l.icon aria-hidden="true" className="h-5 w-5" />
            {l.label}
          </span>
        </NavLink>
      ))}
    </>
  )

  const authLinks = (onNavigate?: () => void) => (
    <>
      {sessionUser ? (
        <>
          <NavLink to="/mon-compte" className={lienClasse} onClick={onNavigate}>
            <span className="inline-flex items-center gap-2">
              <Avatar user={sessionUser} size="sm" />
              Mon compte
              {unread > 0 ? (
                <span
                  className="ml-1 inline-flex min-w-[1.75rem] items-center justify-center rounded-full bg-ocre px-2 py-0.5 text-[0.8125rem] font-bold text-white"
                  aria-label={`${unread} notification${unread > 1 ? 's' : ''} non lue${unread > 1 ? 's' : ''}`}
                >
                  {unread}
                </span>
              ) : null}
            </span>
          </NavLink>
          {sessionUser.role === 'administrateur' ? (
            <NavLink to="/admin" className={lienClasse} onClick={onNavigate}>
              <span className="inline-flex items-center gap-2">
                <LayoutDashboard aria-hidden="true" className="h-5 w-5" />
                Administration
              </span>
            </NavLink>
          ) : null}
          <button
            type="button"
            onClick={() => {
              closeMenu()
              onDeconnexion()
            }}
            className="inline-flex min-h-[48px] items-center gap-2 rounded-lg px-3 font-bold text-brique hover:bg-brique-pale"
          >
            <LogOut aria-hidden="true" className="h-5 w-5" />
            Déconnexion
          </button>
        </>
      ) : (
        <>
          <NavLink to="/connexion" className={lienClasse} onClick={onNavigate}>
            <span className="inline-flex items-center gap-2">
              <LogIn aria-hidden="true" className="h-5 w-5" />
              Connexion
            </span>
          </NavLink>
          <NavLink
            to="/inscription"
            onClick={onNavigate}
            className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-forest px-5 font-bold text-white shadow-sm transition-colors hover:bg-forest-dark"
          >
            <UserPlus aria-hidden="true" className="h-5 w-5" />
            Créer un compte
          </NavLink>
        </>
      )}
    </>
  )

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white shadow-[0_1px_2px_rgb(31_44_37_/_0.04)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-3 sm:gap-4 sm:px-4">
        <Link to="/" className="flex min-w-0 shrink items-center gap-2 rounded-lg py-1 pr-1 sm:gap-3 sm:pr-2">
          <img src={FAVICON} alt="" className="h-10 w-10 shrink-0 rounded-xl sm:h-11 sm:w-11" />
          <span className="min-w-0 whitespace-nowrap text-base font-bold leading-tight text-forest sm:text-lg">
            Foyer Rural d'Arches
            <span className="hidden whitespace-nowrap text-[0.8125rem] font-normal text-mist sm:block">
              Association du village — depuis 1962
            </span>
          </span>
        </Link>

        {/* Navigation desktop */}
        <nav aria-label="Navigation principale" className="hidden shrink items-center gap-0.5 xl:flex">
          {navLinks()}
        </nav>

        {/* Actions de session (desktop) */}
        <div className="hidden shrink-0 items-center gap-1 xl:flex">{authLinks()}</div>

        {/* Bouton menu mobile */}
        <button
          type="button"
          onClick={openMenu}
          className="inline-flex min-h-[48px] shrink-0 items-center gap-1.5 rounded-xl border border-line bg-white px-3 font-bold text-forest hover:bg-sand sm:px-4 xl:hidden"
          aria-haspopup="dialog"
        >
          <Menu aria-hidden="true" className="h-6 w-6" />
          Menu
        </button>
      </div>

      {/* Menu mobile : fenêtre de dialogue accessible */}
      <dialog
        ref={dialogMobile}
        aria-label="Menu de navigation"
        className="fixed inset-0 m-0 h-dvh max-h-full w-full max-w-none rounded-none bg-white p-0 text-bark"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-line p-4">
            <p className="text-lg font-bold text-forest">Navigation</p>
            <button
              type="button"
              onClick={closeMenu}
              className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border border-line bg-white px-4 font-bold text-forest hover:bg-sand"
            >
              <X aria-hidden="true" className="h-6 w-6" />
              Fermer
            </button>
          </div>
          <nav
            aria-label="Navigation principale (mobile)"
            className="flex flex-col gap-1 overflow-y-auto p-4"
          >
            {navLinks(closeMenu)}
            <div className="my-3 border-t border-line" aria-hidden="true" />
            <div className="flex flex-col gap-1">{authLinks(closeMenu)}</div>
          </nav>
          <div className="mt-auto p-4 text-[0.9375rem] text-mist">
            <Link to="/contact" onClick={closeMenu} className="underline underline-offset-4">
              Nous contacter
            </Link>
          </div>
        </div>
      </dialog>
    </header>
  )
}
