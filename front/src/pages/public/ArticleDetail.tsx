import { Link, useLocation, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, Eye, PencilLine, Tag, User } from 'lucide-react'
import { useDb } from '../../lib/db'
import {
  articleAuthorLabel,
  articleCoverMediaId,
  getCategory,
  getMedia,
  getTag,
  publicBlocks,
  visibleComments,
} from '../../lib/selectors'
import { formatDate, formatDateTime, formatNombre } from '../../lib/format'
import { mediaUrl } from '../../lib/assets'
import { BlockRenderer } from '../../components/content/BlockRenderer'
import { CommentsSection } from '../../components/content/Comments'
import { ArticleStatutBadge } from '../../components/content/ArticleCard'
import { Alert, ErrorState } from '../../components/ui/feedback'
import { Breadcrumb } from '../../components/ui/nav'
import { CategoryChip, TagChip } from '../../components/ui/misc'
import { session } from '../../lib/db'

/** Détail d'un article publié (§17) + commentaires (§28) */
export function ArticleDetail() {
  const db = useDb()
  const { slug } = useParams()
  const location = useLocation()
  const article = db.articles.find((a) => a.slug === slug && (a.statut === 'publie' || a.publicSnapshot))

  /** URL de la liste d'origine (critères, tri, pagination) transmise par les
   *  cartes d'articles : « Retour à la liste » ne perd aucun critère (§25) */
  const origine = location.state?.from as string | undefined
  const depuisAccueil = origine === '/' || origine?.startsWith('/?')
  const retourArticle = origine ?? '/actualites'
  const retourListe = depuisAccueil ? '/actualites' : retourArticle

  if (!article) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <ErrorState
          title="Article introuvable"
          description="Cet article n'existe pas ou n'est plus publié. Il a peut-être été retiré du site ou placé dans la corbeille."
        />
        <p className="mt-6 text-center">
          <Link to={retourArticle} className="inline-flex min-h-[48px] items-center rounded-xl bg-forest px-6 font-bold text-white hover:bg-forest-dark">
            <ArrowLeft aria-hidden="true" className="mr-2 h-5 w-5" />
            {depuisAccueil ? 'Retour à l’accueil' : 'Retour aux actualités'}
          </Link>
        </p>
      </div>
    )
  }

  const coverId = articleCoverMediaId(article)
  const cover = getMedia(coverId)
  const auteur = db.users.find((u) => u.id === article.auteurId)
  const sessionUser = session.current ? db.users.find((u) => u.id === session.current!.userId) : null
  const nbCommentaires = visibleComments(article.id).length

  // Liens des tags/catégories préservent les filtres vers la liste
  return (
    <article className="mx-auto max-w-4xl px-4 py-8">
      <Breadcrumb
        items={[
          { label: 'Accueil', to: '/' },
          { label: 'Actualités', to: retourListe },
          { label: article.titre },
        ]}
      />

      {/* Statut de l'article pour les admins (version publiée / en préparation) */}
      {sessionUser?.role === 'administrateur' ? (
        <div className="mt-4">
          <Alert kind="info" title={`Cet article est : ${article.statut === 'publie' ? 'Publié' : 'En cours de préparation (brouillon de nouvelle version)'}`}>
            {article.publicSnapshot ? (
              <p>
                Une nouvelle version est en préparation dans l'administration. La version affichée
                ci-dessous est celle actuellement visible par le public.{' '}
                <Link to={`/admin/articles/${article.id}`} className="font-bold underline underline-offset-4">
                  Reprendre les modifications
                </Link>
              </p>
            ) : (
              <p>
                <Link to={`/admin/articles/${article.id}`} className="font-bold underline underline-offset-4">
                  Modifier cet article dans l'administration
                </Link>
              </p>
            )}
          </Alert>
        </div>
      ) : null}

      <header className="mt-6">
        <h1 className="text-forest">{article.titre}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.9375rem] text-mist">
          <span className="inline-flex items-center gap-1.5">
            <User aria-hidden="true" className="h-4 w-4" />
            {auteur ? (
              sessionUser ? (
                <Link to={`/profil/${auteur.id}`} className="font-bold underline underline-offset-4 hover:text-forest">
                  {articleAuthorLabel(article)}
                </Link>
              ) : (
                <span className="font-bold">{articleAuthorLabel(article)}</span>
              )
            ) : (
              <span>Utilisateur supprimé</span>
            )}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays aria-hidden="true" className="h-4 w-4" />
            Publié le{' '}
            <time dateTime={article.publishedAt ?? article.updatedAt}>
              {formatDate(article.publishedAt ?? article.updatedAt)}
            </time>
          </span>
          {article.publicSnapshot ? null : (
            <span className="inline-flex items-center gap-1.5">
              <PencilLine aria-hidden="true" className="h-4 w-4" />
              Modifié le {formatDateTime(article.updatedAt)}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <Eye aria-hidden="true" className="h-4 w-4" />
            {formatNombre(article.viewCount)} vues
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Tag aria-hidden="true" className="h-4 w-4" />
            {nbCommentaires} commentaire{nbCommentaires > 1 ? 's' : ''}
          </span>
          <ArticleStatutBadge statut={article.statut} />
        </div>
      </header>

      {cover ? (
        <img
          src={mediaUrl(cover.file)}
          alt={cover.alt}
          className="mt-6 aspect-[16/8] w-full rounded-2xl border border-line object-cover"
        />
      ) : null}

      <div className="mt-8 rounded-2xl border border-line bg-white p-6 md:p-10">
        <BlockRenderer blocks={publicBlocks(article)} />
        <div className="mt-8 border-t border-line pt-6">
          <h2 className="text-lg">Catégories et tags de l'article</h2>
          <ul className="mt-3 flex flex-wrap items-center gap-2" aria-label="Catégories et tags">
            {article.categorieIds.map((cid) => {
              const c = getCategory(cid)
              return c ? (
                <li key={cid}>
                  <CategoryChip to={`/actualites?cat=${encodeURIComponent(c.id)}`}>{c.nom}</CategoryChip>
                </li>
              ) : null
            })}
            {article.tagIds.map((tid) => {
              const t = getTag(tid)
              return t ? (
                <li key={tid}>
                  <TagChip to={`/actualites?tag=${encodeURIComponent(t.id)}`}>#{t.nom}</TagChip>
                </li>
              ) : null
            })}
          </ul>
        </div>
      </div>

      <CommentsSection articleId={article.id} />

      <p className="mt-10">
        <Link
          to={retourArticle}
          className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border border-forest bg-white px-6 font-bold text-forest hover:bg-leaf-pale"
        >
          <ArrowLeft aria-hidden="true" className="h-5 w-5" />
          {depuisAccueil ? 'Retour à l’accueil' : 'Retour à la liste des actualités'}
        </Link>
      </p>
    </article>
  )
}
