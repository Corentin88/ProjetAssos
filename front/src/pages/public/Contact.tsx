import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Clock, Facebook, Instagram, Mail, MapPin, Phone, Send, Youtube } from 'lucide-react'
import type { AssociationPage as AssociationData, Coordonnees } from '../../types'
import { sendContact, useResource } from '../../lib/community'
import { authErrorMessage } from '../../lib/auth'
import { BlockRenderer } from '../../components/content/BlockRenderer'
import { Button, Checkbox, Field, Input, Select, Textarea, buttonClasses, focusChampInvalide } from '../../components/ui/form'
import { Alert, EmptyState } from '../../components/ui/feedback'
import { useForm, validateEmail } from '../../hooks/common'
import { PageHead } from '../../components/layout/PublicLayout'

const SUJETS = [
  'Inscription et adhésion',
  'Réservation de la salle polyvalente',
  'Proposition d’activité ou d’atelier',
  'Bibliothèque et dons de livres',
  'Partenariat ou presse',
  'Autre demande',
]

const CONTACT_VIDE = { prenom: '', nom: '', email: '', sujet: '', message: '', consentement: '' }
const CLASSE_LIEN = 'rounded text-forest underline underline-offset-4 [overflow-wrap:anywhere]'

/** Formulaire de contact (§35) : prénom, nom, e-mail, sujet, message et honeypot. */
export function Contact() {
  const { data: association, error: erreurAssociation } = useResource<AssociationData>('/association')
  const { values, errors, set, setFieldErrors, reset } = useForm(CONTACT_VIDE)
  const [envoye, setEnvoye] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [erreurEnvoi, setErreurEnvoi] = useState('')
  const confirmation = useRef<HTMLDivElement>(null)
  const prenom = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (envoye) confirmation.current?.focus()
  }, [envoye])

  const soumettre = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (enCours) return
    const site_web = String(new FormData(e.currentTarget).get('site_web') ?? '')
    const erreurs: Record<string, string> = {}
    if (!values.prenom.trim()) erreurs.prenom = 'Veuillez saisir votre prénom.'
    if (!values.nom.trim()) erreurs.nom = 'Veuillez saisir votre nom.'
    const erreurEmail = validateEmail(values.email)
    if (erreurEmail) erreurs.email = erreurEmail
    if (!SUJETS.includes(values.sujet)) erreurs.sujet = 'Veuillez choisir un sujet dans la liste.'
    if (values.message.trim().length < 20) erreurs.message = 'Veuillez écrire un message de 20 caractères minimum.'
    if (!values.consentement) erreurs.consentement = 'Veuillez accepter le traitement de vos données.'

    if (Object.keys(erreurs).length) {
      setFieldErrors(erreurs)
      focusChampInvalide(e.currentTarget)
      return
    }

    setEnCours(true)
    setErreurEnvoi('')
    try {
      await sendContact({ prenom: values.prenom.trim(), nom: values.nom.trim(), email: values.email.trim(),
        sujet: values.sujet, message: values.message.trim(), site_web, consentement: true })
    } catch (error) { setErreurEnvoi(authErrorMessage(error)); return }
    finally { setEnCours(false) }
    reset()
    setEnvoye(true)
  }

  return (
    <>
      <PageHead titre="Contact" sousTitre="Une question sur l’adhésion, une activité ou la salle polyvalente ? Écrivez à l’association." />
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:py-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-8">
        <section aria-labelledby="titre-formulaire-contact">
          <h2 id="titre-formulaire-contact" className="text-forest">Formulaire de contact</h2>
          {envoye ? (
            <div ref={confirmation} tabIndex={-1} className="mt-4 scroll-mt-24 space-y-4">
              <Alert kind="succes" title="Message enregistré">
                Votre message a été transmis à l’association.
              </Alert>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="secondaire"
                  onClick={() => {
                    setEnvoye(false)
                    requestAnimationFrame(() => prenom.current?.focus())
                  }}
                >
                  Écrire un autre message
                </Button>
                <Link to="/" className={buttonClasses('fantome')}>Retour à l’accueil</Link>
              </div>
            </div>
          ) : (
            <form
              onSubmit={soumettre}
              noValidate
              className="carte mt-4 flex flex-col gap-4 p-4 sm:gap-5 sm:p-6"
              aria-labelledby="titre-formulaire-contact"
            >
              {erreurEnvoi && <Alert kind="erreur" title="Envoi impossible">{erreurEnvoi}</Alert>}
              {/* Honeypot (§35), retiré de la navigation clavier et de l’arbre d’accessibilité. */}
              <div aria-hidden="true" className="absolute h-0 w-0 overflow-hidden opacity-0">
                <label htmlFor="site-web">Ne pas remplir ce champ</label>
                <input id="site-web" name="site_web" type="text" tabIndex={-1} autoComplete="off" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Prénom" htmlFor="c-prenom" required error={errors.prenom}>
                  <Input
                    ref={prenom}
                    id="c-prenom"
                    required
                    value={values.prenom}
                    onChange={(e) => set('prenom', e.target.value)}
                    invalid={!!errors.prenom}
                    describedBy={errors.prenom ? 'c-prenom-err' : undefined}
                    autoComplete="given-name"
                  />
                </Field>
                <Field label="Nom" htmlFor="c-nom" required error={errors.nom}>
                  <Input
                    id="c-nom"
                    required
                    value={values.nom}
                    onChange={(e) => set('nom', e.target.value)}
                    invalid={!!errors.nom}
                    describedBy={errors.nom ? 'c-nom-err' : undefined}
                    autoComplete="family-name"
                  />
                </Field>
              </div>
              <Field label="Adresse e-mail" htmlFor="c-email" required error={errors.email}>
                <Input
                  id="c-email"
                  type="email"
                  required
                  value={values.email}
                  onChange={(e) => set('email', e.target.value)}
                  invalid={!!errors.email}
                  describedBy={errors.email ? 'c-email-err' : undefined}
                  autoComplete="email"
                />
              </Field>
              <Field label="Sujet" htmlFor="c-sujet" required error={errors.sujet}>
                <Select
                  id="c-sujet"
                  required
                  value={values.sujet}
                  onChange={(e) => set('sujet', e.target.value)}
                  invalid={!!errors.sujet}
                  describedBy={errors.sujet ? 'c-sujet-err' : undefined}
                >
                  <option value="">Choisir un sujet</option>
                  {SUJETS.map((sujet) => <option key={sujet} value={sujet}>{sujet}</option>)}
                </Select>
              </Field>
              <Field label="Message" htmlFor="c-message" required error={errors.message} hint="20 caractères minimum.">
                <Textarea
                  id="c-message"
                  required
                  rows={5}
                  value={values.message}
                  onChange={(e) => set('message', e.target.value)}
                  invalid={!!errors.message}
                  describedBy={errors.message ? 'c-message-hint c-message-err' : 'c-message-hint'}
                />
              </Field>
              <div>
                <Checkbox
                  id="c-consentement"
                  required
                  checked={Boolean(values.consentement)}
                  onChange={(e) => set('consentement', e.target.checked ? 'oui' : '')}
                  aria-invalid={!!errors.consentement || undefined}
                  aria-describedby={errors.consentement ? 'c-consentement-err' : undefined}
                  label="J’accepte que mes données soient utilisées pour traiter ma demande."
                />
                <Link to="/confidentialite" className={`ml-9 text-sm ${CLASSE_LIEN}`}>Politique de confidentialité</Link>
                {errors.consentement ? (
                  <p id="c-consentement-err" role="alert" className="mt-2 rounded-lg bg-brique-pale px-3 py-2 text-sm font-bold text-brique">
                    {errors.consentement}
                  </p>
                ) : null}
              </div>
              <div>
                <Button type="submit" disabled={enCours}>
                  <Send aria-hidden="true" className="h-5 w-5" />
                  Envoyer le message
                </Button>
              </div>
            </form>
          )}
        </section>
        {erreurAssociation ? <Alert kind="erreur" title="Coordonnées indisponibles">{erreurAssociation}</Alert>
          : association && <CoordonneesAssociation coordonnees={association.coordonnees} />}
      </div>
    </>
  )
}

