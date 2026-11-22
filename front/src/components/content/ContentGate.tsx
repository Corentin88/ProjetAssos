import type { ReactNode } from 'react'
import { loadContent } from '../../lib/content'
import { contentStatus, useDb } from '../../lib/db'
import { Alert } from '../ui/feedback'
import { Button } from '../ui/form'

export function ContentGate({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  useDb()
  const scope = admin ? 'admin' : 'public'
  const status = contentStatus[scope]
  if (status === 'ready') return <>{children}</>
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      {status === 'loading' ? <p role="status">Chargement des contenus…</p> : (
        <Alert kind="erreur" title="Contenus indisponibles">
          <Button variant="secondaire" onClick={() => void loadContent(scope)}>Réessayer</Button>
        </Alert>
      )}
    </div>
  )
}
