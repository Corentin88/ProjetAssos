import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { FolderPlus, Upload } from 'lucide-react'
import type { LibraryItem, MediaFolder } from '../../types'
import { authErrorMessage, protectedRequest } from '../../lib/auth'
import { createMediaFolder, uploadMedia, uploadPdf } from '../../lib/content'
import { proposeImageAlternative } from '../../lib/imageAlternative'
import { Alert } from '../ui/feedback'
import { Button, Field, Input, Select } from '../ui/form'
import { Modal } from '../ui/overlay'
import { FolderOptions } from './MediaLibrary'
import type { useMediaLibrary } from './MediaLibrary'
import { ImageAlternativeField } from './ImageAlternativeField'

export const imageFormats = 'image/jpeg,image/png,image/webp'
const mebibyte = 1024 * 1024
const fileFormats = { IMAGE: imageFormats, GPX: '.gpx,application/gpx+xml', PDF: '.pdf,application/pdf' }

type ImportEntry = {
  key: string
  file: File
  name: string
  alt: string
  type: LibraryItem['type']
  decorative?: boolean
  done?: boolean
  error?: string
  validationError?: string
}

function prepareImport(file: File, allowed: LibraryItem['type'][], pdfLimit: number): ImportEntry {
  const gpx = /\.gpx$/i.test(file.name) || file.type === 'application/gpx+xml'
  const pdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf'
  const image = /\.(?:jpe?g|png|webp)$/i.test(file.name) || imageFormats.split(',').includes(file.type)
  const type = gpx ? 'GPX' : pdf ? 'PDF' : 'IMAGE'
  const limit = gpx ? 5 : pdf ? pdfLimit : 8
  let validationError: string | undefined
  if ((!gpx && !pdf && !image) || !allowed.includes(type)) validationError = 'Format de fichier non autorisé.'
  else if (file.size === 0) validationError = 'Ce fichier est vide.'
  else if (file.size > limit * mebibyte) validationError = `Ce fichier dépasse ${limit} Mio.`
  return {
    key: JSON.stringify([file.name, file.size, file.lastModified]), file,
    name: file.name, alt: type === 'IMAGE' ? proposeImageAlternative(file.name) : '', type, validationError,
  }
}

function ImportPreview({ file }: { file: File }) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    const nextUrl = URL.createObjectURL(file)
    setUrl(nextUrl)
    return () => URL.revokeObjectURL(nextUrl)
  }, [file])
  return <img src={url} alt="" className="h-20 w-28 rounded-lg bg-sand object-contain" />
}

