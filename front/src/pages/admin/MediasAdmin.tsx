import { ContentImage } from '../../components/content/ContentImage'
import { useEffect, useMemo, useState } from 'react'
import { Images, Import, Pencil, Search, Trash2 } from 'lucide-react'
import type { GpxMedia, Media } from '../../types'
import { useResource } from '../../lib/community'
import { db, useDbVersion } from '../../lib/db'
import { removeMedia, replaceMedia, saveMediaMetadata, uploadMedia, useContentAction } from '../../lib/content'
import { formatDate, formatTaille } from '../../lib/format'
import { mediaUrl } from '../../lib/assets'
import { AdminPageHead } from '../../components/layout/AdminLayout'
import { Alert, Badge, EmptyState } from '../../components/ui/feedback'
import { Button, Field, Input, Textarea } from '../../components/ui/form'
import { ConfirmDialog, Modal } from '../../components/ui/overlay'
import { useToast } from '../../hooks/useToast'

const FORMATS_ACCEPTES = "JPG, JPEG, PNG, WebP (le SVG n'est pas prévu pour la V1)"

const mediaUsage = (id: string) => db.medias.find(media => media.id === id)?.usage
  ?? { articles: [], avatars: 0, association: false }

function totalUsages(id: string) {
  const usage = mediaUsage(id)
  return usage.articles.length + usage.avatars + (usage.association ? 1 : 0)
}

/** Médiathèque (§36) : import, recherche, remplacement, suppression avec
 *  vérification d'usage, métadonnées et texte alternatif */
