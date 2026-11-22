import { authErrorMessage, useCurrentUser } from '../../lib/auth'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageSquare, Pencil, Trash2 } from 'lucide-react'
import type { Comment } from '../../types'
import { deleteComment, editComment, isDeletedComment, useResource } from '../../lib/community'
import { formatDateTime } from '../../lib/format'
import { Button, Field, Textarea } from '../../components/ui/form'
import { ConfirmDialog } from '../../components/ui/overlay'
import { Alert, EmptyState } from '../../components/ui/feedback'
import { useToast } from '../../hooks/useToast'

/** « Mes commentaires » (§13) : édition sans limite de temps, suppression
 *  avec placeholder public. Les commentaires supprimés par l'auteur
 *  n'apparaissent plus ici (§30). */
export function MesCommentaires() {
  const { toast } = useToast()
  const user = useCurrentUser()
  const { data: commentaires, error, refresh } = useResource<Comment[]>('/me/comments', true)
  const [aEditer, setAEditer] = useState<Comment | null>(null)
  const [contenuEdition, setContenuEdition] = useState('')
  const [aSupprimer, setASupprimer] = useState<Comment | null>(null)

  if (!user) return null

  return (
    <section aria-labelledby="titre-mes-commentaires">
      <h2 id="titre-mes-commentaires" className="text-xl text-forest">
        Mes commentaires
      </h2>
      <p className="mt-2 text-mist">
        Vous pouvez modifier vos commentaires et réponses sans limite de temps. La mention
        « Modifié le… » apparaît publiquement après une modification. Si vous supprimez un
        commentaire, la mention « Commentaire supprimé » reste visible dans la discussion et ses
        réponses éventuelles sont conservées.
      </p>

      {error ? <Alert kind="erreur" title="Commentaires indisponibles">{error}</Alert> : !commentaires ? <p role="status">Chargement…</p> : commentaires.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={MessageSquare}
            title="Vous n'avez pas encore de commentaire"
            description="Participez aux discussions sous les articles : vos messages apparaîtront ici."
            action={
              <Link to="/actualites" className="inline-flex min-h-[48px] items-center rounded-xl bg-forest px-6 font-bold text-white hover:bg-forest-dark">
                Parcourir les actualités
              </Link>
            }
          />
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {commentaires.map((c) => {
            return (
              <li key={c.id} className="rounded-2xl border border-line bg-white p-6">
                <p className="text-[0.9375rem] text-mist">
                  Sur l'article{' '}
                  {c.articleSlug ? (
                    <Link to={`/actualites/${c.articleSlug}#commentaire-${c.id}`} className="font-bold text-forest underline underline-offset-4">
                      {c.articleTitre}
                    </Link>
                  ) : (
                    <span>(article retiré du site)</span>
                  )}
                </p>
                {aEditer?.id === c.id ? (
                  <form
                    className="mt-3 flex flex-col gap-3"
                    onSubmit={async (e) => {
                      e.preventDefault()
                      if (!contenuEdition.trim()) return
                      try { await editComment(c.id, contenuEdition); await refresh() }
                      catch (error) { toast(authErrorMessage(error), 'erreur'); return }
                      setAEditer(null)
                      toast('Commentaire modifié. La date de modification est enregistrée.')
                    }}
                  >
                    <Field label="Modifier votre commentaire" htmlFor={`me-${c.id}`} required>
                      <Textarea
                        id={`me-${c.id}`}
                        value={contenuEdition}
                        onChange={(e) => setContenuEdition(e.target.value)}
                      />
                    </Field>
                    <div className="flex gap-3">
                      <Button type="submit">Enregistrer</Button>
                      <Button variant="blanc" onClick={() => setAEditer(null)}>
                        Annuler
                      </Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <p className="mt-3 whitespace-pre-line text-[1.0625rem]">{isDeletedComment(c) ? 'Commentaire supprimé par la modération' : c.contenu}</p>
                    <p className="mt-2 text-[0.875rem] text-mist">
                      Publié le {formatDateTime(c.createdAt)}
                      {c.updatedAt ? ` — Modifié le ${formatDateTime(c.updatedAt)}` : ''}
                    </p>
                    {!isDeletedComment(c) && <div className="mt-3 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setAEditer(c)
                          setContenuEdition(c.contenu)
                        }}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-3 font-bold text-forest underline decoration-2 underline-offset-4 hover:bg-leaf-pale"
                      >
                        <Pencil aria-hidden="true" className="h-4 w-4" />
                        Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => setASupprimer(c)}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-3 font-bold text-brique underline decoration-2 underline-offset-4 hover:bg-brique-pale"
                      >
                        <Trash2 aria-hidden="true" className="h-4 w-4" />
                        Supprimer
                      </button>
                    </div>}
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmDialog
        open={!!aSupprimer}
        onClose={() => setASupprimer(null)}
        onConfirm={async () => {
          if (aSupprimer) {
            try { await deleteComment(aSupprimer.id); await refresh() }
            catch (error) { toast(authErrorMessage(error), 'erreur'); return }
            toast('Commentaire supprimé. Il est remplacé par « Commentaire supprimé » dans la discussion.', 'info')
          }
          setASupprimer(null)
        }}
        title="Supprimer ce commentaire ?"
        confirmLabel="Supprimer définitivement"
      >
        <p>
          La mention « Commentaire supprimé » apparaîtra dans la discussion à la place de votre
          texte. Les réponses éventuelles seront conservées. Votre commentaire disparaîtra de cette
          liste et de votre profil public.
        </p>
      </ConfirmDialog>
    </section>
  )
}
