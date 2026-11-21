import type { Comment } from '../types'

/** Commentaires et réponses fictifs (§28 à §31).
 *  - c1-5 : commentaire modéré par un administrateur (placeholder public)
 *  - c1-7 : commentaire supprimé par son auteur (placeholder public)
 *  - c6-3 : auteur ayant supprimé son compte → « Utilisateur supprimé » (§12)
 *  - c1-4 : commentaire modifié par son auteur (historique conservé, §29) */
export const commentsSeed: Comment[] = [
  // ----- Discussion sur l'article a1 (fête du village) -----
  {
    id: 'c1-1',
    articleId: 'a1',
    auteurId: 'u5',
    auteurLabel: 'Jean Perrot',
    contenu:
      "Le programme est superbe ! Pour ceux qui n'étaient pas là l'an dernier, le repas partagé est un vrai moment de convivialité : pensez à réserver à la permanence avant le 18.",
    createdAt: '2026-11-08T12:10:00',
    updatedAt: null,
    parentId: null,
    deletedByAuthor: false,
    moderation: null,
    history: [],
  },
  {
    id: 'c1-2',
    articleId: 'a1',
    auteurId: 'u3',
    auteurLabel: 'Marie Dupont',
    contenu:
      "C'était ma première fête avec l'association l'an dernier, j'ai été très bien accueillie. J'espère que la chorale Écho des Vosges sera encore au bal !",
    createdAt: '2026-11-08T13:45:00',
    updatedAt: null,
    parentId: 'c1-1',
    deletedByAuthor: false,
    moderation: null,
    history: [],
  },
  {
    id: 'c1-3',
    articleId: 'a1',
    auteurId: 'u5',
    auteurLabel: 'Jean Perrot',
    contenu:
      "@Marie D. Bienvenue chez nous Marie ! La chorale ouvre le bal chaque année, comme le goûter des enfants à 11 h 30.",
    createdAt: '2026-11-08T14:02:00',
    updatedAt: null,
    parentId: 'c1-1',
    deletedByAuthor: false,
    moderation: null,
    history: [],
  },
  {
    id: 'c1-4',
    articleId: 'a1',
    auteurId: 'u6',
    auteurLabel: 'Sophie Bernard',
    contenu:
      "Petit rectificatif à ce que j'ai dit dimanche : la chasse au trésor est bien à 11 h 30 et non à 11 h. Le rendez-vous est au parc de la mairie.",
    createdAt: '2026-11-09T09:30:00',
    updatedAt: '2026-11-09T10:05:00',
    parentId: null,
    deletedByAuthor: false,
    moderation: null,
    history: [
      {
        contenu:
          "La chasse au trésor est à 11 h, rendez-vous au parc de la mairie.",
        at: '2026-11-09T09:30:00',
      },
    ],
  },
  {
    id: 'c1-5',
    articleId: 'a1',
    auteurId: 'u9',
    auteurLabel: 'Corentin Lefebvre',
    contenu: '[contenu supprimé]',
    createdAt: '2026-11-10T18:20:00',
    updatedAt: null,
    parentId: null,
    deletedByAuthor: false,
    moderation: {
      motif: 'Spam',
      at: '2026-11-11T08:15:00',
      adminId: 'u1',
      contenuSupprime:
        "Promotion exclusive pour votre stand de marché ! Réservez votre emplacement sur mon site promo-stand.example et utilisez le code FETE30 pour -30 %...",
    },
    history: [],
  },
  {
    id: 'c1-6',
    articleId: 'a1',
    auteurId: 'u8',
    auteurLabel: 'Nicole Fève',
    contenu:
      "Bonne décision d'avoir retiré cette publicité. Merci à l'équipe de modération pour sa réactivité.",
    createdAt: '2026-11-11T09:00:00',
    updatedAt: null,
    parentId: 'c1-5',
    deletedByAuthor: false,
    moderation: null,
    history: [],
  },
  {
    id: 'c1-7',
    articleId: 'a1',
    auteurId: 'u13',
    auteurLabel: 'Gérard Muller',
    contenu: '[contenu supprimé]',
    createdAt: '2026-11-12T11:40:00',
    updatedAt: null,
    parentId: null,
    deletedByAuthor: true,
    moderation: null,
    history: [],
  },

  // ----- Discussion sur l'article a2 (assemblée générale) -----
  {
    id: 'c2-1',
    articleId: 'a2',
    auteurId: 'u8',
    auteurLabel: 'Nicole Fève',
    contenu:
      "Une belle année pour l'association. Je note aussi la dynamique sur les événements : quatre rendez-vous fédérateurs, bravo !",
    createdAt: '2026-10-21T19:22:00',
    updatedAt: null,
    parentId: null,
    deletedByAuthor: false,
    moderation: null,
    history: [],
  },
  {
    id: 'c2-2',
    articleId: 'a2',
    auteurId: 'u11',
    auteurLabel: 'Michel Weber',
    contenu:
      "Les comptes rendus complets sont-ils envoyés par courriel aux adhérents, ou seulement disponibles à la permanence ?",
    createdAt: '2026-10-22T08:15:00',
    updatedAt: null,
    parentId: null,
    deletedByAuthor: false,
    moderation: null,
    history: [],
  },

  // ----- Discussion sur l'article a4 (chorale) -----
  {
    id: 'c4-1',
    articleId: 'a4',
    auteurId: 'u10',
    auteurLabel: 'Isabelle Renard',
    contenu:
      "Article très utile. Existe-t-il un enregistrement du répertoire pour réviser entre les répétitions, ou apprend-on tout en séance ?",
    createdAt: '2026-09-16T10:30:00',
    updatedAt: null,
    parentId: null,
    deletedByAuthor: false,
    moderation: null,
    history: [],
  },
  {
    id: 'c4-2',
    articleId: 'a4',
    auteurId: 'u2',
    auteurLabel: 'Robert Klein',
    contenu:
      "Bonjour Isabelle, la cheffe de chœur envoie des enregistrements d'apprentissage par courriel à chaque nouvelle chanson. Rien à apprendre avant la première séance.",
    createdAt: '2026-09-16T14:50:00',
    updatedAt: null,
    parentId: 'c4-1',
    deletedByAuthor: false,
    moderation: null,
    history: [],
  },
  {
    id: 'c4-3',
    articleId: 'a4',
    auteurId: 'u12',
    auteurLabel: 'Anne Charpentier',
    contenu:
      "Je confirme que le solfège n'est pas nécessaire : je chante avec la chorale depuis deux ans et je n'ai jamais lu une partition de ma vie.",
    createdAt: '2026-09-17T18:10:00',
    updatedAt: null,
    parentId: null,
    deletedByAuthor: false,
    moderation: null,
    history: [],
  },

  // ----- Discussion sur l'article a6 (bibliothèque) -----
  {
    id: 'c6-1',
    articleId: 'a6',
    auteurId: 'u13',
    auteurLabel: 'Gérard Muller',
    contenu:
      "Quarante ans déjà ! J'ai connu la bibliothèque dans le vieux local du presbytère. Merci aux bénévoles pour tout ce travail.",
    createdAt: '2026-08-13T09:05:00',
    updatedAt: null,
    parentId: null,
    deletedByAuthor: false,
    moderation: null,
    history: [],
  },
  {
    id: 'c6-2',
    articleId: 'a6',
    auteurId: 'u3',
    auteurLabel: 'Marie Dupont',
    contenu:
      "@Gérard M. Complètement d'accord. La bibliothèque mériterait d'être plus visible : pourquoi pas un stand lors de la fête du village ?",
    createdAt: '2026-08-13T11:20:00',
    updatedAt: null,
    parentId: 'c6-1',
    deletedByAuthor: false,
    moderation: null,
    history: [],
  },
  {
    id: 'c6-3',
    articleId: 'a6',
    auteurId: null,
    auteurLabel: 'Utilisateur supprimé',
    contenu:
      "Nous étions au repas partagé, très bonne organisation et ambiance chaleureuse. Merci encore aux bénévoles présents.",
    createdAt: '2026-08-14T16:35:00',
    updatedAt: null,
    parentId: null,
    deletedByAuthor: false,
    moderation: null,
    history: [],
  },
]
