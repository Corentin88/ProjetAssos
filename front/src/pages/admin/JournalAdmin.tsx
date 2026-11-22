import { useDeferredValue, useState } from 'react'
import { protectedRequest } from '../../lib/auth'
import { actionLabels, targetLabels, journalActor, journalTarget, adminError } from '../../lib/admin'
import type { JournalEntry, JournalResult } from '../../lib/admin'
import { useResource } from '../../lib/community'
import { ScrollText, Trash2 } from 'lucide-react'
import { formatDateTime } from '../../lib/format'
import { AdminPageHead } from '../../components/layout/AdminLayout'
import { Alert, Badge, EmptyState } from '../../components/ui/feedback'
import { Button, Field, Input, Select } from '../../components/ui/form'
import { ConfirmDialog } from '../../components/ui/overlay'
import { useToast } from '../../hooks/useToast'

const VARIANTS = {
  ACCOUNT: 'vert', ARTICLE: 'bleu-vert', CATEGORY: 'gris', TAG: 'gris', COMMENT: 'ocre',
  MEDIA: 'gris', ASSOCIATION: 'gris', CONTACT_MESSAGE: 'gris', ACTIVITY_LOG: 'rouge',
} as const

function borneLocale(value: string, lendemain = false) {
  const date = new Date(`${value}T00:00:00`)
  if (lendemain) date.setDate(date.getDate() + 1)
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined
}

/** Journal d'activité administrateur (§41) : conservation indéfinie,
 *  filtres, suppression manuelle (elle-même inscrite au journal) */
