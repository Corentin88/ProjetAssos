import { Link } from 'react-router-dom'
import { AVATAR_COLORS } from '../../data/users'
import { getMedia } from '../../lib/selectors'
import { mediaUrl } from '../../lib/assets'

// ============================================================
// Avatar — image, avatar prédéfini ou avatar par défaut (§13.2)
// L'avatar est décoratif : le nom est toujours présent en texte à côté.
// ============================================================
export function Avatar({
  user,
  size = 'md',
  className = '',
}: {
  user: { prenom: string; nom: string; avatar: { type: string; colorIndex?: number; mediaId?: string } }
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const dims =
    size === 'lg' ? 'h-20 w-20 text-2xl' : size === 'sm' ? 'h-10 w-10 text-base' : 'h-14 w-14 text-xl'
  // Priorité d'affichage : image personnelle > avatar prédéfini > photo Google > avatar par défaut (§13.2).
  // Maquette : la photo Google est représentée par l'avatar prédéfini.
  const media = user.avatar.type === 'image' && user.avatar.mediaId ? getMedia(user.avatar.mediaId) : undefined
  if (media) {
    return (
      <img
        src={mediaUrl(media.file)}
        alt=""
        className={`${dims} shrink-0 rounded-full border border-line object-cover ${className}`}
      />
    )
  }
  const lettres = `${user.prenom.charAt(0)}${user.nom.charAt(0)}`.toUpperCase()
  const colorIndex = user.avatar.colorIndex ?? 0
  const bg =
    user.avatar.type === 'defaut' ? 'bg-leaf' : AVATAR_COLORS[colorIndex % AVATAR_COLORS.length]
  return (
    <span
      aria-hidden="true"
      className={`${dims} ${bg} flex shrink-0 items-center justify-center rounded-full font-bold text-white ${className}`}
    >
      {lettres}
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
export function CategoryChip({ to, children }: { to?: string; children: React.ReactNode }) {
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
