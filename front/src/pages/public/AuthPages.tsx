import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, LogIn, Mail, UserPlus } from 'lucide-react'
import { login, loginGoogle, register, useDb } from '../../lib/db'
import { Button, Field, Input } from '../../components/ui/form'
import { Alert } from '../../components/ui/feedback'
import { useCountdown, validateEmail, validatePassword } from '../../hooks/common'
import { useToast } from '../../hooks/useToast'

const champClasse = 'relative'

function ChampMotDePasse({
  id,
  value,
  onChange,
  invalid,
  describedBy,
  label,
  autoComplete = 'current-password',
}: {
  id: string
  value: string
  onChange: (v: string) => void
  invalid?: boolean
  describedBy?: string
  label: string
  autoComplete?: string
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className={champClasse}>
      <Field label={label} htmlFor={id} required error={undefined}>
        <div className="relative">
          <Input
            id={id}
            type={visible ? 'text' : 'password'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            invalid={invalid}
            describedBy={describedBy}
            autoComplete={autoComplete}
            className="pr-14"
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-pressed={visible}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-mist hover:text-forest"
          >
            {visible ? <EyeOff aria-hidden="true" className="h-5 w-5" /> : <Eye aria-hidden="true" className="h-5 w-5" />}
            <span className="sr-only">{visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}</span>
          </button>
        </div>
      </Field>
    </div>
  )
}

/** Connexion classique + Google (§4, §5) */
export function Connexion() {
  useDb()
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()
  const [email, setEmail] = useState('')
  const [motdepasse, setMotdepasse] = useState('')
  const [erreurs, setErreurs] = useState<Record<string, string>>({})
  const [globalErreur, setGlobalErreur] = useState('')
  const [enCours, setEnCours] = useState(false)

  // §9 : après plusieurs échecs consécutifs, le délai augmente progressivement
  const [echecs, setEchecs] = useState(0)
  const [attente, setAttente] = useState(false)
  const restant = useCountdown(Math.min(10, 2 * echecs), attente)

  const depuis = (location.state as { from?: string } | null)?.from

  const soumettre = (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!email.trim()) errs.email = 'Veuillez saisir votre adresse e-mail.'
    else {
      const errEmail = validateEmail(email)
      if (errEmail) errs.email = errEmail
    }
    if (!motdepasse) errs.motdepasse = 'Veuillez saisir votre mot de passe.'
    if (Object.keys(errs).length > 0) {
      setErreurs(errs)
      return
    }
    setGlobalErreur('')
    setEnCours(true)
    setTimeout(() => {
      const res = login(email, motdepasse)
      setEnCours(false)
      if (!res.ok) {
        setGlobalErreur(res.error)
        const nouveauxEchecs = echecs + 1
        setEchecs(nouveauxEchecs)
        if (nouveauxEchecs >= 3) {
          setAttente(true)
          setGlobalErreur(
            `${res.error} Pour protéger le service, une nouvelle tentative sera possible dans ${Math.min(10, 2 * nouveauxEchecs)} secondes.`,
          )
        }
        return
      }
      setEchecs(0)
      setAttente(false)
      toast('Connexion réussie. Bienvenue !')
      navigate(depuis && depuis.startsWith('/') ? depuis : '/mon-compte')
    }, 500)
  }

  const surGoogle = () => {
    setEnCours(true)
    setTimeout(() => {
      const res = loginGoogle()
      setEnCours(false)
      if (res.ok) {
        toast('Connexion avec Google réussie.')
        navigate(depuis && depuis.startsWith('/') ? depuis : '/mon-compte')
      } else {
        setGlobalErreur(res.error)
      }
    }, 600)
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-14">
      <h1 className="text-forest">Connexion</h1>
      <p className="mt-2 text-mist">
        Connectez-vous pour commenter les articles, participer aux discussions et accéder à votre
        espace personnel.
      </p>

      {depuis ? (
        <div className="mt-4">
          <Alert kind="info" title="Connexion requise">
            La page demandée nécessite d'être connecté.
          </Alert>
        </div>
      ) : null}

      <form
        onSubmit={soumettre}
        noValidate
        className="mt-8 flex flex-col gap-6 rounded-2xl border border-line bg-white p-6 md:p-8"
        aria-label="Formulaire de connexion"
      >
        {globalErreur ? (
          <div role="alert">
            <Alert kind="erreur" title="Connexion impossible">
              {globalErreur}
            </Alert>
          </div>
        ) : null}

        <Field
          label="Adresse e-mail"
          htmlFor="co-email"
          required
          error={erreurs.email}
        >
          <Input
            id="co-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setErreurs((er) => ({ ...er, email: '' }))
            }}
            invalid={!!erreurs.email}
            describedBy={erreurs.email ? 'co-email-err' : undefined}
            autoComplete="email"
          />
        </Field>

        <div>
          <ChampMotDePasse
            id="co-mdp"
            label="Mot de passe"
            value={motdepasse}
            onChange={(v) => {
              setMotdepasse(v)
              setErreurs((er) => ({ ...er, motdepasse: '' }))
            }}
            invalid={!!erreurs.motdepasse}
            describedBy={erreurs.motdepasse ? 'co-mdp-err' : undefined}
          />
          {erreurs.motdepasse ? (
            <p id="co-mdp-err" role="alert" className="mt-2 rounded-lg bg-brique-pale px-3 py-2 font-bold text-brique">
              {erreurs.motdepasse}
            </p>
          ) : null}
        </div>

        <div>
          <Button type="submit" disabled={attente || enCours} className="w-full">
            <LogIn aria-hidden="true" className="h-5 w-5" />
            {enCours ? 'Connexion en cours…' : 'Se connecter'}
          </Button>
          {attente ? (
            <p role="status" className="mt-2 text-center font-bold text-ocre">
              Trop de tentatives : réessayez dans {restant} secondes.
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-4" aria-hidden="true">
          <span className="h-px flex-1 bg-line" />
          <span className="text-[0.9375rem] text-mist">ou</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        {/* Connexion avec Google (§5) */}
        <button
          type="button"
          onClick={surGoogle}
          disabled={enCours}
          className="inline-flex min-h-[48px] w-full items-center justify-center gap-3 rounded-xl border border-line bg-white px-6 font-bold text-bark hover:bg-sand disabled:opacity-50"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6">
            <path fill="#EA4335" d="M12 5.3c1.6 0 3 .55 4.1 1.6l2.9-2.9C17.2 2.4 14.8 1.4 12 1.4 7.6 1.4 3.8 3.9 2 7.7l3.4 2.6C6.2 7.7 8.9 5.3 12 5.3z" />
            <path fill="#4285F4" d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.2c-.3 1.4-1.1 2.6-2.3 3.4l3.3 2.6c2-1.8 3.8-4.5 3.8-8.2z" />
            <path fill="#FBBC05" d="M5.4 14.2c-.2-.7-.4-1.4-.4-2.2s.1-1.5.4-2.2L2 7.7C1.3 9 1 10.5 1 12s.3 3 1 4.3l3.4-2.1z" />
            <path fill="#34A853" d="M12 22.6c2.8 0 5.2-.9 6.9-2.5l-3.3-2.6c-1 .7-2.2 1.1-3.6 1.1-3.1 0-5.8-2.4-6.6-5.1l-3.4 2.6c1.8 3.8 5.6 6.5 10 6.5z" />
          </svg>
          Se connecter avec Google
        </button>
        <p className="text-[0.9375rem] text-mist">
          L'association entre un compte local existant et Google est toujours explicite : elle se
          fait depuis votre espace personnel, jamais automatiquement.
        </p>

        <ul className="flex flex-col gap-2 border-t border-line pt-5 text-[1.0625rem]">
          <li>
            <Link to="/mot-de-passe-oublie" className="inline-flex min-h-[44px] items-center gap-2 font-bold text-forest underline decoration-2 underline-offset-4">
              <KeyRound aria-hidden="true" className="h-5 w-5" />
              Mot de passe oublié ?
            </Link>
          </li>
          <li>
            <Link to="/inscription" className="inline-flex min-h-[44px] items-center gap-2 font-bold text-forest underline decoration-2 underline-offset-4">
              <UserPlus aria-hidden="true" className="h-5 w-5" />
              Pas encore de compte ? Créer un compte
            </Link>
          </li>
        </ul>

        {/* Aide à la prise en main de la maquette */}
        <aside className="rounded-xl bg-sand p-4 text-[0.9375rem] text-mist" aria-label="Comptes de démonstration de la maquette">
          <p className="font-bold text-bark">Comptes de démonstration (maquette)</p>
          <p className="mt-1">
            Administratrice : <strong>admin@foyer-rural-arches.fr</strong>
            <br />
            Adhérente : <strong>marie.dupont@example.fr</strong>
            <br />
            Mot de passe pour tous les comptes : <strong>demo1234</strong>
          </p>
        </aside>
      </form>
    </div>
  )
}

