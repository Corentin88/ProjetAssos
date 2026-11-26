// ============================================================
// Types partagés de la maquette ProjetAssos
// Les données sont fictives et centralisées dans src/data/
// ============================================================

/** Rôles définis par le cahier des charges (§11) */
export type Role = 'utilisateur' | 'administrateur'

/** Statuts d'un compte (§10) */
export type UserStatus = 'actif' | 'suspendu'

/** Méthodes d'authentification (§5 : mot de passe, compte Google, ou les deux) */
export type AuthMethod = 'motdepasse' | 'google'

export type ApiAvatar =
  | { kind: 'DEFAULT' }
  | { kind: 'PRESET'; preset: number }
  | { kind: 'PERSONAL' | 'GOOGLE'; url: string }

export interface Avatar {
  /** defaut : avatar du site ; initiales : avatar prédéfini coloré ;
   *  image : image personnelle (média) ; google : photo Google */
  type: 'defaut' | 'initiales' | 'image' | 'google'
  colorIndex?: number
  mediaId?: string
  url?: string
}

export interface User {
  id: string
  prenom: string
  nom: string
  email: string
  role: Role
  statut: UserStatus
  avatar: Avatar
  hasPersonalAvatar?: boolean
  googleAvatar?: string
  authMethods: AuthMethod[]
  createdAt: string
  lastActivityAt: string
  /** Nouvelle adresse en attente de validation (§8) */
  pendingEmail?: string
}

export interface Category {
  id: string
  nom: string
  slug: string
  articleCount?: number
}

export interface Tag {
  id: string
  nom: string
  slug: string
  articleCount?: number
}

/** Blocs de l'éditeur d'article (§18) */
export type BlockType =
  | 'titre'
  | 'sous-titre'
  | 'paragraphe'
  | 'image'
  | 'video'
  | 'liste'
  | 'lien'
  | 'citation'
  | 'randonnee'
  | 'localisation'

export interface Block {
  id: string
  type: BlockType
  /** texte du bloc (titre, sous-titre, paragraphe, citation, libellé du lien) */
  text?: string
  /** URL YouTube (vidéo), URL du lien, ou média de la médiathèque (image) */
  url?: string
  mediaId?: string
  /** texte alternatif obligatoire pour les images */
  alt?: string
  items?: string[]
  trail?: TrailBlockFields
  visibility?: TrailVisibility
  mapSettings?: TrailMapSettings
  mapPreview?: Trail['mapPreview'] | null
  gpxAvailable?: boolean
  location?: LocationBlockFields
}

export type ArticleStatus = 'brouillon' | 'programme' | 'publie' | 'corbeille'

export interface Article {
  id: string
  slug: string
  titre: string
  statut: ArticleStatus
  auteurId: string
  auteurLabel?: string
  auteurNom?: string
  createdAt: string
  /** Date de publication effective (§17) */
  publishedAt: string | null
  /** Date de publication programmée (§20) */
  programmeAt: string | null
  /** Date de dernière modification (§17, §18) */
  updatedAt: string
  coverMediaId: string | null
  categorieIds: string[]
  tagIds: string[]
  /** Version de travail. Pour un article publié avec modifications en cours :
   *  contient le brouillon de la nouvelle version. */
  blocks: Block[]
  /** Copie de la version actuellement visible publiquement (§20).
   *  Non nul uniquement si des modifications sont en préparation. */
  publicSnapshot: Block[] | null
  /** Carrousel de la page d'accueil (§26 — fonctionnement à préciser) */
  misEnAvant: boolean
  positionCarrousel?: number | null
  trail?: Trail | null
  viewCount?: number
}

export interface TrailFields {
  name: string
  description: string
  distance: number
  elevationGain: number
  elevationLoss: number
  duration: number
  difficulty: 'EASY' | 'MEDIUM' | 'HARD'
}

export interface Trail extends TrailFields {
  mapPreview: TrailMapPreview
  gpxMediaId?: string
}

export interface TrailMeasurements {
  name: string
  distance: number | null
  durationSeconds: number | null
  departureAt: string | null
  arrivalAt: string | null
  elevationGain: number | null
  elevationLoss: number | null
  elevationMin: number | null
  elevationMax: number | null
}

export interface TrailBlockFields extends TrailMeasurements {
  description: string
  difficulty: TrailFields['difficulty'] | null
}

