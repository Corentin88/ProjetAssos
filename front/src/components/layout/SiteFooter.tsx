import { useCurrentUser } from '../../lib/auth'
import { Link, NavLink } from 'react-router-dom'
import { Facebook, Instagram, Mail, MapPin, Phone } from 'lucide-react'
import { useDb } from '../../lib/db'
import { asset } from '../../lib/assets'
import { LIENS_PUBLICS } from './siteNavigation'

const FAVICON = asset('favicon.svg')
const CLASSE_LIEN = 'inline-flex min-h-8 items-center rounded text-white/90 underline-offset-4 hover:text-white hover:underline'

function lienActif({ isActive }: { isActive: boolean }) {
  return `${CLASSE_LIEN} ${isActive ? 'font-bold underline decoration-2' : ''}`
}

/** Pied de page collé en bas de l'écran (flex + mt-auto sur le layout) */
export function SiteFooter() {
  const db = useDb()
  const c = db.association.coordonnees
  const utilisateur = useCurrentUser()

  return (
    <footer className="focus-inverse mt-auto bg-forest-dark text-white">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 md:grid-cols-[1.15fr_0.75fr_1fr] md:gap-8">
        <section aria-labelledby="footer-assoc">
          <h2 id="footer-assoc" className="flex items-center gap-3 text-lg font-bold">
            <img src={FAVICON} alt="" className="h-10 w-10 rounded-lg" />
            Foyer Rural d'Arches
          </h2>
          <ul className="mt-4 space-y-2 text-base text-white/85">
            <li className="flex items-start gap-2">
              <MapPin aria-hidden="true" className="mt-1 h-5 w-5 shrink-0" />
              <span>
                {c.adresse}, {c.codePostal} {c.ville}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Phone aria-hidden="true" className="mt-1 h-5 w-5 shrink-0" />
              <a
                href={`tel:${c.telephone.replace(/\s/g, '')}`}
                className="underline underline-offset-4 hover:text-white"
              >
                {c.telephone}
              </a>
            </li>
            <li className="flex items-start gap-2">
              <Mail aria-hidden="true" className="mt-1 h-5 w-5 shrink-0" />
              <a
                href={`mailto:${c.email}`}
                className="underline underline-offset-4 [overflow-wrap:anywhere] hover:text-white"
              >
                {c.email}
              </a>
            </li>
          </ul>
        </section>

        <nav aria-labelledby="footer-nav">
          <h2 id="footer-nav" className="text-lg font-bold">
            Le site
          </h2>
          <ul className="mt-2 text-base">
            {LIENS_PUBLICS.map(({ to, label }) => (
              <li key={to}><NavLink className={lienActif} to={to} end={to === '/'}>{label}</NavLink></li>
            ))}
            <li><Link className={CLASSE_LIEN} to="/actualites?avancee=1">Recherche avancée</Link></li>
            {!utilisateur ? (
              <>
                <li><NavLink className={lienActif} to="/connexion">Connexion</NavLink></li>
                <li><NavLink className={lienActif} to="/inscription">Créer un compte</NavLink></li>
              </>
            ) : null}
            {utilisateur?.statut === 'actif' ? (
              <>
                <li><NavLink className={lienActif} to="/mon-compte">Mon compte</NavLink></li>
                {utilisateur.role === 'administrateur' ? (
                  <li><NavLink className={lienActif} to="/admin">Administration</NavLink></li>
                ) : null}
              </>
            ) : null}
          </ul>
        </nav>

        <section aria-labelledby="footer-legal">
          <h2 id="footer-legal" className="text-lg font-bold">
            Informations légales
          </h2>
          <ul className="mt-2 text-base">
            <li><NavLink className={lienActif} to="/mentions-legales">Mentions légales</NavLink></li>
            <li><NavLink className={lienActif} to="/confidentialite">Politique de confidentialité</NavLink></li>
            <li><NavLink className={lienActif} to="/accessibilite">Accessibilité : conformité RGAA</NavLink></li>
          </ul>
          <h3 className="mt-4 text-base font-bold">Suivez-nous</h3>
          <ul className="mt-2 flex flex-wrap gap-2 text-base">
            {c.facebook ? (
              <li>
                <a
                  href={c.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-forest px-3 font-bold hover:bg-forest-light"
                >
                  <Facebook aria-hidden="true" className="h-5 w-5" />
                  Facebook
                </a>
              </li>
            ) : null}
            {c.instagram ? (
              <li>
                <a
                  href={c.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-forest px-3 font-bold hover:bg-forest-light"
                >
                  <Instagram aria-hidden="true" className="h-5 w-5" />
                  Instagram
                </a>
              </li>
            ) : null}
            {c.youtube ? (
              <li>
                <a
                  href={c.youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-forest px-3 font-bold hover:bg-forest-light"
                >
                  YouTube
                </a>
              </li>
            ) : null}
          </ul>
        </section>
      </div>
      <div className="border-t border-white/20 px-4 py-3 text-center text-[0.9375rem] text-white/75">
        <p>
          © 1962–2026 Foyer Rural d'Arches — Maquette frontend à but de démonstration. Les images
          utilisées sont des visuels d'illustration.
        </p>
      </div>
    </footer>
  )
}
