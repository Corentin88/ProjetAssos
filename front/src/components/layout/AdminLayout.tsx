import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  FileText,
  Home,
  Images,
  LayoutDashboard,
  ListTree,
  LogOut,
  MessageSquare,
  MessagesSquare,
  Menu,
  RefreshCw,
  ScrollText,
  Tags,
  Users,
  X,
} from 'lucide-react'
import { db, logout, resetDemoData, session, useDb } from '../../lib/db'
import { asset } from '../../lib/assets'
import { Avatar } from '../ui/misc'
import { fullName } from '../../lib/db'
import { ConfirmDialog } from '../ui/overlay'
import { useToast } from '../../hooks/useToast'

const FAVICON = asset('favicon.svg')

interface LienAdmin {
  to: string
  label: string
  icon: typeof Home
  fin?: boolean
}

const GROUPES: { titre: string; liens: LienAdmin[] }[] = [
  {
    titre: 'Pilotage',
    liens: [{ to: '/admin', label: 'Tableau de bord', icon: LayoutDashboard, fin: true }],
  },
  {
    titre: 'Contenus',
    liens: [
      { to: '/admin/articles', label: 'Articles', icon: FileText },
      { to: '/admin/categories', label: 'Catégories et tags', icon: Tags },
      { to: '/admin/medias', label: 'Médiathèque', icon: Images },
      { to: '/admin/association', label: "Page « L'association »", icon: ListTree },
    ],
  },
  {
    titre: 'Échanges',
    liens: [
      { to: '/admin/commentaires', label: 'Commentaires', icon: MessagesSquare },
      { to: '/admin/messages', label: 'Messages de contact', icon: MessageSquare },
    ],
  },
  {
    titre: 'Suivi',
    liens: [
      { to: '/admin/utilisateurs', label: 'Utilisateurs', icon: Users },
      { to: '/admin/statistiques', label: 'Statistiques', icon: LayoutDashboard },
      { to: '/admin/journal', label: "Journal d'activité", icon: ScrollText },
    ],
  },
]

function lienClasse({ isActive }: { isActive: boolean }): string {
  return `flex items-center gap-3 rounded-xl px-4 py-2.5 font-bold transition-colors ${
    isActive
      ? 'bg-white/15 text-white'
      : 'text-white/85 hover:bg-white/10 hover:text-white'
  }`
}

/** Compteurs d'éléments à traiter affichés sur les rubriques concernées
 *  (productivité : repérer d'un coup d'œil ce qui attend une action) */
function compteurLien(to: string): { valeur: number; urgence: boolean } | null {
  if (to === '/admin/messages') {
    const n = db.messages.filter((m) => !m.lu).length
    return n > 0 ? { valeur: n, urgence: true } : null
  }
  if (to === '/admin/articles') {
    const n = db.articles.filter((a) => a.statut === 'corbeille').length
    return n > 0 ? { valeur: n, urgence: false } : null
  }
  return null
}

