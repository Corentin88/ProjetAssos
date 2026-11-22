import { Link } from 'react-router-dom'
import { Compass, Ear, Keyboard, Palette, Search, TextQuote } from 'lucide-react'
import type { AssociationPage } from '../../types'
import { useResource } from '../../lib/community'
import { PageHead } from '../../components/layout/PublicLayout'

/** Mentions légales */
export function MentionsLegales() {
  const { data } = useResource<AssociationPage>('/association')
  const c = data?.coordonnees
  return (
    <div>
      <PageHead titre="Mentions légales" />
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="flex flex-col gap-6 rounded-2xl border border-line bg-white p-6 md:p-10">
          <section aria-labelledby="ml-editeur">
            <h2 id="ml-editeur" className="text-2xl text-forest">Éditeur du site</h2>
            <p className="mt-3">
              Le site est édité par l'association <strong>Foyer Rural d'Arches</strong>,
              association loi 1901 fondée en 1962{c?.adresse && `, dont le siège se situe au ${c.adresse}, ${c.codePostal} ${c.ville}`}.
            </p>
            <ul className="mt-3 flex list-disc flex-col gap-1 pl-5">
              {c?.telephone && <li>Téléphone : {c.telephone}</li>}
              {c?.email && <li>Courriel : {c.email}</li>}
              <li>Responsable de la publication : Claire Marchal, présidente</li>
            </ul>
          </section>
          <section aria-labelledby="ml-hyberge">
            <h2 id="ml-hyberge" className="text-2xl text-forest">Hébergement</h2>
            <p className="mt-3">
              L'hébergeur du site et les conditions d'hébergement seront précisés dans les
              spécifications techniques du projet (phase de développement backend).
            </p>
          </section>
          <section aria-labelledby="ml-propriete">
            <h2 id="ml-propriete" className="text-2xl text-forest">Propriété intellectuelle</h2>
            <p className="mt-3">
              Les contenus (textes, photographies) sont la propriété de l'association ou
              de leurs auteurs respectifs. Les visuels utilisés dans cette maquette sont des images
              d'illustration issues de banques de photographies publiques et ne représentent pas
              nécessairement l'association ou ses membres.
            </p>
          </section>
          <section aria-labelledby="ml-acces">
            <h2 id="ml-acces" className="text-2xl text-forest">Accessibilité et disponibilité</h2>
            <p className="mt-3">
              L'accessibilité du site est traitée dès la conception : consultez la{' '}
              <Link to="/accessibilite" className="font-bold underline underline-offset-4">
                page Accessibilité (conformité RGAA)
              </Link>{' '}
              pour les engagements détaillés et le retour d'expérience.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

/** Politique de confidentialité (§44 RGPD) */
export function Confidentialite() {
  return (
    <div>
      <PageHead
        titre="Politique de confidentialité"
        sousTitre="Données personnelles collectées par l'association, finalités et durées de conservation (RGPD)."
      />
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="flex flex-col gap-6 rounded-2xl border border-line bg-white p-6 md:p-10">
          <section aria-labelledby="pc-collecte">
            <h2 id="pc-collecte" className="text-2xl text-forest">Données collectées et finalités</h2>
            <ul className="mt-3 flex flex-col gap-3">
              <li className="rounded-xl bg-sand p-4">
                <strong>Compte utilisateur</strong> — prénom, nom, adresse e-mail, avatar,
                méthodes de connexion. Finalité : fonctionnement du compte, participation aux
                discussions, espace personnel.
              </li>
              <li className="rounded-xl bg-sand p-4">
                <strong>Commentaires</strong> — contenu, dates de publication et de modification.
                Finalité : discussions sous les articles. Les données de modération sont conservées
                6 mois.
              </li>
              <li className="rounded-xl bg-sand p-4">
                <strong>Notifications</strong> — messages internes au site (réponses, actions
                concernant votre compte). Conservation maximale : 1 an. Aucune notification
                courrielle systématique.
              </li>
              <li className="rounded-xl bg-sand p-4">
                <strong>Messages de contact</strong> — prénom, nom, e-mail, sujet, message.
                Finalité : répondre aux demandes. Les réponses sont transmises par courriel.
              </li>
              <li className="rounded-xl bg-sand p-4">
                <strong>Statistiques de fréquentation</strong> — nombre de visiteurs, pages vues,
                recherches effectuées. Les données collectées, leur durée de conservation et
                l'éventuel usage de cookies seront précisés dans la conception RGPD détaillée du
                projet.
              </li>
            </ul>
          </section>
          <section aria-labelledby="pc-durees">
            <h2 id="pc-durees" className="text-2xl text-forest">Durées de conservation</h2>
            <ul className="mt-3 flex list-disc flex-col gap-1 pl-5">
              <li>Journal d'activité administratif : conservation sans expiration automatique.</li>
              <li>Données de modération des commentaires : 6 mois, puis suppression automatique.</li>
              <li>Notifications : 1 an maximum.</li>
              <li>Articles en corbeille : jusqu'à suppression définitive explicite par un administrateur.</li>
            </ul>
          </section>
          <section aria-labelledby="pc-droits">
            <h2 id="pc-droits" className="text-2xl text-forest">Vos droits</h2>
            <p className="mt-3">
              Vous pouvez accéder à vos données, les rectifier depuis votre espace personnel,
              demander leur suppression et supprimer définitivement votre compte à tout moment
              (les commentaires existants restent alors attribués à « Utilisateur supprimé »).
              Pour exercer vos droits ou poser une question, utilisez le{' '}
              <Link to="/contact" className="font-bold underline underline-offset-4">
                formulaire de contact
              </Link>
              .
            </p>
          </section>
          <section aria-labelledby="pc-google">
            <h2 id="pc-google" className="text-2xl text-forest">Connexion avec Google</h2>
            <p className="mt-3">
              L'association d'un compte Google est toujours explicite et réversible. Le
              fonctionnement détaillé du traitement des données liées aux connexions externes sera
              précisé avec l'intégration technique de l'authentification.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

/** Page Accessibilité — engagement RGAA honnête (brief : ne pas présenter
 *  une simple barre d'outils comme preuve de conformité) */
export function Accessibilite() {
  return (
    <div>
      <PageHead
        titre="Accessibilité : conformité RGAA"
        sousTitre="L'accessibilité est intégrée dès la conception, sur le site public comme dans l'espace d'administration."
      />
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="flex flex-col gap-6 rounded-2xl border border-line bg-white p-6 md:p-10">
          <section aria-labelledby="acc-etat">
            <h2 id="acc-etat" className="text-2xl text-forest">État de conformité</h2>
            <p className="mt-3">
              Cette maquette vise la conformité au <strong>Référentiel général d'amélioration de
              l'accessibilité (RGAA 4.1)</strong> et aux critères <strong>WCAG 2.1 niveau AA</strong>{' '}
              pertinents. En tant que maquette de conception, elle n'a pas encore fait l'objet d'un
              audit complet : la déclaration de conformité officielle sera établie après l'audit du
              site en production.
            </p>
          </section>

          <section aria-labelledby="acc-dispositions">
            <h2 id="acc-dispositions" className="text-2xl text-forest">Dispositions prises dès la conception</h2>
            <ul className="mt-3 grid gap-3">
              <li className="flex items-start gap-3 rounded-xl bg-sand p-4">
                <Palette aria-hidden="true" className="mt-1 h-6 w-6 shrink-0 text-forest" />
                <span>
                  <strong>Contrastes</strong> : la palette (verts profonds, ocre, fonds apaisés) a été choisie
                  pour garantir des contrastes suffisants entre textes et fonds ; aucune
                  information n'est véhiculée par la couleur seule (les statuts portent toujours
                  un libellé texte).
                </span>
              </li>
              <li className="flex items-start gap-3 rounded-xl bg-sand p-4">
                <Keyboard aria-hidden="true" className="mt-1 h-6 w-6 shrink-0 text-forest" />
                <span>
                  <strong>Navigation clavier</strong> : tous les éléments interactifs sont
                  atteignables et utilisables au clavier, avec un focus visible renforcé (contour
                  ocre 3 px). Un lien d'évitement permet d'aller directement au contenu principal.
                </span>
              </li>
              <li className="flex items-start gap-3 rounded-xl bg-sand p-4">
                <TextQuote aria-hidden="true" className="mt-1 h-6 w-6 shrink-0 text-forest" />
                <span>
                  <strong>Structure et contenu</strong> : HTML sémantique (header, nav, main,
                  article, aside), hiérarchie de titres correcte, textes alternatifs pour les
                  images, zone visuelle standardisée pour les cartes d'articles avec alternatives
                  textuelles complètes.
                </span>
              </li>
              <li className="flex items-start gap-3 rounded-xl bg-sand p-4">
                <Ear aria-hidden="true" className="mt-1 h-6 w-6 shrink-0 text-forest" />
                <span>
                  <strong>Lecteurs d'écran</strong> : libellés explicites pour les formulaires,
                  messages d'erreur en <code>role="alert"</code>, notifications en zone live,
                  fenêtres modales avec <code>aria-modal</code> et gestion du focus, carrousel
                  contrôlable et pausable avec <code>aria-roledescription</code>.
                </span>
              </li>
              <li className="flex items-start gap-3 rounded-xl bg-sand p-4">
                <Search aria-hidden="true" className="mt-1 h-6 w-6 shrink-0 text-forest" />
                <span>
                  <strong>Zoom et recomposition</strong> : zoom à 200 % sans perte de
                  fonctionnalité, contenu recomposé sur petits écrans (le site reste utilisable en
                  320 px de large), tables de données alternatives aux graphiques.
                </span>
              </li>
              <li className="flex items-start gap-3 rounded-xl bg-sand p-4">
                <Compass aria-hidden="true" className="mt-1 h-6 w-6 shrink-0 text-forest" />
                <span>
                  <strong>Mouvements</strong> : animations légères et non indispensables, respect
                  de <code>prefers-reduced-motion</code> (défilement automatique du carrousel
                  désactivé, transitions neutralisées).
                </span>
              </li>
            </ul>
          </section>

          <section aria-labelledby="acc-typo">
            <h2 id="acc-typo" className="text-2xl text-forest">Lisibilité et ergonomie</h2>
            <p className="mt-3">
              Texte courant de 18 px avec interligne confortable, police Atkinson Hyperlegible
              pensée pour la lisibilité, boutons de 48 px minimum, espacement généreux entre les
              éléments interactifs, libellés clairs accompagnés d'icônes, navigation simple et
              prévisible. Le site s'adresse à toutes les générations sans infantiliser personne.
            </p>
          </section>

          <section aria-labelledby="acc-retour">
            <h2 id="acc-retour" className="text-2xl text-forest">Signaler un problème</h2>
            <p className="mt-3">
              Si vous rencontrez une difficulté d'accès à un contenu ou à une fonctionnalité,
              signalez-la via le{' '}
              <Link to="/contact" className="font-bold underline underline-offset-4">
                formulaire de contact
              </Link>{' '}
              en décrivant la page concernée : le bureau s'engage à vous répondre et à corriger le
              problème.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

/** Page 404 */
export function PageIntrouvable() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">
      <p className="text-6xl font-bold text-forest">404</p>
      <h1 className="mt-4 text-forest">Cette page n'existe pas (ou plus)</h1>
      <p className="mt-3 text-mist">
        Le contenu demandé a peut-être été déplacé, retiré ou n'a jamais existé. Vous pouvez
        revenir à l'accueil, consulter les actualités ou utiliser la recherche.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <Link to="/" className="inline-flex min-h-[48px] items-center rounded-xl bg-forest px-6 font-bold text-white hover:bg-forest-dark">
          Retour à l'accueil
        </Link>
        <Link to="/actualites" className="inline-flex min-h-[48px] items-center rounded-xl border border-forest bg-white px-6 font-bold text-forest hover:bg-leaf-pale">
          Voir les actualités
        </Link>
        <Link to="/actualites?avancee=1" className="inline-flex min-h-[48px] items-center rounded-xl border border-forest bg-white px-6 font-bold text-forest hover:bg-leaf-pale">
          Rechercher un contenu
        </Link>
      </div>
    </div>
  )
}
