import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Camera, CheckCircle2, Info } from 'lucide-react'
import type { Avatar as AvatarSpec } from '../../types'
import { authErrorMessage, requestEmailChange, updateAvatar, updateProfile, useCurrentUser } from '../../lib/auth'
import { Avatar } from '../../components/ui/misc'
import { Button, Field, Input } from '../../components/ui/form'
import { Alert } from '../../components/ui/feedback'
import { useToast } from '../../hooks/useToast'
import { validateEmail } from '../../hooks/common'

/** Section Profil (§13.1) : prénom, nom, avatar, adresse e-mail (procédure
 *  §8), mot de passe (via Sécurité). Rôle, date de création et statut
 *  consultables mais non modifiables. */
export function Profil() {
  const { toast } = useToast()
  const user = useCurrentUser()
  const [valeurs, setValeurs] = useState({ prenom: user?.prenom ?? '', nom: user?.nom ?? '' })
  const [erreurs, setErreurs] = useState<Record<string, string>>({})
  const [nouvelEmail, setNouvelEmail] = useState('')
  const [errEmail, setErrEmail] = useState('')
  const [enCours, setEnCours] = useState(false)

  if (!user) return null

  const couleurParDefaut = user.avatar.colorIndex ?? 0
  const avatarsPredefinis: AvatarSpec[] = [0, 1, 2, 3, 4, 5].map((i) => ({
    type: 'initiales',
    colorIndex: i,
  }))
  const avatarDefaut: AvatarSpec = { type: 'defaut' }
  const choisirAvatar = async (avatar: AvatarSpec) => {
    setEnCours(true)
    try {
      await updateAvatar(avatar)
      toast(avatar.type === 'defaut' ? 'Votre avatar par défaut a été rétabli.' : 'Votre avatar a été mis à jour.')
    } catch (error) {
      toast(authErrorMessage(error), 'erreur')
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Identité + avatar */}
      <section aria-labelledby="titre-identite" className="rounded-2xl border border-line bg-white p-6">
        <h2 id="titre-identite" className="text-xl text-forest">
          Mes informations
        </h2>
        <form
          className="mt-5 flex flex-col gap-5"
          onSubmit={async (e) => {
            e.preventDefault()
            if (enCours) return
            const errs: Record<string, string> = {}
            if (!valeurs.prenom.trim()) errs.prenom = 'Le prénom est obligatoire.'
            if (!valeurs.nom.trim()) errs.nom = 'Le nom est obligatoire.'
            if (Object.keys(errs).length) {
              setErreurs(errs)
              return
            }
            setEnCours(true)
            try {
              await updateProfile(valeurs.prenom.trim(), valeurs.nom.trim())
              toast('Vos informations ont été enregistrées.')
            } catch (error) {
              toast(authErrorMessage(error), 'erreur')
            } finally {
              setEnCours(false)
            }
          }}
          noValidate
        >
          <Field label="Prénom" htmlFor="p-prenom" required error={erreurs.prenom}>
            <Input
              id="p-prenom"
              value={valeurs.prenom}
              onChange={(e) => {
                setValeurs((v) => ({ ...v, prenom: e.target.value }))
                setErreurs((er) => ({ ...er, prenom: '' }))
              }}
              invalid={!!erreurs.prenom}
              describedBy={erreurs.prenom ? 'p-prenom-err' : undefined}
            />
          </Field>
          <Field label="Nom" htmlFor="p-nom" required error={erreurs.nom}>
            <Input
              id="p-nom"
              value={valeurs.nom}
              onChange={(e) => {
                setValeurs((v) => ({ ...v, nom: e.target.value }))
                setErreurs((er) => ({ ...er, nom: '' }))
              }}
              invalid={!!erreurs.nom}
              describedBy={erreurs.nom ? 'p-nom-err' : undefined}
            />
          </Field>
          <Button type="submit" disabled={enCours}>Enregistrer mes informations</Button>
        </form>
      </section>

      {/* Avatar (§13.2) */}
      <section aria-labelledby="titre-avatar" className="rounded-2xl border border-line bg-white p-6">
        <h2 id="titre-avatar" className="text-xl text-forest">
          Mon avatar
        </h2>
        <p className="mt-2 text-[0.9375rem] text-mist">
          Choisissez un avatar prédéfini ou l'avatar par défaut du site. L'image personnelle sera
          importable depuis la médiathèque en phase de développement.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <Avatar user={user} size="lg" />
          <fieldset disabled={enCours}>
            <legend className="mb-2 font-bold">Avatars prédéfinis</legend>
            <ul className="flex flex-wrap gap-3">
              {avatarsPredefinis.map((av, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => void choisirAvatar(av)}
                    aria-label={`Choisir l'avatar prédéfini ${i + 1}`}
                    aria-pressed={user.avatar.type === 'initiales' && couleurParDefaut === i}
                    className={`h-14 w-14 rounded-full border-4 ${
                      user.avatar.type === 'initiales' && couleurParDefaut === i
                        ? 'border-ocre'
                        : 'border-transparent'
                    }`}
                  >
                    <span
                      className="flex h-full w-full items-center justify-center rounded-full font-bold text-white"
                      style={{ background: ['#244D3B', '#426B50', '#9A5B22', '#5D8468', '#7C4A1B', '#24332B'][i] }}
                    >
                      {`${user.prenom.charAt(0)}${user.nom.charAt(0)}`.toUpperCase()}
                    </span>
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => void choisirAvatar(avatarDefaut)}
                  aria-pressed={user.avatar.type === 'defaut'}
                  className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-4 font-bold ${
                    user.avatar.type === 'defaut' ? 'border-ocre text-ocre-dark' : 'border-line text-forest'
                  }`}
                >
                  <Camera aria-hidden="true" className="h-5 w-5" />
                  Avatar par défaut
                </button>
              </li>
            </ul>
          </fieldset>
        </div>
      </section>

      {/* Adresse e-mail (§8) */}
      <section aria-labelledby="titre-email" className="rounded-2xl border border-line bg-white p-6">
        <h2 id="titre-email" className="text-xl text-forest">
          Adresse e-mail
        </h2>
        <p className="mt-2">
          Adresse actuelle : <strong>{user.email}</strong>
        </p>
        {user.pendingEmail ? (
          <div className="mt-4">
            <Alert kind="attention" title="Nouvelle adresse en attente de validation">
              <p>
                Un courriel de validation a été envoyé à <strong>{user.pendingEmail}</strong>.
                Tant que la nouvelle adresse n'est pas validée, l'ancienne reste active et vous
                pouvez continuer à utiliser votre compte normalement.
              </p>
            </Alert>
          </div>
        ) : null}
        <form
          className="mt-5 flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault()
            if (enCours) return
            const err = validateEmail(nouvelEmail)
            if (err) {
              setErrEmail(err)
              return
            }
            if (nouvelEmail.trim().toLowerCase() === user.email.toLowerCase()) {
              setErrEmail('Cette adresse est déjà votre adresse actuelle.')
              return
            }
            setErrEmail('')
            setEnCours(true)
            try {
              await requestEmailChange(nouvelEmail)
              setNouvelEmail('')
              toast('Un courriel de validation a été envoyé à la nouvelle adresse.')
            } catch (error) {
              setErrEmail(authErrorMessage(error))
            } finally {
              setEnCours(false)
            }
          }}
          noValidate
        >
          <Field
            label="Nouvelle adresse e-mail"
            htmlFor="p-email"
            required
            error={errEmail}
            hint="La modification ne prendra effet qu'après validation du courriel envoyé à la nouvelle adresse."
          >
            <Input
              id="p-email"
              type="email"
              value={nouvelEmail}
              onChange={(e) => {
                setNouvelEmail(e.target.value)
                setErrEmail('')
              }}
              invalid={!!errEmail}
              describedBy={errEmail ? 'p-email-err' : undefined}
            />
          </Field>
          <Button type="submit" variant="secondaire" disabled={enCours}>
            Demander le changement d'adresse
          </Button>
        </form>
        <p className="mt-4 text-[0.9375rem] text-mist">
          Pour modifier votre mot de passe, rendez-vous dans la section{' '}
          <Link to="/mon-compte/securite" className="font-bold text-forest underline underline-offset-4">
            Sécurité et connexion
          </Link>
          .
        </p>
      </section>

      {/* Informations consultables (§13.1) */}
      <section aria-labelledby="titre-infos" className="rounded-2xl border border-line bg-white p-6">
        <h2 id="titre-infos" className="text-xl text-forest">
          Informations de mon compte
        </h2>
        <dl className="mt-4 flex flex-col gap-3 text-[1.0625rem]">
          <div className="flex justify-between gap-4 rounded-xl bg-sand p-3">
            <dt className="font-bold">Rôle</dt>
            <dd>{user.role === 'administrateur' ? 'Administrateur' : 'Utilisateur'}</dd>
          </div>
          <div className="flex justify-between gap-4 rounded-xl bg-sand p-3">
            <dt className="font-bold">Statut du compte</dt>
            <dd>{user.statut === 'actif' ? 'Actif' : 'Suspendu'}</dd>
          </div>
          <div className="flex justify-between gap-4 rounded-xl bg-sand p-3">
            <dt className="font-bold">Date de création</dt>
            <dd>{new Date(user.createdAt).toLocaleDateString('fr-FR')}</dd>
          </div>
          <div className="flex justify-between gap-4 rounded-xl bg-sand p-3">
            <dt className="font-bold">Méthodes de connexion</dt>
            <dd>
              {user.authMethods
                .map((m) => (m === 'motdepasse' ? 'Mot de passe' : 'Google'))
                .join(', ')}
            </dd>
          </div>
        </dl>
        <p className="mt-4 flex items-start gap-2 text-[0.9375rem] text-mist">
          <Info aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          La gestion des appareils et des sessions actives n'est pas exposée aux utilisateurs. Un
          avatar du site peut être retiré par un administrateur, qui ne choisit jamais une
          identité à votre place.
        </p>
        {user.avatar.type === 'image' ? (
          <div className="mt-2 text-[0.9375rem]">
            <p>Image personnelle actuelle</p>
            <Avatar user={user} size="lg" className="mt-2" />
          </div>
        ) : null}
        <p className="mt-4">
          <CheckCircle2 aria-hidden="true" className="mr-1 inline h-5 w-5 text-leaf" />
          Ces informations alimentent votre{' '}
          <Link to="/profil/moi" className="font-bold underline underline-offset-4">
            profil public
          </Link>{' '}
          (prénom, initiale du nom, date d'inscription).
        </p>
      </section>
    </div>
  )
}
