import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Field, Input } from '../ui/form'

export function ChampMotDePasse({ id, value, onChange, erreur, aide, label, autoComplete = 'current-password' }: {
  id: string
  value: string
  onChange: (v: string) => void
  erreur?: string
  aide?: string
  label: string
  autoComplete?: string
}) {
  const [visible, setVisible] = useState(false)
  const description = [aide && `${id}-hint`, erreur && `${id}-err`].filter(Boolean).join(' ')
  return (
    <Field label={label} htmlFor={id} required error={erreur} hint={aide}>
      <div className="relative">
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          invalid={!!erreur}
          describedBy={description || undefined}
          autoComplete={autoComplete}
          className="pr-14"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-controls={id}
          className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-lg text-mist hover:bg-leaf-pale hover:text-forest"
        >
          {visible ? <EyeOff aria-hidden="true" className="h-5 w-5" /> : <Eye aria-hidden="true" className="h-5 w-5" />}
          <span className="sr-only">{visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}</span>
        </button>
      </div>
    </Field>
  )
}
