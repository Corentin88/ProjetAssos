import { useCurrentUser } from '../../lib/auth'
import { NavLink, Outlet } from 'react-router-dom'
import { Bell, MessageSquare, ShieldCheck, Trash2, UserCircle } from 'lucide-react'
import { useDb } from '../../lib/db'
import { unreadNotificationCount } from '../../lib/selectors'
import { RequireAuth } from '../../components/layout/guards'
import { formatDate, formatMoisAnnee } from '../../lib/format'
import { Avatar } from '../../components/ui/misc'

/** « Mon compte » (§13) : profil, sécurité/connexion, mes commentaires,
 *  notifications, suppression du compte */
const SECTIONS = [
  { to: '/mon-compte', label: 'Profil', icon: UserCircle, fin: true },
  { to: '/mon-compte/securite', label: 'Sécurité et connexion', icon: ShieldCheck },
  { to: '/mon-compte/mes-commentaires', label: 'Mes commentaires', icon: MessageSquare },
  { to: '/mon-compte/notifications', label: 'Notifications', icon: Bell },
  { to: '/mon-compte/supprimer', label: 'Supprimer mon compte', icon: Trash2, danger: true },
]

function MonCompteLayout() {
  useDb()
  const sessionUser = useCurrentUser()
  const unread = sessionUser ? unreadNotificationCount(sessionUser.id) : 0

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-forest">Mon compte</h1>
      {sessionUser ? (
        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-white p-6">
          <Avatar user={sessionUser} size="lg" />
          <div>
            <p className="text-xl font-bold">
              {sessionUser.prenom} {sessionUser.nom}
            </p>
            <p className="text-mist">
              Membre depuis {formatMoisAnnee(sessionUser.createdAt)} — compte créé le{' '}
              {formatDate(sessionUser.createdAt)}
            </p>
            <p className="mt-1 text-[0.9375rem]">
              <span className="inline-flex items-center gap-2 rounded-full bg-leaf-pale px-3 py-1 font-bold text-forest">
                Rôle : {sessionUser.role === 'administrateur' ? 'Administrateur' : 'Utilisateur'}
              </span>
              <span className="ml-2 inline-flex items-center gap-2 rounded-full bg-leaf-pale px-3 py-1 font-bold text-forest">
                Statut : {sessionUser.statut === 'actif' ? 'Actif' : 'Suspendu'}
              </span>
              {unread > 0 ? (
                <span className="ml-2 inline-flex items-center gap-2 rounded-full bg-ocre-pale px-3 py-1 font-bold text-ocre-dark">
                  {unread} notification{unread > 1 ? 's' : ''} non lue{unread > 1 ? 's' : ''}
                </span>
              ) : null}
            </p>
          </div>
        </div>
      ) : null}

      <nav aria-label="Sections de mon compte" className="mt-8">
        <ul className="flex flex-wrap gap-2">
          {SECTIONS.map((s) => (
            <li key={s.to}>
              <NavLink
                to={s.to}
                end={s.fin}
                className={({ isActive }) =>
                  `inline-flex min-h-[48px] items-center gap-2 rounded-xl px-5 font-bold ${
                    isActive
                      ? s.danger
                        ? 'bg-brique text-white'
                        : 'bg-forest text-white'
                      : s.danger
                        ? 'border border-brique text-brique hover:bg-brique-pale'
                        : 'border border-line bg-white text-forest hover:bg-leaf-pale'
                  }`
                }
              >
                <s.icon aria-hidden="true" className="h-5 w-5" />
                {s.label}
                {s.to.includes('notifications') && unread > 0 ? (
                  <span className="ml-1 rounded-full bg-ocre px-2 py-0.5 text-[0.8125rem] text-white">
                    {unread}
                  </span>
                ) : null}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-8">
        <Outlet />
      </div>
    </div>
  )
}

export function MonCompte() {
  return (
    <RequireAuth>
      <MonCompteLayout />
    </RequireAuth>
  )
}
