import {
  Activity, Baby, Bike, BookOpen, CalendarDays, Camera, ChefHat, CircleDot, Clapperboard,
  Compass, Dices, Drama, Dumbbell, Footprints, HandHeart, Heart, Landmark, Leaf, MapPin,
  Mountain, Music, Palette, PartyPopper, PersonStanding, Plane, Spade, TreePine, Trophy,
  Users, Utensils,
} from 'lucide-react'

// Les identifiants sont conservés en base et validés dans CategoryVisualDto.
export const categoryIconGroups = [
  { label: 'Plein air et sport', items: [
    { id: 'footprints', label: 'Randonnée', Icon: Footprints, keywords: 'marche balade pédestre trek' },
    { id: 'mountain', label: 'Montagne', Icon: Mountain, keywords: 'sommet alpin escalade relief' },
    { id: 'tree-pine', label: 'Forêt', Icon: TreePine, keywords: 'arbre bois nature plein air' },
    { id: 'leaf', label: 'Nature', Icon: Leaf, keywords: 'feuille écologie plantes jardin' },
    { id: 'bike', label: 'Vélo', Icon: Bike, keywords: 'cyclisme vtt bicyclette' },
    { id: 'activity', label: 'Course', Icon: Activity, keywords: 'activité courir running footing jogging athlétisme' },
    { id: 'dumbbell', label: 'Sports', Icon: Dumbbell, keywords: 'gym fitness entraînement musculation' },
    { id: 'circle-dot', label: 'Pétanque', Icon: CircleDot, keywords: 'boules cochonnet tournoi' },
    { id: 'trophy', label: 'Tournois', Icon: Trophy, keywords: 'compétition championnat coupe concours' },
  ] },
  { label: 'Jeux et sorties', items: [
    { id: 'spade', label: 'Jeux de cartes', Icon: Spade, keywords: 'cartes pique belote tarot bridge poker' },
    { id: 'dices', label: 'Jeux de société', Icon: Dices, keywords: 'jeux plateau dés ludothèque' },
    { id: 'baby', label: 'Enfants', Icon: Baby, keywords: 'jeunesse famille activités enfants' },
    { id: 'plane', label: 'Voyage', Icon: Plane, keywords: 'vacances tourisme avion excursion' },
    { id: 'compass', label: 'Découverte', Icon: Compass, keywords: 'orientation exploration sortie' },
    { id: 'map-pin', label: 'Lieu', Icon: MapPin, keywords: 'destination adresse carte' },
  ] },
  { label: 'Arts et culture', items: [
    { id: 'music', label: 'Musique', Icon: Music, keywords: 'concert chant chorale instrument' },
    { id: 'person-standing', label: 'Danse', Icon: PersonStanding, keywords: 'bal danse mouvement chorégraphie' },
    { id: 'drama', label: 'Théâtre', Icon: Drama, keywords: 'spectacle scène comédie' },
    { id: 'clapperboard', label: 'Cinéma', Icon: Clapperboard, keywords: 'film projection vidéo' },
    { id: 'book-open', label: 'Lecture', Icon: BookOpen, keywords: 'livre bibliothèque littérature' },
    { id: 'camera', label: 'Photographie', Icon: Camera, keywords: 'photo appareil image' },
    { id: 'palette', label: 'Arts', Icon: Palette, keywords: 'peinture dessin création arts plastiques' },
    { id: 'landmark', label: 'Patrimoine', Icon: Landmark, keywords: 'monument musée histoire architecture' },
  ] },
  { label: 'Vie associative', items: [
    { id: 'chef-hat', label: 'Cuisine', Icon: ChefHat, keywords: 'recette gastronomie atelier culinaire' },
    { id: 'utensils', label: 'Repas', Icon: Utensils, keywords: 'déjeuner dîner buffet banquet table' },
    { id: 'party-popper', label: 'Fête', Icon: PartyPopper, keywords: 'célébration animation festival anniversaire' },
    { id: 'calendar-days', label: 'Événements', Icon: CalendarDays, keywords: 'agenda calendrier rendez-vous' },
    { id: 'users', label: 'Réunions', Icon: Users, keywords: 'groupe assemblée conseil adhérents' },
    { id: 'hand-heart', label: 'Bénévolat', Icon: HandHeart, keywords: 'bénévole engagement solidarité aide' },
    { id: 'heart', label: 'Entraide', Icon: Heart, keywords: 'cœur soutien partage solidarité' },
  ] },
]

export const categoryIcons = categoryIconGroups.flatMap(group => group.items)