/** Inscription publique (§3.1) : rôle Utilisateur, compte activé immédiatement */
export function Inscription() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [valeurs, setValeurs] = useState({ prenom: '', nom: '', email: '', mdp: '', confirmation: '' })
  const [erreurs, setErreurs] = useState<Record<string, string>>({})
  const [cgv, setCgv] = useState(false)

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
    const errEmail = validateEmail(valeurs.email)
    if (errEmail) errs.email = errEmail
    const errMdp = validatePassword(valeurs.mdp)
    if (errMdp) errs.mdp = errMdp
    if (valeurs.confirmation !== valeurs.mdp) {
      errs.confirmation = 'La confirmation ne correspond pas au mot de passe saisi.'
    }
    if (!cgv) errs.cgv = 'Merci d\'accepter la politique de confidentialité pour créer votre compte.'
    if (Object.keys(errs).length > 0) {
      setErreurs(errs)
      return
    }
    const res = register(valeurs.prenom, valeurs.nom, valeurs.email)
    if (!res.ok) {
      setErreurs({ email: res.error })
      return
    }
    toast('Votre compte a été créé et activé. Bienvenue dans l\'association !')
    navigate('/mon-compte')
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-14">
      <h1 className="text-forest">Créer mon compte</h1>
      <p className="mt-2 text-mist">
        Gratuit, immédiat : le compte est activé dès l'inscription. Il vous permet de commenter les
        articles et d'accéder à votre espace personnel.
      </p>
      <form
        onSubmit={soumettre}
        noValidate
        className="mt-8 flex flex-col gap-6 rounded-2xl border border-line bg-white p-6 md:p-8"
        aria-label="Formulaire d'inscription"
      >
        <div className="grid gap-6 md:grid-cols-2">
          <Field label="Prénom" htmlFor="in-prenom" required error={erreurs.prenom}>
            <Input id="in-prenom" value={valeurs.prenom} onChange={(e) => set('prenom', e.target.value)} invalid={!!erreurs.prenom} describedBy={erreurs.prenom ? 'in-prenom-err' : undefined} autoComplete="given-name" />
          </Field>
          <Field label="Nom" htmlFor="in-nom" required error={erreurs.nom}>
            <Input id="in-nom" value={valeurs.nom} onChange={(e) => set('nom', e.target.value)} invalid={!!erreurs.nom} describedBy={erreurs.nom ? 'in-nom-err' : undefined} autoComplete="family-name" />
          </Field>
        </div>
        <Field label="Adresse e-mail" htmlFor="in-email" required error={erreurs.email}>
          <Input id="in-email" type="email" value={valeurs.email} onChange={(e) => set('email', e.target.value)} invalid={!!erreurs.email} describedBy={erreurs.email ? 'in-email-err' : undefined} autoComplete="email" />
        </Field>
        <Field
          label="Mot de passe"
          htmlFor="in-mdp"
          required
          error={erreurs.mdp}
          hint="8 caractères minimum, avec au moins une lettre et un chiffre."
        >
          <Input id="in-mdp" type="password" value={valeurs.mdp} onChange={(e) => set('mdp', e.target.value)} invalid={!!erreurs.mdp} describedBy={erreurs.mdp ? 'in-mdp-err' : undefined} autoComplete="new-password" />
        </Field>
        <Field label="Confirmer le mot de passe" htmlFor="in-mdp2" required error={erreurs.confirmation}>
          <Input id="in-mdp2" type="password" value={valeurs.confirmation} onChange={(e) => set('confirmation', e.target.value)} invalid={!!erreurs.confirmation} describedBy={erreurs.confirmation ? 'in-mdp2-err' : undefined} autoComplete="new-password" />
        </Field>

        <div>
          <label htmlFor="in-cgv" className="flex items-start gap-3 text-[1.0625rem]">
            <input
              id="in-cgv"
              type="checkbox"
              checked={cgv}
              onChange={(e) => {
                setCgv(e.target.checked)
                setErreurs((er) => ({ ...er, cgv: '' }))
              }}
              className="mt-2 h-6 w-6 shrink-0 accent-forest"
            />
            <span>
              J'ai lu et j'accepte la{' '}
              <Link to="/confidentialite" className="font-bold underline underline-offset-4">
                politique de confidentialité
              </Link>{' '}
              (collecte des données du compte, notifications internes, statistiques).
            </span>
          </label>
          {erreurs.cgv ? (
            <p role="alert" className="mt-2 rounded-lg bg-brique-pale px-3 py-2 font-bold text-brique">
              {erreurs.cgv}
            </p>
          ) : null}
        </div>

        <div>
          <Button type="submit" variant="ocre" className="w-full">
            <UserPlus aria-hidden="true" className="h-5 w-5" />
            Créer mon compte
          </Button>
        </div>
        <p className="border-t border-line pt-5 text-[0.9375rem] text-mist">
          Vous avez déjà un compte ?{' '}
          <Link to="/connexion" className="font-bold text-forest underline underline-offset-4">
            Se connecter
          </Link>
        </p>
      </form>
    </div>
  )
}

