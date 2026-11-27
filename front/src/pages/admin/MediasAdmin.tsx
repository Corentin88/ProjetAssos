import { useEffect, useRef, useState } from 'react'
import { FileText, FolderPlus, Import, Route } from 'lucide-react'
import type { FormEvent } from 'react'
import type { LibraryDetails, LibraryItem } from '../../types'
import { AdminPageHead } from '../../components/layout/AdminLayout'
import { FolderOptions, folderPath, MediaLibrary, useMediaLibrary } from '../../components/admin/MediaLibrary'
import { MediaImport, imageFormats } from '../../components/admin/MediaImport'
import { ImageAlternativeField } from '../../components/admin/ImageAlternativeField'
import { QuickClassification } from '../../components/admin/QuickClassification'
import { ContentImage } from '../../components/content/ContentImage'
import { PdfActions } from '../../components/content/PdfActions'
import { Alert } from '../../components/ui/feedback'
import { Button, Field, Input, Select } from '../../components/ui/form'
import { Modal } from '../../components/ui/overlay'
import { ApiError, authErrorMessage, protectedRequest } from '../../lib/auth'
import { useResource } from '../../lib/community'
import { createMediaFolder, removeMedia, replaceMedia, saveMediaClassification, saveMediaMetadata } from '../../lib/content'
import { useDb } from '../../lib/db'
import { formatDate, formatTaille } from '../../lib/format'
import { useToast } from '../../hooks/useToast'
import { imageAlternative } from '../../lib/imageAlternative'

type Action = 'import' | 'create-folder' | 'rename-folder' | 'delete-folder' | 'move' | 'edit' | 'replace' | 'delete' | 'classify'
const titles: Record<Action, string> = {
  import: 'Importer des médias',
  'create-folder': 'Créer un dossier',
  'rename-folder': 'Renommer le dossier',
  'delete-folder': 'Supprimer le dossier',
  move: 'Déplacer les médias',
  edit: 'Modifier les métadonnées',
  replace: 'Remplacer le fichier image',
  delete: 'Supprimer le média',
  classify: 'Catégories et tags du média',
}

const libraryUrl = '/admin/content'
const folderName = 'Non classés'

export function MediasAdmin() {
  const { categories, tags } = useDb()
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
      classify: 'Catégories et tags enregistrés.',
    }[action])
  }

  const item = details.data
  const usage = item?.usage
  const used = Boolean(usage && (usage.articles.length || usage.avatars || usage.association || usage.trails || usage.categoryVisuals?.length))

  return <>
    <AdminPageHead titre="Médiathèque" description="Images, documents PDF et fichiers GPX réutilisables.">
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
                {item.type === 'PDF' ? <FileText aria-hidden="true" className="h-12 w-12 text-forest" /> : <Route aria-hidden="true" className="h-12 w-12 text-forest" />}
              </div>}
          <div className="min-w-0">
            <h3 className="break-all font-bold">{item.nom}</h3>
            <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
              <dt>Type</dt><dd>{item.type === 'IMAGE' ? `Image · ${item.format}` : item.type === 'PDF' ? 'Document PDF' : 'Parcours GPX'}</dd>
              {item.type === 'PDF' && item.originalName !== item.nom && <><dt>Nom original</dt><dd className="break-words">{item.originalName}</dd></>}
              <dt>Taille</dt><dd>{formatTaille(item.tailleKo)}</dd>
              <dt>Ajout</dt><dd>{formatDate(item.createdAt)}</dd>
              <dt>Dossier</dt><dd className="break-all">{item.folderId ? folderPath(library.byId, item.folderId).map(folder => folder.name).join(' / ') || 'Dossier indisponible' : folderName}</dd>
              <dt>Catégories</dt><dd className="break-words">{categories.filter(category => item.categorieIds.includes(category.id)).map(category => category.nom).join(', ') || '—'}</dd>
              <dt>Tags</dt><dd className="break-words">{tags.filter(tag => item.tagIds.includes(tag.id)).map(tag => tag.nom).join(', ') || '—'}</dd>
              {item.type === 'IMAGE' && item.largeur > 0 && item.hauteur > 0 && <>
                <dt>Dimensions</dt><dd>{item.largeur} × {item.hauteur} px</dd>
              </>}
              {item.type === 'IMAGE' && (item.alt || item.decorative) && <><dt>Texte alternatif</dt><dd className="break-words">{item.decorative ? 'Image décorative' : item.alt}</dd></>}
              <dt>Utilisation</dt><dd className="break-words">{!used ? 'Aucune référence détectée' : [
                item.usage.articles.length ? `Articles : ${item.usage.articles.join(', ')}` : '',
                item.usage.categoryVisuals?.length ? `Visuels de catégorie : ${item.usage.categoryVisuals.join(', ')}` : '',
                item.usage.association ? 'Page L’association' : '',
                item.usage.avatars ? `${item.usage.avatars} avatar(s)` : '',
                item.usage.trails ? `${item.usage.trails} référence(s) de randonnée` : '',
              ].filter(Boolean).join(' · ')}</dd>
            </dl>
            {item.type === 'PDF' && <div className="mt-4"><PdfActions title={item.nom} viewPath={`${libraryUrl}/media/${item.id}/pdf`} secure /></div>}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondaire" size="petit" onClick={() => setOperation({ action: 'edit' })}>Modifier</Button>
              <Button variant="secondaire" size="petit" onClick={() => setOperation({ action: 'classify' })}>Catégories et tags</Button>
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
    {operation?.action === 'import' ? <MediaImport library={library} type="ALL"
      onClose={() => setOperation(undefined)} onFinished={complete => complete ? afterWrite('import') : results.refresh()} />
      : operation && <MediaAction operation={operation} library={library} item={item}
        onDone={afterWrite} onClose={() => setOperation(undefined)} />}
  </>
}

