import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarClock,
  Eye,
  FileText,
  Paperclip,
  Save,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react'
import type { Article } from '../../types'
import {
  cancelEditPublished,
  cancelProgramming,
  createArticle,
  db,
  logAction,
  programArticle,
  publishNow,
  session,
  startEditPublished,
  trashArticle,
  updateArticle,
  useDb,
  validatePublishedEdit,
} from '../../lib/db'
import { getMedia } from '../../lib/selectors'
import { toInputDateTime, formatDateTime } from '../../lib/format'
import { mediaUrl } from '../../lib/assets'
import { AdminPageHead } from '../../components/layout/AdminLayout'
import { BlockEditor } from '../../components/admin/BlockEditor'
import { MediaPicker } from '../../components/admin/MediaPicker'
import { ArticleStatutBadge } from '../../components/content/ArticleCard'
import { BlockView } from '../../components/content/BlockRenderer'
import { Button, Field, Input, buttonClasses } from '../../components/ui/form'
import { ConfirmDialog } from '../../components/ui/overlay'
import { Alert } from '../../components/ui/feedback'
import { useToast } from '../../hooks/useToast'

const MAX_TAGS = 4 // point à confirmer (§46) : nombre maximal de tags

/** Éditeur d'article basé sur les blocs (§18) + workflow de publication (§20).
 *  Ergonomie (brief V3 §4) : zone centrale dédiée au titre et au contenu,
 *  barre d'actions collante toujours accessible, panneau latéral de
 *  paramètres repliable sur mobile. */
