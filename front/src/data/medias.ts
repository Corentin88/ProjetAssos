import type { Media } from '../types'

/** Bibliothèque de médias fictive (§36).
 *  Les fichiers correspondants sont servis depuis public/images/.
 *  Visuels d'illustration variés, représentant la vie associative générale. */
export const mediasSeed: Media[] = [
  { id: 'm-village', file: 'village-arches.jpg', nom: 'village-arches.jpg', tailleKo: 321, format: 'JPG', alt: 'Vue du village d\'Arches : maisons et toits de tuiles au pied des collines vosgiennes', largeur: 1200, hauteur: 805, createdAt: '2026-08-26T09:00:00' },
  { id: 'm-fete', file: 'fete-village.jpg', nom: 'fete-village.jpg', tailleKo: 258, format: 'JPG', alt: 'Fête du village sous la tente : ambiance festive et dansante en fin d\'après-midi', largeur: 1600, hauteur: 907, createdAt: '2026-11-04T10:00:00' },
  { id: 'm-marche', file: 'marche-producteurs.jpg', nom: 'marche-producteurs.jpg', tailleKo: 147, format: 'JPG', alt: 'Étal coloré de légumes et de fruits frais au marché des producteurs', largeur: 1200, hauteur: 801, createdAt: '2026-10-02T09:30:00' },
  { id: 'm-atelier', file: 'atelier-memoire.jpg', nom: 'atelier-memoire.jpg', tailleKo: 198, format: 'JPG', alt: 'Participants d\'un atelier mémoire autour d\'une table, animatrice et puzzles', largeur: 1800, hauteur: 1200, createdAt: '2026-10-12T14:20:00' },
  { id: 'm-chorale', file: 'chorale.jpg', nom: 'chorale.jpg', tailleKo: 897, format: 'JPG', alt: 'Chanteuses de la chorale en pleine répétition, micros et partitions', largeur: 3000, hauteur: 2000, createdAt: '2026-09-12T11:00:00' },
  { id: 'm-biblio', file: 'bibliotheque.jpg', nom: 'bibliotheque.jpg', tailleKo: 1529, format: 'JPG', alt: 'Bibliothèque bénévole : comptoir d\'accueil et rayonnages de livres', largeur: 2400, hauteur: 1600, createdAt: '2026-08-06T15:00:00' },
  { id: 'm-benevoles', file: 'benevoles.jpg', nom: 'benevoles.jpg', tailleKo: 598, format: 'JPG', alt: 'Bénévoles de l\'association réunis autour d\'un café dans la salle commune', largeur: 2560, hauteur: 1707, createdAt: '2026-11-15T09:00:00' },
  { id: 'm-salle', file: 'salle-des-fetes.jpg', nom: 'salle-des-fetes.jpg', tailleKo: 462, format: 'JPG', alt: 'Salle polyvalente préparée pour un événement : charpente apparente et tables dressées', largeur: 2048, hauteur: 1365, createdAt: '2026-07-16T10:00:00' },
  { id: 'm-noel', file: 'marche-noel.jpg', nom: 'marche-noel.jpg', tailleKo: 257, format: 'JPG', alt: 'Illuminations de fin d\'année sur une façade du village : faune et sapins lumineux', largeur: 1600, hauteur: 900, createdAt: '2026-11-16T10:00:00' },
  { id: 'm-repas', file: 'repas-assoc.jpg', nom: 'repas-assoc.jpg', tailleKo: 1214, format: 'JPG', alt: 'Repas partagé d\'été sous les arbres, longues tablées conviviales', largeur: 2560, hauteur: 1707, createdAt: '2026-08-10T12:00:00' },
  { id: 'm-theatre', file: 'theatre.jpg', nom: 'theatre.jpg', tailleKo: 112, format: 'JPG', alt: 'Troupe de théâtre amateur sur scène, costumes et maquillages de fin de spectacle', largeur: 1200, hauteur: 676, createdAt: '2026-05-18T18:00:00' },
  { id: 'm-reunion', file: 'reunion-association.jpg', nom: 'reunion-association.jpg', tailleKo: 334, format: 'JPG', alt: 'Membres du bureau de l\'association réunis autour d\'une table de réunion', largeur: 1600, hauteur: 1067, createdAt: '2026-10-18T18:00:00' },
  { id: 'm-fleurs', file: 'fleurs-alpines.jpg', nom: 'fleurs-alpines.jpg', tailleKo: 298, format: 'JPG', alt: 'Orchidées sauvages et gentianes dans une prairie vosgienne', largeur: 1600, hauteur: 1067, createdAt: '2026-10-12T14:20:00' },
  { id: 'm-patrimoine', file: 'chateau-patrimoine.jpg', nom: 'chateau-patrimoine.jpg', tailleKo: 240, format: 'JPG', alt: 'Édifice patrimonial perché sur une colline boisée au-dessus de la vallée', largeur: 1600, hauteur: 1200, createdAt: '2026-09-18T11:18:00' },
  { id: 'm-chaume', file: 'ferme-auberge.jpg', nom: 'ferme-auberge.jpg', tailleKo: 270, format: 'JPG', alt: 'Ferme-auberge vosgienne isolée dans un pré de montagne en fleurs', largeur: 1600, hauteur: 1200, createdAt: '2026-09-18T11:05:00' },
  { id: 'm-plan', file: 'plan-deau-foret.jpg', nom: 'plan-deau-foret.jpg', tailleKo: 398, format: 'JPG', alt: 'Plan d\'eau entouré de forêts dans les Vosges, reflets sur l\'eau', largeur: 1600, hauteur: 1067, createdAt: '2026-09-10T15:44:00' },
  { id: 'm-foret', file: 'foret-vosgienne.jpg', nom: 'foret-vosgienne.jpg', tailleKo: 356, format: 'JPG', alt: 'Sous-bois vosgien baigné de lumière traversant les sapins', largeur: 1600, hauteur: 1067, createdAt: '2026-09-02T09:14:00' },
  { id: 'm-automne', file: 'cretes-automne.jpg', nom: 'cretes-automne.jpg', tailleKo: 445, format: 'JPG', alt: 'Collines boisées aux couleurs de l\'automne, fougères dorées', largeur: 1600, hauteur: 1067, createdAt: '2026-09-10T15:40:00' },
  { id: 'm-visuel-defaut', file: 'visuel-defaut.jpg', nom: 'visuel-defaut.jpg', tailleKo: 210, format: 'JPG', alt: 'Visuel par défaut : sentier de forêt traversant des collines boisées sous un ciel clair', largeur: 1600, hauteur: 900, createdAt: '2026-03-01T08:00:00' },
]