function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Navigation de l'administration" className="flex flex-col gap-5">
      {GROUPES.map((g) => (
        <section key={g.titre} aria-labelledby={`admin-nav-${g.titre}`}>
          <h2
            id={`admin-nav-${g.titre}`}
            className="mb-1 px-4 text-[0.8125rem] font-bold uppercase tracking-wide text-white/60"
          >
            {g.titre}
          </h2>
          <ul className="flex flex-col gap-1">
            {g.liens.map((l) => {
              const compteur = compteurLien(l.to)
              return (
                <li key={l.to}>
                  <NavLink to={l.to} end={l.fin} className={lienClasse} onClick={onNavigate}>
                    <l.icon aria-hidden="true" className="h-5 w-5 shrink-0" />
                    <span className="min-w-0 flex-1">{l.label}</span>
                    {compteur ? (
                      <span
                        className={`inline-flex min-w-[1.75rem] items-center justify-center rounded-full px-2 py-0.5 text-[0.8125rem] font-bold ${
                          compteur.urgence
                            ? 'bg-ocre text-white'
                            : 'bg-white/20 text-white'
                        }`}
                        aria-label={`${compteur.valeur} élément${compteur.valeur > 1 ? 's' : ''} à consulter`}
                      >
                        {compteur.valeur}
                      </span>
                    ) : null}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </nav>
  )
}

/** Layout de l'administration : identité visuelle distincte du site public
 *  (colonne latérale sombre, fond instrumental) mais mêmes couleurs de marque. */
export function AdminLayout() {
  useDb()
  const navigate = useNavigate()
  const { toast } = useToast()
  const drawer = useRef<HTMLDialogElement>(null)
  const [resetOuvert, setResetOuvert] = useState(false)
  const sessionUser = session.current
    ? db.users.find((u) => u.id === session.current!.userId) ?? null
    : null

  // Focus du contenu principal à chaque navigation interne
  useEffect(() => {
    const main = document.getElementById('contenu-admin')
    main?.focus({ preventScroll: true })
  })

  const openDrawer = () => drawer.current?.showModal()
  const closeDrawer = () => drawer.current?.close()

  const onDeconnexion = () => {
    logout()
    navigate('/')
  }

  const onReset = () => {
    resetDemoData()
    setResetOuvert(false)
    toast('Données de démonstration réinitialisées : toutes les modifications ont été perdues.', 'info')
    navigate('/admin')
  }

  return (
    <div className="flex min-h-screen flex-col bg-admin">
      <a href="#contenu-admin" className="skip-link">
        Aller au contenu principal
      </a>

      {/* Barre supérieure mobile */}
      <div className="focus-inverse sticky top-0 z-40 flex items-center justify-between gap-3 bg-forest-dark px-4 py-3 text-white lg:hidden">
        <button
          type="button"
          onClick={openDrawer}
          className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-white/10 px-4 font-bold"
          aria-haspopup="dialog"
        >
          <Menu aria-hidden="true" className="h-6 w-6" />
          Menu
        </button>
        <Link to="/admin" className="flex items-center gap-2 rounded-lg py-1 font-bold">
          <img src={FAVICON} alt="" className="h-9 w-9 rounded-lg" />
          Administration
        </Link>
        <Link
          to="/"
          className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-white/10 px-3 font-bold"
        >
          <Home aria-hidden="true" className="h-5 w-5" />
          <span className="sr-only">Retour au site public</span>
          Site
        </Link>
      </div>

      <div className="flex flex-1">
        {/* Sidebar desktop */}
        <aside className="hidden w-80 shrink-0 flex-col bg-forest-dark p-5 lg:flex">
          <Link to="/admin" className="flex items-center gap-3 rounded-xl p-2 hover:bg-white/10">
            <img src={FAVICON} alt="" className="h-11 w-11 rounded-xl" />
            <span className="leading-tight text-white">
              <span className="block font-bold">Foyer Rural d'Arches</span>
              <span className="block text-[0.875rem] text-white/70">Espace d'administration</span>
            </span>
          </Link>
          <div className="my-5 border-t border-white/15" aria-hidden="true" />
          <div className="scrollzone flex-1 overflow-y-auto">
            <AdminNav />
          </div>
          <div className="mt-5 border-t border-white/15 pt-5">
            {sessionUser ? (
              <div className="flex items-center gap-3 rounded-xl bg-white/10 p-3 text-white">
                <Avatar user={sessionUser} size="sm" />
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate font-bold">{fullName(sessionUser)}</p>
                  <p className="text-[0.8125rem] text-white/70">
                    {sessionUser.role === 'administrateur' ? 'Administrateur' : 'Utilisateur'}
                  </p>
                </div>
              </div>
            ) : null}
            <Link
              to="/"
              className="mt-3 flex items-center gap-3 rounded-xl px-4 py-3 font-bold text-white/85 hover:bg-white/10 hover:text-white"
            >
              <Home aria-hidden="true" className="h-5 w-5" />
              Voir le site public
            </Link>
            <button
              type="button"
              onClick={() => setResetOuvert(true)}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 font-bold text-white/85 hover:bg-white/10 hover:text-white"
            >
              <RefreshCw aria-hidden="true" className="h-5 w-5" />
              Réinitialiser les données
            </button>
            <button
              type="button"
              onClick={onDeconnexion}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 font-bold text-white/85 hover:bg-white/10 hover:text-white"
            >
              <LogOut aria-hidden="true" className="h-5 w-5" />
              Déconnexion
            </button>
          </div>
        </aside>

        {/* Tiroir mobile */}
        <dialog
          ref={drawer}
          aria-label="Menu de l'administration"
          className="fixed inset-y-0 left-0 m-0 h-dvh max-h-full w-[min(24rem,calc(100vw-3rem))] max-w-none rounded-r-2xl border-r border-admin-line bg-forest-dark p-0"
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-white/15 p-4">
              <p className="font-bold text-white">Administration</p>
              <button
                type="button"
                onClick={closeDrawer}
                className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-white/10 px-4 font-bold text-white"
              >
                <X aria-hidden="true" className="h-6 w-6" />
                Fermer
              </button>
            </div>
            <div className="scrollzone flex-1 overflow-y-auto p-4">
              <AdminNav onNavigate={closeDrawer} />
            </div>
            <div className="border-t border-white/15 p-4">
              <Link
                to="/"
                onClick={closeDrawer}
                className="flex items-center gap-3 rounded-xl px-4 py-3 font-bold text-white/85 hover:bg-white/10 hover:text-white"
              >
                <Home aria-hidden="true" className="h-5 w-5" />
                Voir le site public
              </Link>
              <button
                type="button"
                onClick={() => {
                  closeDrawer()
                  setResetOuvert(true)
                }}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 font-bold text-white/85 hover:bg-white/10 hover:text-white"
              >
                <RefreshCw aria-hidden="true" className="h-5 w-5" />
                Réinitialiser les données
              </button>
              <button
                type="button"
                onClick={() => {
                  closeDrawer()
                  onDeconnexion()
                }}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 font-bold text-white/85 hover:bg-white/10 hover:text-white"
              >
                <LogOut aria-hidden="true" className="h-5 w-5" />
                Déconnexion
              </button>
            </div>
          </div>
        </dialog>

        {/* Contenu */}
        <main id="contenu-admin" tabIndex={-1} className="min-w-0 flex-1 outline-none">
          <Outlet />
        </main>
      </div>

      {/* Réinitialisation des données de démonstration (brief §10) */}
      <ConfirmDialog
        open={resetOuvert}
        onClose={() => setResetOuvert(false)}
        onConfirm={onReset}
        title="Réinitialiser les données de démonstration ?"
        confirmLabel="Réinitialiser les données"
      >
        <p>
          Toutes les modifications effectuées dans la maquette (articles créés ou modifiés,
          commentaires, comptes, messages, page de l'association…) seront <strong>définitivement
          perdues</strong> et les données de démonstration d'origine rétablies. Vous serez
          déconnecté·e. Cette action est utile pour repartir d'une situation propre pendant la
          démonstration.
        </p>
      </ConfirmDialog>
    </div>
  )
}

/** En-tête de page administration (h1 + actions) */
export function AdminPageHead({
  titre,
  description,
  children,
}: {
  titre: string
  description?: string
  children?: React.ReactNode
}) {
  return (
    <div className="border-b border-admin-line bg-white px-4 py-6 md:px-8">
      <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl text-forest md:text-3xl">{titre}</h1>
          {description ? <p className="mt-1 max-w-2xl text-mist">{description}</p> : null}
        </div>
        {children ? <div className="flex flex-wrap gap-3">{children}</div> : null}
      </div>
    </div>
  )
}

