import { useId, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, MessageCircle } from 'lucide-react'
import { currentUser, useDb } from '../../lib/db'
import { getArticleById, getUser, userPublicComments } from '../../lib/selectors'
import { formatDate, formatMoisAnnee } from '../../lib/format'
import { Avatar } from '../../components/ui/misc'
import { EmptyState, ErrorState } from '../../components/ui/feedback'
import { Button, buttonClasses } from '../../components/ui/form'
import { Breadcrumb } from '../../components/ui/nav'
import { RequireAuth } from '../../components/layout/guards'

function ProfilPublicContenu({ tousLesCommentaires }: { tousLesCommentaires?: boolean }) {
  useDb()
  const { id } = useParams()
  // L'identifiant « moi » pointe vers la session courante
  const sessionUser = currentUser()
  const cibleId = id === 'moi' ? (sessionUser?.id ?? undefined) : id
  const cible = getUser(cibleId ?? null)

  if (!cible) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <ErrorState
          title="Profil introuvable"
          description="Ce profil n'existe pas ou appartient à un compte supprimé."
        />
      </div>
    )
  }

  const commentairesPublics = userPublicComments(cible.id)
  const nbCommentaires = commentairesPublics.length
  const commentaires = tousLesCommentaires ? commentairesPublics : commentairesPublics.slice(0, 5) // §15

  const prenom = cible.prenom
  const initialeNom = cible.nom.charAt(0)
  const nomPublic = initialeNom ? `${prenom} ${initialeNom}.` : prenom

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 [overflow-wrap:anywhere] sm:py-8">
      <Breadcrumb
        items={[
          { label: 'Accueil', to: '/' },
          ...(cibleId === sessionUser?.id
            ? [{ label: 'Mon compte', to: '/mon-compte' }]
            : []),
          { label: `Profil de ${nomPublic}` },
        ]}
      />

      <header className="carte mt-4 flex items-center gap-4 p-4 sm:p-6">
        <Avatar user={{ prenom, nom: initialeNom, avatar: cible.avatar }} />
        <div>
          <h1 className="text-2xl text-forest">
            {nomPublic}
          </h1>
          <p className="mt-1 text-base text-mist">Membre depuis {formatMoisAnnee(cible.createdAt)}</p>
          <p className="text-base text-mist">
            {nbCommentaires} {nbCommentaires === 1 ? 'commentaire public' : 'commentaires publics'}
          </p>
        </div>
      </header>

      <section aria-labelledby="titre-commentaires-publics" className="mt-8">
        <h2 id="titre-commentaires-publics" className="flex items-center gap-2 text-2xl text-forest">
          <MessageCircle aria-hidden="true" className="h-7 w-7" />
          {tousLesCommentaires ? 'Tous ses commentaires publics' : 'Derniers commentaires publics'}
        </h2>

        {commentaires.length === 0 ? (
          <div className="mt-4">
            <EmptyState icon={MessageCircle} title="Aucun commentaire public pour le moment" />
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-4">
            {commentaires.map((c) => {
              const article = getArticleById(c.articleId)
              if (!article) return null
              return (
                <li key={c.id} className="carte p-4 sm:p-5">
                  <p className="mb-2 text-sm text-mist">
                    <time dateTime={c.createdAt}>{formatDate(c.createdAt)}</time>
                    {' · '}
                    <Link to={`/actualites/${article.slug}#commentaire-${c.id}`} className="font-bold text-forest underline underline-offset-4">
                      {article.titre}
                    </Link>
                  </p>
                  <CommentaireApercu contenu={c.contenu} />
                </li>
              )
            })}
          </ul>
        )}

        {!tousLesCommentaires && nbCommentaires > 5 ? (
          <p className="mt-5">
            <Link
              to={`/profil/${cible.id}/commentaires`}
              className={buttonClasses('secondaire')}
            >
              Voir tous les commentaires
            </Link>
          </p>
        ) : null}
        {tousLesCommentaires ? (
          <p className="mt-5">
            <Link
              to={`/profil/${cible.id}`}
              className={buttonClasses('secondaire')}
            >
              <ArrowLeft aria-hidden="true" className="h-5 w-5" />
              Retour au profil
            </Link>
          </p>
        ) : null}
      </section>
    </div>
  )
}

/** Aperçu visuellement limité à environ trois lignes (§15) */
function CommentaireApercu({ contenu }: { contenu: string }) {
  const [complet, setComplet] = useState(false)
  const id = useId()
  return (
    <div>
      <p id={id} className={`whitespace-pre-line text-base ${complet ? '' : 'line-clamp-3'}`}>
        {contenu}
      </p>
      <Button
        variant="fantome"
        size="petit"
        aria-expanded={complet}
        aria-controls={id}
        onClick={() => setComplet((c) => !c)}
      >
        {complet ? 'Réduire le commentaire' : 'Voir le commentaire complet'}
      </Button>
    </div>
  )
}

export function ProfilPublic() {
  return (
    <RequireAuth>
      <ProfilPublicContenu />
    </RequireAuth>
  )
}

export function ProfilPublicCommentaires() {
  return (
    <RequireAuth>
      <ProfilPublicContenu tousLesCommentaires />
    </RequireAuth>
  )
}
