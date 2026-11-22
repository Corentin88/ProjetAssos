import { useCurrentUser } from '../../lib/auth'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BellOff, CircleAlert, Info, ShieldCheck, Trash2 } from 'lucide-react'
import {
  deleteAllNotifications,
  deleteNotification,
  markAllNotificationsRead,
  markNotificationRead,
  useDb,
} from '../../lib/db'
import { userNotifications } from '../../lib/selectors'
import { formatDateTime } from '../../lib/format'
import { Button } from '../../components/ui/form'
import { ConfirmDialog } from '../../components/ui/overlay'
import { EmptyState } from '../../components/ui/feedback'
import { useToast } from '../../hooks/useToast'

const ICONES = {
  interaction: Info,
  compte: ShieldCheck,
  moderation: CircleAlert,
}

/** Notifications internes (§16) : consultation, marquage, suppression.
 *  Conservées 1 an maximum ; aucune notification e-mail systématique. */
export function NotificationsPage() {
  useDb()
  const { toast } = useToast()
  const user = useCurrentUser()
  const notifications = user ? userNotifications(user.id) : []
  const nonLues = notifications.filter((n) => !n.lue).length

  if (!user) return null

  return (
    <section aria-labelledby="titre-notifications">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 id="titre-notifications" className="text-xl text-forest">
            Mes notifications
          </h2>
          <p className="mt-1 text-[0.9375rem] text-mist">
            Les notifications sont internes au site : aucun courriel systématique n'est envoyé.
            Elles sont conservées pendant 1 an maximum.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondaire"
            size="petit"
            disabled={nonLues === 0}
            onClick={() => {
              markAllNotificationsRead(user.id)
              toast('Toutes vos notifications sont marquées comme lues.')
            }}
          >
            Tout marquer comme lu
          </Button>
          <ButtonSupprimerTout userId={user.id} />
        </div>
      </div>

      <p className="mt-4 font-bold" role="status">
        {nonLues > 0
          ? `${nonLues} notification${nonLues > 1 ? 's' : ''} non lue${nonLues > 1 ? 's' : ''}`
          : 'Aucune notification non lue'}
      </p>

      {notifications.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={BellOff}
            title="Aucune notification"
            description="Vous recevrez ici les réponses à vos commentaires et les informations importantes concernant votre compte."
          />
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {notifications.map((n) => {
            const Icone = ICONES[n.type as keyof typeof ICONES] ?? Info
            return (
              <li
                key={n.id}
                className={`rounded-2xl border bg-white p-5 ${
                  n.lue ? 'border-line' : 'border-ocre'
                }`}
                aria-label={n.lue ? 'Notification lue' : 'Notification non lue'}
              >
                <div className="flex items-start gap-4">
                  <Icone
                    aria-hidden="true"
                    className={`mt-1 h-6 w-6 shrink-0 ${n.type === 'moderation' ? 'text-brique' : 'text-forest'}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">
                      {n.titre}
                      {!n.lue ? (
                        <span className="ml-2 rounded-full bg-ocre px-2 py-0.5 text-[0.75rem] font-bold text-white">
                          Nouvelle
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-[1.0625rem]">{n.texte}</p>
                    <p className="mt-1 text-[0.875rem] text-mist">
                      <time dateTime={n.at}>{formatDateTime(n.at)}</time>
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {n.link ? (
                        <Link
                          to={n.link}
                          onClick={() => markNotificationRead(n.id)}
                          className="inline-flex min-h-[44px] items-center rounded-lg font-bold text-forest underline decoration-2 underline-offset-4 hover:bg-leaf-pale"
                        >
                          Voir le contenu concerné
                          <span className="sr-only"> : {n.titre}</span>
                        </Link>
                      ) : null}
                      {!n.lue ? (
                        <button
                          type="button"
                          onClick={() => markNotificationRead(n.id)}
                          className="inline-flex min-h-[44px] items-center rounded-lg px-3 font-bold text-forest underline decoration-2 underline-offset-4 hover:bg-leaf-pale"
                        >
                          Marquer comme lue
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          deleteNotification(n.id)
                          toast('Notification supprimée.', 'info')
                        }}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-3 font-bold text-brique underline decoration-2 underline-offset-4 hover:bg-brique-pale"
                      >
                        <Trash2 aria-hidden="true" className="h-4 w-4" />
                        Supprimer
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function ButtonSupprimerTout({ userId }: { userId: string }) {
  const { toast } = useToast()
  const [confirme, setConfirme] = useState(false)
  return (
    <>
      <Button variant="danger" size="petit" onClick={() => setConfirme(true)}>
        <Trash2 aria-hidden="true" className="h-4 w-4" />
        Supprimer toutes mes notifications
      </Button>
      <ConfirmDialog
        open={confirme}
        onClose={() => setConfirme(false)}
        onConfirm={() => {
          deleteAllNotifications(userId)
          setConfirme(false)
          toast('Toutes vos notifications ont été supprimées.', 'info')
        }}
        title="Supprimer toutes vos notifications ?"
        confirmLabel="Tout supprimer"
      >
        <p>
          L'ensemble de vos notifications sera supprimé de votre compte. Cette action est
          irréversible : pensez à consulter les liens importants avant de confirmer.
        </p>
      </ConfirmDialog>
    </>
  )
}
