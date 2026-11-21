import type {
  ActivityLogEntry,
  AssociationPage,
  ContactMessage,
  StatsData,
  UserNotification,
} from '../types'

// ------------------------------------------------------------
// Messages de contact (§35)
// ------------------------------------------------------------
export const messagesSeed: ContactMessage[] = [
  {
    id: 'msg1',
    prenom: 'Lydia',
    nom: 'Hoffmann',
    email: 'lydia.hoffmann@example.fr',
    sujet: 'Inscription et adhésion',
    message:
      "Bonjour, j'aimerais m'inscrire pour la saison 2026-2027 et participer à l'atelier créatif. Comment puis-je faire, et où déposer ma cotisation ? Merci d'avance.",
    at: '2026-11-19T09:12:00',
    lu: false,
    repliedAt: null,
  },
  {
    id: 'msg2',
    prenom: 'Freddy',
    nom: 'Steiner',
    email: 'freddy.stiner@example.fr',
    sujet: 'Proposition d’atelier photographie',
    message:
      "Photographe amateur, je vous propose un atelier « photo du village » le samedi matin, avec un temps de partage des images en fin de saison. Intéressé par une collaboration bénévole ?",
    at: '2026-11-18T14:45:00',
    lu: false,
    repliedAt: null,
  },
  {
    id: 'msg3',
    prenom: 'Services techniques',
    nom: 'Mairie d’Arches',
    email: 'services@mairie-arches.example.fr',
    sujet: 'Salle polyvalente : calendrier des travaux',
    message:
      "Bonjour, la commune souhaite coordonner le planning des ateliers du Foyer Rural avec la phase 2 des travaux de la salle polyvalente. Pouvez-vous transmettre vos dates de répétitions ? Cordialement, services techniques.",
    at: '2026-11-14T10:30:00',
    lu: true,
    repliedAt: '2026-11-15T09:05:00',
  },
  {
    id: 'msg4',
    prenom: 'Béatrice',
    nom: 'Colin',
    email: 'beatrice.colin@example.fr',
    sujet: 'Location de la salle pour un anniversaire',
    message:
      "Bonjour, je souhaite réserver la salle polyvalente pour un anniversaire familial en février. Quelles sont les modalités et le tarif ? Bonne journée.",
    at: '2026-11-09T18:20:00',
    lu: true,
    repliedAt: null,
  },
  {
    id: 'msg5',
    prenom: 'Alain',
    nom: 'Berger',
    email: 'alain.berger@example.fr',
    sujet: 'Chorale : reprise des répétitions',
    message: "Bonjour, la chorale accepte-t-elle les nouveaux venus en cours d'année ou seulement à la rentrée ?",
    at: '2026-11-02T11:00:00',
    lu: true,
    repliedAt: '2026-11-03T08:40:00',
  },
  {
    id: 'msg6',
    prenom: 'Ophélie',
    nom: 'Marchal',
    email: 'ophelie.marchal@example.fr',
    sujet: 'Don de livres pour la bibliothèque',
    message:
      "Bonjour, je déménage et j'ai deux cartons de romans à donner. Le don est-il accepté au dernier samedi du mois ? Merci de préciser l'horaire.",
    at: '2026-10-28T16:15:00',
    lu: true,
    repliedAt: null,
  },
]

// ------------------------------------------------------------
// Notifications internes (§16) — pas de courriel systématique
// ------------------------------------------------------------
export const notificationsSeed: UserNotification[] = [
  {
    id: 'n1',
    userId: 'u3',
    type: 'interaction',
    titre: 'Réponse à votre commentaire',
    texte: "Jean Perrot a répondu à votre commentaire sur « Fête du village : le programme complet ».",
    at: '2026-11-08T14:02:00',
    lue: false,
    link: '/actualites/fete-du-village-programme-complet#commentaire-c1-2',
  },
  {
    id: 'n2',
    userId: 'u3',
    type: 'compte',
    titre: 'Méthode de connexion associée',
    texte: "Votre compte Google a bien été associé à votre compte le 2 novembre. Vous pouvez désormais vous connecter avec l'un ou l'autre.",
    at: '2026-11-02T10:00:00',
    lue: true,
  },
  {
    id: 'n3',
    userId: 'u5',
    type: 'interaction',
    titre: 'Réponse à votre commentaire',
    texte: "Marie Dupont a répondu à votre commentaire sur « Fête du village : le programme complet ».",
    at: '2026-11-08T13:45:00',
    lue: false,
    link: '/actualites/fete-du-village-programme-complet#commentaire-c1-1',
  },
  {
    id: 'n4',
    userId: 'u10',
    type: 'interaction',
    titre: 'Réponse à votre commentaire',
    texte: "Robert Klein a répondu à votre question sur « Bien préparer la rentrée de la chorale ».",
    at: '2026-09-16T14:50:00',
    lue: true,
    link: '/actualites/bien-preparer-la-rentree-de-la-chorale#commentaire-c4-1',
  },
  {
    id: 'n5',
    userId: 'u7',
    type: 'moderation',
    titre: 'Compte suspendu',
    texte: "Votre compte a été suspendu par un administrateur le 28 octobre. Les contenus publics du site restent accessibles en lecture.",
    at: '2026-10-28T10:12:00',
    lue: false,
  },
  {
    id: 'n6',
    userId: 'u1',
    type: 'compte',
    titre: 'Modifications enregistrées',
    texte: "Votre profil a été mis à jour le 10 novembre (adresse e-mail confirmée).",
    at: '2026-11-10T16:20:00',
    lue: true,
  },
]

