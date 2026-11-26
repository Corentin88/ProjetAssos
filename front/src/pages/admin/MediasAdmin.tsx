import { useEffect, useRef, useState } from 'react'
import { FolderPlus, Import, Route } from 'lucide-react'
import type { FormEvent } from 'react'
import type { LibraryDetails, LibraryItem } from '../../types'
import { AdminPageHead } from '../../components/layout/AdminLayout'
import { FolderOptions, folderPath, MediaLibrary, useMediaLibrary } from '../../components/admin/MediaLibrary'
import { ContentImage } from '../../components/content/ContentImage'
import { Alert } from '../../components/ui/feedback'
import { Button, Field, Input, Select, Textarea } from '../../components/ui/form'
import { Modal } from '../../components/ui/overlay'
import { ApiError, authErrorMessage, protectedRequest } from '../../lib/auth'
import { useResource } from '../../lib/community'
import { removeMedia, replaceMedia, saveMediaMetadata, uploadMedia } from '../../lib/content'
import { formatDate, formatTaille } from '../../lib/format'
import { useToast } from '../../hooks/useToast'

type Action = 'import' | 'create-folder' | 'rename-folder' | 'delete-folder' | 'move' | 'edit' | 'replace' | 'delete'
const titles: Record<Action, string> = {
  import: 'Importer des médias',
  'create-folder': 'Créer un dossier',
  'rename-folder': 'Renommer le dossier',
  'delete-folder': 'Supprimer le dossier',
  move: 'Déplacer les médias',
  edit: 'Modifier les métadonnées',
  replace: 'Remplacer le fichier image',
  delete: 'Supprimer le média',
}

const libraryUrl = '/admin/content'
const imageFormats = 'image/jpeg,image/png,image/webp'
const folderName = 'Non classés'

