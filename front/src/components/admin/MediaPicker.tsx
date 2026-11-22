import { ContentImage } from '../content/ContentImage'
import { useMemo, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { useDb } from '../../lib/db'
import { mediaUrl } from '../../lib/assets'
import type { Media } from '../../types'
import { Modal } from '../ui/overlay'
import { Button } from '../ui/form'
import { EmptyState } from '../ui/feedback'

/** Sélecteur de média : réutilisable pour la couverture d'article, les blocs
 *  image et les galeries (§36 : la médiathèque est un espace commun) */
export function MediaPicker({
  open,
  onClose,
  onChoose,
  titre = 'Choisir une image dans la médiathèque',
  selectionActive,
  sources,
}: {
  open: boolean
  onClose: () => void
  onChoose: (media: Media) => void
  titre?: string
  selectionActive?: string | null
  sources?: Media[]
}) {
  const database = useDb()
  const bibliotheque = sources ?? database.medias
  const [recherche, setRecherche] = useState('')
  const medias = useMemo(
    () =>
      bibliotheque.filter(
        (m) =>
          !recherche.trim() ||
          m.nom.toLowerCase().includes(recherche.toLowerCase()) ||
          m.alt.toLowerCase().includes(recherche.toLowerCase()),
      ),
    [bibliotheque, recherche],
  )

  return (
    <Modal open={open} onClose={onClose} title={titre} size="large">
      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="mediapicker-search" className="font-bold">
            Rechercher une image
          </label>
          <input
            id="mediapicker-search"
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Nom du fichier ou texte alternatif…"
            className="mt-2 min-h-[48px] w-full rounded-xl border border-line bg-white px-4 text-[1.0625rem]"
          />
        </div>
        {medias.length === 0 ? (
          <EmptyState
            title="Aucune image trouvée"
            description="Aucun média ne correspond à cette recherche. Vous pouvez importer de nouvelles images dans la médiathèque."
          />
        ) : (
          <ul className="scrollzone grid max-h-[26rem] gap-4 overflow-y-auto sm:grid-cols-3" aria-label="Images disponibles">
            {medias.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChoose(m)
                    onClose()
                  }}
                  aria-pressed={selectionActive === m.id}
                  className={`group w-full rounded-xl border p-2 text-left transition-colors ${
                    selectionActive === m.id ? 'border-ocre bg-ocre-pale' : 'border-line hover:border-forest'
                  }`}
                >
                  <ContentImage
                    src={mediaUrl(m.file)}
                    alt={m.alt}
                    className="h-32 w-full rounded-lg object-cover"
                    loading="lazy"
                  />
                  <span className="mt-2 flex items-center justify-between gap-2">
                    <span className="block truncate text-[0.875rem] font-bold">{m.nom}</span>
                    {selectionActive === m.id ? (
                      <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0 text-ocre" />
                    ) : null}
                  </span>
                  <span className="block truncate text-[0.8125rem] text-mist">{m.alt}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end">
          <Button variant="blanc" onClick={onClose}>
            Annuler
          </Button>
        </div>
      </div>
    </Modal>
  )
}
