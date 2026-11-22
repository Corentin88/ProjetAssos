import { useCurrentUser } from '../../lib/auth'
import { useMemo, useState } from 'react'
import { ScrollText, Trash2 } from 'lucide-react'
import type { LogActionType } from '../../types'
import { db, deleteLogEntry, fullName, useDb, useDbVersion } from '../../lib/db'
import { formatDateTime } from '../../lib/format'
import { AdminPageHead } from '../../components/layout/AdminLayout'
import { Badge, EmptyState } from '../../components/ui/feedback'
import { Button, Field, Input, Select } from '../../components/ui/form'
import { ConfirmDialog } from '../../components/ui/overlay'
import { useToast } from '../../hooks/useToast'

const TYPES: { id: LogActionType | ''; label: string }[] = [
  { id: '', label: 'Tous les types' },
  { id: 'compte', label: 'Comptes' },
  { id: 'article', label: 'Articles' },
  { id: 'categorie', label: 'Catégories' },
  { id: 'tag', label: 'Tags' },
  { id: 'commentaire', label: 'Commentaires' },
  { id: 'media', label: 'Médias' },
  { id: 'association', label: "Page « L'association »" },
  { id: 'message', label: 'Messages de contact' },
  { id: 'journal', label: 'Journal' },
]

const VARIANTS: Record<LogActionType, 'vert' | 'ocre' | 'gris' | 'rouge' | 'bleu-vert'> = {
  compte: 'vert',
  article: 'bleu-vert',
  categorie: 'gris',
  tag: 'gris',
  commentaire: 'ocre',
  media: 'gris',
  association: 'gris',
  message: 'gris',
  journal: 'rouge',
}

/** Journal d'activité administrateur (§41) : conservation indéfinie,
 *  filtres, suppression manuelle (elle-même inscrite au journal) */
export function JournalAdmin() {
  useDb()
  const version = useDbVersion()
  const { toast } = useToast()
  const admin = useCurrentUser()
  const adminId = admin?.id ?? 'u1'

  const [filtreAdmin, setFiltreAdmin] = useState('')
  const [filtreType, setFiltreType] = useState<LogActionType | ''>('')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [cible, setCible] = useState('')
  const [aSupprimer, setASupprimer] = useState<string | null>(null)

  const entrees = useMemo(() => {
    let list = [...db.logs]
    if (filtreAdmin) list = list.filter((l) => l.adminId === filtreAdmin)
    if (filtreType) list = list.filter((l) => l.type === filtreType)
    if (dateDebut) list = list.filter((l) => l.at >= new Date(dateDebut).toISOString())
    if (dateFin)
      list = list.filter((l) => l.at <= new Date(`${dateFin}T23:59:59`).toISOString())
    const q = cible.trim().toLowerCase()
    if (q) list = list.filter((l) => l.cible.toLowerCase().includes(q) || l.action.toLowerCase().includes(q))
    return list
  }, [version, filtreAdmin, filtreType, dateDebut, dateFin, cible])

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
              value={filtreAdmin}
              onChange={(e) => setFiltreAdmin(e.target.value)}
              className="min-h-[48px] w-full rounded-xl border border-line bg-white px-4 text-[1.0625rem]"
            >
              <option value="">Tous</option>
              {[...new Set(db.logs.map((l) => l.adminId))].map((aid) => {
                const u = db.users.find((x) => x.id === aid)
                return (
                  <option key={aid} value={aid}>
                    {u ? fullName(u) : 'Administrateur inconnu'}
                  </option>
                )
              })}
            </select>
          </Field>
          <Field label="Type d'action" htmlFor="j-type">
            <select
              id="j-type"
              value={filtreType}
              onChange={(e) => setFiltreType(e.target.value as LogActionType | '')}
              className="min-h-[48px] w-full rounded-xl border border-line bg-white px-4 text-[1.0625rem]"
            >
              {TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Période : du" htmlFor="j-debut">
            <Input id="j-debut" type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
          </Field>
          <Field label="au" htmlFor="j-fin">
            <Input id="j-fin" type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} />
          </Field>
          <Field label="Élément concerné" htmlFor="j-cible">
            <Input id="j-cible" type="search" value={cible} onChange={(e) => setCible(e.target.value)} placeholder="Titre, compte, fichier…" />
          </Field>
        </form>

        <p className="mt-4 text-mist" role="status">
          <ScrollText aria-hidden="true" className="mr-1 inline h-5 w-5" />
          {entrees.length} entrée{entrees.length > 1 ? 's' : ''} affichée{entrees.length > 1 ? 's' : ''} sur {db.logs.length}
        </p>

        {entrees.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon={ScrollText}
              title="Aucune entrée trouvée"
              description="Aucune entrée du journal ne correspond aux filtres actuels."
            />
          </div>
        ) : (
          <ol className="mt-6 flex flex-col gap-3">
            {entrees.map((l) => {
              const u = db.users.find((x) => x.id === l.adminId)
              return (
                <li key={l.id} className="rounded-2xl border border-line bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={VARIANTS[l.type]}>{TYPES.find((t) => t.id === l.type)?.label ?? l.type}</Badge>
                      <span className="font-bold">{l.action}</span>
                    </div>
                    <span className="text-[0.875rem] text-mist">
                      <time dateTime={l.at}>{formatDateTime(l.at)}</time>
                    </span>
                  </div>
                  <p className="mt-1 text-[1.0625rem]">
                    Élément : <strong>{l.cible}</strong>
                  </p>
                  <p className="text-[0.9375rem] text-mist">
                    Par {u ? fullName(u) : 'un administrateur'}
                    {l.details ? ` — ${l.details}` : ''}
                  </p>
                  <div className="mt-2">
                    <Button size="petit" variant="danger" onClick={() => setASupprimer(l.id)}>
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                      Supprimer cette entrée
                    </Button>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>

      <ConfirmDialog
        open={!!aSupprimer}
        onClose={() => setASupprimer(null)}
        onConfirm={() => {
          if (aSupprimer) {
            const entree = db.logs.find((l) => l.id === aSupprimer)
            deleteLogEntry(aSupprimer, adminId)
            toast(
              `Entrée supprimée (${entree?.action ?? ''}). La suppression manuelle est elle-même inscrite dans le journal.`,
              'info',
            )
          }
          setASupprimer(null)
        }}
        title="Supprimer cette entrée du journal ?"
        confirmLabel="Supprimer l'entrée"
      >
        <p>
          L'entrée sera retirée du journal. Conformément au cahier des charges, cette suppression
          manuelle sera elle-même enregistrée dans le journal d'activité.
        </p>
      </ConfirmDialog>
    </>
  )
}
