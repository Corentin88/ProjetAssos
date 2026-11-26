import { useState } from 'react'
import type { LibraryItem } from '../../types'
import { rememberMedia } from '../../lib/db'
import { Modal } from '../ui/overlay'
import { Button } from '../ui/form'
import { MediaLibrary, useMediaLibrary } from './MediaLibrary'

type Props = {
  open: boolean
  onClose: () => void
  onChoose: (media: LibraryItem) => void
  titre?: string
  selectionActive?: string | null
  type?: LibraryItem['type']
}

/** Sélecteur partagé par les couvertures d’article et les blocs image ou randonnée. */
export function MediaPicker({ open, onClose, titre = 'Choisir une image dans la médiathèque', ...props }: Props) {
  return (
    <Modal open={open} onClose={onClose} title={titre} size="large">
      {open && <PickerContent {...props} onClose={onClose} />}
    </Modal>
  )
}

function PickerContent({ onClose, onChoose, selectionActive, type = 'IMAGE' }: Omit<Props, 'open' | 'titre'>) {
  const library = useMediaLibrary(type)
  const [choice, setChoice] = useState<LibraryItem>()
  return (
    <div className="flex flex-col gap-4">
      <MediaLibrary library={library} activeId={choice?.id ?? selectionActive ?? undefined} onOpen={setChoice} />
      <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t border-line bg-white py-3">
        {choice && <p className="mr-auto min-w-0 break-all text-sm" role="status">Sélection : {choice.nom}</p>}
        <Button variant="blanc" onClick={onClose}>Annuler</Button>
        <Button disabled={!choice} onClick={() => {
          if (!choice) return
          if (choice.type === 'IMAGE') rememberMedia(choice)
          onChoose(choice)
          onClose()
        }}>Utiliser ce fichier</Button>
      </div>
    </div>
  )
}
