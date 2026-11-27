import { useId, useRef, useState } from 'react'
import type { CategoryVisual } from '../../types'
import { getMedia } from '../../lib/selectors'
import { CategoryVisualMark } from '../content/CategoryVisualMark'
import { categoryIconGroups, categoryIcons } from '../content/categoryIcons'
import { Button, Field, Input } from '../ui/form'
import { MediaPicker } from './MediaPicker'

function searchKey(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim()
}

export function CategoryVisualPicker({ value, onChange, disabled = false }: {
  value: CategoryVisual | null
  onChange: (value: CategoryVisual | null) => void
  disabled?: boolean
}) {
  const id = useId()
  const iconButton = useRef<HTMLButtonElement>(null)
  const [showIcons, setShowIcons] = useState(false)
  const [showMedia, setShowMedia] = useState(false)
  const [query, setQuery] = useState('')
  const current = value?.icon
    ? categoryIcons.find(item => item.id === value.icon)?.label
    : getMedia(value?.mediaId)?.nom
  const terms = searchKey(query).split(/\s+/)
  const results = categoryIconGroups.map(group => ({
    ...group,
    items: group.items.filter(item => {
      const searchable = searchKey(`${item.label} ${item.keywords} ${item.id} ${group.label}`)
      return terms.every(term => searchable.includes(term))
    }),
  })).filter(group => group.items.length)

  return <fieldset disabled={disabled} className="min-w-0 rounded-xl border border-line p-3">
    <legend className="px-1 font-bold">Visuel facultatif</legend>
    <p className="flex items-center gap-2 break-all text-mist" role="status">
      <CategoryVisualMark visual={value} size="h-9 w-9" />
      {current ?? (value ? 'Visuel sélectionné' : 'Aucun visuel')}
    </p>
    <div className="mt-3 flex flex-wrap gap-2">
      <Button ref={iconButton} size="petit" variant="secondaire" aria-expanded={showIcons} onClick={() => setShowIcons(open => !open)}>Choisir une icône</Button>
      <Button size="petit" variant="secondaire" onClick={() => setShowMedia(true)}>Choisir une image</Button>
      {value && <Button size="petit" variant="fantome" onClick={() => onChange(null)}>Retirer le visuel</Button>}
    </div>
    {showIcons && <div className="mt-3 grid gap-2">
      <Field label="Rechercher une icône" htmlFor={id}>
        <Input id={id} type="search" autoFocus value={query} onChange={event => setQuery(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter') event.preventDefault() }} />
      </Field>
      {results.length ? <div className="grid gap-4 py-2">
        {results.map(group => <section key={group.label} aria-label={group.label}>
          <p className="mb-2 text-sm font-bold text-mist">{group.label}</p>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,6.5rem),1fr))] auto-rows-[6rem] gap-2">
            {group.items.map(({ id: icon, label, Icon }) => <li key={icon} className="min-w-0">
              <Button size="petit" variant={value?.icon === icon ? 'primaire' : 'blanc'} aria-pressed={value?.icon === icon}
                className="h-full w-full flex-col break-words px-1 text-center leading-tight [overflow-wrap:anywhere]"
                onClick={() => onChange({ icon })}>
                <Icon aria-hidden="true" className="h-6 w-6 shrink-0" />{label}
              </Button>
            </li>)}
          </ul>
        </section>)}
        <Button size="petit" variant="secondaire" className="justify-self-start" onClick={() => {
          setShowIcons(false)
          iconButton.current?.focus()
        }}>Fermer les icônes</Button>
      </div> : <p role="status">Aucune icône trouvée.</p>}
    </div>}
    <MediaPicker open={showMedia} onClose={() => setShowMedia(false)} selectionActive={value?.mediaId}
      titre="Choisir le visuel de la catégorie" onChoose={media => onChange({ mediaId: media.id })} />
  </fieldset>
}
