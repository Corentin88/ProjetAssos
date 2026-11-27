import { ContentImage } from '../content/ContentImage'
import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import {
  ArrowDown,
  ArrowUp,
  FileText,
  Heading1,
  Heading2,
  Image as ImageIcon,
  Images,
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
import type { Block, BlockType } from '../../types'
import { newBlockId } from '../../data/articles'
import { getMedia } from '../../lib/selectors'
import { mediaUrl } from '../../lib/assets'
import { defaultTrailVisibility, emptyLocation, emptyTrail } from '../../lib/mapBlocks'
import { youtubeId } from '../content/BlockRenderer'
import { Button, Field, Input, Textarea } from '../ui/form'
import { ConfirmDialog } from '../ui/overlay'
import { MediaPicker } from './MediaPicker'
import { TrailEditor } from './TrailEditor'
import { LocationEditor } from './LocationEditor'
import { BlockCarouselEditor } from './BlockCarouselEditor'
import { ImageAlternativeField } from './ImageAlternativeField'
import { PdfBlockEditor } from './PdfBlockEditor'
import { VisualPdfFields } from './VisualPdfFields'
import { imageAlternative } from '../../lib/imageAlternative'

const LIBELLES: Record<BlockType, { nom: string; icone: typeof Text; hint: string }> = {
  titre: { nom: 'Titre', icone: Heading1, hint: 'Titre de section (niveau de titre automatiquement hiérarchisé)' },
  'sous-titre': { nom: 'Sous-titre', icone: Heading2, hint: 'Sous-titre de section' },
  paragraphe: { nom: 'Paragraphe', icone: Text, hint: 'Texte courant' },
  image: { nom: 'Image', icone: ImageIcon, hint: 'Image de la médiathèque avec texte alternatif' },
  carrousel: { nom: 'Carrousel', icone: Images, hint: 'Plusieurs images dans l’ordre de votre choix' },
  pdf: { nom: 'Document PDF', icone: FileText, hint: 'Consultation et téléchargement selon vos réglages' },
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
  errors,
  article = false,
  onTrailBusy,
}: {
  blocks: Block[]
  onChange: Dispatch<SetStateAction<Block[]>>
  errors?: Record<string, string>
  article?: boolean
  onTrailBusy?: (id: string, busy: boolean) => void
}) {
  const [menuOuvert, setMenuOuvert] = useState(false)
  const [aSupprimer, setASupprimer] = useState<number | null>(null)
  const [pickerIndex, setPickerIndex] = useState<number | null>(null)

  const ajouter = (type: BlockType) => {
    const base: Block = { id: newBlockId('nvx'), type }
    if (type === 'liste') base.items = ['Premier élément', 'Deuxième élément']
    if (type === 'paragraphe' || type === 'image') base.text = ''
    if (type === 'carrousel') base.slides = []
    if (type === 'pdf') base.pdf = { display: true, download: true, presentation: 'integrated' }
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
    <div className="flex min-w-0 flex-col gap-4">
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
              <li key={b.id} className="min-w-0 rounded-2xl border border-line bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="inline-flex items-center gap-2 font-bold">
                    <Icone aria-hidden="true" className="h-5 w-5 text-forest" />
                    {meta.nom}
                    <span className="text-[0.8125rem] font-normal text-mist">
                      bloc {index + 1} sur {blocks.length}
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-2">
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
      {/* Les colonnes du menu suivent la largeur de l’éditeur, pas celle de l’écran (barre latérale, panneau). */}
      <div className="@container relative">
        <Button onClick={() => setMenuOuvert((o) => !o)} aria-expanded={menuOuvert}>
          <Plus aria-hidden="true" className="h-5 w-5" />
          Ajouter un bloc
        </Button>
        {menuOuvert ? (
          <div className="mt-2 grid w-full max-w-2xl grid-cols-1 gap-2 rounded-2xl border border-line bg-white p-3 @md:grid-cols-2 @2xl:grid-cols-3">
            {(Object.keys(LIBELLES) as BlockType[]).filter(type =>
              article || !['randonnee', 'localisation', 'carrousel', 'pdf'].includes(type)
            ).map((type) => {
              const { nom, icone: Icone } = LIBELLES[type]
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => ajouter(type)}
                  className="flex min-h-12 min-w-0 items-center gap-2 rounded-xl border border-line px-3 py-2 text-left font-bold text-forest hover:bg-leaf-pale"
                >
                  <Icone aria-hidden="true" className="size-5 shrink-0" />
                  <span className="min-w-0 [overflow-wrap:anywhere]">{nom}</span>
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
        open={pickerIndex !== null}
        onClose={() => setPickerIndex(null)}
        titre={article ? 'Choisir une image ou un PDF pour le bloc' : "Choisir l’image du bloc"}
        type={article ? 'VISUAL' : 'IMAGE'}
        selectionActive={pickerIndex !== null ? getMedia(blocks[pickerIndex]?.mediaId ?? '')?.sourcePdfId ?? blocks[pickerIndex]?.mediaId : null}
        onChoose={(media) => {
          if (pickerIndex !== null && media.type === 'IMAGE') {
            const current = blocks[pickerIndex]
            if (!current) return
            const alternative = current.decorative || current.alt?.trim() ? {} : imageAlternative(media)
            const access = current.mediaId === media.id ? {} : { viewPdf: undefined, downloadPdf: undefined }
            majBloc(pickerIndex, { mediaId: media.id, ...alternative, ...access })
          }
        }}
      />
    </div>
  )

  function renderChamp(b: Block, index: number) {
    switch (b.type) {
      case 'carrousel':
        return <BlockCarouselEditor block={b} onChange={slides => majBloc(index, { slides })} errors={errors} />
      case 'pdf':
        return <PdfBlockEditor block={b} onChange={patch => majBloc(index, patch)} errors={errors} />
      case 'randonnee':
        return <TrailEditor block={b}
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
                alt={b.decorative ? '' : (b.alt || media.alt)}
                className={`h-40 w-full max-w-sm rounded-xl border border-line ${media.fromPdf ? 'bg-sand object-contain' : 'object-cover'}`}
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
            <ImageAlternativeField id={errorId} alt={b.alt ?? ''} decorative={b.decorative} error={errors?.[errorId]}
              onAltChange={alt => majBloc(index, { alt })} onDecorativeChange={decorative => majBloc(index, { decorative })} />
            {article && media?.fromPdf && <VisualPdfFields id={`blk-${b.id}`} value={b} onChange={patch => majBloc(index, patch)} />}
            <Field label="Légende" htmlFor={`blk-caption-${b.id}`}>
              <Input id={`blk-caption-${b.id}`} value={b.text ?? ''} maxLength={1000}
                onChange={event => majBloc(index, { text: event.target.value })} />
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
