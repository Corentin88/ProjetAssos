import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { restoreSession, useAuthSession } from '../../lib/auth'
import { Alert } from '../ui/feedback'
import { Button } from '../ui/form'

function SessionEnAttente({ indisponible }: { indisponible: boolean }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      {indisponible ? (
        <Alert kind="erreur" title="Session indisponible">
          <p>Le serveur n’a pas pu vérifier votre session.</p>
          <Button className="mt-3" variant="secondaire" onClick={() => void restoreSession()}>Réessayer</Button>
        </Alert>
      ) : (
        <p role="status">Vérification de votre session…</p>
      )}
    </div>
  )
}

/** Protection des routes nécessitant une session (§2). */
export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { status, user: sessionUser } = useAuthSession()

  if (status !== 'ready') return <SessionEnAttente indisponible={status === 'unavailable'} />
  if (!sessionUser) {
    return <Navigate to="/connexion" state={{ from: location.pathname + location.search + location.hash }} replace />
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
  const location = useLocation()
  const { status, user: sessionUser } = useAuthSession()

  if (status !== 'ready') return <SessionEnAttente indisponible={status === 'unavailable'} />
  if (!sessionUser) {
    return <Navigate to="/connexion" state={{ from: location.pathname + location.search + location.hash }} replace />
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