// Page « L'association » rendue depuis le contenu administrable (§32, §33).
export function AssociationPage() {
  const { data: association, error: erreurAssociation } = useResource<AssociationData>('/association')

  return (
    <>
      <PageHead titre="L’association" sousTitre="L’histoire, les valeurs et les activités du Foyer Rural d’Arches." />
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:py-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-8">
        {erreurAssociation ? <Alert kind="erreur" title="Présentation indisponible">{erreurAssociation}</Alert>
          : !association ? <p role="status">Chargement…</p> : association.blocks.length ? (
          <article aria-label="Présentation de l’association" className="carte [overflow-wrap:anywhere] p-4 sm:p-7 lg:p-8">
            <BlockRenderer blocks={association.blocks} />
          </article>
        ) : (
          <EmptyState title="La présentation sera bientôt disponible" />
        )}
        {association && <CoordonneesAssociation coordonnees={association.coordonnees} lienContact />}
      </div>
    </>
  )
}

function CoordonneesAssociation({ coordonnees: c, lienContact }: { coordonnees: Coordonnees; lienContact?: boolean }) {
  const latitude = Number(c.latitude)
  const longitude = Number(c.longitude)
  const carteDisponible = Boolean(c.latitude.trim() && c.longitude.trim())
    && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
  const reseaux = [
    { label: 'Facebook', href: c.facebook, Icone: Facebook },
    { label: 'Instagram', href: c.instagram, Icone: Instagram },
    { label: 'YouTube', href: c.youtube, Icone: Youtube },
  ].filter(({ href }) => /^https?:\/\//i.test(href.trim()))

  return (
    <aside aria-labelledby="titre-coordonnees" className="min-w-0">
      <h2 id="titre-coordonnees" className="text-forest">Nos coordonnées</h2>
      <div className="carte mt-4 p-4 text-base sm:p-5">
        <address className="not-italic">
          <ul className="grid gap-3 [overflow-wrap:anywhere]">
            <li className="flex items-start gap-2">
              <MapPin aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-forest" />
              <span>{c.adresse}<br />{c.codePostal} {c.ville}</span>
            </li>
            {c.telephone ? (
              <li className="flex items-start gap-2">
                <Phone aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-forest" />
                <a href={`tel:${c.telephone.replace(/\s/g, '')}`} className={CLASSE_LIEN}>{c.telephone}</a>
              </li>
            ) : null}
            {c.email ? (
              <li className="flex items-start gap-2">
                <Mail aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-forest" />
                <a href={`mailto:${c.email}`} className={CLASSE_LIEN}>{c.email}</a>
              </li>
            ) : null}
            {c.horaires ? (
              <li className="flex items-start gap-2">
                <Clock aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-forest" />
                <span>{c.horaires}</span>
              </li>
            ) : null}
          </ul>
        </address>
        {lienContact ? (
          <Link to="/contact" className={`mt-4 ${buttonClasses('primaire', 'petit')}`}>Nous écrire</Link>
        ) : null}
      </div>
      {/* Carte indicative (§32, §34) : le lien ouvre la carte interactive à la position administrée. */}
      {carteDisponible ? (
        <figure className="carte mt-4 overflow-hidden">
          <svg viewBox="0 0 400 120" className="h-auto w-full" aria-hidden="true">
            <rect width="400" height="120" fill="var(--color-leaf-pale)" />
            <path d="M0 90 C100 10 220 120 400 24 M92 120 Q169 70 158 0 M312 120 Q255 55 292 0" fill="none" stroke="#cfe0d4" strokeWidth="10" />
            <circle cx="200" cy="60" r="12" fill="var(--color-ocre)" stroke="white" strokeWidth="4" />
          </svg>
          <figcaption className="px-4 py-2 text-base">
            <p className="text-sm text-mist">Carte indicative · {c.ville}</p>
            <a
              href={`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=15/${latitude}/${longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex min-h-11 items-center font-bold ${CLASSE_LIEN}`}
            >
              Voir sur OpenStreetMap
              <span className="sr-only"> (nouvel onglet)</span>
            </a>
          </figcaption>
        </figure>
      ) : null}
      {reseaux.length ? (
        <section aria-labelledby="titre-reseaux" className="carte mt-4 p-4 sm:p-5">
          <h3 id="titre-reseaux" className="text-lg text-forest">Réseaux sociaux</h3>
          <ul className="mt-2 flex flex-wrap gap-x-4 text-base">
            {reseaux.map(({ label, href, Icone }) => (
              <li key={label}>
                <a
                  href={href.trim()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex min-h-11 items-center gap-2 font-bold ${CLASSE_LIEN}`}
                >
                  <Icone aria-hidden="true" className="h-5 w-5" />
                  {label}
                  <span className="sr-only"> (nouvel onglet)</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </aside>
  )
}
