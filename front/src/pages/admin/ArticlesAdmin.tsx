import { ContentImage } from '../../components/content/ContentImage'
import { CarouselSelection } from '../../components/admin/CarouselSelection'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, FileText, ListFilter, Pencil, RotateCcw, Search, Trash2, Undo2 } from 'lucide-react'
import type { Article } from '../../types'
import { db, useDbVersion } from '../../lib/db'
import { articleAction, useContentAction } from '../../lib/content'
import { articleAuthorLabel, articleCoverMediaId, getCategory, getMedia } from '../../lib/selectors'
import { formatDate, formatDateTime } from '../../lib/format'
import { mediaUrl } from '../../lib/assets'
import { AdminPageHead } from '../../components/layout/AdminLayout'
import { ArticleStatutBadge } from '../../components/content/ArticleCard'
import { buttonClasses, Button, Field, Input, Select } from '../../components/ui/form'
import { ConfirmDialog } from '../../components/ui/overlay'
import { Alert, Badge, EmptyState } from '../../components/ui/feedback'
import { useToast } from '../../hooks/useToast'

type Onglet = 'publies' | 'programmes' | 'brouillons' | 'corbeille'

/** Identifiant d'onglet → statut d'article (singulier) */
const STATUT_PAR_ONGLET: Record<Onglet, Article['statut']> = {
  publies: 'publie',
  programmes: 'programme',
  brouillons: 'brouillon',
  corbeille: 'corbeille',
}

/** Gestion des articles (§20, §21) : tableau lisible par statut, recherche,
 *  filtres, actions contextuelles, corbeille avec restauration au choix */
