import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, Link2, ShieldCheck } from 'lucide-react'
import {
  associerGoogle,
  changePassword,
  db,
  dissocierGoogle,
  MOT_DE_PASSE_DEMO,
  session,
  useDb,
} from '../../lib/db'
import { Button, Field, Input } from '../../components/ui/form'
import { Alert } from '../../components/ui/feedback'
import { useToast } from '../../hooks/useToast'
import { validatePassword } from '../../hooks/common'

/** Section Sécurité / connexion (§5, §6, §13) */
export function Securite() {
  useDb()
  const navigate = useNavigate()
  const { toast } = useToast()
  const user = session.current ? db.users.find((u) => u.id === session.current!.userId) ?? null : null

  const [ancien, setAncien] = useState('')
  const [nouveau, setNouveau] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [erreurs, setErreurs] = useState<Record<string, string>>({})

  if (!user) return null
  const aGoogle = user.authMethods.includes('google')
  const aMotDePasse = user.authMethods.includes('motdepasse')

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Modification du mot de passe (§6) */}
      <section aria-labelledby="titre-mdp" className="rounded-2xl border border-line bg-white p-6">
        <h2 id="titre-mdp" className="flex items-center gap-2 text-xl text-forest">
          <KeyRound aria-hidden="true" className="h-6 w-6" />
          Changer mon mot de passe
        </h2>
        <form
          className="mt-5 flex flex-col gap-5"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            const errs: Record<string, string> = {}
            if (!ancien) errs.ancien = 'Veuillez saisir votre mot de passe actuel.'
            const errNouveau = validatePassword(nouveau)
            if (errNouveau) errs.nouveau = errNouveau
            if (confirmation !== nouveau) errs.confirmation = 'La confirmation ne correspond pas au nouveau mot de passe.'
            if (Object.keys(errs).length) {
              setErreurs(errs)
              return
            }
            const res = changePassword(user.id, ancien, nouveau)
            if (!res.ok) {
              setErreurs({ ancien: res.error })
              return
            }
            toast('Mot de passe modifié. Toutes vos sessions ont été invalidées : reconnectez-vous.')
            navigate('/connexion')
          }}
        >
          <Field label="Mot de passe actuel" htmlFor="s-ancien" required error={erreurs.ancien}>
            <Input
              id="s-ancien"
              type="password"
              value={ancien}
              onChange={(e) => {
                setAncien(e.target.value)
                setErreurs((er) => ({ ...er, ancien: '' }))
              }}
              invalid={!!erreurs.ancien}
              describedBy={erreurs.ancien ? 's-ancien-err' : undefined}
              autoComplete="current-password"
            />
          </Field>
          <Field
            label="Nouveau mot de passe"
            htmlFor="s-nouveau"
            required
            error={erreurs.nouveau}
            hint="8 caractères minimum, avec au moins une lettre et un chiffre."
          >
            <Input
              id="s-nouveau"
              type="password"
              value={nouveau}
              onChange={(e) => {
                setNouveau(e.target.value)
                setErreurs((er) => ({ ...er, nouveau: '' }))
              }}
              invalid={!!erreurs.nouveau}
              describedBy={erreurs.nouveau ? 's-nouveau-err' : undefined}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirmer le nouveau mot de passe" htmlFor="s-conf" required error={erreurs.confirmation}>
            <Input
              id="s-conf"
              type="password"
              value={confirmation}
              onChange={(e) => {
                setConfirmation(e.target.value)
                setErreurs((er) => ({ ...er, confirmation: '' }))
              }}
              invalid={!!erreurs.confirmation}
              describedBy={erreurs.confirmation ? 's-conf-err' : undefined}
              autoComplete="new-password"
            />
          </Field>
          <Alert kind="attention" title="Après la modification">
            Toutes les sessions existantes sont invalidées et vous devez vous reconnecter avec le
            nouveau mot de passe.
          </Alert>
          <div>
            <Button type="submit">Modifier mon mot de passe</Button>
            <p className="mt-3 text-[0.875rem] text-mist">
              Maquette : le mot de passe de démonstration est « {MOT_DE_PASSE_DEMO} ».
            </p>
          </div>
        </form>
      </section>

      {/* Méthodes de connexion : association Google explicite (§5) */}
      <section aria-labelledby="titre-google" className="rounded-2xl border border-line bg-white p-6">
        <h2 id="titre-google" className="flex items-center gap-2 text-xl text-forest">
          <ShieldCheck aria-hidden="true" className="h-6 w-6" />
          Méthodes de connexion
        </h2>
        <ul className="mt-4 flex flex-col gap-3">
          <li className="flex items-center justify-between gap-4 rounded-xl bg-sand p-4">
            <span>
              <strong>Mot de passe</strong>
              <span className="block text-[0.9375rem] text-mist">
                {aMotDePasse ? 'Actif' : 'Non configuré'}
              </span>
            </span>
            {aMotDePasse ? (
              <span className="rounded-full bg-leaf-pale px-3 py-1 font-bold text-forest">Activée</span>
            ) : (
              <span className="rounded-full bg-sand-dark px-3 py-1 font-bold text-mist">Désactivée</span>
            )}
          </li>
          <li className="flex items-center justify-between gap-4 rounded-xl bg-sand p-4">
            <span>
              <strong>Compte Google</strong>
              <span className="block text-[0.9375rem] text-mist">
                {aGoogle ? 'Associé à votre compte' : 'Non associé'}
              </span>
            </span>
            {aGoogle ? (
              <span className="rounded-full bg-leaf-pale px-3 py-1 font-bold text-forest">Activée</span>
            ) : (
              <span className="rounded-full bg-sand-dark px-3 py-1 font-bold text-mist">Désactivée</span>
            )}
          </li>
        </ul>

        {aGoogle ? (
          <div className="mt-5">
            <Button
              variant="secondaire"
              onClick={() => {
                if (user.authMethods.length <= 1) {
                  toast('Impossible de dissocier la dernière méthode de connexion active.', 'erreur')
                  return
                }
                dissocierGoogle(user.id)
                toast('Votre compte Google a été dissocié.')
              }}
            >
              Dissocier mon compte Google
            </Button>
          </div>
        ) : (
          <div className="mt-5">
            <Button
              onClick={() => {
                associerGoogle(user.id)
                toast('Votre compte Google a été associé de manière explicite.')
              }}
            >
              <Link2 aria-hidden="true" className="h-5 w-5" />
              Associer mon compte Google
            </Button>
            <p className="mt-3 text-[0.9375rem] text-mist">
              L'association n'est jamais automatique : si vous possédez déjà un compte local avec la
              même adresse e-mail, vous devez d'abord vous connecter puis demander l'association
              ici, depuis votre espace personnel.
            </p>
          </div>
        )}

        <div className="mt-6 border-t border-line pt-5">
          <Alert kind="info" title="Sessions et sécurité">
            La gestion technique des jetons d'accès, du renouvellement de session et de leur
            rotation sera définie dans les spécifications techniques du backend. Une déconnexion
            ou une invalidation de session empêche l'accès aux fonctionnalités réservées aux
            membres.
          </Alert>
        </div>
      </section>
    </div>
  )
}
