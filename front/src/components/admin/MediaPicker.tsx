import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { LibraryImage, LibraryItem } from '../../types'
import { rememberMedia } from '../../lib/db'
import { Modal } from '../ui/overlay'
import { Button } from '../ui/form'
import { MediaLibrary, useMediaLibrary } from './MediaLibrary'
import type { LibraryType } from './MediaLibrary'
import { MediaImport } from './MediaImport'
import { authErrorMessage } from '../../lib/auth'
import { preparePdfVisual } from '../../lib/content'
import { Alert } from '../ui/feedback'

type PickerSelection = { onChoose: (media: LibraryItem) => void; multiple?: false }
  | { onChoose: (images: LibraryImage[]) => void; multiple: true; limit: number; excludedIds: string[] }

type Options = {
  open: boolean
  onClose: () => void
  titre?: string
  selectionActive?: string | null
  type?: LibraryType
} & PickerSelection

/** Sélecteur partagé par les couvertures, les catégories et les blocs de contenu. */
export function MediaPicker(props: Options) {
  return props.open ? createPortal(<PickerContent {...props} />, document.body) : null
}

function PickerContent(props: Options) {
  const { onClose, selectionActive, titre = 'Choisir une image dans la médiathèque', type = 'IMAGE' } = props
  const library = useMediaLibrary(type)
  const [choices, setChoices] = useState<LibraryItem[]>([])
  const [importing, setImporting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const selected = new Set(choices.map(item => item.id))
  const remaining = props.multiple ? props.limit - choices.length : 1

  function choose(item: LibraryItem) {
    if (busy) return
    setError('')
    if (!props.multiple) {
      setChoices([item])
      return
    }
    if ((item.type === 'IMAGE' || (type === 'VISUAL' && item.type === 'PDF')) && !props.excludedIds.includes(item.id)) setChoices(current => {
      if (current.some(selected => selected.id === item.id)) return current.filter(selected => selected.id !== item.id)
      return current.length < props.limit ? [...current, item] : current
    })
  }

  async function confirm() {
    setBusy(true)
    setError('')
    try {
      const items: LibraryItem[] = []
      for (const item of choices) {
        if (type === 'VISUAL' && item.type === 'PDF') {
          const preview = await preparePdfVisual(item.id)
          items.push({ ...preview, type: 'IMAGE', folderId: item.folderId, thumbnail: preview.file })
        } else items.push(item)
      }
      const images = items.filter((item): item is LibraryImage => item.type === 'IMAGE')
      images.forEach(rememberMedia)
      if (props.multiple) props.onChoose(images)
      else if (items[0]) props.onChoose(items[0])
      onClose()
    } catch (reason) {
      setError(authErrorMessage(reason))
    } finally {
      setBusy(false)
    }
  }

  return <>
    <Modal open onClose={onClose} title={titre} size="large" preventClose={busy}>
      <div className="flex flex-col gap-4">
        {type !== 'GPX' && <Button className="self-start" variant="secondaire" disabled={busy || remaining <= 0} onClick={() => setImporting(true)}>
          Importer des fichiers
        </Button>}
        <MediaLibrary library={library} activeId={props.multiple ? undefined : choices[0]?.id ?? selectionActive ?? undefined}
          selected={props.multiple ? selected : undefined} onOpen={choose}
          itemDisabled={item => busy || Boolean(props.multiple && (props.excludedIds.includes(item.id) || (remaining <= 0 && !selected.has(item.id))))} />
        {error && <Alert kind="erreur" title="Aperçu PDF indisponible">{error}</Alert>}
        <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t border-line bg-white py-3">
          {choices.length > 0 && <p className="mr-auto min-w-0 break-all text-sm" role="status">
                {props.multiple ? `${choices.length} fichier(s) sélectionné(s)` : `Sélection : ${choices[0].nom}`}
          </p>}
          <Button variant="blanc" onClick={onClose} disabled={busy}>Annuler</Button>
          <Button disabled={busy || !choices.length} onClick={() => void confirm()}>
            {busy ? 'Préparation…' : props.multiple ? 'Ajouter la sélection' : 'Utiliser ce fichier'}
          </Button>
        </div>
      </div>
    </Modal>
    {importing && <MediaImport library={library} type={type} maxFiles={remaining} onClose={() => setImporting(false)}
      onUploaded={choose} onFinished={async complete => {
        await library.results.refresh()
        if (complete) setImporting(false)
      }} />}
  </>
}
