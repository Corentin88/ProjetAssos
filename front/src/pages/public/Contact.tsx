import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Clock, Mail, MapPin, Phone, Send, Facebook, Instagram, Youtube } from 'lucide-react'
import { addContactMessage, useDb } from '../../lib/db'
import { BlockRenderer } from '../../components/content/BlockRenderer'
import { Button, Field, Input, Textarea, Checkbox } from '../../components/ui/form'
import { Alert } from '../../components/ui/feedback'
import { useToast } from '../../hooks/useToast'
import { PageHead } from '../../components/layout/PublicLayout'

const SUJETS = [
  'Inscription et adhésion',
  'Réservation de la salle polyvalente',
  'Proposition d’activité ou d’atelier',
  'Bibliothèque et dons de livres',
  'Partenariat ou presse',
  'Autre demande',
]

/** Formulaire de contact (§35) : prénom, nom, e-mail, sujet, message +
 *  honeypot anti-spam invisible */
export function Contact() {
  const db = useDb()
  const { toast } = useToast()
  const [valeurs, setValeurs] = useState({ prenom: '', nom: '', email: '', sujet: '', message: '' })
  const [consentement, setConsentement] = useState(false)
  const [honeypot, setHoneypot] = useState('') // champ caché : doit rester vide
  const [erreurs, setErreurs] = useState<Record<string, string>>({})
  const [envoye, setEnvoye] = useState(false)

  const c = db.association.coordonnees

  const set = (champ: string, val: string) => {
    setValeurs((v) => ({ ...v, [champ]: val }))
    setErreurs((e) => {
      const n = { ...e }
      delete n[champ]
      return n
    })
  }

  const soumettre = (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!valeurs.prenom.trim()) errs.prenom = 'Veuillez saisir votre prénom.'
    if (!valeurs.nom.trim()) errs.nom = 'Veuillez saisir votre nom.'
    if (!valeurs.email.trim()) errs.email = 'Veuillez saisir votre adresse e-mail.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valeurs.email.trim()))
      errs.email = "Le format de l'adresse e-mail n'est pas valide."
    if (!valeurs.sujet) errs.sujet = 'Veuillez choisir un sujet dans la liste.'
    if (!valeurs.message.trim()) errs.message = 'Veuillez écrire votre message.'
    else if (valeurs.message.trim().length < 20)
      errs.message = 'Votre message est trop court : décrivez votre demande en quelques phrases (20 caractères minimum).'
    if (!consentement)
      errs.consentement = "Merci d'accepter le traitement de vos données pour envoyer le message."

    if (Object.keys(errs).length > 0) {
      setErreurs(errs)
      return
    }
    // Honeypot rempli → soumission automatisée ignorée silencieusement (§35)
    if (honeypot) {
      setEnvoye(true)
      return
    }
    addContactMessage({
      prenom: valeurs.prenom.trim(),
      nom: valeurs.nom.trim(),
      email: valeurs.email.trim(),
      sujet: valeurs.sujet,
      message: valeurs.message.trim(),
    })
    setEnvoye(true)
    setValeurs({ prenom: '', nom: '', email: '', sujet: '', message: '' })
    setConsentement(false)
    toast('Votre message a bien été envoyé. L\'équipe de l\'association vous répondra par courriel.')
  }

  return (
    <div>
      <PageHead
        titre="Contact"
        sousTitre="Une question sur l'adhésion, une activité, la salle polyvalente ? Écrivez-nous : le bureau répond généralement sous 48 h."
      />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 lg:grid-cols-3">
        {/* Formulaire */}
        <div className="lg:col-span-2">
          <h2 className="text-2xl text-forest">Formulaire de contact</h2>
          {envoye ? (
            <div className="mt-6">
              <Alert kind="succes" title="Message envoyé">
                <p>
                  Merci ! Votre message a été transmis au bureau de l'association. Vous recevrez la
                  réponse par courriel à l'adresse que vous avez indiquée.
                </p>
                <p className="mt-2">
                  <Link to="/" className="font-bold underline underline-offset-4">
                    Retour à l'accueil
                  </Link>
                </p>
              </Alert>
            </div>
          ) : null}
          <form
            onSubmit={soumettre}
            noValidate
            className="mt-6 flex flex-col gap-6 rounded-2xl border border-line bg-white p-6"
            aria-label="Formulaire de contact"
          >
            {/* Honeypot (§35) : masqué visuellement et aux lecteurs d'écran */}
            <div aria-hidden="true" className="absolute h-0 w-0 overflow-hidden opacity-0">
              <label htmlFor="site-web">Ne pas remplir ce champ</label>
              <input
                id="site-web"
                name="site_web"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Field label="Votre prénom" htmlFor="c-prenom" required error={erreurs.prenom}>
                <Input
                  id="c-prenom"
                  value={valeurs.prenom}
                  onChange={(e) => set('prenom', e.target.value)}
                  invalid={!!erreurs.prenom}
                  describedBy={erreurs.prenom ? 'c-prenom-err' : undefined}
                  autoComplete="given-name"
                />
              </Field>
              <Field label="Votre nom" htmlFor="c-nom" required error={erreurs.nom}>
                <Input
                  id="c-nom"
                  value={valeurs.nom}
                  onChange={(e) => set('nom', e.target.value)}
                  invalid={!!erreurs.nom}
                  describedBy={erreurs.nom ? 'c-nom-err' : undefined}
                  autoComplete="family-name"
                />
              </Field>
            </div>
            <Field
              label="Votre adresse e-mail"
              htmlFor="c-email"
              required
              error={erreurs.email}
              hint="La réponse vous sera envoyée par courriel."
            >
              <Input
                id="c-email"
                type="email"
                value={valeurs.email}
                onChange={(e) => set('email', e.target.value)}
                invalid={!!erreurs.email}
                describedBy={erreurs.email ? 'c-email-err' : undefined}
                autoComplete="email"
              />
            </Field>
            <Field label="Sujet de votre demande" htmlFor="c-sujet" required error={erreurs.sujet}>
              <select
                id="c-sujet"
                value={valeurs.sujet}
                onChange={(e) => set('sujet', e.target.value)}
                aria-invalid={!!erreurs.sujet}
                aria-describedby={erreurs.sujet ? 'c-sujet-err' : undefined}
                className={`min-h-[48px] w-full rounded-xl border bg-white px-4 py-3 text-[1.0625rem] ${erreurs.sujet ? 'border-brique' : 'border-line'}`}
              >
                <option value="">— Choisir un sujet —</option>
                {SUJETS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Votre message"
              htmlFor="c-message"
              required
              error={erreurs.message}
              hint="Décrivez votre demande en quelques phrases."
            >
              <Textarea
                id="c-message"
                rows={7}
                value={valeurs.message}
                onChange={(e) => set('message', e.target.value)}
                invalid={!!erreurs.message}
                describedBy={erreurs.message ? 'c-message-err' : undefined}
              />
            </Field>
            <div>
              <Checkbox
                id="c-consentement"
                checked={consentement}
                onChange={(e) => {
                  setConsentement(e.target.checked)
                  setErreurs((er) => {
                    const n = { ...er }
                    delete n.consentement
                    return n
                  })
                }}
                label={
                  <>
                    J'accepte que mes données (nom, adresse e-mail et contenu du message) soient
                    utilisées uniquement pour traiter ma demande, conformément à la{' '}
                    <Link to="/confidentialite" className="font-bold underline underline-offset-4">
                      politique de confidentialité
                    </Link>
                    .
                  </>
                }
              />
              {erreurs.consentement ? (
                <p role="alert" className="mt-2 rounded-lg bg-brique-pale px-3 py-2 font-bold text-brique">
                  {erreurs.consentement}
                </p>
              ) : null}
            </div>
            <div>
              <Button type="submit" variant="ocre">
                <Send aria-hidden="true" className="h-5 w-5" />
                Envoyer le message
              </Button>
            </div>
          </form>
        </div>

        {/* Coordonnées (§34) */}
        <aside aria-labelledby="titre-coordonnees">
          <h2 id="titre-coordonnees" className="text-2xl text-forest">
            Nos coordonnées
          </h2>
          <div className="mt-6 flex flex-col gap-4">
            <div className="rounded-2xl border border-line bg-white p-6">
              <h3 className="text-lg">Association</h3>
              <ul className="mt-3 flex flex-col gap-3 text-[1.0625rem]">
                <li className="flex items-start gap-3">
                  <MapPin aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-forest" />
                  <span>
                    {c.adresse}
                    <br />
                    {c.codePostal} {c.ville}
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Phone aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-forest" />
                  <a href={`tel:${c.telephone.replace(/\s/g, '')}`} className="underline underline-offset-4 hover:text-forest">
                    {c.telephone}
                  </a>
                </li>
                <li className="flex items-start gap-3">
                  <Mail aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-forest" />
                  <a href={`mailto:${c.email}`} className="break-all underline underline-offset-4 hover:text-forest">
                    {c.email}
                  </a>
                </li>
                <li className="flex items-start gap-3">
                  <Clock aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-forest" />
                  <span>{c.horaires}</span>
                </li>
                <li className="flex items-start gap-3">
                  <CalendarDays aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-forest" />
                  <span>Événements et permanences : les dates sont annoncées dans les actualités.</span>
                </li>
              </ul>
            </div>

            {/* Carte indicative (§32, §34) — maquette */}
            <div className="overflow-hidden rounded-2xl border border-line bg-white">
              <svg
                viewBox="0 0 400 260"
                className="h-auto w-full"
                role="img"
                aria-label={`Carte indicative : l'association se situe à ${c.ville}, latitude ${c.latitude}, longitude ${c.longitude}. Carte illustrative, lien vers OpenStreetMap disponible sous la carte.`}
              >
                <rect width="400" height="260" fill="#e7f1ea" />
                <path d="M0,200 C120,160 240,220 400,180" fill="none" stroke="#cfe0d4" strokeWidth="14" />
                <circle cx="200" cy="130" r="10" fill="#b05f1d" stroke="#fff" strokeWidth="4" />
                <text x="200" y="112" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#1f2c25">
                  Maison des associations
                </text>
                <text x="200" y="238" textAnchor="middle" fontSize="14" fill="#55645b">
                  Carte illustrative — position : {c.latitude}, {c.longitude}
                </text>
              </svg>
              <div className="p-4">
                <a
                  href={`https://www.openstreetmap.org/?mlat=${c.latitude}&mlon=${c.longitude}#map=13/${c.latitude}/${c.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center rounded-lg font-bold text-forest underline decoration-2 underline-offset-4"
                >
                  Ouvrir la position dans OpenStreetMap
                  <span className="sr-only"> (nouvelle fenêtre)</span>
                </a>
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-white p-6">
              <h3 className="text-lg">Réseaux sociaux</h3>
              <ul className="mt-3 flex flex-wrap gap-3">
                {c.facebook ? (
                  <li>
                    <a href={c.facebook} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-2 rounded-lg font-bold text-forest underline decoration-2 underline-offset-4">
                      <Facebook aria-hidden="true" className="h-5 w-5" />
                      Facebook
                      <span className="sr-only"> (nouvelle fenêtre)</span>
                    </a>
                  </li>
                ) : null}
                {c.instagram ? (
                  <li>
                    <a href={c.instagram} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-2 rounded-lg font-bold text-forest underline decoration-2 underline-offset-4">
                      <Instagram aria-hidden="true" className="h-5 w-5" />
                      Instagram
                      <span className="sr-only"> (nouvelle fenêtre)</span>
                    </a>
                  </li>
                ) : null}
                {c.youtube ? (
                  <li>
                    <a href={c.youtube} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-2 rounded-lg font-bold text-forest underline decoration-2 underline-offset-4">
                      <Youtube aria-hidden="true" className="h-5 w-5" />
                      YouTube
                      <span className="sr-only"> (nouvelle fenêtre)</span>
                    </a>
                  </li>
                ) : null}
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

// Page « L'association » rendue depuis le contenu administrable (§32, §33)
export function AssociationPage() {
  const db = useDb()
  const c = db.association.coordonnees

  return (
    <div>
      <PageHead titre="L'association" sousTitre="Histoire, valeurs et vie du Foyer Rural d'Arches, association du village depuis 1962." />
      <div className="mx-auto max-w-4xl px-4 py-10">
        <article className="rounded-2xl border border-line bg-white p-6 md:p-10">
          <BlockRenderer blocks={db.association.blocks} />
        </article>
        <div className="mt-8 rounded-2xl border border-forest bg-leaf-pale p-6">
          <h2 className="text-2xl text-forest">Nous trouver</h2>
          <p className="mt-3">
            {c.adresse}, {c.codePostal} {c.ville} — {c.horaires}
          </p>
          <p className="mt-2">
            Téléphone : {c.telephone} — Courriel : {c.email}
          </p>
          <div className="mt-4 flex flex-wrap gap-4">
            <Link
              to="/contact"
              className="inline-flex min-h-[48px] items-center rounded-xl bg-forest px-6 font-bold text-white hover:bg-forest-dark"
            >
              Nous écrire
            </Link>
            <a
              href={`https://www.openstreetmap.org/?mlat=${c.latitude}&mlon=${c.longitude}#map=13/${c.latitude}/${c.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[48px] items-center rounded-xl border border-forest bg-white px-6 font-bold text-forest hover:bg-white/60"
            >
              Voir sur la carte
              <span className="sr-only"> (nouvelle fenêtre)</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

