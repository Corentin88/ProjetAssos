import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, MessageCircle } from 'lucide-react'
import { db, session, useDb } from '../../lib/db'
import { getUser, userPublicComments, userPublicCommentCount } from '../../lib/selectors'
import { formatDate, formatMoisAnnee } from '../../lib/format'
import { Avatar } from '../../components/ui/misc'
import { ErrorState } from '../../components/ui/feedback'
import { Breadcrumb } from '../../components/ui/nav'
import { RequireAuth } from '../../components/layout/guards'
import { useState } from 'react'

function ProfilPublicContenu({ tousLesCommentaires }: { tousLesCommentaires?: boolean }) {
  useDb()
  const { id } = useParams()
  // L'identifiant « moi » pointe vers la session courante
  const sessionUser = session.current
    ? db.users.find((u) => u.id === session.current!.userId) ?? null
    : null
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

  const nbCommentaires = userPublicCommentCount(cible.id)
  const commentaires = tousLesCommentaires
    ? userPublicComments(cible.id)
    : userPublicComments(cible.id).slice(0, 5) // 5 derniers commentaires publics (§15)

  const prenom = cible.prenom
  const initialeNom = `${cible.nom.charAt(0)}.`

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Breadcrumb
        items={[
          { label: 'Accueil', to: '/' },
          ...(cibleId === sessionUser?.id
            ? [{ label: 'Mon compte', to: '/mon-compte' }]
            : []),
          { label: `Profil de ${prenom} ${initialeNom}` },
        ]}
      />

      <header className="mt-6 flex items-center gap-6 rounded-2xl border border-line bg-white p-6">
        <Avatar user={cible} size="lg" />
        <div>
          <h1 className="text-2xl text-forest">
            {prenom} <span className="font-normal">{initialeNom}</span>
          </h1>
          <p className="mt-1 italic text-mist">Membre depuis {formatMoisAnnee(cible.createdAt)}</p>
          <p className="mt-1 italic text-mist">
            {nbCommentaires} commentaire{nbCommentaires > 1 ? 's' : ''} publié
            {nbCommentaires > 1 ? 's' : ''}
          </p>
        </div>
      </header>

      <p className="mt-4 text-[0.9375rem] text-mist">
        Seules les informations publiques sont affichées : aucune adresse e-mail, aucun rôle ni
        donnée de connexion n'apparaît sur un profil.
      </p>

      <section aria-labelledby="titre-commentaires-publics" className="mt-8">
        <h2 id="titre-commentaires-publics" className="flex items-center gap-2 text-2xl text-forest">
          <MessageCircle aria-hidden="true" className="h-7 w-7" />
          {tousLesCommentaires ? 'Tous ses commentaires publics' : 'Ses 5 derniers commentaires publics'}
        </h2>

        {commentaires.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-line bg-white p-6 text-mist">
            Aucun commentaire public pour le moment.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-4">
            {commentaires.map((c) => {
              const article = db.articles.find((a) => a.id === c.articleId)
              return (
                <li key={c.id} className="rounded-2xl border border-line bg-white p-5">
                  <CommentaireApercu contenu={c.contenu} />
                  <p className="mt-2 text-[0.875rem] text-mist">
                    Le {formatDate(c.createdAt)} —{' '}
                    {article ? (
                      <>
                        dans l'article{' '}
                        <Link
                          to={`/actualites/${article.slug}#commentaire-${c.id}`}
                          className="font-bold text-forest underline underline-offset-4"
                        >
                          {article.titre}
                        </Link>
                      </>
                    ) : (
                      '(article retiré du site)'
                    )}
                  </p>
                </li>
              )
            })}
          </ul>
        )}

        {!tousLesCommentaires && nbCommentaires > 5 ? (
          <p className="mt-5">
            <Link
              to={`/profil/${cible.id}/commentaires`}
              className="inline-flex min-h-[48px] items-center rounded-xl border border-forest bg-white px-6 font-bold text-forest hover:bg-leaf-pale"
            >
              Voir tous les commentaires de {prenom} {initialeNom}
            </Link>
          </p>
        ) : null}
        {tousLesCommentaires ? (
          <p className="mt-5">
            <Link
              to={`/profil/${cible.id}`}
              className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border border-forest bg-white px-6 font-bold text-forest hover:bg-leaf-pale"
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
  return (
    <div>
      <p className={!complet ? 'line-clamp-3 text-[1.0625rem]' : 'text-[1.0625rem] whitespace-pre-line'}>
        {contenu}
      </p>
      <button
        type="button"
        onClick={() => setComplet((c) => !c)}
        className="mt-2 inline-flex min-h-[44px] items-center rounded-lg font-bold text-forest underline decoration-2 underline-offset-4 hover:bg-leaf-pale"
      >
        {complet ? 'Réduire le commentaire' : 'Voir le commentaire complet'}
      </button>
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
