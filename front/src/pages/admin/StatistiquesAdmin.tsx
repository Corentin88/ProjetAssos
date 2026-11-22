import { Link } from 'react-router-dom'
import { FileText, Mail, MessagesSquare, Users } from 'lucide-react'
import { useAdminOverview } from '../../lib/admin'
import { Alert } from '../../components/ui/feedback'
import { AdminPageHead } from '../../components/layout/AdminLayout'
import { formatNombre } from '../../lib/format'

/** Graphique en barres accessible : aria + alternative en tableau */
function BarresRoles({ admins, utilisateurs }: { admins: number; utilisateurs: number }) {
  const total = admins + utilisateurs || 1
  const data = [
    { nom: 'Administrateurs', valeur: admins, couleur: '#20573f' },
    { nom: 'Utilisateurs', valeur: utilisateurs, couleur: '#5b9672' },
  ]
  return (
    <figure className="rounded-2xl border border-line bg-white p-6">
      <figcaption className="text-xl text-forest">Répartition par rôle (§39)</figcaption>
      <svg viewBox="0 0 400 120" className="mt-4 h-auto w-full" role="img" aria-label={`Répartition par rôle : ${admins} administrateurs, ${utilisateurs} utilisateurs`}>
        {data.map((d, i) => (
          <g key={d.nom} transform={`translate(0,${i * 50})`}>
            <text x="0" y="18" fontSize="15" fill="#1f2c25" fontWeight="bold">
              {d.nom}
            </text>
            <rect x="0" y="26" width={(d.valeur / total) * 360} height="22" rx="8" fill={d.couleur} />
            <text x={(d.valeur / total) * 360 + 8} y="43" fontSize="15" fill="#55645b">
              {d.valeur}
            </text>
          </g>
        ))}
      </svg>
      <details className="mt-3">
        <summary className="cursor-pointer font-bold text-forest">Voir les données en tableau</summary>
        <table className="mt-3 w-full border-collapse text-left text-[0.9375rem]">
          <caption className="sr-only">Répartition des comptes par rôle</caption>
          <thead>
            <tr>
              <th scope="col" className="border-b border-line px-3 py-2">Rôle</th>
              <th scope="col" className="border-b border-line px-3 py-2">Nombre de comptes</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.nom}>
                <td className="border-b border-line px-3 py-1.5">{d.nom}</td>
                <td className="border-b border-line px-3 py-1.5">{d.valeur}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}

/** Statistiques (§39) : réservées aux administrateurs */
export function StatistiquesAdmin() {
  const { data, error } = useAdminOverview()
  const admins = data?.accounts.ADMIN ?? 0
  const utilisateurs = data?.accounts.USER ?? 0
  const publies = data?.articles.PUBLISHED ?? 0
  const brouillons = data?.articles.DRAFT ?? 0
  const programmes = data?.articles.SCHEDULED ?? 0
  const corbeille = data?.articles.TRASHED ?? 0
  const nbMessagesNonLus = data?.unreadMessages ?? 0

  return (
    <>
      <AdminPageHead
        titre="Statistiques"
        description="Indicateurs de comptes, contenus et messages réservés aux administrateurs."
      />
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        {error ? <Alert kind="erreur" title="Statistiques indisponibles">{error}</Alert> : !data ? (
          <p role="status">Chargement des statistiques…</p>
        ) : (
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icone: Users, label: 'Total utilisateurs', valeur: admins + utilisateurs },
              { icone: FileText, label: 'Articles publiés', valeur: publies },
              { icone: MessagesSquare, label: 'Commentaires', valeur: data.comments },
              { icone: Mail, label: 'Messages non lus', valeur: nbMessagesNonLus },
            ].map((k) => (
              <div key={k.label} className="rounded-2xl border border-line bg-white p-6">
                <k.icone aria-hidden="true" className="h-7 w-7 text-forest" />
                <dt className="mt-2 text-[0.9375rem] text-mist">{k.label}</dt>
                <dd className="text-3xl font-bold">{formatNombre(k.valeur)}</dd>
              </div>
            ))}
          </dl>
        )}

        {data && <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <BarresRoles admins={admins} utilisateurs={utilisateurs} />

          <section aria-labelledby="titre-contenus" className="rounded-2xl border border-line bg-white p-6">
            <h2 id="titre-contenus" className="text-xl text-forest">Contenus</h2>
            <ul className="mt-4 flex flex-col gap-2 text-[1.0625rem]">
              {[
                { label: 'Articles publiés', valeur: publies, lien: '/admin/articles?onglet=publies' },
                { label: 'Brouillons', valeur: brouillons, lien: '/admin/articles?onglet=brouillons' },
                { label: 'Articles programmés', valeur: programmes, lien: '/admin/articles?onglet=programmes' },
                { label: 'Articles dans la corbeille', valeur: corbeille, lien: '/admin/articles?onglet=corbeille' },
                { label: 'Commentaires (tous)', valeur: data.comments, lien: '/admin/commentaires' },
                { label: 'Médias dans la médiathèque', valeur: data.media, lien: '/admin/medias' },
              ].map((item) => (
                <li key={item.label} className="flex items-center justify-between gap-3 rounded-xl bg-sand p-3">
                  <Link to={item.lien} className="font-bold text-forest underline underline-offset-4 hover:bg-leaf-pale">
                    {item.label}
                  </Link>
                  <span className="font-bold">{formatNombre(item.valeur)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>}

        <section aria-labelledby="titre-frequentation" className="mt-8 rounded-2xl border border-line bg-white p-6">
          <h2 id="titre-frequentation" className="text-xl text-forest">Fréquentation</h2>
          <p className="mt-2 text-mist">La mesure de fréquentation reste à définir dans le cadre RGPD.</p>
          <p className="mt-4">
            <Link to="/admin" className="font-bold text-forest underline underline-offset-4">Éléments à traiter</Link>
            {' · '}
            <Link to="/admin/journal" className="font-bold text-forest underline underline-offset-4">Journal d’activité</Link>
          </p>
        </section>
      </div>
    </>
  )
}
