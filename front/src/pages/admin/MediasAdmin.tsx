import { useCurrentUser } from '../../lib/auth'
import { useMemo, useState } from 'react'
import { Images, Import, Pencil, Search, Trash2 } from 'lucide-react'
import type { Media } from '../../types'
import {
  addMedia,
  db,
  deleteMedia,
  isMediaUsed,
  logAction,
  mediaUsage,
  replaceMediaFile,
  updateMedia,
  useDb,
  useDbVersion,
} from '../../lib/db'
import { formatDate, formatTaille } from '../../lib/format'
import { mediaUrl } from '../../lib/assets'
import { AdminPageHead } from '../../components/layout/AdminLayout'
import { Badge, EmptyState } from '../../components/ui/feedback'
import { Button, Field, Input, Textarea } from '../../components/ui/form'
import { ConfirmDialog, Modal } from '../../components/ui/overlay'
import { useToast } from '../../hooks/useToast'

const FORMATS_ACCEPTES = "JPG, JPEG, PNG, WebP (le SVG n'est pas prévu pour la V1)"

// Pool d'images de démonstration utilisées par l'import simulé
const FICHIERS_DEMO = [
  'village-arches.jpg',
  'fete-village.jpg',
  'marche-producteurs.jpg',
  'atelier-memoire.jpg',
  'bibliotheque.jpg',
  'repas-assoc.jpg',
  'theatre.jpg',
]

/** Médiathèque (§36) : import, recherche, remplacement, suppression avec
 *  vérification d'usage, métadonnées et texte alternatif */
export function MediasAdmin() {
  useDb()
  const version = useDbVersion()
  const { toast } = useToast()
  const admin = useCurrentUser()
  const adminId = admin?.id ?? 'u1'

  const [recherche, setRecherche] = useState('')
  const [importOuvert, setImportOuvert] = useState(false)
  const [aEditer, setAEditer] = useState<Media | null>(null)
  const [edition, setEdition] = useState({ nom: '', alt: '' })
  const [aRemplacer, setARemplacer] = useState<Media | null>(null)
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
  const utilise = aSupprimer ? isMediaUsed(aSupprimer.id) : false

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
                  <img
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
                      <Button size="petit" variant="fantome" onClick={() => setARemplacer(m)}>
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

      {/* Import (maquette : choix d'un fichier local ou d'un visuel de démonstration) */}
      <ImportMediaModal
        open={importOuvert}
        onClose={() => setImportOuvert(false)}
        onImport={(nom, tailleKo, format, alt, file) => {
          addMedia({ file, nom, tailleKo, format, alt, largeur: 1600, hauteur: 1067 })
          logAction(adminId, 'media', 'Import d\'un média', nom)
          toast('Image importée dans la médiathèque.')
          setImportOuvert(false)
        }}
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
              onClick={() => {
                if (aEditer) {
                  updateMedia(aEditer.id, { nom: edition.nom.trim() || aEditer.nom, alt: edition.alt.trim() })
                  logAction(adminId, 'media', 'Modification des métadonnées d\'un média', edition.nom.trim() || aEditer.nom)
                  toast('Métadonnées enregistrées : nom du fichier et texte alternatif mis à jour.')
                  setAEditer(null)
                }
              }}
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
        onConfirm={() => {
          if (aRemplacer) {
            const demo = FICHIERS_DEMO[Math.floor(Math.random() * FICHIERS_DEMO.length)]
            replaceMediaFile(aRemplacer.id, demo)
            logAction(adminId, 'media', 'Remplacement du fichier d\'un média', aRemplacer.nom)
            toast('Fichier remplacé : les contenus qui utilisent cette image affichent automatiquement la nouvelle version.')
            setARemplacer(null)
          }
        }}
        title="Remplacer le fichier de cette image ?"
        confirmLabel="Remplacer le fichier"
        destructive={false}
      >
        <p>
          L'image « {aRemplacer?.nom} » est utilisée à{' '}
          <strong>
            {aRemplacer
              ? (() => {
                  const u = mediaUsage(aRemplacer.id)
                  return u.articles.length + u.avatars + (u.association ? 1 : 0)
                })()
              : 0}{' '}
            endroit(s)
          </strong>
          . Le remplacement met à jour tous ces endroits automatiquement (l'identifiant de
          l'image est conservé). En production, le nouveau fichier devra respecter les formats et
          limites définis dans les spécifications techniques.
        </p>
      </ConfirmDialog>

      {/* Suppression avec vérification d'usage (§36) */}
      <ConfirmDialog
        open={!!aSupprimer}
        onClose={() => setASupprimer(null)}
        onConfirm={() => {
          if (aSupprimer && !utilise) {
            deleteMedia(aSupprimer.id)
            logAction(adminId, 'media', 'Suppression d\'un média', aSupprimer.nom)
            toast('Image supprimée de la médiathèque.', 'info')
          }
          setASupprimer(null)
        }}
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
function ImportMediaModal({
  open,
  onClose,
  onImport,
}: {
  open: boolean
  onClose: () => void
  onImport: (nom: string, tailleKo: number, format: 'JPG' | 'PNG' | 'WebP', alt: string, file: string) => void
}) {
  const [fichier, setFichier] = useState<File | null>(null)
  const [nom, setNom] = useState('')
  const [alt, setAlt] = useState('')
  const [erreur, setErreur] = useState('')

  const importerFichierDemo = () => {
    const demo = FICHIERS_DEMO[Math.floor(Math.random() * FICHIERS_DEMO.length)]
    onImport(demo, 180 + Math.floor(Math.random() * 200), 'JPG', alt.trim() || 'Image de démonstration importée', demo)
    setFichier(null)
    setNom('')
    setAlt('')
    setErreur('')
  }

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
                setErreur("Choisissez d'abord un fichier image (ou utilisez un visuel de démonstration).")
                return
              }
              if (!alt.trim()) {
                setErreur('Le texte alternatif est obligatoire pour l\'accessibilité.')
                return
              }
              const format =
                fichier.type === 'image/png' ? 'PNG' : fichier.type === 'image/webp' ? 'WebP' : 'JPG'
              onImport(nom.trim() || fichier.name, Math.max(1, Math.round(fichier.size / 1024)), format, alt.trim(), URL.createObjectURL(fichier))
              setFichier(null)
              setNom('')
              setAlt('')
              setErreur('')
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
            hint={`Formats acceptés : ${FORMATS_ACCEPTES}. La taille maximale sera définie dans les spécifications techniques.`}
          >
            <input
              id="import-fichier"
              type="file"
              accept="image/jpeg, image/png, image/webp"
              onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
              className="w-full rounded-xl border border-line bg-white p-3 text-[1rem]"
            />
          </Field>
          {fichier ? (
            <img
              src={URL.createObjectURL(fichier)}
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
          <div className="rounded-xl bg-sand p-4 text-[0.9375rem] text-mist">
            <p className="font-bold text-bark">Maquette</p>
            <p className="mt-1">
              Sans fichier sous la main, vous pouvez importer un visuel de démonstration :
            </p>
            <div className="mt-3">
              <Button size="petit" variant="secondaire" onClick={importerFichierDemo}>
                Importer un visuel de démonstration
              </Button>
            </div>
          </div>
        </div>
      </Modal>
  )
}
