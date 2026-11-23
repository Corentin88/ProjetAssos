import { ContentImage } from '../content/ContentImage'
import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Heading1,
  Heading2,
  Image as ImageIcon,
  Link as LinkIcon,
  ListOrdered,
  MapPin,
  Mountain,
  Paperclip,
  Plus,
  Quote,
  Text,
  Trash2,
  Youtube,
} from 'lucide-react'
import type { Block, BlockType, GpxMedia, Media } from '../../types'
import { newBlockId } from '../../data/articles'
import { getMedia } from '../../lib/selectors'
import { mediaUrl } from '../../lib/assets'
import { useResource } from '../../lib/community'
import { defaultTrailVisibility, emptyLocation, emptyTrail } from '../../lib/mapBlocks'
import { youtubeId } from '../content/BlockRenderer'
import { Button, Field, Input, Textarea } from '../ui/form'
import { ConfirmDialog } from '../ui/overlay'
import { MediaPicker } from './MediaPicker'
import { TrailEditor } from './TrailEditor'
import { LocationEditor } from './LocationEditor'

const LIBELLES: Record<BlockType, { nom: string; icone: typeof Text; hint: string }> = {
  titre: { nom: 'Titre', icone: Heading1, hint: 'Titre de section (niveau de titre automatiquement hiérarchisé)' },
  'sous-titre': { nom: 'Sous-titre', icone: Heading2, hint: 'Sous-titre de section' },
  paragraphe: { nom: 'Paragraphe', icone: Text, hint: 'Texte courant' },
  image: { nom: 'Image', icone: ImageIcon, hint: 'Image de la médiathèque avec texte alternatif' },
  video: { nom: 'Vidéo YouTube', icone: Youtube, hint: 'Lecteur intégré — la vidéo reste hébergée sur YouTube (§19)' },
  liste: { nom: 'Liste', icone: ListOrdered, hint: 'Liste à puces, un élément par ligne' },
  lien: { nom: 'Lien', icone: LinkIcon, hint: 'Lien interne (commence par /) ou externe' },
  citation: { nom: 'Citation', icone: Quote, hint: 'Citation mise en valeur' },
  randonnee: { nom: 'Randonnée / GPX', icone: Mountain, hint: 'Parcours, mesures et fichier GPX' },
  localisation: { nom: 'Carte / Localisation', icone: MapPin, hint: 'Un lieu repéré sur une carte' },
}

/** Éditeur d'article basé sur des blocs (§18) : ajout, modification,
 *  suppression et réorganisation des blocs */
