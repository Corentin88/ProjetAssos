import { Link } from 'react-router-dom'
import type { To } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import { AVATAR_COLORS } from '../../data/users'
import { getMedia } from '../../lib/selectors'
import { mediaUrl } from '../../lib/assets'
import { fetchAvatar } from '../../lib/auth'
import type { Avatar as AvatarSpec } from '../../types'

// ============================================================
// Avatar — image, avatar prédéfini ou avatar par défaut (§13.2)
// L'avatar est décoratif : le nom est toujours présent en texte à côté.
// ============================================================
export function Avatar({
  user,
  size = 'md',
  className = '',
}: {
  user: { prenom: string; nom: string; avatar: AvatarSpec }
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const dims =
    size === 'lg' ? 'h-20 w-20 text-2xl' : size === 'sm' ? 'h-10 w-10 text-base' : 'h-14 w-14 text-xl'
  // Priorité d'affichage : image personnelle > avatar prédéfini > photo Google > avatar par défaut (§13.2).
  const media = user.avatar.type === 'image' && user.avatar.mediaId ? getMedia(user.avatar.mediaId) : undefined
  const lettres = `${user.prenom.charAt(0)}${user.nom.charAt(0)}`.toUpperCase()
  const couleur = user.avatar.type === 'initiales' ? AVATAR_COLORS[user.avatar.colorIndex ?? 0] : undefined
  const classes = `${dims} shrink-0 rounded-full ${className}`
  const fallback = (
    <span aria-hidden="true" style={couleur ? { backgroundColor: couleur } : undefined}
      className={`${classes} bg-leaf flex items-center justify-center font-bold text-white`}>
      {lettres}
    </span>
  )
  if (user.avatar.type === 'image' && !media && user.avatar.url) {
    return <PrivateAvatarPhoto key={user.avatar.url} path={user.avatar.url} classes={classes} fallback={fallback} />
  }
  const source = media ? mediaUrl(media.file) : user.avatar.type === 'google' ? user.avatar.url : undefined
  return source ? <AvatarPhoto key={source} src={source} classes={classes} fallback={fallback} /> : fallback
}

type PhotoProps = { classes: string; fallback: ReactElement }

function PrivateAvatarPhoto({ path, classes, fallback }: PhotoProps & { path: string }) {
  const [source, setSource] = useState<string>()
  useEffect(() => {
    const controller = new AbortController()
    let url: string | undefined
    void fetchAvatar(path, controller.signal).then((blob) => {
      if (controller.signal.aborted) return
      url = URL.createObjectURL(blob)
      setSource(url)
    }).catch(() => {})
    return () => {
      controller.abort()
      if (url) URL.revokeObjectURL(url)
    }
  }, [path])
  return source ? <AvatarPhoto src={source} classes={classes} fallback={fallback} /> : fallback
}

function AvatarPhoto({ src, classes, fallback }: PhotoProps & { src: string }) {
  const [loadedSource, setLoadedSource] = useState<string>()
  const ready = loadedSource === src
  return (
    <span className="relative inline-grid shrink-0">
      {!ready && fallback}
      <img key={src} src={src} alt="" referrerPolicy="no-referrer"
        onLoad={() => setLoadedSource(src)}
        onError={() => setLoadedSource(undefined)}
        className={`${classes} border border-line object-cover ${ready ? '' : 'absolute inset-0 invisible'}`} />
    </span>
  )
}

/** Avatar d'un commentaire (utilisateur supprimé possible) */
export function CommentAvatar({ label, size = 'md' }: { label: string; size?: 'sm' | 'md' | 'lg' }) {
  const dims = size === 'sm' ? 'h-10 w-10 text-base' : 'h-14 w-14 text-xl'
  const lettres =
    label === 'Utilisateur supprimé'
      ? '?'
      : label
          .split(/\s+/)
          .map((mot) => mot.charAt(0).toUpperCase())
          .slice(0, 2)
          .join('')
  return (
    <span
      aria-hidden="true"
      className={`${dims} flex shrink-0 items-center justify-center rounded-full bg-leaf font-bold text-white`}
    >
      {lettres}
    </span>
  )
}

// ============================================================
// Carte générique
// ============================================================
export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`carte p-6 ${className}`}>{children}</div>
  )
}

// ============================================================
// Étiquette de tag cliquable (alternative textuelle aux cartes)
// ============================================================
export function TagChip({ to, children }: { to?: string; children: React.ReactNode }) {
  const cls =
    'inline-flex items-center rounded-full bg-leaf-pale px-3 py-1 text-[0.875rem] font-bold text-forest hover:bg-leaf hover:text-white'
  if (to) {
    return (
      <Link to={to} className={cls}>
        {children}
      </Link>
    )
  }
  return <span className={cls}>{children}</span>
}

/** Pastille de catégorie cliquable */
export function CategoryChip({ to, children }: { to?: To; children: React.ReactNode }) {
  const cls =
    'inline-flex items-center rounded-full bg-ocre-pale px-3 py-1 text-[0.875rem] font-bold text-ocre-dark hover:bg-ocre hover:text-white'
  if (to) {
    return (
      <Link to={to} className={cls}>
        {children}
      </Link>
    )
  }
  return <span className={cls}>{children}</span>
}

/** Titre de section standardisé */
export function SectionTitle({
  children,
  as: Tag = 'h2',
  id,
  className = '',
}: {
  children: React.ReactNode
  as?: 'h2' | 'h3' | 'h4'
  id?: string
  className?: string
}) {
  return (
    <Tag id={id} className={`font-bold text-forest ${Tag === 'h2' ? 'text-2xl' : 'text-xl'} ${className}`}>
      {children}
    </Tag>
  )
}
