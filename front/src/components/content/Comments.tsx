import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle, Pencil, Reply, Trash2 } from 'lucide-react'
import type { Comment } from '../../types'
import {
  addComment,
  db,
  deleteCommentByAuthor,
  editComment,
  fullName,
  session,
  useDb,
  useDbVersion,
} from '../../lib/db'
import { commentThreads } from '../../lib/selectors'
import { formatDateTime } from '../../lib/format'
import { Button, Field, Textarea } from '../ui/form'
import { ConfirmDialog } from '../ui/overlay'
import { Alert, EmptyState } from '../ui/feedback'
import { CommentAvatar } from '../ui/misc'
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

export function CommentsSection({ articleId }: { articleId: string }) {
  useDb()
  const version = useDbVersion() // recomputé à chaque mutation du grain
  void version
  const user = session.current ? db.users.find((u) => u.id === session.current!.userId) ?? null : null
  const threads = commentThreads(articleId)
  const nbTotal = threads.reduce((n, t) => n + 1 + t.replies.length, 0)

  return (
    <section id="commentaires" aria-labelledby="titre-commentaires" className="mt-12">
      <h2 id="titre-commentaires" className="flex items-center gap-3 text-2xl text-forest">
        <MessageCircle aria-hidden="true" className="h-7 w-7" />
        Commentaires ({nbTotal})
      </h2>
      <p className="mt-2 text-mist">
        Les commentaires sont publiés immédiatement et visibles par tous. Les discussions ne
        comportent qu'un seul niveau de réponse : pour répondre à une réponse, mentionnez son
        auteur avec son @prénom.
      </p>

      <CommentForm articleId={articleId} parentId={null} user={user} />

      <div className="mt-8 flex flex-col gap-6">
        {threads.length === 0 ? (
          <EmptyState
            icon={MessageCircle}
            title="Aucun commentaire pour le moment"
            description="Soyez la première personne à partager votre expérience dans la discussion."
          />
        ) : (
          threads.map(({ comment, replies }) => (
            <CommentThreadView
              key={comment.id}
              comment={comment}
              replies={replies}
              user={user}
            />
          ))
        )}
      </div>
    </section>
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
    <article className="rounded-2xl border border-line bg-white p-6">
      <CommentView comment={comment} user={user} />
      {replies.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-4 border-l-2 border-leaf-pale pl-5" aria-label={`Réponses au commentaire de ${comment.auteurLabel}`}>
          {replies.map((r) => (
            <li key={r.id}>
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
  const [modifOuverte, setModifOuverte] = useState(false)
  const [reponseOuverte, setReponseOuverte] = useState(false)
  const [aSupprimer, setASupprimer] = useState(false)

  const supprime = comment.deletedByAuthor || comment.moderation
  const estAuteur = user && comment.auteurId === user.id

  return (
    <div id={`commentaire-${comment.id}`} className="scroll-mt-24">
      <div className="flex items-start gap-4">
        <CommentAvatar label={comment.auteurLabel} size={dansReponse ? 'sm' : 'md'} />
        <div className="min-w-0 flex-1">
          <p className="font-bold">
            {supprime ? (
              <span className="text-mist">Commentaire supprimé</span>
            ) : user && comment.auteurId ? (
              <Link
                to={`/profil/${comment.auteurId}`}
                className="rounded-md underline decoration-2 underline-offset-4 hover:text-forest"
              >
                {comment.auteurLabel}
              </Link>
            ) : (
              <span>{comment.auteurLabel}</span>
            )}
            {comment.auteurId === null && !supprime ? (
              <span className="ml-2 text-[0.8125rem] font-normal text-mist">
                (compte supprimé)
              </span>
            ) : null}
          </p>
          <p className="text-[0.875rem] text-mist">
            <time dateTime={comment.createdAt}>le {formatDateTime(comment.createdAt)}</time>
            {comment.updatedAt ? (
              <span className="ml-1"> — Modifié le {formatDateTime(comment.updatedAt)}</span>
            ) : null}
          </p>

          {supprime ? (
            <p className="mt-2 rounded-xl bg-sand-dark px-4 py-3 text-mist italic">
              Commentaire supprimé. Les réponses restent visibles pour préserver la discussion.
            </p>
          ) : modifOuverte ? (
            <EditCommentForm
              comment={comment}
              onDone={() => setModifOuverte(false)}
            />
          ) : (
            <p className="mt-2 whitespace-pre-line text-[1.0625rem] leading-relaxed">
              {avecMentions(comment.contenu)}
            </p>
          )}

          {!supprime && user ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {estAuteur ? (
                <>
                  <button
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
                  type="button"
                  onClick={() => setReponseOuverte((o) => !o)}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-3 font-bold text-forest underline decoration-2 underline-offset-4 hover:bg-leaf-pale"
                  aria-expanded={reponseOuverte}
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
              onDone={() => setReponseOuverte(false)}
            />
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={aSupprimer}
        onClose={() => setASupprimer(false)}
        onConfirm={() => {
          deleteCommentByAuthor(comment.id)
          setASupprimer(false)
          toast('Votre commentaire a été supprimé. Il est remplacé par la mention « Commentaire supprimé » dans la discussion.', 'info')
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
  const [contenu, setContenu] = useState(comment.contenu)
  const [erreur, setErreur] = useState('')

  return (
    <form
      className="mt-3 flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!contenu.trim()) {
          setErreur('Le contenu du commentaire ne peut pas être vide.')
          return
        }
        editComment(comment.id, contenu)
        toast('Votre commentaire a été modifié. La date de dernière modification est enregistrée.')
        onDone()
      }}
    >
      <Field
        label="Modifier votre commentaire"
        htmlFor={`modif-${comment.id}`}
        required
        error={erreur}
        hint="Vous pouvez modifier votre commentaire sans limite de temps. La mention « Modifié le… » sera affichée publiquement."
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
          aria-label="Nouveau contenu du commentaire"
        />
      </Field>
      <div className="flex gap-3">
        <Button type="submit">Enregistrer la modification</Button>
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
  const [contenu, setContenu] = useState('')
  const [erreur, setErreur] = useState('')
  const [envoye, setEnvoye] = useState(false)

  if (!user) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-line bg-white p-6">
        <p className="font-bold">Participer à la discussion</p>
        <p className="mt-1">
          Seuls les utilisateurs connectés peuvent publier des commentaires. Les commentaires sont
          visibles de tous.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to="/connexion" className={buttonLink}>
            Se connecter
          </Link>
          <Link to="/inscription" className={buttonLinkSecondaire}>
            Créer un compte
          </Link>
        </div>
      </div>
    )
  }

  const parent = parentId ? db.comments.find((c) => c.id === parentId) : null

  return (
    <form
      className="mt-6 rounded-2xl border border-line bg-white p-6"
      onSubmit={(e) => {
        e.preventDefault()
        if (!contenu.trim()) {
          setErreur('Veuillez écrire votre commentaire avant de l\'envoyer.')
          return
        }
        addComment(articleId, user.id, contenu, parentId)
        setContenu('')
        setEnvoye(true)
        setErreur('')
        toast('Votre commentaire a été publié. Il est visible immédiatement.')
        onDone?.()
      }}
    >
      <h3 className="text-xl">
        {parentId ? 'Votre réponse' : 'Écrire un commentaire'}
      </h3>
      {parent ? (
        <p className="mt-1 text-[0.9375rem] text-mist">
          Réponse au commentaire de {parent.auteurLabel}.{' '}
          {parent.parentId ? (
            <span>
              Les réponses ne peuvent pas recevoir d'autres réponses : pour répondre à une réponse,
              publiez un nouveau commentaire en mentionnant son auteur, par exemple{' '}
              <strong>
                @{parent.auteurLabel.split(' ')[0]} {parent.auteurLabel.split(' ')[1]?.charAt(0) ?? ''}.
              </strong>
            </span>
          ) : null}
        </p>
      ) : null}
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
          htmlFor={`commentaire-${parentId ?? 'nouveau'}`}
          required
          error={erreur}
        >
          <Textarea
            id={`commentaire-${parentId ?? 'nouveau'}`}
            value={contenu}
            onChange={(e) => {
              setContenu(e.target.value)
              setErreur('')
            }}
            invalid={!!erreur}
            describedBy={erreur ? `commentaire-${parentId ?? 'nouveau'}-err` : undefined}
            placeholder="Partagez votre expérience, votre question ou votre conseil…"
          />
        </Field>
      </div>
      <div className="mt-4 flex gap-3">
        <Button type="submit">{parentId ? 'Publier ma réponse' : 'Publier mon commentaire'}</Button>
        {onDone ? (
          <Button variant="blanc" onClick={onDone}>
            Annuler
          </Button>
        ) : null}
      </div>
    </form>
  )
}

const buttonLink =
  'inline-flex min-h-[48px] items-center rounded-xl bg-forest px-6 font-bold text-white hover:bg-forest-dark'
const buttonLinkSecondaire =
  'inline-flex min-h-[48px] items-center rounded-xl border border-forest bg-white px-6 font-bold text-forest hover:bg-leaf-pale'
