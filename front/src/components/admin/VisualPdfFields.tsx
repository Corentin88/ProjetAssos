import type { VisualPdfOptions } from '../../types'
import { Checkbox } from '../ui/form'

export function VisualPdfFields({ id, value, onChange }: {
  id: string
  value: VisualPdfOptions
  onChange: (patch: VisualPdfOptions) => void
}) {
  return <fieldset className="grid min-w-0 gap-2">
    <legend className="mb-2 font-bold">Première page d’un PDF</legend>
    <Checkbox id={`${id}-pdf-view`} label="Autoriser la consultation du PDF complet"
      checked={Boolean(value.viewPdf)} onChange={event => onChange({ viewPdf: event.target.checked })} />
    <Checkbox id={`${id}-pdf-download`} label="Afficher le bouton de téléchargement du PDF"
      checked={Boolean(value.downloadPdf)} onChange={event => onChange({ downloadPdf: event.target.checked })} />
  </fieldset>
}