export function MediasAdmin() {
  const library = useMediaLibrary()
  const { results, folders, current } = library
  const { toast } = useToast()
  const [activeId, setActiveId] = useState<string>()
  const [selected, setSelected] = useState(new Set<string>())
  const [operation, setOperation] = useState<{ action: Action; ids?: string[] }>()
  const details = useResource<LibraryDetails>(activeId ? `${libraryUrl}/media/${activeId}` : undefined, true)
  const heading = useRef<HTMLHeadingElement>(null)

  function openItem(item: LibraryItem) {
    setActiveId(item.id)
    if (activeId === item.id) heading.current?.focus()
  }
  useEffect(() => {
    if (activeId) heading.current?.focus()
  }, [activeId])

  function toggle(id: string) {
    setSelected(previous => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else if (next.size < 1000) next.add(id)
      return next
    })
  }

  async function afterWrite(action: Action, ids: string[] = []) {
    if (action === 'delete') {
      setActiveId(undefined)
      setSelected(previous => new Set([...previous].filter(id => id !== activeId)))
    }
    if (action === 'move') setSelected(previous => new Set([...previous].filter(id => !ids.includes(id))))
    if (action === 'delete-folder') library.setFolder(current?.parentId ?? 'unfiled')
    await Promise.all([
      results.refresh(),
      action.endsWith('folder') ? folders.refresh() : undefined,
      action !== 'delete' ? details.refresh() : undefined,
    ])
    setOperation(undefined)
    toast({
      import: 'Import terminé.',
      'create-folder': 'Dossier créé.',
      'rename-folder': 'Dossier renommé.',
      'delete-folder': 'Dossier supprimé.',
      move: 'Classement mis à jour.',
      edit: 'Métadonnées enregistrées.',
      replace: 'Image remplacée.',
      delete: 'Média supprimé.',
    }[action])
  }

  const item = details.data
  const usage = item?.usage
  const used = Boolean(usage && (usage.articles.length || usage.avatars || usage.association || usage.trails))

  return <>
    <AdminPageHead titre="Médiathèque" description="Images et fichiers GPX réutilisables.">
      <Button onClick={() => setOperation({ action: 'import' })}><Import aria-hidden="true" className="h-5 w-5" /> Importer</Button>
    </AdminPageHead>
    <div className="mx-auto grid max-w-6xl gap-5 px-4 pb-8 md:px-8">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondaire" onClick={() => setOperation({ action: 'create-folder' })}>
          <FolderPlus aria-hidden="true" className="h-5 w-5" /> {current ? 'Nouveau sous-dossier' : 'Nouveau dossier'}
        </Button>
        {current && <>
          <Button variant="secondaire" onClick={() => setOperation({ action: 'rename-folder' })}>Renommer le dossier</Button>
          <Button variant="blanc" onClick={() => setOperation({ action: 'delete-folder' })}>Supprimer le dossier</Button>
        </>}
      </div>
      {selected.size > 0 && <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white p-3">
        <p role="status">{selected.size} média{selected.size > 1 ? 's sélectionnés' : ' sélectionné'}</p>
        {selected.size === 1000 && <p>Limite de 1 000 médias par déplacement atteinte.</p>}
        <Button variant="secondaire" onClick={() => setOperation({ action: 'move', ids: [...selected] })}>Déplacer la sélection</Button>
        <Button variant="blanc" onClick={() => setSelected(new Set())}>Annuler la sélection</Button>
      </div>}
      {activeId && <section aria-labelledby="media-details" className="min-w-0 rounded-2xl border border-line bg-white p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 id="media-details" ref={heading} tabIndex={-1} className="text-xl text-forest">Détails du média</h2>
          <Button variant="blanc" onClick={() => setActiveId(undefined)}>Fermer les détails</Button>
        </div>
        {details.error ? <Alert kind="erreur" title="Détails indisponibles">
          <p>{details.error}</p><Button variant="secondaire" onClick={() => void details.refresh()}>Réessayer</Button>
        </Alert> : !item ? <p role="status">Chargement des détails…</p> : <div className="grid min-w-0 gap-5 sm:grid-cols-2">
          {item.type === 'IMAGE'
            ? <ContentImage src={item.file} alt={item.alt} className="max-h-64 w-full rounded-xl bg-sand object-contain" />
            : <div className="grid min-h-24 place-items-center rounded-xl bg-sand">
                <Route aria-hidden="true" className="h-12 w-12 text-forest" />
              </div>}
          <div className="min-w-0">
            <h3 className="break-all font-bold">{item.nom}</h3>
            <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
              <dt>Type</dt><dd>{item.type === 'IMAGE' ? `Image · ${item.format}` : 'Parcours GPX'}</dd>
              <dt>Taille</dt><dd>{formatTaille(item.tailleKo)}</dd>
              <dt>Ajout</dt><dd>{formatDate(item.createdAt)}</dd>
              <dt>Dossier</dt><dd className="break-all">{item.folderId ? folderPath(library.byId, item.folderId).map(folder => folder.name).join(' / ') || 'Dossier indisponible' : folderName}</dd>
              {item.type === 'IMAGE' && item.largeur > 0 && item.hauteur > 0 && <>
                <dt>Dimensions</dt><dd>{item.largeur} × {item.hauteur} px</dd>
              </>}
              {item.type === 'IMAGE' && item.alt && <><dt>Texte alternatif</dt><dd className="break-words">{item.alt}</dd></>}
              <dt>Utilisation</dt><dd className="break-words">{!used ? 'Aucune référence détectée' : [
                item.usage.articles.length ? `Articles : ${item.usage.articles.join(', ')}` : '',
                item.usage.association ? 'Page L’association' : '',
                item.usage.avatars ? `${item.usage.avatars} avatar(s)` : '',
                item.usage.trails ? `${item.usage.trails} référence(s) de randonnée` : '',
              ].filter(Boolean).join(' · ')}</dd>
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondaire" size="petit" onClick={() => setOperation({ action: 'edit' })}>Modifier</Button>
              <Button variant="secondaire" size="petit" onClick={() => setOperation({ action: 'move', ids: [item.id] })}>Déplacer</Button>
              {item.type === 'IMAGE' && <Button variant="secondaire" size="petit" onClick={() => setOperation({ action: 'replace' })}>Remplacer le fichier</Button>}
              <Button variant="danger" size="petit" disabled={used} onClick={() => setOperation({ action: 'delete' })}>Supprimer</Button>
            </div>
            {used && <p className="mt-2 text-sm text-mist">Ce média est utilisé. Retirez ses références avant de le supprimer.</p>}
          </div>
        </div>}
      </section>}
      <MediaLibrary library={library} activeId={activeId} selected={selected} onOpen={openItem} onToggle={toggle} />
    </div>
    {operation && <MediaAction operation={operation} library={library} item={item}
      onDone={afterWrite} onClose={() => setOperation(undefined)} />}
  </>
}

