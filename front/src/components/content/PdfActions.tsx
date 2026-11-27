import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Download, ExternalLink } from 'lucide-react'
import { authErrorMessage, protectedRequest, request } from '../../lib/auth'
import { pdfTransferTimeoutMs } from '../../lib/content'
import { Alert } from '../ui/feedback'
import { Button } from '../ui/form'

export function PdfActions({ title, viewPath, downloadPath, secure = false, preview }: {
  title: string
  viewPath?: string
  downloadPath?: string
  secure?: boolean
  preview?: ReactNode
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const active = useRef(false)

  async function openPdf(path: string, download: boolean) {
    if (active.current) return
    setError('')
    const tab = download ? null : window.open('', '_blank')
    if (!download && !tab) {
      setError('Autorisez les nouveaux onglets pour consulter le PDF.')
      return
    }
    if (tab) {
      tab.opener = null
      tab.document.title = title
      tab.document.body.textContent = 'Chargement du PDF…'
    }
    active.current = true
    setBusy(true)
    try {
      const data = secure
        ? await protectedRequest<Blob>(path, 'GET', undefined, true, pdfTransferTimeoutMs)
        : await request<Blob>(path, 'GET', undefined, undefined, true, pdfTransferTimeoutMs)
      if (data.type !== 'application/pdf' || data.size === 0) throw new Error('PDF indisponible')
      if (tab?.closed) return
      // La visionneuse native reçoit un Blob PDF, jamais du HTML ni un jeton dans son URL.
      const url = URL.createObjectURL(data)
      if (tab) {
        tab.location.replace(url)
        const release = window.setInterval(() => {
          if (tab.closed) {
            window.clearInterval(release)
            URL.revokeObjectURL(url)
          }
        }, 1500)
      } else {
        const link = document.createElement('a')
        link.href = url
        link.download = /\.pdf$/i.test(title) ? title : `${title}.pdf`
        document.body.append(link)
        link.click()
        link.remove()
        window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
      }
    } catch (reason) {
      tab?.close()
      setError(authErrorMessage(reason))
    } finally {
      active.current = false
      setBusy(false)
    }
  }

  return <div className="grid gap-2">
    {viewPath && preview && <button type="button" disabled={busy} aria-label={`Consulter le PDF « ${title} » dans un nouvel onglet`}
      className="block min-w-0" onClick={() => void openPdf(viewPath, false)}>{preview}</button>}
    <div className="flex flex-wrap gap-2">
      {viewPath && <Button variant="secondaire" disabled={busy} onClick={() => void openPdf(viewPath, false)}>
        <ExternalLink aria-hidden="true" className="size-5" /> Consulter le PDF<span className="sr-only"> « {title} » dans un nouvel onglet</span>
      </Button>}
      {downloadPath && <Button variant="secondaire" disabled={busy} onClick={() => void openPdf(downloadPath, true)}>
        <Download aria-hidden="true" className="size-5" /> Télécharger le PDF<span className="sr-only"> « {title} »</span>
      </Button>}
    </div>
    {busy && <p role="status" className="text-sm text-mist">Chargement du PDF…</p>}
    {error && <Alert kind="erreur" title="Document PDF indisponible">{error}</Alert>}
  </div>
}