export function JournalAdmin() {
  const { toast } = useToast()
  const [filtres, setFiltres] = useState({ actor: '', action: '', target: '', from: '', before: '', element: '', page: 1 })
  const element = useDeferredValue(filtres.element)
  const [aSupprimer, setASupprimer] = useState<JournalEntry | null>(null)
  const [suppressionEnCours, setSuppressionEnCours] = useState(false)
  const [erreurSuppression, setErreurSuppression] = useState('')
  const from = filtres.from ? borneLocale(filtres.from) : undefined
  const before = filtres.before ? borneLocale(filtres.before, true) : undefined
  const datesInvalides = Boolean((filtres.from && !from) || (filtres.before && !before) || (from && before && from >= before))
  const params = new URLSearchParams({ page: String(filtres.page) })
  for (const field of ['actor', 'action', 'target'] as const) {
    if (filtres[field]) params.set(field, filtres[field])
  }
  if (element.trim()) params.set('element', element.trim())
  if (from) params.set('from', from)
  if (before) params.set('before', before)
  const { data, error, refresh } = useResource<JournalResult>(datesInvalides ? undefined : `/admin/journal?${params}`, true)
  const changerFiltre = (key: Exclude<keyof typeof filtres, 'page'>, value: string) => {
    setFiltres(previous => ({ ...previous, [key]: value, page: 1 }))
  }
  const supprimer = async () => {
    if (!aSupprimer || suppressionEnCours) return
    setSuppressionEnCours(true)
    setErreurSuppression('')
    try {
      await protectedRequest(`/admin/journal/${aSupprimer.id}`, 'DELETE', { confirmed: true })
      setASupprimer(null)
      if (filtres.page > 1 && data?.entries.length === 1) {
        setFiltres(previous => ({ ...previous, page: previous.page - 1 }))
      } else {
        await refresh()
      }
      toast('Entrée supprimée. La suppression est inscrite au journal.', 'info')
    } catch (error) { setErreurSuppression(adminError(error)) }
    finally { setSuppressionEnCours(false) }
  }

  return (
    <>
      <AdminPageHead
        titre="Journal d'activité"
        description="Toutes les actions administratives importantes. Les entrées sont conservées indéfiniment, sauf suppression manuelle — une suppression manuelle est elle-même enregistrée dans le journal."
      />
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        <form className="grid gap-4 rounded-2xl border border-line bg-white p-5 md:grid-cols-2 xl:grid-cols-5" onSubmit={(e) => e.preventDefault()}>
          <Field label="Administrateur" htmlFor="j-admin">
            <select
              id="j-admin"
              value={filtres.actor}
              onChange={(e) => changerFiltre('actor', e.target.value)}
              className="min-h-[48px] w-full rounded-xl border border-line bg-white px-4 text-[1.0625rem]"
            >
              <option value="">Tous</option>
              <option value="none">Action automatique ou compte supprimé</option>
              {filtres.actor && filtres.actor !== 'none' && !data?.actors.some(actor => actor.id === filtres.actor) &&
                <option value={filtres.actor}>Compte sélectionné</option>}
              {data?.actors.map(actor => <option key={actor.id} value={actor.id}>{actor.label}</option>)}
            </select>
          </Field>
          <Field label="Type d'action" htmlFor="j-type">
            <select
              id="j-type"
              value={filtres.action}
              onChange={(e) => changerFiltre('action', e.target.value)}
              className="min-h-[48px] w-full rounded-xl border border-line bg-white px-4 text-[1.0625rem]"
            >
              <option value="">Toutes les actions</option>
              {Object.entries(actionLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </Field>
          <Field label="Période : du" htmlFor="j-debut">
            <Input id="j-debut" type="date" value={filtres.from} onChange={(e) => changerFiltre('from', e.target.value)} />
          </Field>
          <Field label="au" htmlFor="j-fin">
            <Input id="j-fin" type="date" value={filtres.before} onChange={(e) => changerFiltre('before', e.target.value)} />
          </Field>
          <Field label="Élément concerné" htmlFor="j-cible">
            <Input id="j-cible" type="search" maxLength={255} value={filtres.element} onChange={(e) => changerFiltre('element', e.target.value)} placeholder="Titre, nom, fichier ou identifiant" />
          </Field>
          <Field label="Type d’élément" htmlFor="j-target">
            <Select id="j-target" value={filtres.target} onChange={(e) => changerFiltre('target', e.target.value)}>
              <option value="">Tous les éléments</option>
              {Object.entries(targetLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </Select>
          </Field>
        </form>

        <p className="mt-4 text-mist" role="status">
          <ScrollText aria-hidden="true" className="mr-1 inline h-5 w-5" />
          {data && `Page ${filtres.page} · ${data.entries.length} entrée${data.entries.length > 1 ? 's' : ''}`}
        </p>

        {datesInvalides ? <Alert kind="erreur" title="Période invalide">La date de début doit précéder ou égaler la date de fin.</Alert>
          : error ? <Alert kind="erreur" title="Journal indisponible">{error}</Alert>
          : !data ? <p role="status">Chargement du journal…</p>
          : data.entries.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon={ScrollText}
              title="Aucune entrée trouvée"
              description="Aucune entrée du journal ne correspond aux filtres actuels."
            />
          </div>
        ) : (
          <ol className="mt-6 flex flex-col gap-3">
            {data.entries.map((l) => (
                <li key={l.id} className="rounded-2xl border border-line bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={VARIANTS[l.target]}>{targetLabels[l.target]}</Badge>
                      <span className="font-bold">{actionLabels[l.action]}</span>
                    </div>
                    <span className="text-[0.875rem] text-mist">
                      <time dateTime={l.at}>{formatDateTime(l.at)}</time>
                    </span>
                  </div>
                  <p className="mt-1 text-[1.0625rem]">
                    Élément : <strong>{journalTarget(l)}</strong>
                  </p>
                  <p className="text-[0.9375rem] text-mist">
                    {journalActor(l)} — {l.description}
                  </p>
                  <div className="mt-2">
                    <Button size="petit" variant="danger" onClick={() => { setErreurSuppression(''); setASupprimer(l) }}>
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                      Supprimer cette entrée
                    </Button>
                  </div>
                </li>
            ))}
          </ol>
        )}
        {(filtres.page > 1 || data?.hasNext) && <nav className="mt-6 flex gap-3" aria-label="Pages du journal">
          <Button variant="secondaire" disabled={filtres.page === 1} onClick={() => setFiltres(previous => ({ ...previous, page: previous.page - 1 }))}>Précédente</Button>
          <Button variant="secondaire" disabled={!data?.hasNext} onClick={() => setFiltres(previous => ({ ...previous, page: previous.page + 1 }))}>Suivante</Button>
        </nav>}
      </div>

      <ConfirmDialog
        open={!!aSupprimer}
        onClose={() => setASupprimer(null)}
        onConfirm={supprimer}
        title="Supprimer cette entrée du journal ?"
        confirmLabel="Supprimer l'entrée"
      >
        <p>
          L'entrée sera retirée du journal. Conformément au cahier des charges, cette suppression
          manuelle sera elle-même enregistrée dans le journal d'activité.
        </p>
        {erreurSuppression && <p role="alert" className="mt-3 text-brique">{erreurSuppression}</p>}
      </ConfirmDialog>
    </>
  )
}
