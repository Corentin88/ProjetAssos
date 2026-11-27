import { authErrorMessage, mapAvatar, useCurrentUser } from '../../lib/auth'
import { createContext, useContext, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { MessageCircle, Pencil, Reply, Shield, Trash2 } from 'lucide-react'
import type { Comment } from '../../types'
import { createComment, deleteComment, editComment, isDeletedComment } from '../../lib/community'
import { formatDateTime } from '../../lib/format'
import { Button, Field, Textarea, buttonClasses, focusChampInvalide } from '../ui/form'
import { ConfirmDialog } from '../ui/overlay'
import { Alert, EmptyState } from '../ui/feedback'
import { Avatar, CommentAvatar } from '../ui/misc'
import { useToast } from '../../hooks/useToast'

/** Met en évidence les mentions @Prénom N. dans un commentaire (§28) */
function avecMentions(texte: string): React.ReactNode {
  const parts = texte.split(/(@[A-ZÉÈ][\wéèêàçôûîö]+\s?[A-ZÉÈ]?\.?)/g)
  return parts.map((p, i) =>
    /^@[A-ZÉÈ]/.test(p) ? (
      <strong key={i} className="text-forest">
        {p}
      </strong>
    ) : (
      p
    ),
  )
}

const RefreshComments = createContext<() => Promise<void>>(async () => {})

export function CommentsSection({ articleId, comments, error, refresh }: {
  articleId: string; comments?: Comment[]; error?: string; refresh: () => Promise<void>
}) {
  const compte = useCurrentUser()
  const user = compte?.statut === 'actif' ? compte : null
  const replies = new Map<string, Comment[]>()
  for (const comment of comments ?? []) {
    if (!comment.parentId) continue
    const list = replies.get(comment.parentId) ?? []
    list.push(comment)
    replies.set(comment.parentId, list)
  }
  const threads = (comments ?? []).filter(comment => !comment.parentId)
  const nbTotal = comments?.filter(comment => !isDeletedComment(comment)).length

  return (
    <RefreshComments.Provider value={refresh}>
    <section id="commentaires" aria-labelledby="titre-commentaires" className="mt-8 sm:mt-10">
      <h2 id="titre-commentaires" className="flex items-center gap-3 text-2xl text-forest">
        <MessageCircle aria-hidden="true" className="h-7 w-7" />
        Commentaires{nbTotal === undefined ? '' : ` (${nbTotal})`}
      </h2>
      <p className="mt-2 text-mist">
        Les commentaires sont publics. Pour réagir à une réponse, répondez au commentaire
        initial en mentionnant son auteur, par exemple @Marie D.
      </p>

      {compte?.statut === 'suspendu' ? (
        <div className="mt-4">
          <Alert kind="attention" title="Compte suspendu">Vous pouvez lire les commentaires publics.</Alert>
        </div>
      ) : (
        <CommentForm articleId={articleId} parentId={null} user={user} />
      )}

      <div className="mt-5 flex flex-col gap-4">
        {error ? <Alert kind="erreur" title="Commentaires indisponibles">{error}</Alert> : !comments ? <p role="status">Chargement…</p> : threads.length === 0 ? (
          <EmptyState
            icon={MessageCircle}
            title="Aucun commentaire pour le moment"
            description="Soyez la première personne à partager votre expérience dans la discussion."
          />
        ) : (
          threads.map(comment => (
            <CommentThreadView
              key={comment.id}
              comment={comment}
              replies={replies.get(comment.id) ?? []}
              user={user}
            />
          ))
        )}
      </div>
    </section>
    </RefreshComments.Provider>
  )
}

function CommentThreadView({
  comment,
  replies,
  user,
}: {
  comment: Comment
  replies: Comment[]
  user: { id: string; prenom: string; nom: string } | null
}) {
  return (
    <article className="rounded-2xl border border-line bg-white p-3 sm:p-5">
      <CommentView comment={comment} user={user} />
      {replies.length > 0 ? (
        <ul className="mt-3 grid gap-3 border-l-2 border-leaf/40 pl-2 sm:pl-4" aria-label="Réponses à ce commentaire">
          {replies.map((r) => (
            <li key={r.id} className="rounded-xl bg-sand p-2.5 sm:p-3">
              <CommentView comment={r} user={user} dansReponse />
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  )
}

function CommentView({
  comment,
  user,
  dansReponse = false,
}: {
  comment: Comment
  user: { id: string; prenom: string; nom: string } | null
  dansReponse?: boolean
}) {
  const { toast } = useToast()
  const refresh = useContext(RefreshComments)
  const [modifOuverte, setModifOuverte] = useState(false)
  const [reponseOuverte, setReponseOuverte] = useState(false)
  const [aSupprimer, setASupprimer] = useState(false)

  // Le placeholder ne reprend ni le nom, ni l'avatar, ni les dates du commentaire retiré.
  if (isDeletedComment(comment)) {
    const Icone = comment.deletedByAdmin ? Shield : Trash2
    return (
      <div
        id={`commentaire-${comment.id}`}
        tabIndex={-1}
        className={`flex scroll-mt-24 items-center gap-2 rounded-lg px-3 py-2 text-sm ${comment.deletedByAdmin ? 'bg-ocre-pale text-ocre-dark' : 'bg-sand-dark text-mist'}`}
      >
        <Icone aria-hidden="true" className="h-4 w-4 shrink-0" />
        <p><strong>Commentaire supprimé</strong> · {comment.deletedByAdmin ? 'Par la modération' : 'Par son auteur'}</p>
      </div>
    )
  }

  const nomPublic = comment.auteurLabel || 'Utilisateur supprimé'
  const estAuteur = user && (comment.isOwn || comment.auteurId === user.id)
  const avatar = comment.auteurAvatar && (user || comment.auteurAvatar.kind === 'PRESET')
    ? mapAvatar(comment.auteurAvatar) : undefined
  const noms = nomPublic.split(/\s+/)

  return (
    <div id={`commentaire-${comment.id}`} tabIndex={-1} className="scroll-mt-24 [overflow-wrap:anywhere]">
      <div className="flex items-start gap-2 sm:gap-3">
        {avatar ? <Avatar user={{ prenom: noms[0], nom: noms[noms.length - 1], avatar }} size="sm" />
          : <CommentAvatar label={nomPublic} size="sm" />}
        <div className="min-w-0 flex-1">
          <p className="font-bold">
            {user && comment.auteurId ? (
              <Link
                to={`/profil/${comment.auteurId}`}
                className="rounded-md underline decoration-2 underline-offset-4 hover:text-forest"
              >
                {nomPublic}
              </Link>
            ) : (
              <span>{nomPublic}</span>
            )}
          </p>
          <p className="text-[0.875rem] text-mist">
            <time dateTime={comment.createdAt}>le {formatDateTime(comment.createdAt)}</time>
            {comment.updatedAt ? (
              <span className="ml-2 inline-block rounded-md bg-leaf-pale px-2 font-bold text-forest">
                Modifié le <time dateTime={comment.updatedAt}>{formatDateTime(comment.updatedAt)}</time>
              </span>
            ) : null}
          </p>

          {modifOuverte ? (
            <EditCommentForm
              comment={comment}
              onDone={() => {
                setModifOuverte(false)
                document.getElementById(`modifier-${comment.id}`)?.focus()
              }}
            />
          ) : (
            <p className="mt-2 whitespace-pre-line text-base leading-relaxed sm:text-[1.0625rem]">
              {avecMentions(comment.contenu)}
            </p>
          )}

          {user ? (
            <div className="mt-2 flex flex-wrap gap-x-2 text-sm">
              {estAuteur ? (
                <>
                  <button
                    id={`modifier-${comment.id}`}
                    type="button"
                    onClick={() => setModifOuverte(true)}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-3 font-bold text-forest underline decoration-2 underline-offset-4 hover:bg-leaf-pale"
                  >
                    <Pencil aria-hidden="true" className="h-4 w-4" />
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => setASupprimer(true)}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-3 font-bold text-brique underline decoration-2 underline-offset-4 hover:bg-brique-pale"
                  >
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                    Supprimer
                  </button>
                </>
              ) : null}
              {!dansReponse ? (
                <button
                  id={`repondre-${comment.id}`}
                  type="button"
                  onClick={() => setReponseOuverte((o) => !o)}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-3 font-bold text-forest underline decoration-2 underline-offset-4 hover:bg-leaf-pale"
                  aria-expanded={reponseOuverte}
                  aria-controls={reponseOuverte ? `reponse-${comment.id}` : undefined}
                >
                  <Reply aria-hidden="true" className="h-4 w-4" />
                  Répondre
                </button>
              ) : null}
            </div>
          ) : null}

          {reponseOuverte ? (
            <CommentForm
              articleId={comment.articleId}
              parentId={comment.id}
              user={user}
              onDone={() => {
                setReponseOuverte(false)
                document.getElementById(`repondre-${comment.id}`)?.focus()
              }}
            />
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={aSupprimer}
        onClose={() => setASupprimer(false)}
        onConfirm={async () => {
          try { await deleteComment(comment.id); await refresh() }
          catch (error) { toast(authErrorMessage(error), 'erreur'); return }
          setASupprimer(false)
          requestAnimationFrame(() => document.getElementById(`commentaire-${comment.id}`)?.focus())
          toast('Commentaire supprimé.', 'info')
        }}
        title="Supprimer votre commentaire ?"
        confirmLabel="Supprimer mon commentaire"
      >
        <p>
          Votre commentaire ne sera plus affiché : la mention « Commentaire supprimé » apparaîtra à
          son emplacement. Ses réponses éventuelles seront conservées et resteront rattachées à la
          discussion. Cette action ne peut pas être annulée.
        </p>
      </ConfirmDialog>
    </div>
  )
}

function EditCommentForm({ comment, onDone }: { comment: Comment; onDone: () => void }) {
  const { toast } = useToast()
  const refresh = useContext(RefreshComments)
  const [enCours, setEnCours] = useState(false)
  const [contenu, setContenu] = useState(comment.contenu)
  const [erreur, setErreur] = useState('')

  return (
    <form
      className="mt-3 flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!contenu.trim()) {
          setErreur('Le contenu du commentaire ne peut pas être vide.')
          focusChampInvalide(e.currentTarget)
          return
        }
        if (enCours) return
        setEnCours(true)
        try { await editComment(comment.id, contenu); await refresh() }
        catch (error) { setErreur(authErrorMessage(error)); return }
        finally { setEnCours(false) }
        toast('Commentaire modifié.')
        onDone()
      }}
    >
      <Field
        label="Modifier votre commentaire"
        htmlFor={`modif-${comment.id}`}
        required
        error={erreur}
      >
        <Textarea
          id={`modif-${comment.id}`}
          value={contenu}
          onChange={(e) => {
            setContenu(e.target.value)
            setErreur('')
          }}
          invalid={!!erreur}
          describedBy={erreur ? `modif-${comment.id}-err` : undefined}
          autoFocus
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={enCours}>Enregistrer la modification</Button>
        <Button variant="blanc" onClick={onDone}>
          Annuler
        </Button>
      </div>
    </form>
  )
}

function CommentForm({
  articleId,
  parentId,
  user,
  onDone,
}: {
  articleId: string
  parentId: string | null
  user: { id: string; prenom: string; nom: string } | null
  onDone?: () => void
}) {
  const { toast } = useToast()
  const refresh = useContext(RefreshComments)
  const [enCours, setEnCours] = useState(false)
  const { pathname, search, hash } = useLocation()
  const [contenu, setContenu] = useState('')
  const [erreur, setErreur] = useState('')
  const [envoye, setEnvoye] = useState(false)

  if (!user) {
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-line bg-white p-4 sm:p-5">
        <p className="font-bold">Participer à la discussion</p>
        <p className="mt-1">
          Connectez-vous pour publier un commentaire.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to="/connexion" state={{ from: `${pathname}${search}${hash}` }} className={buttonClasses()}>
            Se connecter
          </Link>
          <Link to="/inscription" className={buttonClasses('secondaire')}>
            Créer un compte
          </Link>
        </div>
      </div>
    )
  }

  const champ = `texte-commentaire-${parentId ?? 'nouveau'}`

  return (
    <form
      id={parentId ? `reponse-${parentId}` : undefined}
      className="mt-4 rounded-xl border border-line bg-white p-3 sm:p-5"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!contenu.trim()) {
          setErreur('Veuillez écrire votre commentaire avant de l\'envoyer.')
          focusChampInvalide(e.currentTarget)
          return
        }
        if (enCours) return
        setEnCours(true)
        try { await createComment(articleId, contenu, parentId); await refresh() }
        catch (error) { setErreur(authErrorMessage(error)); return }
        finally { setEnCours(false) }
        setContenu('')
        setEnvoye(true)
        setErreur('')
        if (parentId) toast('Votre réponse a été publiée.')
        onDone?.()
      }}
    >
      <h3 className="text-xl">
        {parentId ? 'Votre réponse' : 'Écrire un commentaire'}
      </h3>
      {envoye ? (
        <div className="mt-3">
          <Alert kind="succes" title="Commentaire publié">
            Votre commentaire est visible immédiatement sous l'article.
          </Alert>
        </div>
      ) : null}
      <div className="mt-4">
        <Field
          label={parentId ? 'Votre réponse' : 'Votre commentaire'}
          htmlFor={champ}
          required
          error={erreur}
        >
          <Textarea
            id={champ}
            value={contenu}
            onChange={(e) => {
              setContenu(e.target.value)
              setErreur('')
            }}
            invalid={!!erreur}
            describedBy={erreur ? `${champ}-err` : undefined}
            autoFocus={Boolean(parentId)}
            placeholder="Partagez votre expérience, votre question ou votre conseil…"
          />
        </Field>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="submit" disabled={enCours}>{parentId ? 'Publier ma réponse' : 'Publier mon commentaire'}</Button>
        {onDone ? (
          <Button variant="blanc" onClick={onDone}>
            Annuler
          </Button>
        ) : null}
      </div>
    </form>
  )
}