/** Mot de passe oublié (§7) : envoi d'un lien temporaire à usage unique */
export function MotDePasseOublie() {
  const [email, setEmail] = useState('')
  const [erreur, setErreur] = useState('')
  const [envoye, setEnvoye] = useState(false)

  return (
    <div className="mx-auto max-w-xl px-4 py-14">
      <h1 className="text-forest">Mot de passe oublié</h1>
      {envoye ? (
        <div className="mt-8 flex flex-col gap-6 rounded-2xl border border-line bg-white p-6 md:p-8">
          <Alert kind="succes" title="Courriel envoyé">
            <p>
              Si un compte existe pour l'adresse <strong>{email}</strong>, un courriel contenant un
              lien de réinitialisation vient d'être envoyé. Ce lien est temporaire et à usage unique.
            </p>
            <p className="mt-2">
              Dans la maquette, ouvrez la page de réinitialisation pour continuer :
            </p>
            <p className="mt-3">
              <Link
                to="/reinitialiser-mot-de-passe"
                className="inline-flex min-h-[48px] items-center rounded-xl bg-forest px-6 font-bold text-white hover:bg-forest-dark"
              >
                Définir un nouveau mot de passe
              </Link>
            </p>
          </Alert>
        </div>
      ) : (
        <form
          className="mt-8 flex flex-col gap-6 rounded-2xl border border-line bg-white p-6 md:p-8"
          onSubmit={(e) => {
            e.preventDefault()
            const err = validateEmail(email)
            if (err) {
              setErreur(err)
              return
            }
            setErreur('')
            setEnvoye(true)
          }}
          noValidate
        >
          <p className="text-mist">
            Saisissez l'adresse e-mail de votre compte : nous vous enverrons un lien pour définir un
            nouveau mot de passe. Votre ancien mot de passe sera invalidé, ainsi que toutes les
            sessions ouvertes.
          </p>
          <Field label="Adresse e-mail du compte" htmlFor="mdp-email" required error={erreur}>
            <Input
              id="mdp-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setErreur('')
              }}
              invalid={!!erreur}
              describedBy={erreur ? 'mdp-email-err' : undefined}
              autoComplete="email"
            />
          </Field>
          <Button type="submit">
            <Mail aria-hidden="true" className="h-5 w-5" />
            Envoyer le lien de réinitialisation
          </Button>
          <p className="border-t border-line pt-5">
            <Link to="/connexion" className="inline-flex min-h-[44px] items-center gap-2 font-bold text-forest underline decoration-2 underline-offset-4">
              <ArrowLeft aria-hidden="true" className="h-5 w-5" />
              Retour à la connexion
            </Link>
          </p>
        </form>
      )}
    </div>
  )
}