export function ArticlesAdmin() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const effectuer = useContentAction()
  const [params, setParams] = useSearchParams()
  const carrouselOuvert = params.get('carrousel') === '1'
  const setCarrouselOuvert = (ouvert: boolean) => setParams(actuels => {
    const suivants = new URLSearchParams(actuels)
    if (ouvert) suivants.set('carrousel', '1')
    else suivants.delete('carrousel')
    return suivants
  }, { replace: true })
  const version = useDbVersion()

  const onglet = (params.get('onglet') as Onglet) ?? 'publies'
  const [recherche, setRecherche] = useState('')
  const [filtreCategorie, setFiltreCategorie] = useState('')
  const [aCorbeille, setACorbeille] = useState<Article | null>(null)
  const [aSupprimer, setASupprimer] = useState<Article | null>(null)
  const [aRestaurer, setARestaurer] = useState<Article | null>(null)
  const [aRetirer, setARetirer] = useState<Article | null>(null)

  const comptes = {
    publies: db.articles.filter((a) => a.statut === 'publie').length,
    programmes: db.articles.filter((a) => a.statut === 'programme').length,
    brouillons: db.articles.filter((a) => a.statut === 'brouillon').length,
    corbeille: db.articles.filter((a) => a.statut === 'corbeille').length,
  }

  const articles = useMemo(() => {
    let base = db.articles.filter((a) => a.statut === STATUT_PAR_ONGLET[onglet])
    const q = recherche.trim().toLowerCase()
    if (q) {
      base = base.filter(
        (a) =>
          a.titre.toLowerCase().includes(q) ||
          articleAuthorLabel(a).toLowerCase().includes(q),
      )
    }
    if (filtreCategorie) {
      base = base.filter((a) => a.categorieIds.includes(filtreCategorie))
    }
    return [...base].sort((a, b) => {
      const da = a.publishedAt ?? a.programmeAt ?? a.updatedAt
      const dbb = b.publishedAt ?? b.programmeAt ?? b.updatedAt
      return dbb.localeCompare(da)
    })
  }, [version, onglet, recherche, filtreCategorie])

  const setOnglet = (o: Onglet) => {
    const next = new URLSearchParams(params)
    next.set('onglet', o)
    setParams(next, { replace: true })
  }

  const onglets: { id: Onglet; label: string; count: number }[] = [
    { id: 'publies', label: 'Publiés', count: comptes.publies },
    { id: 'programmes', label: 'Programmés', count: comptes.programmes },
    { id: 'brouillons', label: 'Brouillons', count: comptes.brouillons },
    { id: 'corbeille', label: 'Corbeille', count: comptes.corbeille },
  ]

  const datePrincipale = (a: Article) => {
    if (a.statut === 'publie') return `Publié le ${formatDate(a.publishedAt)}`
    if (a.statut === 'programme') return `Publication prévue le ${formatDateTime(a.programmeAt)}`
    if (a.statut === 'corbeille') return `Dernière modification le ${formatDate(a.updatedAt)}`
    return `Brouillon mis à jour le ${formatDate(a.updatedAt)}`
  }

  const actions = (a: Article) => {
    switch (a.statut) {
      case 'publie':
        return (
          <>
            <Link to={`/admin/articles/${a.id}`} className={buttonClasses('secondaire', 'petit')}>
              <Pencil aria-hidden="true" className="h-4 w-4" />
              Modifier
            </Link>
            {a.publicSnapshot ? (
              <>
                <Button
                  size="petit"
                  onClick={() => effectuer(async () => {
                    await articleAction(a.id, 'publish')
                    toast('La nouvelle version est publiée : elle remplace la version précédente.')
                  })}
                >
                  Valider la nouvelle version
                </Button>
                <Button
                  size="petit"
                  variant="blanc"
                  onClick={() => effectuer(async () => {
                    await articleAction(a.id, 'discard-work', { confirmed: true })
                    toast('Les modifications en préparation ont été annulées.', 'info')
                  })}
                >
                  Annuler les modifications
                </Button>
              </>
            ) : null}
            <Link to={`/admin/articles/${a.id}/preview`} className={buttonClasses('fantome', 'petit')}>
              <Eye aria-hidden="true" className="h-4 w-4" />
              Prévisualiser
            </Link>
            <Button size="petit" variant="secondaire" onClick={() => setARetirer(a)}>
              Retirer de la publication
            </Button>
            <Button size="petit" variant="danger" onClick={() => setACorbeille(a)}>
              <Trash2 aria-hidden="true" className="h-4 w-4" />
              Corbeille
            </Button>
          </>
        )
      case 'programme':
        return (
          <>
            <Link to={`/admin/articles/${a.id}`} className={buttonClasses('secondaire', 'petit')}>
              <Pencil aria-hidden="true" className="h-4 w-4" />
              Modifier
            </Link>
            <Link to={`/admin/articles/${a.id}/preview`} className={buttonClasses('fantome', 'petit')}>
              <Eye aria-hidden="true" className="h-4 w-4" />
              Prévisualiser
            </Link>
            <Button
              size="petit"
              onClick={() => effectuer(async () => {
                await articleAction(a.id, 'publish')
                toast('Article publié immédiatement (publication anticipée).')
              })}
            >
              Publier maintenant
            </Button>
            <Button
              size="petit"
              variant="secondaire"
              onClick={() => effectuer(async () => {
                await articleAction(a.id, 'cancel-schedule')
                toast("Programmation annulée : l'article est de nouveau un brouillon.", 'info')
              })}
            >
              Annuler la programmation
            </Button>
            <Button size="petit" variant="danger" onClick={() => setACorbeille(a)}>
              <Trash2 aria-hidden="true" className="h-4 w-4" />
              Supprimer (corbeille)
            </Button>
          </>
        )
      case 'brouillon':
        return (
          <>
            <Link to={`/admin/articles/${a.id}`} className={buttonClasses('secondaire', 'petit')}>
              <Pencil aria-hidden="true" className="h-4 w-4" />
              Modifier
            </Link>
            <Link to={`/admin/articles/${a.id}/preview`} className={buttonClasses('fantome', 'petit')}>
              <Eye aria-hidden="true" className="h-4 w-4" />
              Prévisualiser
            </Link>
            <Button
              size="petit"
              onClick={() => effectuer(async () => {
                await articleAction(a.id, 'publish')
                toast('Article publié immédiatement.')
              })}
            >
              Publier immédiatement
            </Button>
            <Button
              size="petit"
              variant="danger"
              onClick={() => effectuer(async () => {
                await articleAction(a.id, 'trash')
                toast('Article placé dans la corbeille.', 'info')
              })}
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
              Mettre à la corbeille
            </Button>
          </>
        )
      case 'corbeille':
        return (
          <>
            <Button size="petit" onClick={() => setARestaurer(a)}>
              <Undo2 aria-hidden="true" className="h-4 w-4" />
              Restaurer
            </Button>
            <Button size="petit" variant="danger" onClick={() => setASupprimer(a)}>
              <RotateCcw aria-hidden="true" className="hidden h-4 w-4" />
              Supprimer définitivement
            </Button>
          </>
        )
    }
  }

  return (
    <>
      <AdminPageHead
        titre="Articles"
        description="Créez, publiez, programmez et archivez les actualités de l'association. Un article publié modifié reste visible dans sa version publique jusqu'à la validation de la nouvelle version."
      >
        <Button variant="secondaire" onClick={() => setCarrouselOuvert(true)}>
          Gérer la une
        </Button>
        <Link to="/admin/articles/nouveau" className={buttonClasses('primaire')}>
          <FileText aria-hidden="true" className="h-5 w-5" />
          Nouvel article
        </Link>
      </AdminPageHead>
      {carrouselOuvert ? <CarouselSelection onClose={() => setCarrouselOuvert(false)} /> : null}

      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        {/* Onglets de statut */}
        <div role="tablist" aria-label="Articles par statut" className="flex flex-wrap gap-2">
          {onglets.map((o) => (
            <button
              key={o.id}
              role="tab"
              aria-selected={onglet === o.id}
              onClick={() => setOnglet(o.id)}
              className={`inline-flex min-h-[48px] items-center gap-2 rounded-xl px-5 font-bold transition-colors ${
                onglet === o.id
                  ? o.id === 'corbeille'
                    ? 'bg-brique text-white'
                    : 'bg-forest text-white'
                  : 'border border-line bg-white text-forest hover:bg-leaf-pale'
              }`}
            >
              {o.label}
              <span
                className={`rounded-full px-2 py-0.5 text-[0.8125rem] ${
                  onglet === o.id ? 'bg-white/20' : 'bg-sand-dark'
                }`}
              >
                {o.count}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-4 rounded-2xl border border-line bg-white p-5 md:grid-cols-[1fr_auto]">
          <Field label="Rechercher un article" htmlFor="admin-art-q">
            <div className="relative">
              <Input
                id="admin-art-q"
                type="search"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Titre ou auteur…"
              />
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-mist"
              />
            </div>
          </Field>
          <Field label="Catégorie" htmlFor="admin-art-cat">
            <Select
              id="admin-art-cat"
              value={filtreCategorie}
              onChange={(e) => setFiltreCategorie(e.target.value)}
            >
              <option value="">Toutes les catégories</option>
              {db.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <p className="mt-4 text-mist" role="status">
          <ListFilter aria-hidden="true" className="mr-1 inline h-5 w-5" />
          {articles.length} article{articles.length > 1 ? 's' : ''} dans cet onglet
        </p>

        {articles.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon={FileText}
              title={
                onglet === 'corbeille'
                  ? 'La corbeille est vide'
                  : onglet === 'programmes'
                    ? 'Aucun article programmé'
                    : onglet === 'brouillons'
                      ? 'Aucun brouillon'
                      : 'Aucun article publié pour le moment'
              }
              description={
                recherche || filtreCategorie
                  ? 'Aucun article ne correspond à la recherche et aux filtres actuels.'
                  : 'Créez un article pour commencer.'
              }
              action={
                <Link to="/admin/articles/nouveau" className={buttonClasses('primaire')}>
                  Nouvel article
                </Link>
              }
            />
          </div>
        ) : (
          <>
            {/* Tableau desktop */}
            <div className="scrollzone carte mt-6 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1050px] border-collapse text-left text-[1rem]">
                <caption className="sr-only">
                  Liste des articles de l'onglet {onglets.find((o) => o.id === onglet)?.label}
                </caption>
                <thead>
                  <tr className="border-b border-line bg-sand">
                    <th scope="col" className="px-4 py-3">Couverture</th>
                    <th scope="col" className="px-4 py-3">Titre</th>
                    <th scope="col" className="px-4 py-3">Auteur</th>
                    <th scope="col" className="px-4 py-3">Catégories</th>
                    <th scope="col" className="px-4 py-3">Statut</th>
                    <th scope="col" className="px-4 py-3">Publié le</th>
                    <th scope="col" className="px-4 py-3">Modifié le</th>
                    <th scope="col" className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {articles.map((a) => {
                    const cover = getMedia(articleCoverMediaId(a))
                    return (
                      <tr key={a.id} className="border-b border-line align-top">
                        <td className="px-4 py-3">
                          {cover ? (
                            <ContentImage
                              src={mediaUrl(cover.file)}
                              alt=""
                              className="h-14 w-20 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="h-14 w-20 rounded-lg bg-leaf-pale" aria-hidden="true" />
                          )}
                        </td>
                        <td className="max-w-[22rem] px-4 py-3">
                          <Link
                            to={`/admin/articles/${a.id}`}
                            className="rounded-md font-bold underline decoration-line underline-offset-4 hover:underline"
                          >
                            {a.titre}
                          </Link>
                          {a.publicSnapshot ? (
                            <p className="mt-1 text-[0.8125rem] font-bold text-ocre-dark">
                              Version en préparation
                            </p>
                          ) : null}
                          {a.misEnAvant ? (
                            <p className="mt-1 text-[0.8125rem] text-mist">À la une</p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">{articleAuthorLabel(a)}</td>
                        <td className="px-4 py-3">
                          {a.categorieIds.length === 0 ? (
                            <span className="text-mist">—</span>
                          ) : (
                            <ul className="flex flex-wrap gap-1">
                              {a.categorieIds.map((cid) => (
                                <li key={cid} className="rounded-full bg-ocre-pale px-2 py-0.5 text-[0.8125rem] font-bold text-ocre-dark">
                                  {getCategory(cid)?.nom ?? '—'}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className="px-4 py-3"><ArticleStatutBadge statut={a.statut} /></td>
                        <td className="px-4 py-3 text-[0.9375rem]">
                          {a.publishedAt ? formatDate(a.publishedAt) : '—'}
                        </td>
                        <td className="px-4 py-3 text-[0.9375rem]">{formatDate(a.updatedAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">{actions(a)}</div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Cartes mobile : même contenu, disposition adaptée */}
            <ul className="mt-6 flex flex-col gap-4 md:hidden">
              {articles.map((a) => (
                <li key={a.id} className="carte p-5">
                  <div className="flex gap-4">
                    {(() => {
                      const cover = getMedia(articleCoverMediaId(a))
                      return cover ? (
                        <ContentImage
                          src={mediaUrl(cover.file)}
                          alt=""
                          className="h-20 w-24 shrink-0 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="h-20 w-24 shrink-0 rounded-xl bg-leaf-pale" aria-hidden="true" />
                      )
                    })()}
                    <div className="min-w-0">
                      <Link
                        to={`/admin/articles/${a.id}`}
                        className="font-bold underline decoration-line underline-offset-4"
                      >
                        {a.titre}
                      </Link>
                      <p className="mt-1 text-[0.875rem] text-mist">{datePrincipale(a)}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-2">
                        <ArticleStatutBadge statut={a.statut} />
                        {a.publicSnapshot ? <Badge variant="ocre">Version en préparation</Badge> : null}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-[0.9375rem]">
                    Par {articleAuthorLabel(a)}
                    {a.categorieIds.length > 0
                      ? ` — ${a.categorieIds.map((cid) => getCategory(cid)?.nom ?? '').filter(Boolean).join(', ')}`
                      : ''}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">{actions(a)}</div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Confirmation : article programmé → corbeille (§21 : confirmation obligatoire) */}
      <ConfirmDialog
        open={!!aCorbeille}
        onClose={() => setACorbeille(null)}
        onConfirm={() => effectuer(async () => {
          if (aCorbeille) {
            await articleAction(aCorbeille.id, 'trash', { confirmed: true })
            toast(
              'Article placé dans la corbeille.',
              'info',
            )
          }
          setACorbeille(null)
        })}
        title="Confirmer la mise à la corbeille"
        confirmLabel="Mettre à la corbeille"
      >
        <p>
          « {aCorbeille?.titre} » sera placé dans la corbeille.
          {aCorbeille?.programmeAt ? ` Sa publication prévue le ${formatDateTime(aCorbeille.programmeAt)} sera annulée.` : ''}
        </p>
      </ConfirmDialog>

      {/* Restauration : choix Brouillon ou Publié (§21) */}
      <ConfirmDialog
        open={!!aRestaurer}
        onClose={() => setARestaurer(null)}
        onConfirm={() => effectuer(async () => {
          if (aRestaurer) {
            await articleAction(aRestaurer.id, 'restore-draft')
            toast("Article restauré en brouillon : il n'est pas publié automatiquement.")
          }
          setARestaurer(null)
        })}
        title="Restaurer depuis la corbeille"
        confirmLabel="Restaurer en brouillon"
      >
        <p>Choisissez la cible de restauration pour « {aRestaurer?.titre} » :</p>
        <ul className="mt-3 flex flex-col gap-2">
          <li>
            <strong>Brouillon</strong> : l'article redevient modifiable et n'est pas publié
            automatiquement (bouton ci-dessous).
          </li>
          <li>
            <strong>Publié</strong> : l'article redevient immédiatement accessible au public —
            utilisez « Restaurer directement en publié » dans la liste ci-dessous.
          </li>
        </ul>
        <div className="mt-4">
          <Button
            variant="ocre"
            onClick={() => effectuer(async () => {
              if (aRestaurer) {
                await articleAction(aRestaurer.id, 'restore-published')
                toast('Article restauré et publié : il est à nouveau accessible publiquement.')
              }
              setARestaurer(null)
            })}
          >
            Restaurer directement en publié
          </Button>
        </div>
      </ConfirmDialog>

      {/* Suppression définitive (§21) : commentaires associés supprimés */}
      <ConfirmDialog
        open={!!aSupprimer}
        onClose={() => setASupprimer(null)}
        onConfirm={() => effectuer(async () => {
          if (aSupprimer) {
            await articleAction(aSupprimer.id, 'delete', { confirmed: true })
            toast('Article supprimé définitivement, avec ses commentaires associés.', 'info')
          }
          setASupprimer(null)
        })}
        title="Supprimer définitivement cet article ?"
        confirmLabel="Supprimer définitivement"
      >
        <Alert kind="attention" title="Action définitive">
          <p>
            « {aSupprimer?.titre} » sera supprimé définitivement, ainsi que tous ses commentaires
            associés. Les données associées qui ne sont plus nécessaires seront supprimées
            conformément aux règles RGPD. Cette action ne peut pas être annulée.
          </p>
        </Alert>
      </ConfirmDialog>

      {/* Retrait de publication */}
      <ConfirmDialog
        open={!!aRetirer}
        onClose={() => setARetirer(null)}
        onConfirm={() => effectuer(async () => {
          if (aRetirer) {
            await articleAction(aRetirer.id, 'unpublish')
            toast(
              "Article retiré de la publication : il redevient un brouillon non visible publiquement.",
              'info',
            )
          }
          setARetirer(null)
        })}
        title="Retirer cet article de la publication ?"
        confirmLabel="Retirer de la publication"
      >
        <p>
          « {aRetirer?.titre} » ne sera plus visible publiquement et redeviendra un brouillon. Le
          comportement précis des dates lors d'un retrait est un point à confirmer en phase
          technique (le cahier des charges laisse ce comportement à préciser).
        </p>
      </ConfirmDialog>
    </>
  )
}
