import { useId, useState } from 'react'
import { Plus } from 'lucide-react'
import { ApiError, authErrorMessage } from '../../lib/auth'
import { saveClassification } from '../../lib/content'
import { Button, Field, Input } from '../ui/form'

export function QuickClassification({ kind, onCreated }: {
  kind: 'categories' | 'tags'
  onCreated: (id: string) => void
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const category = kind === 'categories'
  const label = category ? 'Nouvelle catégorie' : 'Nouveau tag'
  async function create() {
    const value = name.trim()
    if (!value || busy) return
    setBusy(true)
    setError('')
    try {
      const created = await saveClassification(kind, value)
      onCreated(created.id)
      setOpen(false)
      setName('')
    } catch (reason) {
      setError(reason instanceof ApiError && reason.status === 409
        ? category ? 'Cette catégorie existe déjà.' : 'Ce tag existe déjà.'
        : authErrorMessage(reason))
    } finally {
      setBusy(false)
    }
  }
  return <div className="mt-3">
    {!open ? <Button variant="secondaire" size="petit" onClick={() => setOpen(true)}>
      <Plus aria-hidden="true" className="h-4 w-4" /> {label}
    </Button> : <div className="grid gap-2 rounded-xl border border-line p-3" aria-busy={busy}>
      <Field htmlFor={id} label={label} error={error} required>
        <Input id={id} autoFocus maxLength={255} value={name} disabled={busy}
          invalid={Boolean(error)} describedBy={error ? `${id}-err` : undefined}
          onChange={event => { setName(event.target.value); setError('') }}
          onKeyDown={event => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            void create()
          }} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button size="petit" disabled={busy || !name.trim()} onClick={() => void create()}>{busy ? 'Création…' : 'Créer'}</Button>
        <Button variant="blanc" size="petit" disabled={busy} onClick={() => { setOpen(false); setError('') }}>Annuler</Button>
      </div>
    </div>}
  </div>
}