export type TrailVisibility = Record<
  'distance' | 'duration' | 'dates' | 'elevation' | 'altitude' | 'difficulty' | 'description' | 'map' | 'download',
  boolean
> & Partial<Record<'departure' | 'arrival' | 'elevationGain' | 'elevationLoss' | 'elevationMin' | 'elevationMax', boolean>>

export type TrailMapSettings = {
  slopes: boolean
  profile: boolean
  initialMode: 'classic' | 'slopes'
}

export type TrailSample = {
  coordinates: [number, number]
  distanceKm: number | null
  elevation: number | null
  time: string | null
  slope: 'up' | 'down' | 'flat' | null
  elevationBreak: boolean
}

export type TrailMapPreview = {
  segments: [number, number][][]
  samples?: TrailSample[][]
}

export type GpxPreview = TrailMapPreview & { details: TrailMeasurements }

export interface LocationBlockFields {
  title: string
  address: string
  description: string
  latitude: number | null
  longitude: number | null
}

export interface CommentEditHistory {
  contenu: string
  at: string
}

export interface CommentModeration {
  motif: string
  precision?: string
  at: string
  adminId: string | null
  adminLabel?: string
  /** Contenu supprimé, conservé 6 mois côté administration (§31) */
  contenuSupprime: string
}

export interface Comment {
  id: string
  articleId: string
  articleTitre?: string
  articleSlug?: string
  /** null → l'utilisateur a supprimé son compte (§12) */
  auteurId: string | null
  /** « Utilisateur supprimé » ou nom conservé après suspension (§10, §12) */
  auteurLabel: string
  auteurAvatar?: ApiAvatar
  contenu: string
  createdAt: string
  updatedAt: string | null
  /** Un seul niveau de réponse (§28) */
  parentId: string | null
  /** Supprimé par son auteur (§30) */
  deletedByAuthor: boolean
  deletedByAdmin?: boolean
  /** Supprimé par un administrateur avec motif (§31) */
  moderation: CommentModeration | null
  /** Historique des modifications, accessible aux administrateurs (§29) */
  history: CommentEditHistory[]
}

export interface Media {
  id: string
  file: string
  nom: string
  tailleKo: number
  format: 'JPG' | 'PNG' | 'WebP'
  alt: string
  largeur: number
  hauteur: number
  createdAt: string
  usage?: { articles: string[]; avatars: number; association: boolean }
}

interface LibraryItemFields {
  id: string
  nom: string
  createdAt: string
  tailleKo: number
  folderId: string | null
}

export type LibraryImage = Media & LibraryItemFields & { type: 'IMAGE'; thumbnail: string }
export type LibraryItem = LibraryImage | (LibraryItemFields & { type: 'GPX' })
export type LibraryDetails = LibraryItem & {
  usage: { articles: string[]; avatars: number; association: boolean; trails: number }
}

export interface MediaFolder {
  id: string
  name: string
  parentId: string | null
}

export interface ContactMessage {
  id: string
  prenom: string
  nom: string
  email: string
  sujet: string
  message: string
  at: string
  lu: boolean
  repliedAt: string | null
}

export type NotificationType = 'interaction' | 'compte' | 'moderation'

export interface UserNotification {
  id: string
  userId: string
  type: NotificationType
  titre: string
  texte: string
  at: string
  lue: boolean
  /** Lien interne éventuel (article, commentaire) */
  link?: string
}

export type LogActionType =
  | 'compte'
  | 'article'
  | 'categorie'
  | 'tag'
  | 'commentaire'
  | 'media'
  | 'association'
  | 'message'
  | 'journal'

export interface ActivityLogEntry {
  id: string
  at: string
  adminId: string
  type: LogActionType
  /** Libellé lisible de l'action */
  action: string
  /** Élément concerné */
  cible: string
  details?: string
}

export interface Coordonnees {
  adresse: string
  codePostal: string
  ville: string
  telephone: string
  email: string
  latitude: string
  longitude: string
  horaires: string
  facebook: string
  instagram: string
  youtube: string
}

export interface AssociationPage {
  blocks: Block[]
  coordonnees: Coordonnees
  updatedAt: string | null
}

export interface StatsData {
  /** Libellés de mois et séries de fréquentation (§39) */
  moisLabels: string[]
  visiteurs: number[]
  pagesVues: number[]
  topArticles: { articleId: string; vues: number }[]
  recherches: { terme: string; occurrences: number }[]
  sources: { nom: string; part: number }[]
}
