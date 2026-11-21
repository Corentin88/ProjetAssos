import { Link } from 'react-router-dom'
import { FileText, Mail, MessagesSquare, TrendingUp, Users } from 'lucide-react'
import { db, useDb } from '../../lib/db'
import { useFakeLoad } from '../../hooks/common'
import { Skeleton, SkeletonText } from '../../components/ui/feedback'
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

function CourbeFrequence() {
  const { moisLabels, visiteurs, pagesVues } = db.stats
  const W = 720
  const H = 300
  const pad = 40
  const max = Math.max(...pagesVues) * 1.1
  const pts = (serie: number[]) =>
    serie
      .map((v, i) => {
        const x = pad + (i / (serie.length - 1)) * (W - pad * 2)
        const y = H - pad - (v / max) * (H - pad * 2)
        return `${i === 0 ? 'M' : 'L'}${Math.round(x)},${Math.round(y)}`
      })
      .join(' ')

  return (
    <figure className="rounded-2xl border border-line bg-white p-6">
      <figcaption className="text-xl text-forest">Évolution de la fréquentation — 12 derniers mois</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 h-auto w-full" role="img" aria-label={`Évolution du trafic sur 12 mois : visiteurs de ${visiteurs[0]} à ${visiteurs[visiteurs.length - 1]}, pages vues de ${pagesVues[0]} à ${pagesVues[pagesVues.length - 1]}`}>
        {[0.25, 0.5, 0.75, 1].map((t) => (
          <line key={t} x1={pad} y1={H - pad - t * (H - pad * 2)} x2={W - pad} y2={H - pad - t * (H - pad * 2)} stroke="#e4e4dc" />
        ))}
        <path d={pts(pagesVues)} fill="none" stroke="#b05f1d" strokeWidth="4" strokeLinecap="round" />
        <path d={pts(visiteurs)} fill="none" stroke="#20573f" strokeWidth="4" strokeLinecap="round" />
        {moisLabels.map((m, i) => {
          const x = pad + (i / (moisLabels.length - 1)) * (W - pad * 2)
          return (
            <text key={m} x={x} y={H - 12} fontSize="11" fill="#55645b" textAnchor="middle">
              {m}
            </text>
          )
        })}
        <text x={pad} y="24" fontSize="14" fill="#20573f" fontWeight="bold">— Visiteurs</text>
        <text x={pad + 130} y="24" fontSize="14" fill="#b05f1d" fontWeight="bold">— Pages vues</text>
      </svg>
      <details className="mt-3">
        <summary className="cursor-pointer font-bold text-forest">Voir les données en tableau</summary>
        <div className="scrollzone mt-3 max-h-72 overflow-y-auto">
          <table className="w-full border-collapse text-left text-[0.9375rem]">
            <caption className="sr-only">Visiteurs et pages vues par mois</caption>
            <thead>
              <tr>
                <th scope="col" className="border-b border-line px-3 py-2">Mois</th>
                <th scope="col" className="border-b border-line px-3 py-2">Visiteurs</th>
                <th scope="col" className="border-b border-line px-3 py-2">Pages vues</th>
              </tr>
            </thead>
            <tbody>
              {moisLabels.map((m, i) => (
                <tr key={m}>
                  <td className="border-b border-line px-3 py-1.5">{m}</td>
                  <td className="border-b border-line px-3 py-1.5">{formatNombre(visiteurs[i])}</td>
                  <td className="border-b border-line px-3 py-1.5">{formatNombre(pagesVues[i])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}

/** Statistiques (§39) : réservées aux administrateurs */
export function StatistiquesAdmin() {
  useDb()
  const chargement = useFakeLoad(500)

  const admins = db.users.filter((u) => u.role === 'administrateur').length
  const utilisateurs = db.users.length - admins
  const publies = db.articles.filter((a) => a.statut === 'publie').length
  const brouillons = db.articles.filter((a) => a.statut === 'brouillon').length
  const programmes = db.articles.filter((a) => a.statut === 'programme').length
  const corbeille = db.articles.filter((a) => a.statut === 'corbeille').length
  const nbMessagesNonLus = db.messages.filter((m) => !m.lu).length

  return (
    <>
      <AdminPageHead
        titre="Statistiques"
        description="Indicateurs de comptes, contenus, messages et fréquentation. Les statistiques sont réservées aux administrateurs ; la solution de mesure et les données collectées seront précisées dans la conception RGPD."
      />
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        {chargement ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Chargement des statistiques">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-line bg-white p-6">
                <SkeletonText lines={2} />
              </div>
            ))}
          </div>
        ) : (
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icone: Users, label: 'Total utilisateurs', valeur: db.users.length },
              { icone: FileText, label: 'Articles publiés', valeur: publies },
              { icone: MessagesSquare, label: 'Commentaires', valeur: db.comments.length },
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

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <BarresRoles admins={admins} utilisateurs={utilisateurs} />

          <section aria-labelledby="titre-contenus" className="rounded-2xl border border-line bg-white p-6">
            <h2 id="titre-contenus" className="text-xl text-forest">Contenus</h2>
            <ul className="mt-4 flex flex-col gap-2 text-[1.0625rem]">
              {[
                { label: 'Articles publiés', valeur: publies, lien: '/admin/articles?onglet=publies' },
                { label: 'Brouillons', valeur: brouillons, lien: '/admin/articles?onglet=brouillons' },
                { label: 'Articles programmés', valeur: programmes, lien: '/admin/articles?onglet=programmes' },
                { label: 'Articles dans la corbeille', valeur: corbeille, lien: '/admin/articles?onglet=corbeille' },
                { label: 'Commentaires (tous)', valeur: db.comments.length, lien: '/admin/commentaires' },
                { label: 'Médias dans la médiathèque', valeur: db.medias.length, lien: '/admin/medias' },
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
        </div>

        <div className="mt-8">
          <CourbeFrequence />
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          {/* Articles les plus consultés */}
          <section aria-labelledby="titre-top" className="rounded-2xl border border-line bg-white p-6">
            <h2 id="titre-top" className="flex items-center gap-2 text-xl text-forest">
              <TrendingUp aria-hidden="true" className="h-6 w-6" />
              Articles les plus consultés
            </h2>
            <table className="mt-4 w-full border-collapse text-left text-[0.9375rem]">
              <caption className="sr-only">Articles les plus consultés du site</caption>
              <thead>
                <tr>
                  <th scope="col" className="border-b border-line px-3 py-2">Article</th>
                  <th scope="col" className="border-b border-line px-3 py-2">Vues</th>
                </tr>
              </thead>
              <tbody>
                {db.stats.topArticles.map((t) => {
                  const a = db.articles.find((x) => x.id === t.articleId)
                  return (
                    <tr key={t.articleId}>
                      <td className="border-b border-line px-3 py-2">
                        {a ? (
                          <Link to={`/admin/articles/${a.id}`} className="font-bold text-forest underline underline-offset-4">
                            {a.titre}
                          </Link>
                        ) : (
                          '(article supprimé)'
                        )}
                      </td>
                      <td className="border-b border-line px-3 py-2">{formatNombre(t.vues)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>

          {/* Recherches effectuées */}
          <section aria-labelledby="titre-recherches" className="rounded-2xl border border-line bg-white p-6">
            <h2 id="titre-recherches" className="text-xl text-forest">Recherches les plus effectuées</h2>
            <table className="mt-4 w-full border-collapse text-left text-[0.9375rem]">
              <caption className="sr-only">Termes de recherche les plus fréquents</caption>
              <thead>
                <tr>
                  <th scope="col" className="border-b border-line px-3 py-2">Terme</th>
                  <th scope="col" className="border-b border-line px-3 py-2">Occurrences</th>
                </tr>
              </thead>
              <tbody>
                {db.stats.recherches.map((r) => (
                  <tr key={r.terme}>
                    <td className="border-b border-line px-3 py-2">{r.terme}</td>
                    <td className="border-b border-line px-3 py-2">{formatNombre(r.occurrences)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        {/* Sources de trafic */}
        <section aria-labelledby="titre-sources" className="mt-8 rounded-2xl border border-line bg-white p-6">
          <h2 id="titre-sources" className="text-xl text-forest">Principales sources de trafic</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {db.stats.sources.map((s) => (
              <li key={s.nom}>
                <p className="flex justify-between font-bold">
                  <span>{s.nom}</span>
                  <span>{s.part} %</span>
                </p>
                <div className="mt-1 h-6 rounded-lg bg-sand-dark">
                  <div className="h-6 rounded-lg bg-forest" style={{ width: `${s.part}%` }} role="img" aria-label={`${s.nom} : ${s.part} % du trafic`} />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[0.9375rem] text-mist">
            Activité récente et éléments nécessitant une intervention : voir la zone « À traiter »
            du tableau de bord et le journal d'activité.
          </p>
        </section>
      </div>
    </>
  )
}
