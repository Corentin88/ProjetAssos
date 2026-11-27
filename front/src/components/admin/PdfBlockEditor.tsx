import { useState } from 'react'
import type { Block, LibraryDetails } from '../../types'
import { useResource } from '../../lib/community'
import { Button, Checkbox, Field, Input, Select, Textarea } from '../ui/form'
import { MediaPicker } from './MediaPicker'

function documentTitle(name: string) {
  const words = name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  return words ? words.charAt(0).toLocaleUpperCase('fr') + words.slice(1) : 'Document PDF'
}

export function PdfBlockEditor({ block, onChange, errors }: {
  block: Block
  onChange: (patch: Partial<Block>) => void
  errors?: Record<string, string>
}) {
  const [open, setOpen] = useState(false)
  const document = useResource<LibraryDetails>(block.mediaId ? `/admin/content/media/${block.mediaId}` : undefined, true)
  const pdf = block.pdf ?? { display: true, download: true }
  const id = `blk-${block.id}-pdf`
  const titleError = errors?.[`${id}-title`]
  const accessError = errors?.[`${id}-access`]
  const update = (patch: Partial<typeof pdf>) => onChange({ pdf: { ...pdf, ...patch } })

  return <div className="grid gap-3">
    {block.mediaId && <p className="break-words text-mist">{document.data?.type === 'PDF' ? document.data.originalName : 'PDF sélectionné'}</p>}
    <Button size="petit" variant="secondaire" className="justify-self-start" onClick={() => setOpen(true)}>
      {block.mediaId ? 'Remplacer le PDF' : 'Choisir un PDF'}
    </Button>
    <Field label="Titre du document" htmlFor={`${id}-title`} required error={titleError}>
      <Input id={`${id}-title`} value={block.text ?? ''} maxLength={255} onChange={event => onChange({ text: event.target.value })}
        invalid={Boolean(titleError)} describedBy={titleError ? `${id}-title-err` : undefined} />
    </Field>
    <Field label="Description" htmlFor={`${id}-description`}>
      <Textarea id={`${id}-description`} value={pdf.description ?? ''} maxLength={4000} rows={3}
        onChange={event => update({ description: event.target.value })} />
    </Field>
    <Checkbox id={`${id}-access`} label="Afficher le document dans l’article" checked={pdf.display}
      aria-describedby={accessError ? `${id}-err` : undefined} onChange={event => update({ display: event.target.checked })} />
    {pdf.display && <Field label="Présentation du document" htmlFor={`${id}-presentation`}>
      <Select id={`${id}-presentation`} value={pdf.presentation ?? 'link'}
        onChange={event => update({ presentation: event.target.value === 'integrated' ? 'integrated' : 'link' })}>
        <option value="integrated">Lecteur intégré</option>
        <option value="link">Lien vers le document</option>
      </Select>
    </Field>}
    <Checkbox id={`${id}-download`} label="Autoriser le téléchargement" checked={pdf.download}
      aria-describedby={accessError ? `${id}-err` : undefined} onChange={event => update({ download: event.target.checked })} />
    {(!pdf.display && !pdf.download) && <p id={`${id}-err`} role="alert" className="text-brique">Activez au moins un accès au document.</p>}
    <MediaPicker open={open} type="PDF" titre="Choisir un document PDF" selectionActive={block.mediaId} onClose={() => setOpen(false)}
      onChoose={media => {
        if (media.type === 'PDF') onChange({ mediaId: media.id, text: block.text?.trim() ? block.text : documentTitle(media.nom) })
      }} />
  </div>
}
