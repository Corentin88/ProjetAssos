import { ContentImage } from '../../components/content/ContentImage'
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
import { db, useDb } from '../../lib/db'
import { articleAction, saveArticle, useContentAction } from '../../lib/content'
import { articleAuthorLabel, getMedia } from '../../lib/selectors'
import { toInputDateTime, formatDateTime } from '../../lib/format'
import { mediaUrl } from '../../lib/assets'
import { editableArticleBlocks } from '../../lib/mapBlocks'
import { AdminPageHead } from '../../components/layout/AdminLayout'
import { TrailDetails } from '../../components/content/TrailDetails'
import { BlockEditor } from '../../components/admin/BlockEditor'
import { MediaPicker } from '../../components/admin/MediaPicker'
import { ArticleStatutBadge } from '../../components/content/ArticleCard'
import { BlockView, estLienAutorise, youtubeId } from '../../components/content/BlockRenderer'
import { Button, Field, Input, buttonClasses } from '../../components/ui/form'
import { ConfirmDialog } from '../../components/ui/overlay'
import { Alert } from '../../components/ui/feedback'
import { useToast } from '../../hooks/useToast'

/** Éditeur d'article basé sur les blocs (§18) + workflow de publication (§20).
 *  Ergonomie (brief V3 §4) : zone centrale dédiée au titre et au contenu,
 *  barre d'actions collante toujours accessible, panneau latéral de
 *  paramètres repliable sur mobile. */
export function ArticleEditor() {
  useDb()
  const { id } = useParams()
  const existant = id ? db.articles.find((a) => a.id === id) : undefined
  if (id && !existant) {
    return <div className="mx-auto max-w-3xl px-4 py-16"><Alert kind="erreur" title="Article introuvable" /></div>
  }
  return <ArticleForm key={id ?? 'nouveau'} existant={existant} />
}

