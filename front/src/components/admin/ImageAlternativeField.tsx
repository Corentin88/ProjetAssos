import type { ChangeEvent } from 'react'
import { Checkbox, Field, Input, Textarea } from '../ui/form'

export function ImageAlternativeField({ id, alt, decorative, onAltChange, onDecorativeChange, error, multiline = false }: {
  id: string
  alt: string
  decorative?: boolean
  onAltChange: (alt: string) => void
  onDecorativeChange: (decorative: boolean) => void
  error?: string
  multiline?: boolean
}) {
  const control = {
    id, value: alt, maxLength: 1000, disabled: decorative,
    required: !decorative, invalid: Boolean(error) && !decorative,
    describedBy: `${id}-hint${error && !decorative ? ` ${id}-err` : ''}`,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onAltChange(event.target.value),
  }
  return <div className="grid gap-2">
    <Checkbox id={`${id}-decorative`} checked={Boolean(decorative)} label="Image décorative"
      aria-describedby={`${id}-decorative-hint`}
      onChange={event => onDecorativeChange(event.target.checked)} />
    <p id={`${id}-decorative-hint`} className="text-sm text-mist">À cocher si l’image n’apporte aucune information au contenu.</p>
    <Field label="Texte alternatif" htmlFor={id} required={!decorative} error={decorative ? undefined : error}
      hint={decorative ? 'L’image aura une alternative vide.' : 'Vérifiez la proposition issue du nom du fichier et décrivez le contenu utile de l’image.'}>
      {multiline ? <Textarea {...control} rows={2} /> : <Input {...control} />}
    </Field>
  </div>
}
