import { useRef, useState } from 'react'
import type { Category, CategoryVisual } from '../../types'
import { ApiError, authErrorMessage } from '../../lib/auth'
import { saveClassification } from '../../lib/content'
import { Alert } from '../ui/feedback'
import { Button, Field, Input } from '../ui/form'
import { Modal } from '../ui/overlay'
import { CategoryVisualPicker } from './CategoryVisualPicker'

export function CategoryEditDialog({ category, onClose }: { category: Category; onClose: () => void }) {
  const [name, setName] = useState(category.nom)
  const [visual, setVisual] = useState<CategoryVisual | null>(category.visual ?? null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const saving = useRef(false)

  return <Modal open title="Modifier la catégorie" onClose={() => { if (!saving.current) onClose() }} preventClose={busy}>
    <form className="grid gap-4" aria-busy={busy} onSubmit={async event => {
      event.preventDefault()
      if (saving.current || !name.trim()) return
      saving.current = true
      setBusy(true)
      setError('')
      try {
        await saveClassification('categories', name, category.id, visual)
        onClose()
      } catch (reason) {
        setError(reason instanceof ApiError && reason.status === 409 ? 'Une catégorie porte déjà ce nom ou le visuel est devenu indisponible.' : authErrorMessage(reason))
      } finally {
        saving.current = false
        setBusy(false)
      }
    }}>
      <p className="text-sm text-mist">Les changements s’appliquent à tous les articles de cette catégorie.</p>
      {error && <Alert kind="erreur" title="Modification impossible">{error}</Alert>}
      <Field label="Nom de la catégorie" htmlFor="quick-category-name" required>
        <Input id="quick-category-name" value={name} maxLength={255} disabled={busy} required onChange={event => setName(event.target.value)} />
      </Field>
      <CategoryVisualPicker value={visual} onChange={setVisual} disabled={busy} />
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="blanc" disabled={busy} onClick={onClose}>Annuler</Button>
        <Button type="submit" disabled={busy || !name.trim()}>{busy ? 'Enregistrement…' : 'Enregistrer'}</Button>
      </div>
    </form>
  </Modal>
}
