import { ApiError, authErrorMessage, protectedRequest } from '../../lib/auth'
import { useOutletContext } from 'react-router-dom'
import type { AdminMessagesContext } from '../../components/layout/AdminLayout'
import { useMemo, useState } from 'react'
import { CheckCheck, Mail, MailOpen, Reply, Trash2 } from 'lucide-react'
import type { ContactMessage } from '../../types'
import { formatDateTime } from '../../lib/format'
import { AdminPageHead } from '../../components/layout/AdminLayout'
import { Avatar } from '../../components/ui/misc'
import { Alert, Badge, EmptyState } from '../../components/ui/feedback'
import { Button, Field, Textarea } from '../../components/ui/form'
import { ConfirmDialog, Modal } from '../../components/ui/overlay'
import { useToast } from '../../hooks/useToast'

/** Messages reçus via le formulaire de contact (§35) : consultation,
 *  statut lu/non lu, réponse par courriel, suppression */
export function MessagesAdmin() {
  const { data, error, refresh } = useOutletContext<AdminMessagesContext>()
  const { toast } = useToast()
  const [envoiEnCours, setEnvoiEnCours] = useState(false)

  const [filtre, setFiltre] = useState<'tous' | 'non-lus' | 'lus'>('tous')
  const [ouvert, setOuvert] = useState<ContactMessage | null>(null)
  const [reponse, setReponse] = useState('')
  const [erreurReponse, setErreurReponse] = useState('')
  const [aSupprimer, setASupprimer] = useState<ContactMessage | null>(null)

  const messages = useMemo(() => {
    let list = [...(data ?? [])].sort((a, b) => b.at.localeCompare(a.at))
    if (filtre === 'non-lus') list = list.filter((m) => !m.lu)
    if (filtre === 'lus') list = list.filter((m) => m.lu)
    return list
  }, [data, filtre])

  const nonLus = data?.filter((m) => !m.lu).length ?? 0
  const markMessage = async (id: string, lu: boolean) => {
    try { await protectedRequest(`/admin/contact/${id}/read`, 'PATCH', { lu }); await refresh() }
    catch (error) { toast(authErrorMessage(error), 'erreur') }
  }

  return (
    <>
      <AdminPageHead
        titre="Messages de contact"
        description="Les messages envoyés depuis le formulaire de contact sont enregistrés ici. Une réponse est transmise par courriel au demandeur."
      >
        <Button
          variant="secondaire"
          disabled={nonLus === 0}
          onClick={async () => {
            try { await protectedRequest('/admin/contact/read', 'PATCH'); await refresh() }
            catch (error) { toast(authErrorMessage(error), 'erreur'); return }
            toast('Tous les messages sont marqués comme lus.')
          }}
        >
          <CheckCheck aria-hidden="true" className="h-5 w-5" />
          Tout marquer comme lu
        </Button>
      </AdminPageHead>

      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        <div role="tablist" aria-label="Filtrer les messages" className="flex flex-wrap gap-2">
          {(
            [
              { id: 'tous', label: 'Tous' },
              { id: 'non-lus', label: `Non lus (${nonLus})` },
              { id: 'lus', label: 'Lus' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={filtre === t.id}
              onClick={() => setFiltre(t.id)}
              className={`inline-flex min-h-[48px] items-center rounded-xl px-5 font-bold ${
                filtre === t.id ? 'bg-forest text-white' : 'border border-line bg-white text-forest hover:bg-leaf-pale'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error ? <Alert kind="erreur" title="Messages indisponibles">{error}</Alert> : !data ? <p role="status">Chargement…</p> : messages.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon={filtre === 'non-lus' ? MailOpen : Mail}
              title="Aucun message"
              description={
                filtre === 'non-lus'
                  ? 'Aucun message en attente de lecture : tout est traité.'
                  : 'Aucun message reçu pour le moment.'
              }
            />
          </div>
        ) : (
          <ul className="mt-6 flex flex-col gap-4">
            {messages.map((m) => (
              <li
                key={m.id}
                className={`rounded-2xl border bg-white p-5 ${
                  m.lu ? 'border-line' : 'border-ocre'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  {!m.lu ? <Badge variant="ocre">Non lu</Badge> : <Badge variant="gris">Lu</Badge>}
                  {m.repliedAt ? <Badge variant="vert">Répondu</Badge> : null}
                  <span className="text-[0.9375rem] text-mist">
                    Reçu le <time dateTime={m.at}>{formatDateTime(m.at)}</time>
                  </span>
                </div>
                <h2 className="mt-2 text-lg font-bold">{m.sujet}</h2>
                <p className="text-[0.9375rem] text-mist">
                  {m.prenom} {m.nom} — <span className="break-all">{m.email}</span>
                </p>
                <p className="mt-2 line-clamp-2 text-[1.0625rem]">{m.message}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="petit"
                    variant={m.lu ? 'secondaire' : 'primaire'}
                    onClick={() => {
                      setOuvert(m)
                      setReponse('')
                      setErreurReponse('')
                      if (!m.lu) markMessage(m.id, true)
                    }}
                  >
                    <MailOpen aria-hidden="true" className="h-4 w-4" />
                    Lire et répondre
                  </Button>
                  {!m.lu ? (
                    <Button
                      size="petit"
                      variant="fantome"
                      onClick={() => markMessage(m.id, true)}
                    >
                      Marquer comme lu
                    </Button>
                  ) : (
                    <Button
                      size="petit"
                      variant="fantome"
                      onClick={() => markMessage(m.id, false)}
                    >
                      Marquer comme non lu
                    </Button>
                  )}
                  <Button size="petit" variant="danger" onClick={() => setASupprimer(m)}>
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                    Supprimer
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Lecture + réponse (modale accessible) */}
      <Modal
        open={!!ouvert}
        onClose={() => setOuvert(null)}
        title={ouvert ? `Message de ${ouvert.prenom} ${ouvert.nom}` : ''}
        size="large"
        footer={
          <>
            <Button variant="blanc" onClick={() => setOuvert(null)}>
              Fermer
            </Button>
            <Button
              disabled={envoiEnCours}
              onClick={async () => {
                if (!ouvert || envoiEnCours) return
                if (!reponse.trim()) {
                  setErreurReponse('Veuillez écrire la réponse avant de l\'envoyer.')
                  return
                }
                setEnvoiEnCours(true)
                try {
                  await protectedRequest(`/admin/contact/${ouvert.id}/reply`, 'POST', { message: reponse })
                  await refresh()
                } catch (error) {
                  setErreurReponse(error instanceof ApiError && error.status === 503
                    ? 'Envoi indisponible. Vérifiez la configuration SMTP.' : authErrorMessage(error))
                  return
                } finally { setEnvoiEnCours(false) }
                toast('Réponse envoyée par courriel.')
                setOuvert(null)
              }}
            >
              <Reply aria-hidden="true" className="h-5 w-5" />
              Envoyer la réponse
            </Button>
          </>
        }
      >
        {ouvert ? (
          <div className="flex flex-col gap-4">
            <p className="text-[0.9375rem] text-mist">
              Sujet : <strong>{ouvert.sujet}</strong> — reçu le {formatDateTime(ouvert.at)} —{' '}
              <span className="break-all">{ouvert.email}</span>
            </p>
            <blockquote className="rounded-xl border-l-2 border-leaf bg-sand p-4">
              {ouvert.message}
            </blockquote>
            {ouvert.repliedAt ? (
              <p>
                <Badge variant="vert">
                  Réponse déjà envoyée le {formatDateTime(ouvert.repliedAt)}
                </Badge>
              </p>
            ) : null}
            <Field
              label="Votre réponse (destinée au demandeur)"
              htmlFor="reponse-message"
              required
              error={erreurReponse}
            >
              <Textarea
                id="reponse-message"
                value={reponse}
                onChange={(e) => {
                  setReponse(e.target.value)
                  setErreurReponse('')
                }}
                rows={5}
                invalid={!!erreurReponse}
                describedBy={erreurReponse ? 'reponse-message-err' : undefined}
              />
            </Field>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={!!aSupprimer}
        onClose={() => setASupprimer(null)}
        onConfirm={async () => {
          if (aSupprimer) {
            try { await protectedRequest(`/admin/contact/${aSupprimer.id}`, 'DELETE'); await refresh() }
            catch (error) { toast(authErrorMessage(error), 'erreur'); return }
            toast('Message supprimé.', 'info')
          }
          setASupprimer(null)
        }}
        title="Supprimer ce message ?"
        confirmLabel="Supprimer le message"
      >
        <p>
          Le message « {aSupprimer?.sujet} » de {aSupprimer?.prenom} {aSupprimer?.nom} sera
          supprimé de la base de données. Cette action est définitive.
        </p>
      </ConfirmDialog>
    </>
  )
}
