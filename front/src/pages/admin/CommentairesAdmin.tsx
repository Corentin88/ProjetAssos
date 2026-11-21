import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { History, MessagesSquare, Pencil, Search, Trash2 } from 'lucide-react'
import type { Comment } from '../../types'
import {
  adminEditComment,
  db,
  moderateComment,
  MOTIFS_MODERATION,
  session,
  useDb,
  useDbVersion,
} from '../../lib/db'
import { getArticleById, visibleComments } from '../../lib/selectors'
import { formatDateTime } from '../../lib/format'
import { AdminPageHead } from '../../components/layout/AdminLayout'
import { Badge, EmptyState } from '../../components/ui/feedback'
import { Button, Field, Input, Textarea } from '../../components/ui/form'
import { ConfirmDialog, Modal } from '../../components/ui/overlay'
import { useToast } from '../../hooks/useToast'

type FiltreStatut = 'tous' | 'visibles' | 'supprimes-auteur' | 'moderes'

/** Modération des commentaires (§28 à §31) : consultation détaillée, modification,
 *  suppression avec motif obligatoire, historique des versions */
export function CommentairesAdmin() {
  useDb()
  const version = useDbVersion()
  const { toast } = useToast()
  const admin = session.current ? db.users.find((u) => u.id === session.current!.userId) : null
  const adminId = admin?.id ?? 'u1'

  const [recherche, setRecherche] = useState('')
  const [filtreArticle, setFiltreArticle] = useState('')
  const [filtreStatut, setFiltreStatut] = useState<FiltreStatut>('tous')

  const [aConsulter, setAConsulter] = useState<Comment | null>(null)
  const [aModerer, setAModerer] = useState<Comment | null>(null)
  const [motif, setMotif] = useState<string>(MOTIFS_MODERATION[0])
  const [precision, setPrecision] = useState('')
  const [erreurMotif, setErreurMotif] = useState('')
  const [aEditer, setAEditer] = useState<Comment | null>(null)
  const [contenuEdition, setContenuEdition] = useState('')
  const [historique, setHistorique] = useState<Comment | null>(null)

  const articlesAvecCommentaires = db.articles.filter((a) =>
    db.comments.some((c) => c.articleId === a.id),
  )

  const commentaires = useMemo(() => {
    let list = [...db.comments].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const q = recherche.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (c) => c.auteurLabel.toLowerCase().includes(q) || c.contenu.toLowerCase().includes(q),
      )
    }
    if (filtreArticle) list = list.filter((c) => c.articleId === filtreArticle)
    if (filtreStatut === 'visibles') list = list.filter((c) => !c.deletedByAuthor && !c.moderation)
    if (filtreStatut === 'supprimes-auteur') list = list.filter((c) => c.deletedByAuthor)
    if (filtreStatut === 'moderes') list = list.filter((c) => c.moderation)
    return list
  }, [version, recherche, filtreArticle, filtreStatut])

  const nbVisibles = db.comments.filter((c) => !c.deletedByAuthor && !c.moderation).length

  /** Réponses associées à un commentaire (thread complet) */
  const reponsesDe = (id: string) =>
    db.comments.filter((c) => c.parentId === id).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const parentDe = (c: Comment) => (c.parentId ? db.comments.find((x) => x.id === c.parentId) ?? null : null)

  return (
    <>
      <AdminPageHead
        titre="Commentaires"
        description="Consultez tous les commentaires, ouvrez la vue détaillée, modifiez ou supprimez au besoin. Une suppression administrative exige un motif, est inscrite au journal d'activité et conserve les données 6 mois."
      />
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div className="carte p-5">
            <dt className="text-[0.9375rem] text-mist">Commentaires publics visibles</dt>
            <dd className="text-2xl font-bold">{nbVisibles}</dd>
          </div>
          <div className="carte p-5">
            <dt className="text-[0.9375rem] text-mist">Supprimés par leur auteur</dt>
            <dd className="text-2xl font-bold">
              {db.comments.filter((c) => c.deletedByAuthor).length}
            </dd>
          </div>
          <div className="carte p-5">
            <dt className="text-[0.9375rem] text-mist">Supprimés par la modération</dt>
            <dd className="text-2xl font-bold">
              {db.comments.filter((c) => c.moderation).length}
            </dd>
          </div>
        </dl>

        <form className="mt-6 grid gap-4 rounded-2xl border border-line bg-white p-5 md:grid-cols-3" onSubmit={(e) => e.preventDefault()}>
          <Field label="Rechercher" htmlFor="com-recherche">
            <div className="relative">
              <Input
                id="com-recherche"
                type="search"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Auteur ou contenu…"
              />
              <Search aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-mist" />
            </div>
          </Field>
          <Field label="Filtrer par article" htmlFor="com-article">
            <select
              id="com-article"
              value={filtreArticle}
              onChange={(e) => setFiltreArticle(e.target.value)}
              className="min-h-[48px] w-full rounded-xl border border-line bg-white px-4 text-[1.0625rem]"
            >
              <option value="">Tous les articles</option>
              {articlesAvecCommentaires.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.titre}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Statut" htmlFor="com-statut">
            <select
              id="com-statut"
              value={filtreStatut}
              onChange={(e) => setFiltreStatut(e.target.value as FiltreStatut)}
              className="min-h-[48px] w-full rounded-xl border border-line bg-white px-4 text-[1.0625rem]"
            >
              <option value="tous">Tous les statuts</option>
              <option value="visibles">Visibles publiquement</option>
              <option value="supprimes-auteur">Supprimés par l'auteur</option>
              <option value="moderes">Supprimés par la modération</option>
            </select>
          </Field>
        </form>

        <p className="mt-4 text-mist" role="status">
          {commentaires.length} commentaire{commentaires.length > 1 ? 's' : ''} affiché
          {commentaires.length > 1 ? 's' : ''} sur {db.comments.length}
        </p>

        {commentaires.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon={MessagesSquare}
              title="Aucun commentaire trouvé"
              description="Aucun commentaire ne correspond aux filtres actuels."
            />
          </div>
        ) : (
          <ul className="mt-6 flex flex-col gap-4">
            {commentaires.map((c) => {
              const article = getArticleById(c.articleId)
              const visible = !c.deletedByAuthor && !c.moderation
              const reponses = reponsesDe(c.id)
              return (
                <li key={c.id} className="carte p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    {visible ? (
                      <Badge variant="vert">Visible publiquement</Badge>
                    ) : c.deletedByAuthor ? (
                      <Badge variant="gris">Supprimé par l'auteur</Badge>
                    ) : (
                      <Badge variant="rouge">Supprimé par la modération</Badge>
                    )}
                    {c.updatedAt ? <Badge variant="ocre">Modifié</Badge> : null}
                    {c.parentId ? <Badge variant="gris">Réponse</Badge> : null}
                    {reponses.length > 0 ? (
                      <Badge variant="gris">
                        {reponses.length} réponse{reponses.length > 1 ? 's' : ''}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-2 font-bold">
                    {c.auteurLabel}
                    <span className="font-normal text-mist">
                      {' '}
                      — le {formatDateTime(c.createdAt)}
                      {c.updatedAt ? ` (modifié le ${formatDateTime(c.updatedAt)})` : ''}
                    </span>
                  </p>
                  <p className="mt-1 text-[0.9375rem] text-mist">
                    Article :{' '}
                    {article ? (
                      <Link to={`/actualites/${article.slug}`} className="font-bold text-forest underline underline-offset-4">
                        {article.titre}
                      </Link>
                    ) : (
                      '(article supprimé définitivement)'
                    )}
                  </p>
                  <p className={`mt-2 whitespace-pre-line text-[1.0625rem] ${visible ? '' : 'italic text-mist'}`}>
                    {c.deletedByAuthor || c.moderation
                      ? '« Commentaire supprimé » — contenu conservé côté administration.'
                      : c.contenu}
                  </p>
                  {c.moderation ? (
                    <p className="mt-2 rounded-xl bg-brique-pale px-3 py-2 text-[0.9375rem] text-brique">
                      Motif de la modération : <strong>{c.moderation.motif}</strong>
                      {c.moderation.precision ? ` — ${c.moderation.precision}` : ''} par{' '}
                      {db.users.find((u) => u.id === c.moderation!.adminId)
                        ? `${db.users.find((u) => u.id === c.moderation!.adminId)?.prenom} ${db.users.find((u) => u.id === c.moderation!.adminId)?.nom}`
                        : 'un administrateur'}{' '}
                      le {formatDateTime(c.moderation.at)}. Contenu supprimé conservé 6 mois.
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="petit" variant="fantome" onClick={() => setAConsulter(c)}>
                      Consulter
                    </Button>
                    {visible ? (
                      <>
                        <Button
                          size="petit"
                          variant="secondaire"
                          onClick={() => {
                            setAEditer(c)
                            setContenuEdition(c.contenu)
                          }}
                        >
                          <Pencil aria-hidden="true" className="h-4 w-4" />
                          Modifier
                        </Button>
                        <Button size="petit" variant="danger" onClick={() => setAModerer(c)}>
                          <Trash2 aria-hidden="true" className="h-4 w-4" />
                          Supprimer (modération)
                        </Button>
                      </>
                    ) : null}
                    <Button size="petit" variant="fantome" onClick={() => setHistorique(c)}>
                      <History aria-hidden="true" className="h-4 w-4" />
                      Historique ({c.history.length} version{c.history.length > 1 ? 's' : ''})
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Consultation détaillée : contenu, contexte dans l'article, réponses,
          dates et historique (brief §8) */}
      <Modal
        open={!!aConsulter}
        onClose={() => setAConsulter(null)}
        title={`Commentaire de ${aConsulter?.auteurLabel ?? ''}`}
        size="large"
        footer={
          <Button variant="blanc" onClick={() => setAConsulter(null)}>
            Fermer
          </Button>
        }
      >
        {aConsulter ? (
          <div className="flex flex-col gap-5">
            {(() => {
              const article = getArticleById(aConsulter.articleId)
              const parent = parentDe(aConsulter)
              const reponses = reponsesDe(aConsulter.id)
              return (
                <>
                  <div className="rounded-xl bg-sand p-4 text-[0.9375rem]">
                    <p>
                      <strong>Article concerné :</strong>{' '}
                      {article ? (
                        <Link to={`/actualites/${article.slug}`} className="font-bold text-forest underline underline-offset-4">
                          {article.titre}
                        </Link>
                      ) : (
                        'article supprimé définitivement'
                      )}
                    </p>
                    {parent ? (
                      <p className="mt-1">
                        <strong>Réponse à :</strong> {parent.auteurLabel} — «{' '}
                        {parent.contenu.length > 120 ? `${parent.contenu.slice(0, 120)}…` : parent.contenu} »
                      </p>
                    ) : null}
                    <p className="mt-1">
                      <strong>Publié :</strong> {formatDateTime(aConsulter.createdAt)}
                      {aConsulter.updatedAt
                        ? ` — dernière modification : ${formatDateTime(aConsulter.updatedAt)}`
                        : ''}
                    </p>
                  </div>

                  <div>
                    <p className="font-bold">Contenu complet</p>
                    <p className="mt-2 whitespace-pre-line rounded-xl border border-line bg-white p-4 text-[1.0625rem]">
                      {aConsulter.deletedByAuthor || aConsulter.moderation
                        ? '« Commentaire supprimé » — le contenu original reste consultable ci-dessous.'
                        : aConsulter.contenu}
                    </p>
                    {aConsulter.moderation ? (
                      <div className="mt-3 rounded-xl bg-brique-pale p-4 text-[0.9375rem] text-brique">
                        <p className="font-bold">
                          Modération — motif : {aConsulter.moderation.motif}
                          {aConsulter.moderation.precision ? ` — ${aConsulter.moderation.precision}` : ''}
                        </p>
                        <p className="mt-1">
                          Par{' '}
                          {db.users.find((u) => u.id === aConsulter.moderation!.adminId)
                            ? `${db.users.find((u) => u.id === aConsulter.moderation!.adminId)?.prenom} ${db.users.find((u) => u.id === aConsulter.moderation!.adminId)?.nom}`
                            : 'un administrateur'}{' '}
                          le {formatDateTime(aConsulter.moderation.at)}.
                        </p>
                        <p className="mt-2 whitespace-pre-line rounded-lg bg-white p-3">
                          <strong>Contenu supprimé (conservé 6 mois) :</strong>
                          <br />
                          {aConsulter.moderation.contenuSupprime}
                        </p>
                      </div>
                    ) : null}
                    {aConsulter.deletedByAuthor && !aConsulter.moderation ? (
                      <p className="mt-2 text-[0.9375rem] text-mist">
                        Ce commentaire a été supprimé par son auteur : seul le placeholder public
                        est conservé, le contenu original n'est pas archivé.
                      </p>
                    ) : null}
                  </div>

                  {reponses.length > 0 ? (
                    <div>
                      <p className="font-bold">
                        {reponses.length} réponse{reponses.length > 1 ? 's' : ''} conservée
                        {reponses.length > 1 ? 's' : ''}
                      </p>
                      <ul className="mt-2 flex flex-col gap-2">
                        {reponses.map((r) => (
                          <li key={r.id} className="rounded-xl bg-sand p-3 text-[0.9375rem]">
                            <strong>{r.auteurLabel}</strong>
                            <span className="text-mist"> — le {formatDateTime(r.createdAt)}</span>
                            <p className="mt-1 whitespace-pre-line">
                              {r.deletedByAuthor || r.moderation
                                ? '« Commentaire supprimé »'
                                : r.contenu}
                            </p>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-[0.9375rem] text-mist">
                        Les réponses existantes restent visibles publiquement, même après une
                        suppression (par l'auteur ou par la modération).
                      </p>
                    </div>
                  ) : (
                    <p className="text-[0.9375rem] text-mist">Aucune réponse associée.</p>
                  )}

                  <p className="text-[0.9375rem] text-mist">
                    {aConsulter.history.length > 0
                      ? `Ce commentaire a été modifié ${aConsulter.history.length} fois : l'historique des versions est accessible via « Historique ».`
                      : "Ce commentaire n'a jamais été modifié."}
                  </p>
                </>
              )
            })()}
          </div>
        ) : null}
      </Modal>

      {/* Modération : motif obligatoire (§31) */}
      <ConfirmDialog
        open={!!aModerer}
        onClose={() => {
          setAModerer(null)
          setErreurMotif('')
          setPrecision('')
        }}
        onConfirm={() => {
          if (!aModerer) return
          if (motif === 'Autre' && !precision.trim()) {
            setErreurMotif('Une précision est obligatoire pour le motif « Autre ».')
            return
          }
          moderateComment(aModerer.id, motif, precision.trim() || null, adminId)
          toast(
            `Commentaire supprimé (motif : ${motif}). Il est remplacé par « Commentaire supprimé » dans la discussion ; ses réponses sont conservées. L'action est inscrite au journal d'activité.`,
            'info',
          )
          setAModerer(null)
          setPrecision('')
        }}
        title="Supprimer ce commentaire (modération) ?"
        confirmLabel="Confirmer la suppression"
      >
        <div className="flex flex-col gap-4">
          <p>
            Le commentaire de <strong>{aModerer?.auteurLabel}</strong> ne sera plus affiché
            publiquement : il sera remplacé par le placeholder « Commentaire supprimé ». Ses
            réponses existantes seront conservées. Les données de modération (contenu, auteur,
            motif, administrateur) sont conservées 6 mois.
          </p>
          <fieldset>
            <legend className="mb-2 font-bold">Motif de la suppression (obligatoire)</legend>
            <ul className="flex flex-col gap-2">
              {MOTIFS_MODERATION.map((m) => (
                <li key={m} className="flex items-center gap-3 rounded-xl border border-line bg-white p-3">
                  <input
                    type="radio"
                    id={`motif-${m}`}
                    name="motif"
                    value={m}
                    checked={motif === m}
                    onChange={() => {
                      setMotif(m)
                      setErreurMotif('')
                    }}
                    className="h-5 w-5 accent-forest"
                  />
                  <label htmlFor={`motif-${m}`} className="cursor-pointer font-bold">
                    {m}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
          {motif === 'Autre' ? (
            <Field label="Précision du motif « Autre »" htmlFor="motif-precision" required error={erreurMotif}>
              <Textarea
                id="motif-precision"
                value={precision}
                onChange={(e) => {
                  setPrecision(e.target.value)
                  setErreurMotif('')
                }}
                rows={3}
                invalid={!!erreurMotif}
                describedBy={erreurMotif ? 'motif-precision-err' : undefined}
              />
            </Field>
          ) : erreurMotif ? (
            <p role="alert" className="font-bold text-brique">{erreurMotif}</p>
          ) : null}
        </div>
      </ConfirmDialog>

      {/* Modification par l'administrateur (§28) */}
      <Modal
        open={!!aEditer}
        onClose={() => setAEditer(null)}
        title="Modifier le commentaire"
        footer={
          <>
            <Button variant="blanc" onClick={() => setAEditer(null)}>
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (aEditer && contenuEdition.trim()) {
                  adminEditComment(aEditer.id, contenuEdition, adminId)
                  toast("Commentaire modifié par l'administration. L'action est inscrite au journal.")
                  setAEditer(null)
                }
              }}
            >
              Enregistrer la modification
            </Button>
          </>
        }
      >
        <Field
          label="Contenu du commentaire"
          htmlFor="admin-edit-com"
          required
          hint="La version précédente est conservée dans l'historique, accessible aux administrateurs uniquement."
        >
          <Textarea
            id="admin-edit-com"
            value={contenuEdition}
            onChange={(e) => setContenuEdition(e.target.value)}
            rows={5}
          />
        </Field>
      </Modal>

      {/* Historique des versions (§29) : accessible aux administrateurs */}
      <Modal
        open={!!historique}
        onClose={() => setHistorique(null)}
        title={`Historique du commentaire de ${historique?.auteurLabel ?? ''}`}
        size="large"
      >
        {historique && historique.history.length > 0 ? (
          <ul className="flex flex-col gap-4">
            <li className="rounded-xl border border-forest bg-leaf-pale p-4">
              <p className="font-bold">Version actuelle (depuis {formatDateTime(historique.updatedAt ?? historique.createdAt)})</p>
              <p className="mt-2 whitespace-pre-line">{historique.contenu}</p>
            </li>
            {historique.history
              .slice()
              .reverse()
              .map((h, i) => (
                <li key={i} className="rounded-xl border border-line bg-sand p-4">
                  <p className="font-bold">
                    Ancienne version — du {formatDateTime(h.at)} au{' '}
                    {formatDateTime(
                      historique.history[historique.history.length - 1 - i + 1]?.at ??
                        historique.updatedAt ??
                        historique.createdAt,
                    )}
                  </p>
                  <p className="mt-2 whitespace-pre-line">{h.contenu}</p>
                </li>
              ))}
          </ul>
        ) : (
          <p className="text-mist">
            Ce commentaire n'a jamais été modifié : aucune version antérieure n'est conservée.
          </p>
        )}
        <p className="mt-4 text-[0.9375rem] text-mist">
          Cet historique est uniquement accessible aux administrateurs. L'utilisateur ne voit que
          la version actuelle et la date de dernière modification.
        </p>
      </Modal>
    </>
  )
}