/** Réinitialisation (§7) : définition du nouveau mot de passe */
export function ReinitialiserMotDePasse() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [mdp, setMdp] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [erreurs, setErreurs] = useState<Record<string, string>>({})
  const [termine, setTermine] = useState(false)

  return (
    <div className="mx-auto max-w-xl px-4 py-14">
      <h1 className="text-forest">Nouveau mot de passe</h1>
      {termine ? (
        <div className="mt-8 flex flex-col gap-6 rounded-2xl border border-line bg-white p-6 md:p-8">
          <CheckCircle2 aria-hidden="true" className="h-12 w-12 text-leaf" />
          <Alert kind="succes" title="Mot de passe mis à jour">
            <p>
              Votre nouveau mot de passe est enregistré. Toutes les sessions ouvertes ont été
              invalidées : connectez-vous avec votre nouveau mot de passe.
            </p>
          </Alert>
          <Button onClick={() => navigate('/connexion')}>Aller à la connexion</Button>
        </div>
      ) : (
        <form
          className="mt-8 flex flex-col gap-6 rounded-2xl border border-line bg-white p-6 md:p-8"
          onSubmit={(e) => {
            e.preventDefault()
            const errs: Record<string, string> = {}
            const errMdp = validatePassword(mdp)
            if (errMdp) errs.mdp = errMdp
            if (confirmation !== mdp) errs.confirmation = 'La confirmation ne correspond pas au mot de passe saisi.'
            if (Object.keys(errs).length > 0) {
              setErreurs(errs)
              return
            }
            setTermine(true)
            toast('Nouveau mot de passe enregistré. Vos sessions ont été invalidées.')
          }}
          noValidate
          aria-label="Définition du nouveau mot de passe"
        >
          <p className="text-mist">
            Maquette : la vérification du lien reçu par courriel est simulée. Le nouveau mot de
            passe doit contenir 8 caractères minimum, avec au moins une lettre et un chiffre.
          </p>
          <Field label="Nouveau mot de passe" htmlFor="r-mdp" required error={erreurs.mdp}>
            <Input id="r-mdp" type="password" value={mdp} onChange={(e) => { setMdp(e.target.value); setErreurs((er) => ({ ...er, mdp: '' })) }} invalid={!!erreurs.mdp} describedBy={erreurs.mdp ? 'r-mdp-err' : undefined} autoComplete="new-password" />
          </Field>
          <Field label="Confirmer le nouveau mot de passe" htmlFor="r-mdp2" required error={erreurs.confirmation}>
            <Input id="r-mdp2" type="password" value={confirmation} onChange={(e) => { setConfirmation(e.target.value); setErreurs((er) => ({ ...er, confirmation: '' })) }} invalid={!!erreurs.confirmation} describedBy={erreurs.confirmation ? 'r-mdp2-err' : undefined} autoComplete="new-password" />
          </Field>
          <Button type="submit">Enregistrer le nouveau mot de passe</Button>
        </form>
      )}
    </div>
  )
}
