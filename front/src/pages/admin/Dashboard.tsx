import { useCurrentUser } from '../../lib/auth'
import { Link, useOutletContext } from 'react-router-dom'
import {
  ArrowRight,
  CalendarClock,
  FileText,
  Image as ImageIcon,
  MessageSquare,
  MessagesSquare,
  ScrollText,
  TriangleAlert,
  UserPlus,
  Users,
} from 'lucide-react'
import { db, fullName, useDb } from '../../lib/db'
import { useFakeLoad } from '../../hooks/common'
import { Skeleton, SkeletonText } from '../../components/ui/feedback'
import type { AdminMessagesContext } from '../../components/layout/AdminLayout'
import type { Comment } from '../../types'
import { useResource } from '../../lib/community'
import { AdminPageHead } from '../../components/layout/AdminLayout'
import { Badge } from '../../components/ui/feedback'
import { ArticleStatutBadge } from '../../components/content/ArticleCard'
import { formatDateTime } from '../../lib/format'
import { buttonClasses } from '../../components/ui/form'

/** Tableau de bord administrateur (§37, §40) : statistiques, « À traiter »,
 *  actions rapides, articles programmés et activité récente */
export function Dashboard() {
  useDb()
  const chargement = useFakeLoad(500)
  const admin = useCurrentUser()

  const publies = db.articles.filter((a) => a.statut === 'publie').length
  const programmes = db.articles.filter((a) => a.statut === 'programme').length
  const brouillons = db.articles.filter((a) => a.statut === 'brouillon').length
  const corbeille = db.articles.filter((a) => a.statut === 'corbeille').length
  const { data: messages } = useOutletContext<AdminMessagesContext>()
  const messagesNonLus = messages?.filter((m) => !m.lu).length ?? 0
  const nbUtilisateurs = db.users.length
  const { data: commentaires } = useResource<Comment[]>('/admin/comments', true)
  const nbCommentaires = commentaires?.length ?? 0
  const medias = db.medias.length

  const aTraiter: { titre: string; texte: string; lien: string; lienLabel: string; urgence: boolean }[] = []
  if (messagesNonLus > 0) {
    aTraiter.push({
      titre: `${messagesNonLus} message${messagesNonLus > 1 ? 's' : ''} de contact non lu${messagesNonLus > 1 ? 's' : ''}`,
      texte: 'Des demandes attendent une réponse : adhésions, signalements, partenariats.',
      lien: '/admin/messages',
      lienLabel: 'Consulter les messages',
      urgence: true,
    })
  }
  if (programmes > 0) {
    aTraiter.push({
      titre: `${programmes} article${programmes > 1 ? 's' : ''} programmé${programmes > 1 ? 's' : ''}`,
      texte: 'Les articles programmés seront publiés automatiquement à la date prévue.',
      lien: '/admin/articles?onglet=programmes',
      lienLabel: 'Voir les articles programmés',
      urgence: false,
    })
  }
  if (corbeille > 0) {
    aTraiter.push({
      titre: `${corbeille} article${corbeille > 1 ? 's' : ''} dans la corbeille`,
      texte: 'Les articles restent dans la corbeille indéfiniment jusqu\'à suppression définitive.',
      lien: '/admin/articles?onglet=corbeille',
      lienLabel: 'Ouvrir la corbeille',
      urgence: false,
    })
  }
  const suspendus = db.users.filter((u) => u.statut === 'suspendu').length
  if (suspendus > 0) {
    aTraiter.push({
      titre: `${suspendus} compte suspendu${suspendus > 1 ? 's' : ''}`,
      texte: 'Les comptes suspendus ne peuvent plus se connecter ni commenter. Réactivation possible à tout moment.',
      lien: '/admin/utilisateurs',
      lienLabel: 'Gérer les utilisateurs',
      urgence: false,
    })
  }

  const programmesProchains = db.articles
    .filter((a) => a.statut === 'programme' && a.programmeAt)
    .sort((a, b) => (a.programmeAt ?? '').localeCompare(b.programmeAt ?? ''))

  const derniersLogs = db.logs.slice(0, 6)

  return (
    <>
      <AdminPageHead
        titre="Tableau de bord"
        description={
          admin
            ? `Bienvenue ${admin.prenom} — vue d'ensemble de l'activité du site.`
            : "Vue d'ensemble de l'activité du site."
        }
      >
        <Link to="/admin/articles/nouveau" className={buttonClasses('primaire')}>
          <FileText aria-hidden="true" className="h-5 w-5" />
          Nouvel article
        </Link>
        <Link to="/admin/utilisateurs" className={buttonClasses('secondaire')}>
          <UserPlus aria-hidden="true" className="h-5 w-5" />
          Créer un compte
        </Link>
      </AdminPageHead>

      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        {/* Indicateurs clés */}
        {chargement ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Chargement des statistiques">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-line bg-white p-6">
                <SkeletonText lines={2} />
              </div>
            ))}
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icone: Users, label: 'Utilisateurs inscrits', valeur: nbUtilisateurs, lien: '/admin/utilisateurs' },
              { icone: FileText, label: 'Articles publiés', valeur: publies, lien: '/admin/articles?onglet=publies' },
              { icone: MessagesSquare, label: 'Commentaires', valeur: nbCommentaires, lien: '/admin/commentaires' },
              { icone: MessageSquare, label: 'Messages non lus', valeur: messagesNonLus, lien: '/admin/messages' },
            ].map((k) => (
              <li key={k.label} className="rounded-2xl border border-line bg-white p-6">
                <Link to={k.lien} className="group flex items-center gap-4">
                  <k.icone aria-hidden="true" className="h-8 w-8 shrink-0 text-forest" />
                  <span>
                    <span className="block text-[0.9375rem] text-mist">{k.label}</span>
                    <span className="block text-3xl font-bold group-hover:text-forest">{k.valeur}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          {/* À traiter (§40) */}
          <section aria-labelledby="titre-a-traiter">
            <h2 id="titre-a-traiter" className="flex items-center gap-2 text-xl text-forest">
              <TriangleAlert aria-hidden="true" className="h-6 w-6" />
              À traiter
            </h2>
            <ul className="mt-4 flex flex-col gap-3">
              {aTraiter.length === 0 ? (
                <li className="rounded-2xl border border-dashed border-line bg-white p-5 text-mist">
                  Rien à signaler : tous les éléments sont à jour.
                </li>
              ) : (
                aTraiter.map((item) => (
                  <li
                    key={item.titre}
                    className={`rounded-2xl border bg-white p-5 ${
                      item.urgence ? 'border-ocre' : 'border-line'
                    }`}
                  >
                    <p className="font-bold">
                      {item.urgence ? (
                        <Badge variant="ocre" className="mr-2">
                          Prioritaire
                        </Badge>
                      ) : null}
                      {item.titre}
                    </p>
                    <p className="mt-1 text-[0.9375rem] text-mist">{item.texte}</p>
                    <Link
                      to={item.lien}
                      className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 font-bold text-forest underline decoration-2 underline-offset-4 hover:bg-leaf-pale"
                    >
                      {item.lienLabel}
                      <ArrowRight aria-hidden="true" className="h-4 w-4" />
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </section>

          {/* Actions rapides */}
          <section aria-labelledby="titre-actions">
            <h2 id="titre-actions" className="text-xl text-forest">
              Actions rapides
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { to: '/admin/articles/nouveau', label: 'Créer un article', icone: FileText },
                { to: '/admin/articles?onglet=corbeille', label: 'Gérer la corbeille', icone: FileText },
                { to: '/admin/medias', label: 'Importer un média', icone: ImageIcon },
                { to: '/admin/utilisateurs', label: 'Créer un compte utilisateur', icone: UserPlus },
                { to: '/admin/commentaires', label: 'Modérer les commentaires', icone: MessagesSquare },
                { to: '/admin/statistiques', label: 'Voir les statistiques', icone: ScrollText },
              ].map((a) => (
                <li key={a.to + a.label}>
                  <Link
                    to={a.to}
                    className="flex min-h-[64px] items-center gap-3 rounded-2xl border border-line bg-white p-4 font-bold text-forest hover:border-forest hover:bg-leaf-pale"
                  >
                    <a.icone aria-hidden="true" className="h-6 w-6 shrink-0" />
                    {a.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* Articles programmés */}
          <section aria-labelledby="titre-programmes">
            <h2 id="titre-programmes" className="flex items-center gap-2 text-xl text-forest">
              <CalendarClock aria-hidden="true" className="h-6 w-6" />
              Publications programmées
            </h2>
            {programmesProchains.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-dashed border-line bg-white p-5 text-mist">
                Aucune publication programmée.
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-3">
                {programmesProchains.map((a) => (
                  <li key={a.id} className="rounded-2xl border border-line bg-white p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link
                        to={`/admin/articles/${a.id}`}
                        className="font-bold text-forest underline decoration-2 underline-offset-4 hover:bg-leaf-pale"
                      >
                        {a.titre}
                      </Link>
                      <ArticleStatutBadge statut={a.statut} />
                    </div>
                    <p className="mt-1 text-[0.9375rem] text-mist">
                      Publication automatique le {formatDateTime(a.programmeAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Activité récente (§41) */}
          <section aria-labelledby="titre-activite">
            <h2 id="titre-activite" className="flex items-center gap-2 text-xl text-forest">
              <ScrollText aria-hidden="true" className="h-6 w-6" />
              Activité administrative récente
            </h2>
            <ul className="mt-4 flex flex-col gap-2">
              {derniersLogs.map((l) => (
                <li key={l.id} className="rounded-2xl border border-line bg-white p-4">
                  <p className="font-bold">{l.action}</p>
                  <p className="text-[0.9375rem] text-mist">
                    {l.cible} — {fullName(db.users.find((u) => u.id === l.adminId))} —{' '}
                    {formatDateTime(l.at)}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-3">
              <Link
                to="/admin/journal"
                className="inline-flex min-h-[44px] items-center gap-1.5 font-bold text-forest underline decoration-2 underline-offset-4 hover:bg-leaf-pale"
              >
                Voir tout le journal d'activité
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </p>
          </section>
        </div>
      </div>
    </>
  )
}