export function MediasAdmin() {
  const version = useDbVersion()
  const { toast } = useToast()
  const effectuer = useContentAction()

  const [recherche, setRecherche] = useState('')
  const [importOuvert, setImportOuvert] = useState(false)
  const [aEditer, setAEditer] = useState<Media | null>(null)
  const [edition, setEdition] = useState({ nom: '', alt: '' })
  const [aRemplacer, setARemplacer] = useState<Media | null>(null)
  const [fichierRemplacement, setFichierRemplacement] = useState<File | null>(null)
  const [aSupprimer, setASupprimer] = useState<Media | null>(null)

  const medias = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    return db.medias.filter(
      (m) =>
        !q ||
        m.nom.toLowerCase().includes(q) ||
        m.alt.toLowerCase().includes(q),
    )
  }, [version, recherche])

  const usage = aSupprimer ? mediaUsage(aSupprimer.id) : null
  const utilise = aSupprimer ? totalUsages(aSupprimer.id) > 0 : false

  return (
    <>
      <AdminPageHead
        titre="Médiathèque"
        description="Espace commun d'images réutilisables : articles et page de l'association. La suppression d'une image encore utilisée est bloquée afin de ne pas casser un contenu existant."
      >
        <Button onClick={() => setImportOuvert(true)}>
          <Import aria-hidden="true" className="h-5 w-5" />
          Importer une image
        </Button>
      </AdminPageHead>

      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        <form className="rounded-2xl border border-line bg-white p-5" onSubmit={(e) => e.preventDefault()}>
          <Field label="Rechercher une image (nom ou texte alternatif)" htmlFor="media-recherche">
            <div className="relative">
              <Input
                id="media-recherche"
                type="search"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Exemple : village, fête, marché…"
              />
              <Search aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-mist" />
            </div>
          </Field>
        </form>

        <p className="mt-4 text-mist" role="status">
          {medias.length} image{medias.length > 1 ? 's' : ''} sur {db.medias.length} — formats
          prévus pour la V1 : {FORMATS_ACCEPTES}
        </p>

        {medias.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon={Images}
              title="Aucune image trouvée"
              description="Aucun média ne correspond à cette recherche."
              action={
                <Button onClick={() => setImportOuvert(true)}>Importer une image</Button>
              }
            />
          </div>
        ) : (
          <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {medias.map((m) => {
              const u = mediaUsage(m.id)
              const nbUsages = u.articles.length + u.avatars + (u.association ? 1 : 0)
              return (
                <li key={m.id} className="overflow-hidden rounded-2xl border border-line bg-white">
                  <ContentImage
                    src={mediaUrl(m.file)}
                    alt={m.alt}
                    className="h-44 w-full object-cover"
                    loading="lazy"
                  />
                  <div className="p-4">
                    <p className="truncate font-bold">{m.nom}</p>
                    <p className="mt-1 text-[0.875rem] text-mist">
                      {m.format} — {formatTaille(m.tailleKo)} — {m.largeur}×{m.hauteur} px
                    </p>
                    <p className="mt-1 text-[0.875rem] text-mist">
                      Importée le {formatDate(m.createdAt)}
                    </p>
                    <p className="mt-2 line-clamp-2 text-[0.9375rem]" title={m.alt}>
                      <Badge variant={nbUsages > 0 ? 'vert' : 'gris'} className="mr-2">
                        {nbUsages} usage{nbUsages > 1 ? 's' : ''}
                      </Badge>
                      {m.alt}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="petit"
                        variant="secondaire"
                        onClick={() => {
                          setAEditer(m)
                          setEdition({ nom: m.nom, alt: m.alt })
                        }}
                      >
                        <Pencil aria-hidden="true" className="h-4 w-4" />
                        Modifier
                      </Button>
                      <Button size="petit" variant="fantome" onClick={() => {
                        setFichierRemplacement(null)
                        setARemplacer(m)
                      }}>
                        Remplacer le fichier
                      </Button>
                      <Button size="petit" variant="danger" onClick={() => setASupprimer(m)}>
                        <Trash2 aria-hidden="true" className="h-4 w-4" />
                        Supprimer
                      </Button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <GpxLibrary />

      <ImportMediaModal
        open={importOuvert}
        onClose={() => setImportOuvert(false)}
        onImport={(file, nom, alt) => effectuer(async () => {
          await uploadMedia(file, nom, alt)
          toast('Image importée dans la médiathèque.')
          setImportOuvert(false)
        })}
      />

      {/* Modification des métadonnées */}
      <Modal
        open={!!aEditer}
        onClose={() => setAEditer(null)}
        title="Modifier les métadonnées de l'image"
        footer={
          <>
            <Button variant="blanc" onClick={() => setAEditer(null)}>
              Annuler
            </Button>
            <Button
              onClick={() => effectuer(async () => {
                if (aEditer) {
                  await saveMediaMetadata(aEditer.id, edition.nom.trim() || aEditer.nom, edition.alt.trim())
                  toast('Métadonnées enregistrées : nom du fichier et texte alternatif mis à jour.')
                  setAEditer(null)
                }
              })}
            >
              Enregistrer
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Nom du fichier" htmlFor="med-nom" required>
            <Input id="med-nom" value={edition.nom} onChange={(e) => setEdition({ ...edition, nom: e.target.value })} />
          </Field>
          <Field
            label="Texte alternatif"
            htmlFor="med-alt"
            required
            hint="Décrit l'image pour les lecteurs d'écran. Obligatoire pour l'accessibilité (RGAA)."
          >
            <Textarea id="med-alt" value={edition.alt} onChange={(e) => setEdition({ ...edition, alt: e.target.value })} rows={3} />
          </Field>
        </div>
      </Modal>

      {/* Remplacement du fichier */}
      <ConfirmDialog
        open={!!aRemplacer}
        onClose={() => setARemplacer(null)}
        onConfirm={() => effectuer(async () => {
          if (aRemplacer && fichierRemplacement) {
            await replaceMedia(aRemplacer.id, fichierRemplacement)
            toast('Fichier remplacé : les contenus qui utilisent cette image affichent automatiquement la nouvelle version.')
            setARemplacer(null)
          } else if (aRemplacer) {
            toast('Choisissez le fichier de remplacement.', 'erreur')
          }
        })}
        title="Remplacer le fichier de cette image ?"
        confirmLabel="Remplacer le fichier"
        destructive={false}
      >
        <p>
          L'image « {aRemplacer?.nom} » est utilisée à{' '}
          <strong>
            {aRemplacer ? totalUsages(aRemplacer.id) : 0}{' '}
            endroit(s)
          </strong>
          . Le remplacement met à jour tous ces endroits automatiquement (l'identifiant de
          l'image est conservé).
        </p>
        <Field label="Fichier de remplacement" htmlFor="remplacement-image" hint="JPEG, PNG ou WebP. 8 Mio maximum.">
          <input id="remplacement-image" type="file" accept="image/jpeg,image/png,image/webp"
            onChange={event => setFichierRemplacement(event.target.files?.[0] ?? null)}
            className="mt-2 w-full rounded-xl border border-line bg-white p-3" />
        </Field>
      </ConfirmDialog>

      {/* Suppression avec vérification d'usage (§36) */}
      <ConfirmDialog
        open={!!aSupprimer}
        onClose={() => setASupprimer(null)}
        onConfirm={() => effectuer(async () => {
          if (aSupprimer && !utilise) {
            await removeMedia(aSupprimer.id)
            toast('Image supprimée de la médiathèque.', 'info')
          }
          setASupprimer(null)
        })}
        title="Supprimer cette image ?"
        confirmLabel="Supprimer l'image"
      >
        {utilise && usage ? (
          <p className="font-bold text-brique">
            Suppression impossible : cette image est encore utilisée ({usage.articles.length}{' '}
            article(s)
            {usage.association ? ', page « L\'association »' : ''}
            {usage.avatars ? `, ${usage.avatars} avatar(s)` : ''}), notamment «{' '}
            {usage.articles[0] ?? 'contenus existants'} ». Remplacez d'abord
            ces usages ou choisissez « Remplacer le fichier ».
          </p>
        ) : (
          <p>
            L'image « {aSupprimer?.nom} » n'est utilisée nulle part : elle sera supprimée
            définitivement de la médiathèque.
          </p>
        )}
      </ConfirmDialog>
    </>
  )
}

/** Fenêtre d'import : fichier réel (aperçu en session) ou visuel de démonstration */
function GpxLibrary() {
  const { data, error, refresh } = useResource<GpxMedia[]>('/admin/content/gpx', true)
  const effectuer = useContentAction()
  const { toast } = useToast()
  const [selected, setSelected] = useState<GpxMedia | null>(null)
  return (
    <section aria-labelledby="titre-mediatheque-gpx" className="mx-auto max-w-6xl px-4 pb-8 md:px-8">
      <h2 id="titre-mediatheque-gpx" className="text-xl text-forest">Fichiers GPX</h2>
      {error ? <Alert kind="erreur" title="Fichiers GPX indisponibles">{error}</Alert>
        : !data ? <p role="status">Chargement…</p>
        : !data.length ? <p className="mt-2 text-mist">Aucun fichier GPX. Importez un fichier depuis l’éditeur d’article.</p>
        : <ul className="mt-3 grid gap-2">{data.map(file => (
          <li key={file.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white p-3">
            <div><p className="font-bold [overflow-wrap:anywhere]">{file.nom}</p>
              <p className="text-sm text-mist">{formatTaille(file.tailleKo)} · {file.usages} parcours</p></div>
            <Button size="petit" variant="danger" disabled={file.usages > 0} onClick={() => setSelected(file)}>
              <Trash2 aria-hidden="true" className="h-4 w-4" /> Supprimer<span className="sr-only"> {file.nom}</span>
            </Button>
          </li>
        ))}</ul>}
      <ConfirmDialog open={Boolean(selected)} onClose={() => setSelected(null)} title="Supprimer ce fichier GPX ?"
        confirmLabel="Supprimer le fichier" onConfirm={() => effectuer(async () => {
          if (!selected) return
          await removeMedia(selected.id)
          await refresh()
          setSelected(null)
          toast('Fichier GPX supprimé.', 'info')
        })}>
        <p>Le fichier « {selected?.nom} » sera supprimé définitivement.</p>
      </ConfirmDialog>
    </section>
  )
}

function ImportMediaModal({
  open,
  onClose,
  onImport,
}: {
  open: boolean
  onClose: () => void
  onImport: (image: File, nom: string, alt: string) => Promise<void>
}) {
  const [fichier, setFichier] = useState<File | null>(null)
  const [nom, setNom] = useState('')
  const [alt, setAlt] = useState('')
  const [erreur, setErreur] = useState('')
  const [apercu, setApercu] = useState<string>()
  useEffect(() => {
    if (!fichier) { setApercu(undefined); return }
    const url = URL.createObjectURL(fichier)
    setApercu(url)
    return () => URL.revokeObjectURL(url)
  }, [fichier])
  useEffect(() => {
    if (open) return
    setFichier(null)
    setNom('')
    setAlt('')
    setErreur('')
  }, [open])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Importer une image"
      footer={
        <>
          <Button variant="blanc" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={() => {
              if (!fichier) {
                setErreur("Choisissez d'abord un fichier image.")
                return
              }
              if (!alt.trim()) {
                setErreur('Le texte alternatif est obligatoire pour l\'accessibilité.')
                return
              }
              setErreur('')
              void onImport(fichier, nom.trim() || fichier.name, alt.trim())
            }}
          >
            Importer
          </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {erreur ? (
            <p role="alert" className="rounded-lg bg-brique-pale px-3 py-2 font-bold text-brique">
              {erreur}
            </p>
          ) : null}
          <Field
            label="Fichier image"
            htmlFor="import-fichier"
            required
            hint={`Formats acceptés : ${FORMATS_ACCEPTES}. 8 Mio maximum.`}
          >
            <input
              id="import-fichier"
              type="file"
              accept="image/jpeg, image/png, image/webp"
              onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
              className="w-full rounded-xl border border-line bg-white p-3 text-[1rem]"
            />
          </Field>
          {fichier && apercu ? (
            <img
              src={apercu}
              alt={`Aperçu du fichier choisi : ${fichier.name}`}
              className="h-40 w-full rounded-xl border border-line object-cover"
            />
          ) : null}
          <Field label="Nom affiché" htmlFor="import-nom" hint="Par défaut, le nom du fichier.">
            <Input id="import-nom" value={nom} onChange={(e) => setNom(e.target.value)} placeholder={fichier?.name ?? 'nom-de-l-image.jpg'} />
          </Field>
          <Field label="Texte alternatif (obligatoire)" htmlFor="import-alt" required>
            <Textarea id="import-alt" value={alt} onChange={(e) => setAlt(e.target.value)} rows={2} />
          </Field>
        </div>
      </Modal>
  )
}