// ------------------------------------------------------------
// Journal d'activité administrateur (§41)
// ------------------------------------------------------------
export const logsSeed: ActivityLogEntry[] = [
  { id: 'l1', at: '2026-11-20T18:24:00', adminId: 'u1', type: 'article', action: "Modification d'un article publié (version en préparation)", cible: 'Marché des producteurs : un bilan très positif' },
  { id: 'l2', at: '2026-11-18T21:15:00', adminId: 'u2', type: 'article', action: "Enregistrement du brouillon", cible: "Compte rendu du conseil d'administration de novembre" },
  { id: 'l3', at: '2026-11-17T18:30:00', adminId: 'u1', type: 'article', action: 'Publication immédiate', cible: 'Téléthon : mobilisation solidaire les 5 et 6 décembre' },
  { id: 'l4', at: '2026-11-16T10:00:00', adminId: 'u1', type: 'article', action: "Programmation d'un article", cible: "Village de Noël : l'association sera présente", details: 'Publication prévue le 05/12/2026 à 09:00' },
  { id: 'l5', at: '2026-11-11T08:15:00', adminId: 'u1', type: 'commentaire', action: "Suppression d'un commentaire (motif : Spam)", cible: 'Commentaire de Corentin Lefebvre — Fête du village' },
  { id: 'l6', at: '2026-11-06T09:30:00', adminId: 'u1', type: 'article', action: 'Mise à la corbeille', cible: 'Infos pratiques du programme 2025' },
  { id: 'l7', at: '2026-11-05T14:45:00', adminId: 'u2', type: 'categorie', action: "Création d'une catégorie", cible: 'Solidarité & entraide' },
  { id: 'l8', at: '2026-11-02T10:00:00', adminId: 'u1', type: 'compte', action: "Modification d'un compte", cible: 'Marie Dupont', details: 'Association du compte Google' },
  { id: 'l9', at: '2026-10-28T10:12:00', adminId: 'u1', type: 'compte', action: "Suspension d'un compte", cible: 'Paul Martin', details: 'Motif : propos répétés envers un animateur' },
  { id: 'l10', at: '2026-10-21T18:00:00', adminId: 'u1', type: 'article', action: 'Publication immédiate', cible: "L'assemblée générale 2026 en quelques chiffres" },
  { id: 'l11', at: '2026-10-12T14:20:00', adminId: 'u2', type: 'media', action: "Import d'un média", cible: 'atelier-memoire.jpg' },
  { id: 'l12', at: '2026-10-08T09:40:00', adminId: 'u1', type: 'association', action: "Modification de la page « L'association »", cible: 'Contenu de la page', details: "Section activités mise à jour" },
  { id: 'l13', at: '2026-10-04T10:00:00', adminId: 'u2', type: 'article', action: 'Publication immédiate', cible: 'Marché des producteurs : un bilan très positif' },
  { id: 'l14', at: '2026-09-28T15:10:00', adminId: 'u1', type: 'message', action: 'Réponse à un message de contact', cible: 'Alain Berger — Chorale : reprise des répétitions' },
  { id: 'l15', at: '2026-09-20T11:30:00', adminId: 'u2', type: 'tag', action: "Création d'un tag", cible: 'Bénévolat' },
  { id: 'l16', at: '2026-09-15T09:00:00', adminId: 'u2', type: 'article', action: 'Publication immédiate', cible: 'Bien préparer la rentrée de la chorale' },
]