function ArticleForm({ existant }: { existant?: Article }) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const effectuer = useContentAction()
  const nouveau = !existant

  // État local du formulaire
  const [titre, setTitre] = useState(existant?.titre ?? '')
  const [blocks, setBlocks] = useState(() => editableArticleBlocks(existant))
  const [gpxEnCours, setGpxEnCours] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [validation, setValidation] = useState<'draft' | 'publish' | 'schedule' | 'reprogram' | null>(null)
  const [categorieIds, setCategorieIds] = useState<string[]>(existant?.categorieIds ?? [])
  const [tagIds, setTagIds] = useState<string[]>(existant?.tagIds ?? [])
  const [coverMediaId, setCoverMediaId] = useState<string | null>(existant?.coverMediaId ?? null)
  const [pickerCouverture, setPickerCouverture] = useState(false)
  const [dateProgrammation, setDateProgrammation] = useState(
    existant?.programmeAt ? toInputDateTime(existant.programmeAt) : '',
  )
  const [corbeilleConfirme, setCorbeilleConfirme] = useState(false)
  /** Panneau de paramètres : replié par défaut sur mobile, toujours visible sur ordinateur */
  const [parametresOuverts, setParametresOuverts] = useState(false)

  const enCorbeille = existant?.statut === 'corbeille'
  const actionsBloquees = saving || gpxEnCours.length > 0
  const dateId = existant?.statut === 'programme' ? 'art-prog-reprog' : 'art-prog'

  function verifier(mode: typeof validation) {
    const errors: Record<string, string> = {}
    if (!mode) return errors
    if ((mode === 'schedule' || mode === 'reprogram') && !(new Date(dateProgrammation).getTime() > Date.now()))
      errors[dateId] = 'Choisissez une date et une heure de publication futures.'
    if (mode === 'reprogram') return errors
    const publication = mode !== 'draft' || existant?.statut === 'programme'
    if (publication && !titre.trim()) errors['art-titre'] = 'Renseignez le titre de l’article.'
    for (const block of blocks) {
      const url = block.url?.trim() ?? ''
      if (block.type === 'image' && (!block.mediaId || !block.alt?.trim()))
        errors[`blk-alt-${block.id}`] = 'Choisissez une image et renseignez son texte alternatif.'
      if (block.type === 'video' && (url ? !youtubeId(url) : publication))
        errors[`blk-${block.id}`] = url ? 'Saisissez une adresse YouTube valide.' : 'Renseignez l’adresse de la vidéo YouTube.'
      if (block.type === 'lien' && (url ? !estLienAutorise(url) : publication))
        errors[`blk-url-${block.id}`] = url ? 'Saisissez une adresse de lien valide.' : 'Renseignez l’adresse du lien.'
      if (block.type === 'liste') {
        const items = block.items?.filter(item => item.trim()) ?? []
        if (items.length > 100 || items.some(item => Array.from(item).length > 4000))
          errors[`blk-${block.id}`] = 'Limitez la liste à 100 éléments de 4 000 caractères chacun.'
      }
      if (block.type === 'randonnee') {
        if (publication && !block.trail?.name.trim()) errors[`blk-${block.id}-name`] = 'Renseignez le nom du parcours.'
        if (publication && !block.mediaId) errors[`blk-${block.id}-file`] = 'Importez ou choisissez un fichier GPX.'
        const trail = block.trail
        if (trail) {
          for (const champ of ['distance', 'elevationGain', 'elevationLoss'] as const) {
            if (trail[champ] != null && trail[champ] < 0)
              errors[`blk-${block.id}-${champ}`] = 'Saisissez un nombre positif ou nul.'
          }
          if (trail.durationSeconds != null && (!Number.isSafeInteger(trail.durationSeconds) || trail.durationSeconds < 0))
            errors[`blk-${block.id}-durationSeconds`] = 'Saisissez une durée en secondes entières, positive ou nulle.'
          if (trail.elevationMin != null && trail.elevationMax != null && trail.elevationMax < trail.elevationMin)
            errors[`blk-${block.id}-elevationMax`] = 'Saisissez une altitude supérieure ou égale au minimum.'
          if (trail.departureAt && trail.arrivalAt && Date.parse(trail.arrivalAt) < Date.parse(trail.departureAt))
            errors[`blk-${block.id}-arrivalAt`] = 'Saisissez une arrivée postérieure ou égale au départ.'
        }
      }
      if (block.type === 'localisation') {
        const { latitude, longitude } = block.location ?? {}
        if ((latitude != null && Math.abs(latitude) > 90) || (longitude != null && Math.abs(longitude) > 180))
          errors[`blk-${block.id}-latitude`] = 'Saisissez une latitude entre −90 et 90 et une longitude entre −180 et 180.'
        else if (publication && (latitude == null || longitude == null))
          errors[`blk-${block.id}-latitude`] = 'Placez le marqueur en recherchant l’adresse ou en saisissant les coordonnées.'
      }
    }
    return errors
  }

  const erreurs = verifier(validation)
  const soumettre = (mode: NonNullable<typeof validation>, action: () => Promise<void>) => effectuer(async () => {
    if (actionsBloquees) return
    const premierChamp = Object.keys(verifier(mode))[0]
    if (premierChamp) {
      setValidation(mode)
      if (premierChamp === dateId) setParametresOuverts(true)
      requestAnimationFrame(() => document.getElementById(premierChamp)?.focus())
      return
    }
    setValidation(null)
    setSaving(true)
    try {
      await action()
    } finally {
      setSaving(false)
    }
  })
  const sauver = () => saveArticle({ titre, blocks, categorieIds, tagIds, coverMediaId }, existant?.id)
  const enregistrer = () => soumettre('draft', async () => {
    const article = await sauver()
    if (nouveau) navigate(`/admin/articles/${article.id}`, { replace: true })
    toast(existant?.statut === 'publie'
      ? 'Version de travail enregistrée. La version publique reste visible.'
      : 'Article enregistré.')
  })
  const previsualiser = () => soumettre('draft', async () => {
    const article = await sauver()
    navigate(`/admin/articles/${article.id}/preview`)
  })
  const publier = () => soumettre('publish', async () => {
    const article = await sauver()
    if (nouveau) navigate(`/admin/articles/${article.id}`, { replace: true })
    await articleAction(article.id, 'publish')
    toast('Article publié.')
  })
  const annuler = () => effectuer(async () => {
    if (!existant) return
    const article = existant.publicSnapshot
      ? await articleAction(existant.id, 'discard-work', { confirmed: true }) : existant
    if (!article) return
    setTitre(article.titre)
    setBlocks(editableArticleBlocks(article))
    setCategorieIds(article.categorieIds)
    setTagIds(article.tagIds)
    setCoverMediaId(article.coverMediaId)
    setValidation(null)
    toast('Modifications annulées. La version publique reste inchangée.', 'info')
  })
  const programmer = (sauverAvant: boolean) => soumettre(sauverAvant ? 'schedule' : 'reprogram', async () => {
    if (!existant) return
    if (sauverAvant) await sauver()
    await articleAction(existant.id, 'schedule', { at: new Date(dateProgrammation).toISOString() })
    toast('Programmation enregistrée.')
  })

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
            <Button size="petit" onClick={() => enregistrer()} disabled={actionsBloquees}>
              <Save aria-hidden="true" className="h-4 w-4" />
              {existant?.statut === 'publie' ? 'Enregistrer la version' : 'Enregistrer le brouillon'}
            </Button>
            <Button
              size="petit"
              variant="secondaire"
              onClick={previsualiser} disabled={actionsBloquees}
            >
              <Eye aria-hidden="true" className="h-4 w-4" />
              Prévisualiser
            </Button>
            {existant?.statut === 'publie' ? (
              <>
                <Button
                  size="petit"
                  onClick={publier} disabled={actionsBloquees}
                >
                  Valider la nouvelle version
                </Button>
                <Button
                  size="petit"
                  variant="blanc"
                  onClick={annuler}
                  disabled={actionsBloquees}
                >
                  Annuler les modifications
                </Button>
              </>
            ) : null}
            {existant?.statut === 'brouillon' || nouveau ? (
              <Button
                size="petit"
                variant="ocre"
                onClick={publier}
                disabled={actionsBloquees}
              >
                Publier
              </Button>
            ) : null}
            <Button
              size="petit"
              variant="danger"
              onClick={() => setCorbeilleConfirme(true)}
              disabled={nouveau || actionsBloquees}
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
              error={erreurs['art-titre']}
            >
              <Input
                id="art-titre"
                value={titre}
                maxLength={255}
                invalid={Boolean(erreurs['art-titre'])}
                describedBy={erreurs['art-titre'] ? 'art-titre-err' : undefined}
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

          <fieldset className="carte min-w-0 p-6" disabled={enCorbeille || saving}>
            <BlockEditor article blocks={blocks} onChange={setBlocks} errors={erreurs}
              onTrailBusy={(id, busy) => setGpxEnCours(ids => busy ? [...ids, id] : ids.filter(item => item !== id))} />
          </fieldset>

          {/* Réafficher la barre d'actions en fin de contenu : éviter de
              remonter tout l'article pour enregistrer ou publier */}
          {!enCorbeille ? (
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => enregistrer()} disabled={actionsBloquees}>
                <Save aria-hidden="true" className="h-5 w-5" />
                {existant?.statut === 'publie' ? 'Enregistrer la version' : 'Enregistrer le brouillon'}
              </Button>
              <Button
                variant="secondaire"
                onClick={previsualiser}
                disabled={actionsBloquees}
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
                    error={erreurs[dateId]}
                  >
                    <Input
                      id="art-prog-reprog"
                      type="datetime-local"
                      value={dateProgrammation}
                      invalid={Boolean(erreurs[dateId])}
                      describedBy={erreurs[dateId] ? `${dateId}-err` : undefined}
                      onChange={(e) => setDateProgrammation(e.target.value)}
                    />
                  </Field>
                  <Button
                    variant="ocre"
                    disabled={actionsBloquees}
                    onClick={() => programmer(false)}
                  >
                    <CalendarClock aria-hidden="true" className="h-5 w-5" />
                    Enregistrer la nouvelle programmation
                  </Button>
                  <Button
                    variant="secondaire"
                    disabled={actionsBloquees}
                    onClick={() => effectuer(async () => {
                      await articleAction(existant.id, 'cancel-schedule')
                      toast("Programmation annulée : l'article est de nouveau un brouillon.", 'info')
                    })}
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
                    error={erreurs[dateId]}
                  >
                    <div className="flex flex-col gap-3">
                      <Input
                        id="art-prog"
                        type="datetime-local"
                        value={dateProgrammation}
                        invalid={Boolean(erreurs[dateId])}
                        describedBy={`${dateId}-hint${erreurs[dateId] ? ` ${dateId}-err` : ''}`}
                        onChange={(e) => setDateProgrammation(e.target.value)}
                      />
                      <Button
                        variant="ocre"
                        disabled={actionsBloquees}
                        onClick={() => programmer(true)}
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
              {!db.categories.length && (
                <p className="mt-3 text-mist">Aucune catégorie créée. <Link className="underline" to="/admin/categories">Gérer les catégories et tags</Link>.</p>
              )}
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
            </section>

            <section className="carte p-6">
              <h2 className="text-xl text-forest">Tags</h2>
              {!db.tags.length && (
                <p className="mt-3 text-mist">Aucun tag créé. <Link className="underline" to="/admin/categories">Gérer les catégories et tags</Link>.</p>
              )}
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
            </section>

            <section className="carte p-6">
              <h2 className="text-xl text-forest">Image de couverture</h2>
              {/* Priorité (§22) : couverture choisie > première image du contenu > visuel par défaut */}
              {cover ? (
                <ContentImage
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
                {cover ? <Button variant="fantome" size="petit" onClick={() => setCoverMediaId(null)}>
                  Retirer la couverture
                </Button> : null}
              </div>
              <div className="mt-5 border-t border-line pt-4">
                <p className="mb-2 text-[0.9375rem] text-mist">
                  {existant?.positionCarrousel != null
                    ? `Article sélectionné à la une, position ${existant.positionCarrousel}.`
                    : 'La une se règle depuis la liste des articles.'}
                </p>
                <Link to="/admin/articles?carrousel=1" className={buttonClasses('secondaire', 'petit')}>
                  Gérer la une
                </Link>
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
        onConfirm={() => effectuer(async () => {
          if (existant) {
            await articleAction(existant.id, 'trash', { confirmed: true })
            toast('Article placé dans la corbeille : il n\'est plus visible publiquement.', 'info')
            navigate('/admin/articles?onglet=corbeille')
          }
          setCorbeilleConfirme(false)
        })}
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
  const cover = getMedia(article.coverMediaId ?? blocks.find(block => block.type === 'image' && block.mediaId)?.mediaId ?? 'm-visuel-defaut')

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
            Auteur : {articleAuthorLabel(article)}
          </span>
        </div>
        <h1 className="mt-4 text-forest">{article.titre}</h1>
        {cover ? (
          <ContentImage
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
        {article.trail && <TrailDetails trail={article.trail} />}
      </div>
    </div>
  )
}
