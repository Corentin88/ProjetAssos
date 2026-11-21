import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { db, session, useDb } from '../../lib/db'
import { Alert } from '../ui/feedback'

/** Protection des routes nécessitant une session (§2)
 *  useDb : les garde-fous réagissent immédiatement aux changements de la
 *  base (rôle modifié, compte suspendu par un autre administrateur…) */
export function RequireAuth({ children }: { children: ReactNode }) {
  useDb()
  const location = useLocation()
  const sessionUser = session.current
    ? db.users.find((u) => u.id === session.current!.userId) ?? null
    : null

  if (!sessionUser) {
    return <Navigate to="/connexion" state={{ from: location.pathname }} replace />
  }
  // Compte suspendu : les sessions sont invalidées (§10)
  if (sessionUser.statut === 'suspendu') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Alert kind="attention" title="Votre compte est suspendu">
          <p>
            L'accès à l'espace personnel est désactivé. Les contenus publics du site restent
            accessibles en lecture. Pour plus d'informations, contactez l'association via le
            formulaire de contact.
          </p>
        </Alert>
      </div>
    )
  }
  return <>{children}</>
}

/** Protection des routes d'administration (§2.3) */
export function RequireAdmin({ children }: { children: ReactNode }) {
  useDb()
  const location = useLocation()
  const sessionUser = session.current
    ? db.users.find((u) => u.id === session.current!.userId) ?? null
    : null

  if (!sessionUser) {
    return <Navigate to="/connexion" state={{ from: location.pathname }} replace />
  }
  if (sessionUser.statut === 'suspendu') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Alert kind="attention" title="Votre compte est suspendu">
          <p>L'accès à l'administration est désactivé pour les comptes suspendus.</p>
        </Alert>
      </div>
    )
  }
  if (sessionUser.role !== 'administrateur') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Alert kind="erreur" title="Accès réservé aux administrateurs">
          <p>
            Votre compte ne dispose pas du rôle « Administrateur ». Si vous pensez qu'il s'agit
            d'une erreur, contactez le bureau de l'association.
          </p>
        </Alert>
      </div>
    )
  }
  return <>{children}</>
}
