import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, Link2, ShieldCheck } from 'lucide-react'
import { authErrorMessage, changePassword, requestFirstPassword, startGoogle, unlinkGoogle, useCurrentUser } from '../../lib/auth'
import { ChampMotDePasse } from '../../components/auth/ChampMotDePasse'
import { Button, focusChampInvalide } from '../../components/ui/form'
import { Alert } from '../../components/ui/feedback'
import { useToast } from '../../hooks/useToast'
import { passwordMinimumMessage, validatePassword } from '../../hooks/common'

/** Section Sécurité / connexion (§5, §6, §13) */
export function Securite() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const user = useCurrentUser()

  const [ancien, setAncien] = useState('')
  const [nouveau, setNouveau] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [erreurs, setErreurs] = useState<Record<string, string>>({})
  const [enCours, setEnCours] = useState(false)
  const [lienEnvoye, setLienEnvoye] = useState(false)
  const [erreurEnvoi, setErreurEnvoi] = useState('')

  if (!user) return null
  const aGoogle = user.authMethods.includes('google')
  const aMotDePasse = user.authMethods.includes('motdepasse')

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Définition ou modification du mot de passe (§6) */}
      <section aria-labelledby="titre-mdp" className="rounded-2xl border border-line bg-white p-6">
        <h2 id="titre-mdp" className="flex items-center gap-2 text-xl text-forest">
          <KeyRound aria-hidden="true" className="h-6 w-6" />
          Mot de passe
        </h2>
        {aMotDePasse ? <form
          className="mt-5 flex flex-col gap-5"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault()
            if (enCours) return
            const errs: Record<string, string> = {}
            if (!ancien) errs.ancien = 'Veuillez saisir votre mot de passe actuel.'
            const errNouveau = validatePassword(nouveau)
            if (errNouveau) errs.nouveau = errNouveau
            if (confirmation !== nouveau) errs.confirmation = 'La confirmation ne correspond pas au nouveau mot de passe.'
            if (Object.keys(errs).length) {
              setErreurs(errs)
              focusChampInvalide(e.currentTarget)
              return
            }
            setEnCours(true)
            try {
              await changePassword(ancien, nouveau, confirmation)
              toast('Mot de passe modifié. Toutes vos sessions ont été invalidées : reconnectez-vous.')
              navigate('/connexion')
            } catch (error) {
              setErreurs({ ancien: authErrorMessage(error) })
            } finally {
              setEnCours(false)
            }
          }}
        >
          <ChampMotDePasse id="s-ancien" label="Mot de passe actuel" value={ancien} erreur={erreurs.ancien}
            onChange={value => { setAncien(value); setErreurs(er => ({ ...er, ancien: '' })) }} />
          <ChampMotDePasse
            id="s-nouveau"
            label="Nouveau mot de passe"
            value={nouveau}
            erreur={erreurs.nouveau}
            aide={passwordMinimumMessage}
            autoComplete="new-password"
            onChange={value => { setNouveau(value); setErreurs(er => ({ ...er, nouveau: '' })) }}
          />
          <ChampMotDePasse id="s-conf" label="Confirmer le nouveau mot de passe" value={confirmation}
            erreur={erreurs.confirmation} autoComplete="new-password"
            onChange={value => { setConfirmation(value); setErreurs(er => ({ ...er, confirmation: '' })) }} />
          <Alert kind="attention" title="Après la modification">
            Toutes les sessions existantes sont invalidées et vous devez vous reconnecter avec le
            nouveau mot de passe.
          </Alert>
          <div>
            <Button type="submit" disabled={enCours}>Modifier mon mot de passe</Button>
          </div>
        </form> : (
          <div className="mt-5 flex flex-col gap-4">
            <p>Vous n’avez pas encore défini de mot de passe pour ce compte.</p>
            {aGoogle && (
              <>
                <p className="text-mist">Vous recevrez un lien à l’adresse e-mail de votre compte. Il sera valable 30 minutes.</p>
                <div>
                  <Button
                    disabled={enCours}
                    onClick={async () => {
                      setErreurEnvoi('')
                      setLienEnvoye(false)
                      setEnCours(true)
                      try {
                        await requestFirstPassword()
                        setLienEnvoye(true)
                      } catch (error) {
                        setErreurEnvoi(authErrorMessage(error))
                      } finally {
                        setEnCours(false)
                      }
                    }}
                  >
                    {enCours ? 'Envoi en cours…' : 'Définir un mot de passe'}
                  </Button>
                </div>
                {lienEnvoye && <Alert kind="succes" title="Lien envoyé">Consultez votre boîte e-mail pour définir votre mot de passe.</Alert>}
                {erreurEnvoi && <Alert kind="erreur" title="Envoi impossible">{erreurEnvoi}</Alert>}
              </>
            )}
          </div>
        )}
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
              disabled={enCours || !aMotDePasse}
              aria-describedby={!aMotDePasse ? 'derniere-connexion' : undefined}
              onClick={async () => {
                setEnCours(true)
                try {
                  await unlinkGoogle()
                  toast('Votre compte Google a été dissocié. Reconnectez-vous.')
                  navigate('/connexion')
                } catch (error) {
                  toast(authErrorMessage(error), 'erreur')
                } finally {
                  setEnCours(false)
                }
              }}
            >
              Dissocier mon compte Google
            </Button>
            {!aMotDePasse && (
              <p id="derniere-connexion" className="mt-3 text-[0.9375rem] text-mist">
                Google est votre seul moyen de connexion. Définissez un mot de passe avant de dissocier votre compte Google.
              </p>
            )}
          </div>
        ) : (
          <div className="mt-5">
            <Button
              disabled={enCours}
              onClick={async () => {
                setEnCours(true)
                try {
                  await startGoogle(true)
                } catch (error) {
                  toast(authErrorMessage(error), 'erreur')
                } finally {
                  setEnCours(false)
                }
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
            Une déconnexion ou une invalidation de session empêche l'accès aux fonctionnalités
            réservées aux membres.
          </Alert>
        </div>
      </section>
    </div>
  )
}