// ------------------------------------------------------------
// Page « L'association » : contenu + coordonnées (§32 à §34)
// ------------------------------------------------------------
export const associationSeed: AssociationPage = {
  blocks: [
    { id: 'as-b1', type: 'titre', text: 'Qui sommes-nous ?' },
    { id: 'as-b2', type: 'paragraphe', text: "Le Foyer Rural d'Arches réunit depuis 1962 les habitant·es du village et des hameaux voisins autour d'une même idée : partager des activités, des savoir-faire et des moments simples. Ateliers hebdomadaires, événements fédérateurs, bibliothèque bénévole : chacun peut participer à sa façon, sans être expert ni passionné de tout." },
    { id: 'as-b3', type: 'image', mediaId: 'm-village', alt: "Vue du village d'Arches : maisons et toits de tuiles au pied des collines vosgiennes" },
    { id: 'as-b4', type: 'titre', text: 'Notre histoire' },
    { id: 'as-b5', type: 'paragraphe', text: "Fondé en 1962 par un groupe de familles du village, le Foyer Rural n'a cessé de grandir : 150 adhérents aujourd'hui, plus de vingt activités hebdomadaires, une bibliothèque devenue repère du village et quatre événements qui rythment l'année. Nous travaillons main dans la main avec la commune, les écoles et les associations voisines." },
    { id: 'as-b6', type: 'titre', text: 'Nos valeurs' },
    { id: 'as-b7', type: 'liste', items: ["La convivialité : personne ne reste à la traîne, on attend le dernier", "L'ouverture : aucune activité n'est réservée aux initiés, la première séance est toujours découverte", "Le bénévolat : chacun peut apporter sa pierre, une fois par saison ou chaque semaine", "Le respect du village : lieux partagés, matériel entretenu, déchets remportés"] },
    { id: 'as-b8', type: 'citation', text: '« Le foyer rural rassemble : ici, on vient comme on est. »' },
    { id: 'as-b9', type: 'titre', text: 'Nos activités' },
    { id: 'as-b10', type: 'liste', items: ["Ateliers hebdomadaires : chorale, théâtre amateur, atelier créatif, jeux de société, gym douce", "Atelier mémoire en partenariat avec la maison pluridisciplinaire de santé", "Bibliothèque bénévole : plus de 6 000 ouvrages, ouverture mercredi et samedi", "Événements : fête du village, repas partagé d'été, vide-grenier, village de Noël", "Sorties découvertes de temps en temps : nature, patrimoine, visites"] },
    { id: 'as-b11', type: 'titre', text: 'Le bureau' },
    { id: 'as-b12', type: 'paragraphe', text: "Présidente : Claire Marchal — Trésorier : Robert Klein — Secrétaire : Nicole Fève. Le bureau se réunit le premier mardi du mois ; les adhérents peuvent y proposer des activités ou des idées via la permanence ou le formulaire de contact." },
  ],
  coordonnees: {
    adresse: '12 place de la Mairie, Maison des associations',
    codePostal: '88380',
    ville: 'Arches',
    telephone: '03 29 42 15 27',
    email: 'contact@foyer-rural-arches.fr',
    latitude: '48.2526',
    longitude: '6.9213',
    horaires: 'Permanence : mercredi 14 h - 18 h et samedi 9 h - 12 h',
    facebook: 'https://www.facebook.com/foyerruralarches',
    instagram: 'https://www.instagram.com/foyer.rural.arches',
    youtube: '',
  },
  updatedAt: '2026-10-08T09:40:00',
}

// ------------------------------------------------------------
// Statistiques fictives (§39)
// ------------------------------------------------------------
export const statsSeed: StatsData = {
  moisLabels: [
    'Nov 2025', 'Déc 2025', 'Jan 2026', 'Fév 2026', 'Mar 2026', 'Avr 2026',
    'Mai 2026', 'Juin 2026', 'Juil 2026', 'Août 2026', 'Sept 2026', 'Oct 2026',
  ],
  visiteurs: [820, 1140, 980, 1240, 1610, 1980, 2460, 2810, 3140, 2960, 2620, 2890],
  pagesVues: [2610, 3420, 2990, 3880, 5010, 6240, 7810, 8940, 10220, 9480, 8210, 9140],
  topArticles: [
    { articleId: 'a4', vues: 1490 },
    { articleId: 'a1', vues: 1284 },
    { articleId: 'a6', vues: 947 },
    { articleId: 'a2', vues: 861 },
    { articleId: 'a5', vues: 733 },
  ],
  recherches: [
    { terme: 'fête du village programme', occurrences: 214 },
    { terme: 'chorale rentrée', occurrences: 186 },
    { terme: 'atelier mémoire inscription', occurrences: 152 },
    { terme: 'location salle polyvalente', occurrences: 141 },
    { terme: 'bibliothèque horaires', occurrences: 128 },
    { terme: 'adhésion 2027', occurrences: 96 },
  ],
  sources: [
    { nom: 'Moteurs de recherche', part: 46 },
    { nom: 'Liens partagés (courriels, réseaux sociaux)', part: 27 },
    { nom: 'Accès directs', part: 18 },
    { nom: 'Sites partenaires (commune, collège)', part: 9 },
  ],
}
