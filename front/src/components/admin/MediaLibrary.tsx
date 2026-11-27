import { useEffect, useId, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Folder, Route } from 'lucide-react'
import type { LibraryItem, MediaFolder } from '../../types'
import { useResource } from '../../lib/community'
import { useDb } from '../../lib/db'
import { ContentImage } from '../content/ContentImage'
import { Alert, EmptyState } from '../ui/feedback'
import { Button, Field, Input, Select } from '../ui/form'

type MediaPage = { total: number; pageSize: number; items: LibraryItem[] }
type LibraryType = LibraryItem['type']

const root = 'unfiled'
const initialFilters = { folder: '', type: '', sort: 'date', page: 1, category: '', tag: '' }

export function useMediaLibrary(type?: LibraryType) {
  const [filters, setFilters] = useState(initialFilters)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const { folder, page, sort, category, tag, type: typeFilter } = filters
  const effectiveType = type ?? typeFilter
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(search.trim())
      setFilters(current => current.page === 1 ? current : { ...current, page: 1 })
    }, 250)
    return () => window.clearTimeout(timer)
  }, [search])
  const params = new URLSearchParams({ page: String(page), sort })
  if (query) params.set('q', query)
  if (folder) params.set('folder', folder)
  if (effectiveType) params.set('type', effectiveType)
  if (category) params.set('category', category)
  if (tag) params.set('tag', tag)
  const results = useResource<MediaPage>(`/admin/content/media?${params}`, true)
  const folders = useResource<MediaFolder[]>('/admin/content/media-folders', true)
  const byId = useMemo(() => new Map(folders.data?.map(item => [item.id, item])), [folders.data])
  const current = byId.get(folder)
  function setFolder(value: string) {
    setFilters(filters => ({ ...filters, folder: value, page: 1 }))
  }
  const pages = results.data ? Math.max(1, Math.ceil(results.data.total / results.data.pageSize)) : 1
  useEffect(() => {
    if (results.data && page > pages) setFilters(filters => ({ ...filters, page: pages }))
  }, [page, pages, results.data])
  return {
    results, folders, byId, current, folder, setFolder, search, setSearch,
    effectiveType, fixedType: type, sort, page, pages, category, tag,
    setCategory: (category: string) => setFilters(filters => ({ ...filters, category, page: 1 })),
    setTag: (tag: string) => setFilters(filters => ({ ...filters, tag, page: 1 })),
    setType: (value: string) => setFilters(filters => ({ ...filters, type: value, page: 1 })),
    setSort: (value: string) => setFilters(filters => ({ ...filters, sort: value, page: 1 })),
    setPage: (value: number) => setFilters(filters => ({ ...filters, page: value })),
    reset() { setSearch(''); setQuery(''); setFilters(initialFilters) },
  }
}

export function folderPath(byId: Map<string, MediaFolder>, id: string) {
  const path: MediaFolder[] = []
  const visited = new Set<string>()
  let folder = byId.get(id)
  while (folder && !visited.has(folder.id)) {
    path.push(folder)
    visited.add(folder.id)
    folder = folder.parentId ? byId.get(folder.parentId) : undefined
  }
  return path.reverse()
}

export function FolderOptions({ library }: { library: ReturnType<typeof useMediaLibrary> }) {
  const { byId } = library
  const folders = useMemo(() => [...byId.values()].map(folder => ({
    id: folder.id, label: folderPath(byId, folder.id).map(item => item.name).join(' / '),
  })).sort((a, b) => a.label.localeCompare(b.label, 'fr')), [byId])
  return <>{folders.map(folder => <option key={folder.id} value={folder.id}>{folder.label}</option>)}</>
}