function MediaAction({ operation, library, item, onClose, onDone }: {
  operation: { action: Action; ids?: string[] }
  library: ReturnType<typeof useMediaLibrary>
  item?: LibraryDetails
  onClose: () => void
  onDone: (action: Action, ids?: string[]) => Promise<void>
}) {
  const { action, ids } = operation
  const { categories, tags } = useDb()
  const [categorieIds, setCategorieIds] = useState(item?.categorieIds ?? [])
  const [tagIds, setTagIds] = useState(item?.tagIds ?? [])
  const [folder] = useState(library.current)
  const [name, setName] = useState((action === 'edit' ? item?.nom : action === 'rename-folder' ? folder?.name : '') ?? '')
  const [alt, setAlt] = useState(item?.type === 'IMAGE' ? imageAlternative(item).alt : '')
  const [decorative, setDecorative] = useState(item?.type === 'IMAGE' && item.decorative === true)
  const [destination, setDestination] = useState(item?.folderId && ids?.length === 1 ? item.folderId : '')
  const [file, setFile] = useState<File>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const destructive = action === 'delete' || action === 'delete-folder'

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      switch (action) {
        case 'create-folder':
          await createMediaFolder(name.trim(), folder?.id)
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
          if (item) await saveMediaMetadata(item.id, name.trim(), alt.trim(), decorative)
          break
        case 'classify':
          if (item) await saveMediaClassification(item.id, categorieIds, tagIds)
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
        {(action === 'edit' || action === 'create-folder' || action === 'rename-folder') && <Field
          label={action === 'edit' ? 'Nom du fichier' : 'Nom du dossier'} htmlFor="media-name" required>
          <Input id="media-name" required maxLength={255} value={name} onChange={event => setName(event.target.value)} />
        </Field>}
        {action === 'edit' && item?.type === 'IMAGE' && <ImageAlternativeField id="media-alt" alt={alt} decorative={decorative}
          onAltChange={setAlt} onDecorativeChange={setDecorative} multiline />}
        {action === 'classify' && ([
          { kind: 'categories', label: 'Catégories', choices: categories, ids: categorieIds, update: setCategorieIds },
          { kind: 'tags', label: 'Tags', choices: tags, ids: tagIds, update: setTagIds },
        ] as const).map(group => <fieldset key={group.kind} className="min-w-0 rounded-xl border border-line p-3">
          <legend className="px-1 font-bold">{group.label}</legend>
          <div className="grid max-h-40 gap-2 overflow-auto">
            {group.choices.map(choice => <label key={choice.id} className="flex items-center gap-2 break-all">
              <input type="checkbox" className="h-5 w-5 shrink-0 accent-forest" checked={group.ids.includes(choice.id)}
                onChange={event => group.update(ids => event.target.checked ? [...ids, choice.id] : ids.filter(id => id !== choice.id))} />
              {choice.nom}
            </label>)}
          </div>
          <QuickClassification kind={group.kind} onCreated={id => group.update(ids => [...ids, id])} />
        </fieldset>)}
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
            disabled={busy || (action === 'replace' && !file)}>
            {busy ? 'Enregistrement…' : destructive ? 'Confirmer la suppression'
              : action === 'move' ? 'Déplacer' : 'Enregistrer'}
          </Button>
        </div>
      </fieldset>
    </form>
  </Modal>
}