type ImportEntry = { file: File; name: string; alt: string; gpx: boolean; done?: boolean; error?: string }

function ImportPreview({ file }: { file: File }) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    const nextUrl = URL.createObjectURL(file)
    setUrl(nextUrl)
    return () => URL.revokeObjectURL(nextUrl)
  }, [file])
  return <img src={url} alt="" loading="lazy" className="h-20 w-28 rounded-lg bg-sand object-contain" />
}

function MediaAction({ operation, library, item, onClose, onDone }: {
  operation: { action: Action; ids?: string[] }
  library: ReturnType<typeof useMediaLibrary>
  item?: LibraryDetails
  onClose: () => void
  onDone: (action: Action, ids?: string[]) => Promise<void>
}) {
  const { action, ids } = operation
  const [folder] = useState(library.current)
  const [name, setName] = useState((action === 'edit' ? item?.nom : action === 'rename-folder' ? folder?.name : '') ?? '')
  const [alt, setAlt] = useState(item?.type === 'IMAGE' ? item.alt : '')
  const [destination, setDestination] = useState(item?.folderId && ids?.length === 1 ? item.folderId : '')
  const [file, setFile] = useState<File>()
  const [imports, setImports] = useState<ImportEntry[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const destructive = action === 'delete' || action === 'delete-folder'

  async function uploadEntries() {
    const failed = imports.find(entry => !entry.done && !entry.gpx && !entry.alt.trim())
    if (failed) {
      setError(`Renseignez le texte alternatif de « ${failed.file.name} ».`)
      return false
    }
    let failures = 0
    for (const [index, entry] of imports.entries()) {
      if (entry.done) continue
      try {
        if (entry.gpx) {
          const form = new FormData()
          form.set('file', entry.file)
          await protectedRequest(`${libraryUrl}/gpx${folder ? `?folderId=${folder.id}` : ''}`, 'POST', form)
        } else {
          await uploadMedia(entry.file, entry.name.trim() || entry.file.name, entry.alt.trim(), folder?.id)
        }
        setImports(entries => entries.map((value, i) => i === index ? { ...value, done: true, error: undefined } : value))
      } catch (reason) {
        failures += 1
        setImports(entries => entries.map((value, i) => i === index ? { ...value, error: authErrorMessage(reason) } : value))
      }
    }
    if (failures) {
      setError(`${failures} fichier(s) en échec. Corrigez les erreurs puis relancez l’import.`)
      await library.results.refresh()
    }
    return failures === 0
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      switch (action) {
        case 'import':
          if (!await uploadEntries()) return
          break
        case 'create-folder':
          await protectedRequest(`${libraryUrl}/media-folders`, 'POST', { nom: name.trim(), parentId: folder?.id })
          break
        case 'rename-folder':
          await protectedRequest(`${libraryUrl}/media-folders/${folder?.id}`, 'PATCH', { nom: name.trim() })
          break
        case 'delete-folder':
          await protectedRequest(`${libraryUrl}/media-folders/${folder?.id}`, 'DELETE', { confirmed: true })
          break
        case 'move':
          await protectedRequest(`${libraryUrl}/media/move`, 'PATCH', { ids, folderId: destination || null })
          break
        case 'edit':
          if (item) await saveMediaMetadata(item.id, name.trim(), alt.trim())
          break
        case 'replace':
          if (item && file) await replaceMedia(item.id, file)
          break
        case 'delete':
          if (item) await removeMedia(item.id)
          break
      }
      await onDone(action, ids)
    } catch (reason) {
      setError(reason instanceof ApiError && reason.status === 409 && action === 'delete'
        ? 'Ce média est désormais utilisé. Retirez ses références avant de réessayer.'
        : authErrorMessage(reason))
    } finally {
      setBusy(false)
    }
  }

  return <Modal open onClose={() => { if (!busy) onClose() }} title={titles[action]} preventClose={busy}>
    <form onSubmit={submit}>
      {error && <Alert kind="erreur" title="Action incomplète">{error}</Alert>}
      <fieldset disabled={busy} aria-busy={busy} className="mt-3 flex min-w-0 flex-col gap-4">
        <legend className="sr-only">{titles[action]}</legend>
        {action === 'import' && <>
          <Field label="Fichiers à importer" htmlFor="media-import" hint="JPEG, PNG et WebP, 8 Mio maximum par image. GPX, 5 Mio maximum.">
            <Input id="media-import" type="file" multiple accept={`${imageFormats},.gpx,application/gpx+xml`}
              onChange={event => setImports(Array.from(event.target.files ?? [], file => ({
                file, name: file.name, alt: '', gpx: /\.gpx$/i.test(file.name) || file.type === 'application/gpx+xml',
              })))} />
          </Field>
          <p className="break-words text-mist">Dossier de destination · {folder?.name ?? folderName}</p>
          {imports.map((entry, index) => <div key={index} className="grid min-w-0 gap-3 rounded-xl border border-line p-3">
            <p className="break-all font-bold">{entry.file.name}</p>
            {entry.done ? <p role="status">Importé</p> : !entry.gpx && <>
              <ImportPreview file={entry.file} />
              <Field label="Nom affiché" htmlFor={`import-name-${index}`}>
                <Input id={`import-name-${index}`} maxLength={255} value={entry.name}
                  onChange={event => setImports(entries => entries.map((value, i) => i === index ? { ...value, name: event.target.value } : value))} />
              </Field>
              <Field label="Texte alternatif" htmlFor={`import-alt-${index}`} required>
                <Textarea id={`import-alt-${index}`} maxLength={1000} required rows={2} value={entry.alt}
                  onChange={event => setImports(entries => entries.map((value, i) => i === index ? { ...value, alt: event.target.value } : value))} />
              </Field>
            </>}
            {entry.error && <p role="alert" className="text-brique">{entry.error}</p>}
          </div>)}
        </>}
        {(action === 'edit' || action === 'create-folder' || action === 'rename-folder') && <Field
          label={action === 'edit' ? 'Nom du fichier' : 'Nom du dossier'} htmlFor="media-name" required>
          <Input id="media-name" required maxLength={255} value={name} onChange={event => setName(event.target.value)} />
        </Field>}
        {action === 'edit' && item?.type === 'IMAGE' && <Field label="Texte alternatif" htmlFor="media-alt" required>
          <Textarea id="media-alt" required maxLength={1000} rows={3} value={alt} onChange={event => setAlt(event.target.value)} />
        </Field>}
        {action === 'move' && <Field label="Dossier de destination" htmlFor="media-destination" hint={`${ids?.length ?? 0} média(s) à déplacer.`}>
          <Select id="media-destination" value={destination} onChange={event => setDestination(event.target.value)}>
            <option value="">{folderName}</option><FolderOptions library={library} />
          </Select>
        </Field>}
        {action === 'replace' && <>
          <p>Le nouveau fichier remplacera l’image dans tous les contenus qui l’utilisent. Ses références seront conservées.</p>
          <Field label="Nouveau fichier" htmlFor="media-replace" required hint="JPEG, PNG ou WebP. 8 Mio maximum.">
            <Input id="media-replace" required type="file" accept={imageFormats} onChange={event => setFile(event.target.files?.[0])} />
          </Field>
        </>}
        {action === 'delete-folder' && <p className="break-words">Les médias de « {folder?.name} » passeront dans « Non classés ». Ses sous-dossiers remonteront à la racine avec leur contenu.</p>}
        {action === 'delete' && <p className="break-words">Le fichier « {item?.nom} » sera effacé définitivement.</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="blanc" onClick={onClose}>Annuler</Button>
          <Button type="submit" variant={destructive ? 'danger' : 'primaire'}
            disabled={busy || (action === 'import' && !imports.some(entry => !entry.done)) || (action === 'replace' && !file)}>
            {busy ? action === 'import' ? 'Import en cours…' : 'Enregistrement…' : destructive ? 'Confirmer la suppression'
              : action === 'import' ? 'Importer' : action === 'move' ? 'Déplacer' : 'Enregistrer'}
          </Button>
        </div>
      </fieldset>
    </form>
  </Modal>
}
