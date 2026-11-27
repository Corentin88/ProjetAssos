import { useEffect, useId, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, MessageCircle } from 'lucide-react'
import { ApiError, getPublicProfile, useCurrentUser } from '../../lib/auth'
import { useResource } from '../../lib/community'
import type { Comment } from '../../types'
import { formatDate, formatMoisAnnee } from '../../lib/format'
import { Avatar } from '../../components/ui/misc'
import { Alert, EmptyState, ErrorState } from '../../components/ui/feedback'
import { Button, buttonClasses } from '../../components/ui/form'
import { Breadcrumb } from '../../components/ui/nav'
import { RequireAuth } from '../../components/layout/guards'
import { PageIntrouvable } from './ErrorPages'

function ProfilPublicContenu({ tousLesCommentaires }: { tousLesCommentaires?: boolean }) {
  const { id } = useParams()
  // L'identifiant « moi » pointe vers la session courante
  const sessionUser = useCurrentUser()
  const cibleId = id === 'moi' ? (sessionUser?.id ?? undefined) : id
  const idApi = cibleId && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(cibleId) ? cibleId : undefined
  const commentairesApi = useResource<Comment[]>(idApi ? `/profiles/${idApi}/comments` : undefined, true)
  const [profil, setProfil] = useState<{
    id: string; data?: Awaited<ReturnType<typeof getPublicProfile>>; indisponible?: boolean
  }>()
  useEffect(() => {
    if (!idApi) return
    let actif = true
    void getPublicProfile(idApi).then(data => {
      if (actif) setProfil({ id: idApi, data })
    }).catch(error => {
      if (actif) setProfil({ id: idApi, indisponible: !(error instanceof ApiError && error.status === 404) })
    })
    return () => { actif = false }
  }, [idApi, sessionUser?.id])
  const cible = idApi && profil?.id === idApi ? profil.data : undefined

  if (idApi && profil?.id !== idApi) {
    return <p className="mx-auto max-w-3xl px-4 py-16" role="status">Chargement du profil…</p>
  }

  if (!cible) {
    if (!idApi || !profil?.indisponible) {
      return <PageIntrouvable description="Ce profil n’existe pas ou n’est plus disponible." />
    }
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <ErrorState
          title="Profil indisponible"
          description="Le profil n’a pas pu être chargé."
        />
      </div>
    )
  }

  const commentairesPublics = commentairesApi.data ?? []
  const nbCommentaires = cible.commentCount
  const commentaires = tousLesCommentaires ? commentairesPublics : commentairesPublics.slice(0, 5) // §15

  const prenom = cible.prenom
  const initialeNom = cible.nom.charAt(0)
  const nomPublic = cible.publicName ?? (initialeNom ? `${prenom} ${initialeNom}.` : prenom)

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

        {commentairesApi.error ? <Alert kind="erreur" title="Commentaires indisponibles">{commentairesApi.error}</Alert>
          : !commentairesApi.data ? <p role="status">Chargement…</p> : commentaires.length === 0 ? (
          <div className="mt-4">
            <EmptyState icon={MessageCircle} title="Aucun commentaire public pour le moment" />
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-4">
            {commentaires.map((c) => {
              const slug = c.articleSlug
              if (!slug) return null
              return (
                <li key={c.id} className="carte p-4 sm:p-5">
                  <p className="mb-2 text-sm text-mist">
                    <time dateTime={c.createdAt}>{formatDate(c.createdAt)}</time>
                    {' · '}
                    <Link to={`/actualites/${slug}#commentaire-${c.id}`} className="font-bold text-forest underline underline-offset-4">
                      {c.articleTitre}
                    </Link>
                  </p>
                  <CommentaireApercu contenu={c.contenu} />
                </li>
              )
            })}
          </ul>
        )}

        {!tousLesCommentaires && commentairesPublics.length > 5 ? (
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