export function ArticleEditor() {
  useDb()
  const { id } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const nouveau = !id

  const existant = id ? db.articles.find((a) => a.id === id) : undefined

  // État local du formulaire
  const [titre, setTitre] = useState(existant?.titre ?? '')
  const [blocks, setBlocks] = useState(existant?.blocks ?? [])
  const [categorieIds, setCategorieIds] = useState<string[]>(existant?.categorieIds ?? [])
  const [tagIds, setTagIds] = useState<string[]>(existant?.tagIds ?? [])
  const [coverMediaId, setCoverMediaId] = useState<string | null>(existant?.coverMediaId ?? null)
  const [misEnAvant, setMisEnAvant] = useState(existant?.misEnAvant ?? false)
  const [pickerCouverture, setPickerCouverture] = useState(false)
  const [dateProgrammation, setDateProgrammation] = useState(
    existant?.programmeAt ? toInputDateTime(existant.programmeAt) : '',
  )
  const [corbeilleConfirme, setCorbeilleConfirme] = useState(false)
  /** Panneau de paramètres : replié par défaut sur mobile, toujours visible sur ordinateur */
  const [parametresOuverts, setParametresOuverts] = useState(false)

  const admin = session.current ? db.users.find((u) => u.id === session.current!.userId) : null
  const adminId = admin?.id ?? 'u1'

  // Règle §20 : ouvrir l'éditeur d'un article publié sans modifications en
  // cours prépare automatiquement une nouvelle version en brouillon
  if (existant && existant.statut === 'publie' && !existant.publicSnapshot) {
    startEditPublished(existant.id)
  }

  const enCorbeille = existant?.statut === 'corbeille'

  const enregistrer = (patch?: { titre?: string }) => {
    if (nouveau) {
      const a = createArticle(adminId, { titre, blocks, categorieIds, tagIds, coverMediaId })
      logAction(adminId, 'article', 'Création d\'un brouillon d\'article', titre || 'Article sans titre')
      toast('Brouillon créé : pensez à le compléter avant publication.')
      navigate(`/admin/articles/${a.id}`, { replace: true })
      return
    }
    if (!existant) return
    updateArticle(existant.id, {
      titre: patch?.titre ?? titre,
      blocks,
      categorieIds,
      tagIds,
      coverMediaId,
      misEnAvant,
    })
    logAction(
      adminId,
      'article',
      existant.statut === 'publie'
        ? 'Modification d\'un article publié (version en préparation)'
        : existant.statut === 'programme'
          ? 'Modification d\'un article programmé (date de publication inchangée)'
          : 'Enregistrement du brouillon',
      (patch?.titre ?? titre) || 'Article sans titre',
    )
    toast(
      existant.statut === 'publie'
        ? 'Nouvelle version enregistrée : la version publique reste visible tant que vous ne la validez pas.'
        : existant.statut === 'programme'
          ? 'Modifications enregistrées. La date et l\'heure de publication prévues restent inchangées.'
          : 'Brouillon enregistré.',
    )
  }

  const cover = coverMediaId ? getMedia(coverMediaId) : undefined

  const statutBadge = useMemo(() => {
    if (!existant) return <span className="font-bold">Nouveau brouillon</span>
    return <ArticleStatutBadge statut={existant.statut} />
  }, [existant?.statut])

  return (
    <>
      <AdminPageHead
        titre={nouveau ? 'Nouvel article' : `Modifier : ${existant?.titre ?? ''}`}
        description={
          existant?.statut === 'publie'
            ? 'Article publié : la version publique reste visible en ligne. Vos modifications sont préparées comme une nouvelle version et ne deviendront publiques qu\'après validation.'
            : existant?.statut === 'programme'
              ? `Article programmé : publication automatique le ${formatDateTime(existant.programmeAt)}. Le contenu peut être modifié directement ; la modification de la programmation est une action distincte.`
              : existant?.statut === 'corbeille'
                ? 'Article dans la corbeille : non visible publiquement. Restaurez-le depuis la liste des articles.'
                : 'Brouillon : non visible publiquement.'
        }
      />

      {/* Barre d'actions collante : reste accessible pendant la rédaction */}
      {!enCorbeille ? (
        <div className="sticky top-[72px] z-30 border-b border-admin-line bg-white/95 shadow-sm backdrop-blur lg:top-0">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 md:px-8">
            <Link to="/admin/articles" className={buttonClasses('blanc', 'petit')}>
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              Retour
            </Link>
            <span className="mr-auto flex items-center gap-2">{statutBadge}</span>
            <Button size="petit" onClick={() => enregistrer()}>
              <Save aria-hidden="true" className="h-4 w-4" />
              {existant?.statut === 'publie' ? 'Enregistrer la version' : 'Enregistrer le brouillon'}
            </Button>
            <Button
              size="petit"
              variant="secondaire"
              onClick={() => {
                enregistrer()
                if (!nouveau) navigate(`/admin/articles/${existant?.id}/preview`)
              }}
            >
              <Eye aria-hidden="true" className="h-4 w-4" />
              Prévisualiser
            </Button>
            {existant?.publicSnapshot ? (
              <>
                <Button
                  size="petit"
                  onClick={() => {
                    enregistrer()
                    validatePublishedEdit(existant.id, adminId)
                    toast('La nouvelle version est publiée : elle remplace la version précédente, qui n\'est plus conservée.')
                  }}
                >
                  Valider la nouvelle version
                </Button>
                <Button
                  size="petit"
                  variant="blanc"
                  onClick={() => {
                    cancelEditPublished(existant.id)
                    toast('Modifications annulées : la version publique reste inchangée.', 'info')
                    setBlocks(existant.blocks)
                  }}
                >
                  Annuler les modifications
                </Button>
              </>
            ) : null}
            {existant?.statut === 'brouillon' || nouveau ? (
              <Button
                size="petit"
                variant="ocre"
                onClick={() => {
                  if (!existant) {
                    // création : créer puis publier
                    const a = createArticle(adminId, { titre, blocks, categorieIds, tagIds, coverMediaId })
                    publishNow(a.id, adminId)
                    toast('Article publié immédiatement.')
                    navigate(`/admin/articles/${a.id}`, { replace: true })
                    return
                  }
                  enregistrer()
                  publishNow(existant.id, adminId)
                  toast('Article publié immédiatement : il est désormais visible publiquement.')
                }}
              >
                Publier
              </Button>
            ) : null}
            <Button
              size="petit"
              variant="danger"
              onClick={() => setCorbeilleConfirme(true)}
              disabled={nouveau}
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
              Corbeille
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:px-8 lg:grid-cols-[1fr_20rem]">
        {/* Colonne principale : titre + contenu par blocs */}
        <div className="flex flex-col gap-6">
          {enCorbeille ? (
            <>
              <Alert kind="attention" title="Cet article est dans la corbeille">
                <p>
                  Il n'est plus visible publiquement et n'apparaît plus dans les recherches. Ses
                  données et ses commentaires sont conservés. La restauration (brouillon ou publié)
                  se fait depuis la liste des articles.
                </p>
              </Alert>
              <p>
                <Link to="/admin/articles?onglet=corbeille" className={buttonClasses('secondaire')}>
                  <ArrowLeft aria-hidden="true" className="h-5 w-5" />
                  Retour à la liste
                </Link>
              </p>
            </>
          ) : null}
          {existant?.publicSnapshot ? (
            <Alert kind="info" title="Version en préparation">
              <p>
                Vous modifiez une nouvelle version de l'article. La version actuellement publiée
                reste visible par le public tant que vous n'avez pas validé la nouvelle version.
                Utilisez « Valider la nouvelle version » dans la barre d'actions pour la remplacer,
                ou « Annuler les modifications » pour revenir à la version publiée.
              </p>
            </Alert>
          ) : null}

          <div className="carte p-6">
            <Field
              label="Titre de l'article"
              htmlFor="art-titre"
              required
            >
              <Input
                id="art-titre"
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
                placeholder="Exemple : fête du village, assemblée générale…"
                className="text-lg"
              />
            </Field>
            <p className="mt-2 text-[0.875rem] text-mist">
              L'année de l'article sera déterminée automatiquement à partir de sa date de
              publication : elle n'est jamais saisie séparément.
            </p>
          </div>

          <div className="carte p-6">
            <BlockEditor blocks={blocks} onChange={setBlocks} />
          </div>

          {/* Réafficher la barre d'actions en fin de contenu : éviter de
              remonter tout l'article pour enregistrer ou publier */}
          {!enCorbeille ? (
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => enregistrer()}>
                <Save aria-hidden="true" className="h-5 w-5" />
                {existant?.statut === 'publie' ? 'Enregistrer la version' : 'Enregistrer le brouillon'}
              </Button>
              <Button
                variant="secondaire"
                onClick={() => {
                  enregistrer()
                  if (!nouveau) navigate(`/admin/articles/${existant?.id}/preview`)
                }}
              >
                <Eye aria-hidden="true" className="h-5 w-5" />
                Prévisualiser
              </Button>
            </div>
          ) : null}
        </div>

        {/* Panneau de paramètres : repliable sur mobile (brief V3 §4) */}
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => setParametresOuverts((o) => !o)}
            aria-expanded={parametresOuverts}
            aria-controls="panneau-parametres"
            className="inline-flex min-h-[48px] items-center justify-between gap-2 rounded-xl border border-line bg-white px-4 font-bold text-forest hover:bg-leaf-pale lg:hidden"
          >
            <span className="inline-flex items-center gap-2">
              <SlidersHorizontal aria-hidden="true" className="h-5 w-5" />
              Paramètres de l'article
            </span>
            {parametresOuverts ? (
              <X aria-hidden="true" className="h-5 w-5" />
            ) : (
              <span className="rounded-full bg-sand-dark px-2 py-0.5 text-[0.8125rem]">
                Afficher
              </span>
            )}
          </button>

          <aside
            id="panneau-parametres"
            aria-label="Propriétés de l'article"
            className={`${parametresOuverts ? 'flex' : 'hidden'} flex-col gap-6 lg:flex`}
          >
            <section className="carte p-6">
              <h2 className="text-xl text-forest">Statut</h2>
              <p className="mt-3">{statutBadge}</p>
              {existant?.statut === 'programme' ? (
                <div className="mt-3 flex flex-col gap-3">
                  <p className="text-[0.9375rem] text-mist">
                    Publication automatique le {formatDateTime(existant.programmeAt)}. Le contenu
                    peut être modifié sans changer cette date ; la modification de la
                    programmation est une action distincte ci-dessous.
                  </p>
                  <Field
                    label="Modifier la date de publication prévue"
                    htmlFor="art-prog-reprog"
                  >
                    <Input
                      id="art-prog-reprog"
                      type="datetime-local"
                      value={dateProgrammation}
                      onChange={(e) => setDateProgrammation(e.target.value)}
                    />
                  </Field>
                  <Button
                    variant="ocre"
                    onClick={() => {
                      if (!dateProgrammation) {
                        toast('Choisissez une date de publication.', 'erreur')
                        return
                      }
                      programArticle(existant.id, new Date(dateProgrammation).toISOString(), adminId)
                      toast('Nouvelle programmation enregistrée.')
                    }}
                  >
                    <CalendarClock aria-hidden="true" className="h-5 w-5" />
                    Enregistrer la nouvelle programmation
                  </Button>
                  <Button
                    variant="secondaire"
                    onClick={() => {
                      cancelProgramming(existant.id, adminId)
                      toast("Programmation annulée : l'article est de nouveau un brouillon.", 'info')
                    }}
                  >
                    Annuler la programmation (repasser en brouillon)
                  </Button>
                </div>
              ) : null}
              {existant?.statut === 'brouillon' && !enCorbeille ? (
                <div className="mt-4">
                  <Field
                    label="Programmer la publication"
                    htmlFor="art-prog"
                    hint="Date et heure futures : l'article sera publié automatiquement."
                  >
                    <div className="flex flex-col gap-3">
                      <Input
                        id="art-prog"
                        type="datetime-local"
                        value={dateProgrammation}
                        onChange={(e) => setDateProgrammation(e.target.value)}
                      />
                      <Button
                        variant="ocre"
                        disabled={!existant}
                        onClick={() => {
                          if (!existant || !dateProgrammation) {
                            toast(existant ? 'Choisissez une date de publication.' : 'Enregistrez d\'abord le brouillon.', 'erreur')
                            return
                          }
                          enregistrer()
                          programArticle(existant.id, new Date(dateProgrammation).toISOString(), adminId)
                          toast('Publication programmée : l\'article sera publié automatiquement à la date prévue.')
                        }}
                      >
                        <CalendarClock aria-hidden="true" className="h-5 w-5" />
                        Programmer la publication
                      </Button>
                    </div>
                  </Field>
                </div>
              ) : null}
            </section>

            <section className="carte p-6">
              <h2 className="text-xl text-forest">Catégories</h2>
              <fieldset className="mt-3 flex flex-col gap-2">
                <legend className="sr-only">Catégories de l'article</legend>
                {db.categories.map((c) => (
                  <label key={c.id} className="flex items-center gap-3 rounded-xl bg-sand p-3 font-bold">
                    <input
                      type="checkbox"
                      checked={categorieIds.includes(c.id)}
                      onChange={(e) =>
                        setCategorieIds((ids) =>
                          e.target.checked ? [...ids, c.id] : ids.filter((x) => x !== c.id),
                        )
                      }
                      className="h-5 w-5 accent-forest"
                    />
                    {c.nom}
                  </label>
                ))}
              </fieldset>
              <p className="mt-2 text-[0.875rem] text-mist">
                Point à confirmer (cahier des charges §46) : le nombre exact de catégories
                autorisées par article.
              </p>
            </section>

            <section className="carte p-6">
              <h2 className="text-xl text-forest">Tags</h2>
              <fieldset className="mt-3 flex flex-wrap gap-2">
                <legend className="sr-only">Tags de l'article</legend>
                {db.tags.map((t) => {
                  const actif = tagIds.includes(t.id)
                  return (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={actif}
                      onClick={() =>
                        setTagIds((ids) => {
                          if (actif) return ids.filter((x) => x !== t.id)
                          if (ids.length >= MAX_TAGS) {
                            toast(`Maximum ${MAX_TAGS} tags par article (règle de maquette à confirmer).`, 'erreur')
                            return ids
                          }
                          return [...ids, t.id]
                        })
                      }
                      className={`inline-flex min-h-[44px] items-center rounded-full px-4 font-bold ${
                        actif ? 'bg-forest text-white' : 'border border-line bg-white text-forest hover:bg-leaf-pale'
                      }`}
                    >
                      #{t.nom}
                    </button>
                  )
                })}
              </fieldset>
              <p className="mt-2 text-[0.875rem] text-mist">
                Maquette : {MAX_TAGS} tags maximum par article.
              </p>
            </section>

            <section className="carte p-6">
              <h2 className="text-xl text-forest">Image de couverture</h2>
              {/* Priorité (§22) : couverture choisie > première image du contenu > visuel par défaut */}
              {cover ? (
                <img
                  src={mediaUrl(cover.file)}
                  alt={cover.alt}
                  className="mt-3 h-40 w-full rounded-xl border border-line object-cover"
                />
              ) : (
                <p className="mt-3 rounded-xl border border-dashed border-line bg-sand p-4 text-[0.9375rem] text-mist">
                  Aucune couverture choisie : la première image du contenu sera utilisée, sinon le
                  visuel par défaut du site.
                </p>
              )}
              <div className="mt-3">
                <Button variant="secondaire" size="petit" onClick={() => setPickerCouverture(true)}>
                  <Paperclip aria-hidden="true" className="h-4 w-4" />
                  {cover ? 'Changer la couverture' : 'Choisir une couverture'}
                </Button>
              </div>
              <div className="mt-5 border-t border-line pt-4">
                <label htmlFor="art-une" className="flex items-start gap-3 text-[1.0625rem]">
                  <input
                    id="art-une"
                    type="checkbox"
                    checked={misEnAvant}
                    onChange={(e) => {
                      setMisEnAvant(e.target.checked)
                      if (existant) {
                        updateArticle(existant.id, { misEnAvant: e.target.checked })
                        toast(
                          e.target.checked
                            ? "Article ajouté à la une : il apparaît dans le carrousel de la page d'accueil."
                            : "Article retiré de la une.",
                        )
                      }
                    }}
                    className="mt-2 h-6 w-6 shrink-0 accent-forest"
                  />
                  <span>
                    <strong>Mettre à la une</strong>
                    <span className="block text-[0.9375rem] text-mist">
                      Les articles à la une alimentent le carrousel de la page d'accueil (3 maximum,
                      ordre de publication).
                    </span>
                  </span>
                </label>
              </div>
            </section>

            {existant && !enCorbeille ? (
              <section className="carte p-6">
                <h2 className="text-xl text-forest">Informations</h2>
                <dl className="mt-3 flex flex-col gap-2 text-[0.9375rem]">
                  <div className="flex justify-between gap-3 rounded-lg bg-sand p-2">
                    <dt className="font-bold">Créé le</dt>
                    <dd>{formatDateTime(existant.createdAt)}</dd>
                  </div>
                  <div className="flex justify-between gap-3 rounded-lg bg-sand p-2">
                    <dt className="font-bold">Dernière modification</dt>
                    <dd>{formatDateTime(existant.updatedAt)}</dd>
                  </div>
                  {existant.publishedAt ? (
                    <div className="flex justify-between gap-3 rounded-lg bg-sand p-2">
                      <dt className="font-bold">Publié le</dt>
                      <dd>{formatDateTime(existant.publishedAt)}</dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-3 rounded-lg bg-sand p-2">
                    <dt className="font-bold">Slug</dt>
                    <dd className="break-all">/{existant.slug}</dd>
                  </div>
                </dl>
              </section>
            ) : null}
          </aside>
        </div>
      </div>

      <MediaPicker
        open={pickerCouverture}
        onClose={() => setPickerCouverture(false)}
        titre="Choisir l'image de couverture"
        selectionActive={coverMediaId}
        onChoose={(m) => setCoverMediaId(m.id)}
      />

      <ConfirmDialog
        open={corbeilleConfirme}
        onClose={() => setCorbeilleConfirme(false)}
        onConfirm={() => {
          if (existant) {
            enregistrer()
            trashArticle(existant.id, adminId)
            toast('Article placé dans la corbeille : il n\'est plus visible publiquement.', 'info')
            navigate('/admin/articles?onglet=corbeille')
          }
          setCorbeilleConfirme(false)
        }}
        title="Mettre cet article à la corbeille ?"
        confirmLabel="Mettre à la corbeille"
      >
        <p>
          L'article ne sera plus visible publiquement et n'apparaîtra plus dans les recherches. Ses
          données et ses commentaires seront conservés. Les articles restent dans la corbeille
          indéfiniment jusqu'à une suppression définitive explicite.
        </p>
      </ConfirmDialog>
    </>
  )
}

/** Prévisualisation d'un article (§18 : système de prévisualisation avant publication) */
export function ArticlePreview() {
  useDb()
  const { id } = useParams()
  const article = id ? db.articles.find((a) => a.id === id) : undefined
  const navigate = useNavigate()

  if (!article) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Alert kind="erreur" title="Article introuvable">
          <p>Cet article n'existe pas (ou plus).</p>
        </Alert>
      </div>
    )
  }

  const blocks = article.blocks
  const auteur = db.users.find((u) => u.id === article.auteurId)
  const cover = article.coverMediaId ? getMedia(article.coverMediaId) : undefined

  return (
    <div>
      <div className="border-b border-ocre bg-ocre-pale px-4 py-4">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <p className="font-bold">
            Prévisualisation — {article.statut === 'publie' && article.publicSnapshot
              ? 'nouvelle version en préparation'
              : article.statut === 'programme'
                ? 'article programmé'
                : article.statut === 'corbeille'
                  ? 'article dans la corbeille'
                  : 'brouillon'}
            {' '}
            <span className="font-normal">(non visible par le public)</span>
          </p>
          <div className="flex gap-3">
            <Button variant="secondaire" size="petit" onClick={() => navigate(`/admin/articles/${article.id}`)}>
              <FileText aria-hidden="true" className="h-4 w-4" />
              Retour à l'éditeur
            </Button>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex flex-wrap items-center gap-3">
          <ArticleStatutBadge statut={article.statut} />
          <span className="text-[0.9375rem] text-mist">
            Auteur : {auteur ? `${auteur.prenom} ${auteur.nom}` : 'Utilisateur supprimé'}
          </span>
        </div>
        <h1 className="mt-4 text-forest">{article.titre}</h1>
        {cover ? (
          <img
            src={mediaUrl(cover.file)}
            alt={cover.alt}
            className="mt-6 aspect-[16/8] w-full rounded-2xl border border-line object-cover"
          />
        ) : null}
        <div className="mt-8 rounded-2xl border border-line bg-white p-6 md:p-10">
          <div className="block-content">
            {blocks.length === 0 ? (
              <p className="text-mist">Aucun bloc de contenu : ajoutez du contenu dans l'éditeur.</p>
            ) : (
              blocks.map((b) => <BlockView key={b.id} block={b} />)
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