export function MediaImport({ library, type = 'IMAGE', maxFiles, onClose, onUploaded, onFinished }: {
  library: Pick<ReturnType<typeof useMediaLibrary>, 'current' | 'byId' | 'folders' | 'results'>
  type?: LibraryItem['type'] | 'ALL' | 'VISUAL'
  maxFiles?: number
  onClose: () => void
  onUploaded?: (media: LibraryItem) => void
  onFinished: (complete: boolean) => Promise<unknown>
}) {
  const id = useId()
  const fileInput = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)
  const active = useRef(false)
  const [imports, setImports] = useState<ImportEntry[]>([])
  const [dragging, setDragging] = useState(false)
  const [upload, setUpload] = useState<{ key: string; progress: string }>()
  const [error, setError] = useState('')
  const [destination, setDestination] = useState(library.current?.id ?? '')
  const [openFolderForm, setOpenFolderForm] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [parent, setParent] = useState(library.current?.id ?? '')
  const [creating, setCreating] = useState(false)
  const [folderError, setFolderError] = useState('')
  const [createdFolders, setCreatedFolders] = useState<MediaFolder[]>([])
  const byId = new Map([...createdFolders.map(folder => [folder.id, folder] as const), ...library.byId])
  const busy = Boolean(upload) || creating
  const destinationLocked = imports.some(entry => entry.done)
  const pending = imports.filter(entry => !entry.done)
  const allowed: LibraryItem['type'][] = type === 'ALL' ? ['IMAGE', 'GPX', 'PDF'] : type === 'VISUAL' ? ['IMAGE', 'PDF'] : [type]
  const pdfLimit = (library.results.data?.pdfMaxBytes ?? 20 * mebibyte) / mebibyte

  useEffect(() => {
    // Un dépôt hors de la zone ne doit pas ouvrir le fichier dans l’onglet courant.
    function preventFileNavigation(event: DragEvent) {
      if (event.dataTransfer?.types.includes('Files')) event.preventDefault()
    }
    window.addEventListener('dragover', preventFileNavigation)
    window.addEventListener('drop', preventFileNavigation)
    return () => {
      window.removeEventListener('dragover', preventFileNavigation)
      window.removeEventListener('drop', preventFileNavigation)
    }
  }, [])

  function addFiles(files: FileList) {
    if (active.current) return
    const keys = new Set(imports.map(entry => entry.key))
    const added = Array.from(files, file => prepareImport(file, allowed, pdfLimit)).filter(entry => {
      if (keys.has(entry.key)) return false
      keys.add(entry.key)
      return true
    })
    if (!added.length) return
    const count = [...pending, ...added].filter(entry => !entry.validationError).length
    if (maxFiles !== undefined && count > maxFiles) {
      setError(`Vous pouvez ajouter au maximum ${maxFiles} image(s) à cette sélection. Retirez un fichier avant d’en ajouter un autre.`)
      return
    }
    setError('')
    setImports(current => {
      const existing = new Set(current.map(entry => entry.key))
      const next = [...current, ...added.filter(entry => !existing.has(entry.key))]
      return maxFiles !== undefined && next.filter(entry => !entry.done && !entry.validationError).length > maxFiles
        ? current : next
    })
  }

  function updateEntry(key: string, patch: Partial<ImportEntry>) {
    setImports(entries => entries.map(entry => entry.key === key ? { ...entry, ...patch } : entry))
  }

  async function createFolder() {
    if (active.current || !folderName.trim()) return
    active.current = true
    setCreating(true)
    setFolderError('')
    try {
      const folder = await createMediaFolder(folderName.trim(), parent || undefined)
      setCreatedFolders(current => [...current, folder])
      setDestination(folder.id)
      setOpenFolderForm(false)
      setFolderName('')
      await library.folders.refresh()
    } catch (reason) {
      setFolderError(authErrorMessage(reason))
    } finally {
      active.current = false
      setCreating(false)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    event.stopPropagation()
    if (active.current || !pending.length || pending.some(entry => entry.validationError)) return
    if (pending.some(entry => entry.type === 'IMAGE' && !entry.decorative && !entry.alt.trim())) {
      setError('Renseignez le texte alternatif de chaque image informative.')
      return
    }
    active.current = true
    setError('')
    let failures = 0
    try {
      for (const [index, entry] of pending.entries()) {
        setUpload({ key: entry.key, progress: `Import du fichier ${index + 1} sur ${pending.length}…` })
        updateEntry(entry.key, { error: undefined })
        try {
          if (entry.type === 'GPX') {
            const form = new FormData()
            form.set('file', entry.file)
            await protectedRequest(`/admin/content/gpx${destination ? `?folderId=${destination}` : ''}`, 'POST', form)
          } else if (entry.type === 'PDF') {
            const pdf = await uploadPdf(entry.file, entry.name.trim() || entry.file.name, destination || undefined)
            onUploaded?.(pdf)
          } else {
            const image = await uploadMedia(entry.file, entry.name.trim() || entry.file.name, entry.alt.trim(), destination || undefined, entry.decorative)
            onUploaded?.(image)
          }
          updateEntry(entry.key, { done: true })
        } catch (reason) {
          failures += 1
          updateEntry(entry.key, { error: authErrorMessage(reason) })
        }
      }
      if (failures) setError(`${failures} fichier(s) en échec. Corrigez les erreurs puis relancez l’import.`)
      await onFinished(failures === 0)
    } catch (reason) {
      setError(authErrorMessage(reason))
    } finally {
      active.current = false
      setUpload(undefined)
    }
  }

  return <Modal open title="Importer des fichiers" preventClose={busy} onClose={() => { if (!active.current) onClose() }}>
    <form onSubmit={submit}>
      {error && <Alert kind="erreur" title="Import incomplet">{error}</Alert>}
      {upload && <p className="mt-2 font-bold" role="status">{upload.progress}</p>}
      <fieldset disabled={busy} aria-busy={busy} className="mt-3 grid min-w-0 gap-4">
        <legend className="sr-only">Import de médias</legend>
        <div className={`flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-center ${dragging ? 'border-forest bg-leaf-pale' : 'border-line bg-sand'}`}
          onDragEnter={event => {
            if (busy || !event.dataTransfer.types.includes('Files')) return
            event.preventDefault()
            dragDepth.current += 1
            setDragging(true)
          }} onDragOver={event => {
            if (!event.dataTransfer.types.includes('Files')) return
            event.preventDefault()
            event.dataTransfer.dropEffect = busy ? 'none' : 'copy'
          }} onDragLeave={() => {
            dragDepth.current = Math.max(0, dragDepth.current - 1)
            if (!dragDepth.current) setDragging(false)
          }} onDrop={event => {
            if (!event.dataTransfer.types.includes('Files')) return
            event.preventDefault()
            dragDepth.current = 0
            setDragging(false)
            addFiles(event.dataTransfer.files)
          }}>
          <Upload className="h-7 w-7 text-forest" aria-hidden="true" />
          <p className="font-bold">{type === 'IMAGE' ? 'Glissez vos images ici' : type === 'PDF' ? 'Glissez vos PDF ici' : type === 'VISUAL' ? 'Glissez vos images ou PDF ici' : 'Glissez vos fichiers ici'}</p>
          <p id={`${id}-formats`} className="text-sm text-mist">
            {allowed.includes('IMAGE') && 'JPEG, PNG et WebP, 8 Mio maximum par image. '}
            {allowed.includes('GPX') && 'GPX, 5 Mio maximum. '}
            {allowed.includes('PDF') && `PDF, ${pdfLimit} Mio maximum.`}
          </p>
          <Input ref={fileInput} type="file" hidden multiple={maxFiles !== 1}
            accept={allowed.map(value => fileFormats[value]).join(',')}
            onChange={event => {
              if (event.target.files) addFiles(event.target.files)
              event.target.value = ''
            }} />
          <Button variant="secondaire" aria-describedby={`${id}-formats`} onClick={() => fileInput.current?.click()}>Choisir des fichiers</Button>
        </div>

        <Field label="Dossier de destination" htmlFor={`${id}-destination`}>
          <Select id={`${id}-destination`} value={destination} disabled={destinationLocked} onChange={event => setDestination(event.target.value)}>
            <option value="">Non classés</option><FolderOptions library={{ byId }} />
          </Select>
        </Field>
        {library.folders.error && <p role="alert" className="text-brique">Dossiers indisponibles. <button type="button" className="underline" onClick={() => void library.folders.refresh()}>Réessayer</button></p>}
        {!destinationLocked && <Button variant="secondaire" className="justify-self-start" aria-expanded={openFolderForm} onClick={() => {
          setParent(destination)
          setFolderError('')
          setOpenFolderForm(open => !open)
        }}><FolderPlus aria-hidden="true" className="h-5 w-5" /> Créer un dossier</Button>}
        {openFolderForm && !destinationLocked && <div className="grid gap-3 rounded-xl border border-line p-3">
          <Field label="Nom du nouveau dossier" htmlFor={`${id}-folder-name`}>
            <Input id={`${id}-folder-name`} value={folderName} maxLength={255} onChange={event => setFolderName(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') { event.preventDefault(); void createFolder() }
              }} />
          </Field>
          <Field label="Dossier parent" htmlFor={`${id}-parent`}>
            <Select id={`${id}-parent`} value={parent} onChange={event => setParent(event.target.value)}>
              <option value="">À la racine</option><FolderOptions library={{ byId }} />
            </Select>
          </Field>
          {folderError && <Alert kind="erreur" title="Dossier non créé">{folderError}</Alert>}
          <Button variant="secondaire" className="justify-self-start" disabled={!folderName.trim()} onClick={() => void createFolder()}>Enregistrer le dossier</Button>
        </div>}

        {imports.map((entry, index) => <div key={entry.key} className="grid min-w-0 gap-3 rounded-xl border border-line p-3">
          <p className="break-all font-bold">{entry.file.name}</p>
          {entry.done ? <p role="status">Importé</p> : entry.type !== 'GPX' && !entry.validationError && <>
            {entry.type === 'IMAGE' && <ImportPreview file={entry.file} />}
            <Field label="Nom affiché" htmlFor={`${id}-name-${index}`}>
              <Input id={`${id}-name-${index}`} maxLength={255} value={entry.name} onChange={event => updateEntry(entry.key, { name: event.target.value })} />
            </Field>
            {entry.type === 'IMAGE' && <ImageAlternativeField id={`${id}-alt-${index}`} alt={entry.alt} decorative={entry.decorative} multiline
              onAltChange={alt => updateEntry(entry.key, { alt })} onDecorativeChange={decorative => updateEntry(entry.key, { decorative })} />}
          </>}
          {!entry.done && upload?.key === entry.key && <p>Envoi en cours…</p>}
          {(entry.validationError || entry.error) && <p role="alert" className="text-brique">{entry.validationError ?? entry.error}</p>}
          {!entry.done && <Button size="petit" variant="fantome" className="justify-self-start" aria-label={`Retirer ${entry.file.name}`}
            onClick={() => setImports(current => current.filter(item => item.key !== entry.key))}>Retirer</Button>}
        </div>)}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="blanc" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={!pending.length || pending.some(entry => entry.validationError)}>
            {pending.some(entry => entry.error) ? 'Relancer l’import' : 'Importer'}
          </Button>
        </div>
      </fieldset>
    </form>
  </Modal>
}