export function MediaLibrary({ library, activeId, selected, onOpen, onToggle }: {
  library: ReturnType<typeof useMediaLibrary>
  activeId?: string
  selected?: Set<string>
  onOpen: (item: LibraryItem) => void
  onToggle?: (id: string) => void
}) {
  const id = useId()
  const { categories, tags } = useDb()
  const { current, folder, folders, results, setFolder } = library
  const children = folders.data?.filter(item => item.parentId === (current?.id ?? null))
  const path = current ? folderPath(library.byId, current.id) : []
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto]">
        <Field label="Rechercher" htmlFor={`${id}-search`}>
          <Input id={`${id}-search`} type="search" maxLength={255} placeholder="Nom, texte alternatif ou classement"
            value={library.search} onChange={event => library.setSearch(event.target.value)} />
        </Field>
        {!library.fixedType && <Field label="Type de média" htmlFor={`${id}-type`}>
          <Select id={`${id}-type`} value={library.effectiveType} onChange={event => library.setType(event.target.value)}>
            <option value="">Tous les types</option><option value="IMAGE">Images</option><option value="GPX">Fichiers GPX</option>
          </Select>
        </Field>}
        <Field label="Dossier" htmlFor={`${id}-dossier`}>
          <Select id={`${id}-dossier`} value={folder} onChange={event => setFolder(event.target.value)}>
            <option value="">Tous les médias</option><option value={root}>Non classés</option>
            <FolderOptions library={library} />
          </Select>
        </Field>
        <Field label="Trier par" htmlFor={`${id}-tri`}>
          <Select id={`${id}-tri`} value={library.sort} onChange={event => library.setSort(event.target.value)}>
            <option value="date">Date (récents)</option><option value="name">Nom (A–Z)</option><option value="size">Taille (décroissante)</option>
          </Select>
        </Field>
        <Button variant="secondaire" onClick={library.reset}>Réinitialiser</Button>
      </div>
      {(categories.length > 0 || tags.length > 0) && <div className="grid gap-3 sm:grid-cols-2">
        {categories.length > 0 && <Field label="Catégorie" htmlFor={`${id}-category`}>
          <Select id={`${id}-category`} value={library.category} onChange={event => library.setCategory(event.target.value)}>
            <option value="">Toutes les catégories</option>
            {categories.map(item => <option key={item.id} value={item.id}>{item.nom}</option>)}
          </Select>
        </Field>}
        {tags.length > 0 && <Field label="Tag" htmlFor={`${id}-tag`}>
          <Select id={`${id}-tag`} value={library.tag} onChange={event => library.setTag(event.target.value)}>
            <option value="">Tous les tags</option>
            {tags.map(item => <option key={item.id} value={item.id}>{item.nom}</option>)}
          </Select>
        </Field>}
      </div>}

      {folders.error && <Alert kind="erreur" title="Dossiers indisponibles">
        <p>{folders.error}</p><Button variant="secondaire" onClick={() => void folders.refresh()}>Réessayer</Button>
      </Alert>}
      {current && <nav aria-label="Fil d’Ariane des dossiers" className="flex flex-wrap items-center gap-2 text-sm">
        <Button variant="secondaire" size="petit" onClick={() => setFolder(current.parentId ?? '')}>
          <ChevronLeft aria-hidden="true" className="h-4 w-4" /> Dossier parent
        </Button>
        <button type="button" className="font-bold text-forest underline" onClick={() => setFolder('')}>Racine</button>
        {path.map(item => <span key={item.id} className="flex min-w-0 items-center gap-2">
          <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0" />
          {item.id === current.id
            ? <span aria-current="location" className="break-all">{item.name}</span>
            : <button type="button" className="break-all font-bold text-forest underline" onClick={() => setFolder(item.id)}>{item.name}</button>}
        </span>)}
      </nav>}
      {!!children?.length && <ul aria-label="Dossiers" className="flex flex-wrap gap-2">
        {children.map(item => <li key={item.id} className="max-w-full">
          <button type="button" className="flex max-w-full items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 font-bold text-forest hover:border-forest"
            onClick={() => setFolder(item.id)} title={item.name}>
            <Folder aria-hidden="true" className="h-5 w-5 shrink-0" /><span className="truncate">{item.name}</span>
          </button>
        </li>)}
      </ul>}

      {results.error ? <Alert kind="erreur" title="Médiathèque indisponible">
        <p>{results.error}</p><Button variant="secondaire" onClick={() => void results.refresh()}>Réessayer</Button>
      </Alert> : !results.data ? <p role="status">Chargement des médias…</p> : <>
        <p role="status" className="text-sm text-mist">{results.data.total} média{results.data.total > 1 ? 's' : ''}</p>
        {results.data.items.length ? <ul aria-label="Médias" className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,10rem),1fr))] gap-3">
          {results.data.items.map(item => <li key={item.id} className="relative min-w-0">
            <button type="button" aria-pressed={item.id === activeId} title={item.nom} onClick={() => onOpen(item)}
              className={`w-full overflow-hidden rounded-xl border bg-white p-2 text-left hover:border-forest ${item.id === activeId || selected?.has(item.id) ? 'border-forest ring-2 ring-forest' : 'border-line'}`}>
              <div className="grid aspect-[4/3] place-items-center overflow-hidden rounded-lg bg-sand">
                {item.type === 'IMAGE'
                  ? <ContentImage src={item.thumbnail} loading="lazy" alt="" className="h-full w-full min-h-0 object-contain" />
                  : <Route aria-hidden="true" className="h-10 w-10 text-forest" />}
              </div>
              <span className="mt-2 block truncate font-bold">{item.nom}</span>
              <span className="text-sm text-mist">{item.type === 'IMAGE' ? `Image · ${item.format}` : 'Parcours GPX'}</span>
            </button>
            {onToggle && <input type="checkbox" checked={Boolean(selected?.has(item.id))}
              disabled={selected?.size === 1000 && !selected.has(item.id)}
              aria-label={`Sélectionner ${item.nom}`} onChange={() => onToggle(item.id)}
              className="absolute left-3 top-3 h-6 w-6 rounded border-line accent-forest" />}
          </li>)}
        </ul> : <EmptyState title="Aucun média trouvé" description="Modifiez vos filtres ou ouvrez un autre dossier." />}
        {library.pages > 1 && <nav aria-label="Pagination des médias" className="flex flex-wrap items-center justify-center gap-3">
          <Button variant="secondaire" size="petit" disabled={library.page <= 1} onClick={() => library.setPage(library.page - 1)}>Précédente</Button>
          <span>Page {library.page} sur {library.pages}</span>
          <Button variant="secondaire" size="petit" disabled={library.page >= library.pages} onClick={() => library.setPage(library.page + 1)}>Suivante</Button>
        </nav>}
      </>}
    </div>
  )
}