export function BlockEditor({
  blocks,
  onChange,
  medias,
  errors,
  article = false,
  onTrailBusy,
}: {
  blocks: Block[]
  onChange: Dispatch<SetStateAction<Block[]>>
  medias?: Media[]
  errors?: Record<string, string>
  article?: boolean
  onTrailBusy?: (id: string, busy: boolean) => void
}) {
  const [menuOuvert, setMenuOuvert] = useState(false)
  const [aSupprimer, setASupprimer] = useState<number | null>(null)
  const [pickerIndex, setPickerIndex] = useState<number | null>(null)
  const { data: gpxFiles, error: gpxError, refresh: refreshGpx } = useResource<GpxMedia[]>(
    article && blocks.some(block => block.type === 'randonnee') ? '/admin/content/gpx' : undefined, true,
  )

  const ajouter = (type: BlockType) => {
    const base: Block = { id: newBlockId('nvx'), type }
    if (type === 'liste') base.items = ['Premier élément', 'Deuxième élément']
    if (type === 'paragraphe') base.text = ''
    if (type === 'randonnee') { base.trail = emptyTrail; base.visibility = defaultTrailVisibility }
    if (type === 'localisation') base.location = emptyLocation
    onChange([...blocks, base])
    setMenuOuvert(false)
  }

  const majBloc = (index: number, patch: Partial<Block>) => {
    const next = blocks.map((b, i) => (i === index ? { ...b, ...patch } : b))
    onChange(next)
  }

  const deplacer = (index: number, dir: -1 | 1) => {
    const cible = index + dir
    if (cible < 0 || cible >= blocks.length) return
    const next = [...blocks]
    const [b] = next.splice(index, 1)
    next.splice(cible, 0, b)
    onChange(next)
  }

  const supprimer = (index: number) => {
    onChange(blocks.filter((_, i) => i !== index))
    setASupprimer(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl text-forest">Contenu de l'article (blocs)</h2>
      <p className="text-[0.9375rem] text-mist">
        Ajoutez, modifiez, réorganisez et supprimez des blocs. La prévisualisation est disponible
        avant toute publication.
      </p>

      {blocks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-white p-6 text-center text-mist">
          Aucun bloc : utilisez « Ajouter un bloc » pour commencer la rédaction.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {blocks.map((b, index) => {
            const meta = LIBELLES[b.type]
            const Icone = meta.icone
            return (
              <li key={b.id} className="rounded-2xl border border-line bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="inline-flex items-center gap-2 font-bold">
                    <Icone aria-hidden="true" className="h-5 w-5 text-forest" />
                    {meta.nom}
                    <span className="text-[0.8125rem] font-normal text-mist">
                      bloc {index + 1} sur {blocks.length}
                    </span>
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => deplacer(index, -1)}
                      disabled={index === 0}
                      className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-line px-3 font-bold text-forest hover:bg-leaf-pale disabled:opacity-40"
                    >
                      <ArrowUp aria-hidden="true" className="h-4 w-4" />
                      Monter
                    </button>
                    <button
                      type="button"
                      onClick={() => deplacer(index, 1)}
                      disabled={index === blocks.length - 1}
                      className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-line px-3 font-bold text-forest hover:bg-leaf-pale disabled:opacity-40"
                    >
                      <ArrowDown aria-hidden="true" className="h-4 w-4" />
                      Descendre
                    </button>
                    <button
                      type="button"
                      onClick={() => setASupprimer(index)}
                      className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-brique px-3 font-bold text-brique hover:bg-brique-pale"
                    >
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                      Supprimer le bloc
                    </button>
                  </div>
                </div>
                <div className="mt-3">{renderChamp(b, index)}</div>
                <p className="mt-1 text-[0.8125rem] text-mist">{meta.hint}</p>
              </li>
            )
          })}
        </ul>
      )}

      {/* Ajout de bloc */}
      <div className="relative">
        <Button onClick={() => setMenuOuvert((o) => !o)} aria-expanded={menuOuvert} aria-haspopup="true">
          <Plus aria-hidden="true" className="h-5 w-5" />
          Ajouter un bloc
        </Button>
        {menuOuvert ? (
          <div className="absolute z-10 mt-2 grid w-full max-w-xl grid-cols-2 gap-2 rounded-2xl border border-line bg-white p-3 shadow-xl sm:grid-cols-4">
            {(Object.keys(LIBELLES) as BlockType[]).filter(type =>
              article || (type !== 'randonnee' && type !== 'localisation')
            ).map((type) => {
              const { nom, icone: Icone } = LIBELLES[type]
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => ajouter(type)}
                  className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border border-line px-3 font-bold text-forest hover:bg-leaf-pale"
                >
                  <Icone aria-hidden="true" className="h-5 w-5" />
                  {nom}
                </button>
              )
            })}
            <p className="col-span-full text-right">
              <button type="button" onClick={() => setMenuOuvert(false)} className="rounded-lg px-3 py-2 font-bold text-mist underline underline-offset-4">
                Fermer le menu d'ajout
              </button>
            </p>
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={aSupprimer !== null}
        onClose={() => setASupprimer(null)}
        onConfirm={() => aSupprimer !== null && supprimer(aSupprimer)}
        title="Supprimer ce bloc ?"
        confirmLabel="Supprimer le bloc"
      >
        <p>
          Le bloc sera retiré du contenu en cours d'édition. La version actuellement publiée (si
          l'article est publié) n'est pas affectée tant que la nouvelle version n'est pas validée.
        </p>
      </ConfirmDialog>

      <MediaPicker
        sources={medias}
        open={pickerIndex !== null}
        onClose={() => setPickerIndex(null)}
        titre="Choisir l'image du bloc"
        selectionActive={pickerIndex !== null ? blocks[pickerIndex]?.mediaId ?? null : null}
        onChoose={(media) => {
          if (pickerIndex !== null) {
            majBloc(pickerIndex, { mediaId: media.id, alt: media.alt })
          }
        }}
      />
    </div>
  )

  function renderChamp(b: Block, index: number) {
    switch (b.type) {
      case 'randonnee':
        return <TrailEditor block={b} files={gpxFiles} filesError={gpxError} refresh={() => void refreshGpx()}
          onChange={patch => onChange(current => current.map(block => block.id === b.id ? { ...block, ...patch } : block))}
          onBusy={onTrailBusy} errors={errors} />
      case 'localisation':
        return <LocationEditor id={b.id} location={b.location ?? emptyLocation}
          error={errors?.[`blk-${b.id}-latitude`]} onChange={location => majBloc(index, { location })} />
      case 'titre':
      case 'sous-titre':
      case 'citation':
        return (
          <Field label="Texte du bloc" htmlFor={`blk-${b.id}`} required>
            <Input
              id={`blk-${b.id}`}
              value={b.text ?? ''}
              onChange={(e) => majBloc(index, { text: e.target.value })}
            />
          </Field>
        )
      case 'paragraphe':
        return (
          <Field label="Texte du paragraphe" htmlFor={`blk-${b.id}`} required>
            <Textarea
              id={`blk-${b.id}`}
              value={b.text ?? ''}
              onChange={(e) => majBloc(index, { text: e.target.value })}
              rows={4}
            />
          </Field>
        )
      case 'image': {
        const media = b.mediaId ? getMedia(b.mediaId) : undefined
        const errorId = `blk-alt-${b.id}`
        return (
          <div className="flex flex-col gap-3">
            {media ? (
              <ContentImage
                src={mediaUrl(media.file)}
                alt={b.alt || media.alt}
                className="h-40 w-full max-w-sm rounded-xl border border-line object-cover"
              />
            ) : (
              <p className="rounded-xl border border-dashed border-line bg-sand p-4 text-mist">
                Aucune image choisie.
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button variant="secondaire" size="petit" onClick={() => setPickerIndex(index)}>
                <Paperclip aria-hidden="true" className="h-4 w-4" />
                {media ? 'Changer l\'image' : 'Choisir dans la médiathèque'}
              </Button>
            </div>
            <Field
              label="Texte alternatif (obligatoire)"
              htmlFor={`blk-alt-${b.id}`}
              required
              hint="Décrit l'image pour les lecteurs d'écran et si l'image ne se charge pas."
              error={errors?.[errorId]}
            >
              <Input
                id={`blk-alt-${b.id}`}
                value={b.alt ?? ''}
                invalid={Boolean(errors?.[errorId])}
                describedBy={`${errorId}-hint${errors?.[errorId] ? ` ${errorId}-err` : ''}`}
                onChange={(e) => majBloc(index, { alt: e.target.value })}
              />
            </Field>
          </div>
        )
      }
      case 'video': {
        const valide = youtubeId(b.url)
        const fieldId = `blk-${b.id}`
        return (
          <Field
            label="Adresse de la vidéo YouTube"
            htmlFor={`blk-${b.id}`}
            required
            error={errors?.[fieldId]}
            hint={
              valide
                ? 'Adresse reconnue : le lecteur sera intégré à l\'article.'
                : 'Exemples acceptés : https://www.youtube.com/watch?v=… ou https://youtu.be/…'
            }
          >
            <Input
              id={`blk-${b.id}`}
              type="url"
              value={b.url ?? ''}
              invalid={Boolean(errors?.[fieldId])}
              describedBy={`${fieldId}-hint${errors?.[fieldId] ? ` ${fieldId}-err` : ''}`}
              onChange={(e) => majBloc(index, { url: e.target.value })}
            />
          </Field>
        )
      }
      case 'liste':
        return (
          <Field
            label="Éléments de la liste"
            htmlFor={`blk-${b.id}`}
            required
            hint="Un élément par ligne."
            error={errors?.[`blk-${b.id}`]}
          >
            <Textarea
              id={`blk-${b.id}`}
              value={(b.items ?? []).join('\n')}
              invalid={Boolean(errors?.[`blk-${b.id}`])}
              describedBy={`blk-${b.id}-hint${errors?.[`blk-${b.id}`] ? ` blk-${b.id}-err` : ''}`}
              onChange={(e) => majBloc(index, { items: e.target.value.split('\n') })}
              rows={4}
            />
          </Field>
        )
      case 'lien':
        return (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Libellé du lien" htmlFor={`blk-${b.id}`} required>
              <Input
                id={`blk-${b.id}`}
                value={b.text ?? ''}
                onChange={(e) => majBloc(index, { text: e.target.value })}
              />
            </Field>
            <Field
              label="Adresse du lien"
              htmlFor={`blk-url-${b.id}`}
              required
              hint="Interne : /actualites, /association… Externe : https://…"
              error={errors?.[`blk-url-${b.id}`]}
            >
              <Input
                id={`blk-url-${b.id}`}
                type="text"
                value={b.url ?? ''}
                invalid={Boolean(errors?.[`blk-url-${b.id}`])}
                describedBy={`blk-url-${b.id}-hint${errors?.[`blk-url-${b.id}`] ? ` blk-url-${b.id}-err` : ''}`}
                onChange={(e) => majBloc(index, { url: e.target.value })}
              />
            </Field>
          </div>
        )
      default:
        return null
    }
  }
}
