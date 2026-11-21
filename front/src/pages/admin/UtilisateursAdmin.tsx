import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Pencil,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react'
import type { Role, User } from '../../types'
import {
  adminCount,
  changeRole,
  createUser,
  db,
  deleteUserByAdmin,
  fullName,
  reactivateUser,
  resetUserAvatar,
  session,
  suspendUser,
  updateUserByAdmin,
  useDb,
  useDbVersion,
} from '../../lib/db'
import { userPublicCommentCount } from '../../lib/selectors'
import { formatDate, formatDateTime } from '../../lib/format'
import { AdminPageHead } from '../../components/layout/AdminLayout'
import { Avatar } from '../../components/ui/misc'
import { Badge, EmptyState } from '../../components/ui/feedback'
import { Button, Field, Input, Select } from '../../components/ui/form'
import { ConfirmDialog, Modal } from '../../components/ui/overlay'
import { Alert } from '../../components/ui/feedback'
import { useToast } from '../../hooks/useToast'

type FiltreStatut = '' | 'actif' | 'suspendu'
type FiltreRole = '' | 'utilisateur' | 'administrateur'

const ROLE_LABELS: Record<Role, string> = {
  utilisateur: 'Utilisateur',
  administrateur: 'Administrateur',
}

function MethodeBadge({ user }: { user: User }) {
  return (
    <span className="flex flex-wrap justify-center gap-1.5">
      {user.authMethods.includes('motdepasse') ? (
        <Badge variant="gris">Mot de passe</Badge>
      ) : null}
      {user.authMethods.includes('google') ? (
        <Badge variant="gris">Google</Badge>
      ) : null}
      {user.authMethods.length === 0 ? (
        // §3.1 : compte créé par un administrateur — l'utilisateur n'a pas
        // encore défini son mot de passe via le lien d'invitation
        <Badge variant="ocre">Invitation en attente — mot de passe non défini</Badge>
      ) : null}
    </span>
  )
}

function RoleBadge({ user }: { user: User }) {
  return user.role === 'administrateur' ? (
    <Badge variant="vert">Administrateur</Badge>
  ) : (
    <Badge variant="gris">Utilisateur</Badge>
  )
}

function StatutBadge({ user }: { user: User }) {
  return user.statut === 'actif' ? (
    <Badge variant="vert">Actif</Badge>
  ) : (
    <Badge variant="rouge">Suspendu</Badge>
  )
}

/** Gestion des utilisateurs (§38) : liste, filtres, création, détail */
export function UtilisateursAdmin() {
  useDb()
  const version = useDbVersion()
  const { toast } = useToast()
  const navigate = useNavigate()
  const admin = session.current ? db.users.find((u) => u.id === session.current!.userId) : null
  const adminId = admin?.id ?? 'u1'

  const [recherche, setRecherche] = useState('')
  const [filtreRole, setFiltreRole] = useState<FiltreRole>('')
  const [filtreStatut, setFiltreStatut] = useState<FiltreStatut>('')
  const [creationOuverte, setCreationOuverte] = useState(false)
  const [nouveau, setNouveau] = useState({ prenom: '', nom: '', email: '', role: 'utilisateur' as Role })
  const [erreurs, setErreurs] = useState<Record<string, string>>({})

  const utilisateurs = useMemo(() => {
    let list = [...db.users]
    const q = recherche.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (u) =>
          `${u.prenom} ${u.nom}`.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q),
      )
    }
    if (filtreRole) list = list.filter((u) => u.role === filtreRole)
    if (filtreStatut) list = list.filter((u) => u.statut === filtreStatut)
    return list.sort((a, b) => `${a.nom}`.localeCompare(`${b.nom}`, 'fr'))
  }, [version, recherche, filtreRole, filtreStatut])

  const soumettreCreation = (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!nouveau.prenom.trim()) errs.prenom = 'Le prénom est obligatoire.'
    if (!nouveau.nom.trim()) errs.nom = 'Le nom est obligatoire.'
    if (!nouveau.email.trim()) errs.email = "L'adresse e-mail est obligatoire."
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(nouveau.email.trim()))
      errs.email = "Le format de l'adresse e-mail n'est pas valide."
    if (Object.keys(errs).length) {
      setErreurs(errs)
      return
    }
    const res = createUser(adminId, nouveau)
    if (!res.ok) {
      setErreurs({ email: res.error })
      return
    }
    setCreationOuverte(false)
    setNouveau({ prenom: '', nom: '', email: '', role: 'utilisateur' })
    toast(
      `Compte créé. L'utilisateur recevra un courriel avec un lien temporaire sécurisé pour définir lui-même son mot de passe : l'administrateur ne définit jamais le mot de passe.`,
    )
  }

  return (
    <>
      <AdminPageHead
        titre="Utilisateurs"
        description="Gérez les comptes : rôles, suspension, réactivation et suppression. Le système garantit qu'il existe toujours au moins un administrateur."
      >
        <Button onClick={() => setCreationOuverte(true)}>
          <UserPlus aria-hidden="true" className="h-5 w-5" />
          Créer un compte
        </Button>
      </AdminPageHead>

      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        <form className="grid gap-4 rounded-2xl border border-line bg-white p-5 md:grid-cols-3" onSubmit={(e) => e.preventDefault()}>
          <Field label="Rechercher (nom ou e-mail)" htmlFor="u-recherche">
            <Input
              id="u-recherche"
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
          </Field>
          <Field label="Rôle" htmlFor="u-role">
            <select
              id="u-role"
              value={filtreRole}
              onChange={(e) => setFiltreRole(e.target.value as FiltreRole)}
              className="min-h-[48px] w-full rounded-xl border border-line bg-white px-4 text-[1.0625rem]"
            >
              <option value="">Tous les rôles</option>
              <option value="utilisateur">Utilisateur</option>
              <option value="administrateur">Administrateur</option>
            </select>
          </Field>
          <Field label="Statut" htmlFor="u-statut">
            <select
              id="u-statut"
              value={filtreStatut}
              onChange={(e) => setFiltreStatut(e.target.value as FiltreStatut)}
              className="min-h-[48px] w-full rounded-xl border border-line bg-white px-4 text-[1.0625rem]"
            >
              <option value="">Tous les statuts</option>
              <option value="actif">Actif</option>
              <option value="suspendu">Suspendu</option>
            </select>
          </Field>
        </form>

        <p className="mt-4 text-mist" role="status">
          {utilisateurs.length} utilisateur{utilisateurs.length > 1 ? 's' : ''} affiché
          {utilisateurs.length > 1 ? 's' : ''} sur {db.users.length}
        </p>

        {utilisateurs.length === 0 ? (
          <div className="mt-4">
            <EmptyState icon={Users} title="Aucun utilisateur trouvé" description="Aucun compte ne correspond aux filtres actuels." />
          </div>
        ) : (
          <>
            {/* Tableau desktop */}
            <div className="scrollzone mt-6 hidden overflow-x-auto rounded-2xl border border-line bg-white md:block">
              <table className="w-full min-w-[900px] border-collapse text-left text-[1rem]">
                <caption className="sr-only">Liste des comptes utilisateurs</caption>
                <thead>
                  <tr className="border-b border-line bg-sand">
                    <th scope="col" className="px-4 py-3">Utilisateur</th>
                    <th scope="col" className="px-4 py-3">E-mail</th>
                    <th scope="col" className="px-4 py-3">Rôle</th>
                    <th scope="col" className="px-4 py-3">Connexion</th>
                    <th scope="col" className="px-4 py-3">Créé le</th>
                    <th scope="col" className="px-4 py-3">Dernière activité</th>
                    <th scope="col" className="px-4 py-3">Statut</th>
                    <th scope="col" className="px-4 py-3">Fiche</th>
                  </tr>
                </thead>
                <tbody>
                  {utilisateurs.map((u) => (
                    <tr key={u.id} className="border-b border-line">
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-3">
                          <Avatar user={u} size="sm" />
                          <span className="font-bold">{fullName(u)}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 break-all">{u.email}</td>
                      <td className="px-4 py-3"><RoleBadge user={u} /></td>
                      <td className="px-4 py-3"><MethodeBadge user={u} /></td>
                      <td className="px-4 py-3">{formatDate(u.createdAt)}</td>
                      <td className="px-4 py-3">{formatDate(u.lastActivityAt)}</td>
                      <td className="px-4 py-3"><StatutBadge user={u} /></td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/admin/utilisateurs/${u.id}`}
                          className="inline-flex min-h-[44px] items-center rounded-lg font-bold text-forest underline decoration-2 underline-offset-4 hover:bg-leaf-pale"
                        >
                          Ouvrir<span className="sr-only"> la fiche de {fullName(u)}</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cartes mobile */}
            <ul className="mt-6 flex flex-col gap-4 md:hidden">
              {utilisateurs.map((u) => (
                <li key={u.id} className="rounded-2xl border border-line bg-white p-5">
                  <div className="flex items-center gap-3">
                    <Avatar user={u} size="md" />
                    <div>
                      <p className="font-bold">{fullName(u)}</p>
                      <p className="break-all text-[0.9375rem] text-mist">{u.email}</p>
                    </div>
                  </div>
                  <dl className="mt-3 flex flex-col gap-1.5 text-[0.9375rem]">
                    <div className="flex justify-between gap-3">
                      <dt className="text-mist">Rôle</dt>
                      <dd><RoleBadge user={u} /></dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-mist">Statut</dt>
                      <dd><StatutBadge user={u} /></dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-mist">Connexion</dt>
                      <dd><MethodeBadge user={u} /></dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-mist">Créé le</dt>
                      <dd>{formatDate(u.createdAt)}</dd>
                    </div>
                  </dl>
                  <p className="mt-3">
                    <Link
                      to={`/admin/utilisateurs/${u.id}`}
                      className="inline-flex min-h-[44px] items-center rounded-lg font-bold text-forest underline decoration-2 underline-offset-4"
                    >
                      Ouvrir la fiche
                    </Link>
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Création de compte (§3.1) : l'admin ne définit jamais le mot de passe */}
      <Modal
        open={creationOuverte}
        onClose={() => setCreationOuverte(false)}
        title="Créer un compte utilisateur"
        footer={
          <>
            <Button variant="blanc" onClick={() => setCreationOuverte(false)}>
              Annuler
            </Button>
            <Button onClick={soumettreCreation}>
              Créer le compte
            </Button>
          </>
        }
      >
        <form className="flex flex-col gap-4" onSubmit={soumettreCreation} noValidate>
          <Alert kind="info" title="Mot de passe">
            <p>
              L'administrateur ne définit jamais le mot de passe : l'utilisateur recevra un courriel
              avec un lien temporaire sécurisé pour le définir lui-même.
            </p>
          </Alert>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prénom" htmlFor="nu-prenom" required error={erreurs.prenom}>
              <Input id="nu-prenom" value={nouveau.prenom} onChange={(e) => { setNouveau({ ...nouveau, prenom: e.target.value }); setErreurs((er) => ({ ...er, prenom: '' })) }} invalid={!!erreurs.prenom} describedBy={erreurs.prenom ? 'nu-prenom-err' : undefined} />
            </Field>
            <Field label="Nom" htmlFor="nu-nom" required error={erreurs.nom}>
              <Input id="nu-nom" value={nouveau.nom} onChange={(e) => { setNouveau({ ...nouveau, nom: e.target.value }); setErreurs((er) => ({ ...er, nom: '' })) }} invalid={!!erreurs.nom} describedBy={erreurs.nom ? 'nu-nom-err' : undefined} />
            </Field>
          </div>
          <Field label="Adresse e-mail" htmlFor="nu-email" required error={erreurs.email}>
            <Input id="nu-email" type="email" value={nouveau.email} onChange={(e) => { setNouveau({ ...nouveau, email: e.target.value }); setErreurs((er) => ({ ...er, email: '' })) }} invalid={!!erreurs.email} describedBy={erreurs.email ? 'nu-email-err' : undefined} />
          </Field>
          <Field label="Rôle" htmlFor="nu-role" required>
            <select
              id="nu-role"
              value={nouveau.role}
              onChange={(e) => setNouveau({ ...nouveau, role: e.target.value as Role })}
              className="min-h-[48px] w-full rounded-xl border border-line bg-white px-4 text-[1.0625rem]"
            >
              <option value="utilisateur">Utilisateur</option>
              <option value="administrateur">Administrateur</option>
            </select>
          </Field>
        </form>
      </Modal>
    </>
  )
}

/** Fiche utilisateur : modification, rôle (confirmation explicite §11),
 *  suspension, réactivation, suppression, avatar (§10, §11, §12, §13.2) */
export function UtilisateurDetail() {
  useDb()
  const { id } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const admin = session.current ? db.users.find((u) => u.id === session.current!.userId) : null
  const adminId = admin?.id ?? 'u1'

  const user = id ? db.users.find((u) => u.id === id) : undefined
  const [aEditer, setAEditer] = useState<User | null>(null)
  const [edition, setEdition] = useState({ prenom: '', nom: '', email: '' })
  const [erreurEdition, setErreurEdition] = useState('')
  const [roleCible, setRoleCible] = useState<Role | null>(null)
  const [aSuspendre, setASuspendre] = useState(false)
  const [aReactiver, setAReactiver] = useState(false)
  const [aSupprimer, setASupprimer] = useState(false)
  const [aAvatar, setAAvatar] = useState(false)

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Alert kind="erreur" title="Utilisateur introuvable">
          <p>Ce compte n'existe pas (ou plus).</p>
        </Alert>
        <p className="mt-4">
          <Link to="/admin/utilisateurs" className="inline-flex min-h-[48px] items-center rounded-xl bg-forest px-6 font-bold text-white">
            Retour à la liste
          </Link>
        </p>
      </div>
    )
  }

  const estDernierAdmin = user.role === 'administrateur' && adminCount() <= 1

  return (
    <>
      <AdminPageHead titre={`Fiche utilisateur : ${fullName(user)}`} description={`Compte créé le ${formatDate(user.createdAt)} — dernière activité le ${formatDate(user.lastActivityAt)}.`}>
        <Link to="/admin/utilisateurs" className={buttonClasses()}>
          <ArrowLeft aria-hidden="true" className="h-5 w-5" />
          Retour à la liste
        </Link>
      </AdminPageHead>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:px-8 lg:grid-cols-[20rem_1fr]">
        <aside className="rounded-2xl border border-line bg-white p-6" aria-label="Identité de l'utilisateur">
          <div className="flex flex-col items-center gap-4 text-center">
            <Avatar user={user} size="lg" />
            <div>
              <p className="text-xl font-bold">{fullName(user)}</p>
              <p className="break-all text-[0.9375rem] text-mist">{user.email}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <RoleBadge user={user} />
              <StatutBadge user={user} />
            </div>
            <MethodeBadge user={user} />
            <dl className="mt-2 w-full text-left text-[0.9375rem]">
              <div className="flex justify-between gap-3 rounded-lg bg-sand p-2">
                <dt className="font-bold">Commentaires publics</dt>
                <dd>{userPublicCommentCount(user.id)}</dd>
              </div>
              <div className="mt-2 flex justify-between gap-3 rounded-lg bg-sand p-2">
                <dt className="font-bold">Nouveau e-mail en attente</dt>
                <dd>{user.pendingEmail ?? '—'}</dd>
              </div>
            </dl>
          </div>
        </aside>

        <div className="flex flex-col gap-6">
          <section aria-labelledby="titre-actions" className="rounded-2xl border border-line bg-white p-6">
            <h2 id="titre-actions" className="text-xl text-forest">
              Actions autorisées
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              <li>
                <Button
                  variant="secondaire"
                  className="w-full"
                  onClick={() => {
                    setAEditer(user)
                    setEdition({ prenom: user.prenom, nom: user.nom, email: user.email })
                    setErreurEdition('')
                  }}
                >
                  <Pencil aria-hidden="true" className="h-5 w-5" />
                  Modifier la fiche
                </Button>
              </li>
              <li>
                <Button
                  variant="secondaire"
                  className="w-full"
                  onClick={() => setRoleCible(user.role === 'administrateur' ? 'utilisateur' : 'administrateur')}
                  disabled={user.role === 'administrateur' && adminCount() <= 1}
                >
                  <ShieldCheck aria-hidden="true" className="h-5 w-5" />
                  {user.role === 'administrateur' ? 'Rétrograder en utilisateur' : 'Promouvoir administrateur'}
                </Button>
              </li>
              {user.statut === 'actif' ? (
                <li>
                  <Button variant="secondaire" className="w-full" onClick={() => setASuspendre(true)}>
                    <Ban aria-hidden="true" className="h-5 w-5" />
                    Suspendre le compte
                  </Button>
                </li>
              ) : (
                <li>
                  <Button variant="secondaire" className="w-full" onClick={() => setAReactiver(true)}>
                    <RotateCcw aria-hidden="true" className="h-5 w-5" />
                    Réactiver le compte
                  </Button>
                </li>
              )}
              <li>
                <Button variant="fantome" className="w-full" onClick={() => setAAvatar(true)}>
                  Avatar par défaut
                </Button>
              </li>
              <li className="sm:col-span-2">
                <Button variant="danger" className="w-full" onClick={() => setASupprimer(true)} disabled={estDernierAdmin}>
                  <Trash2 aria-hidden="true" className="h-5 w-5" />
                  Supprimer le compte
                </Button>
              </li>
            </ul>
            {estDernierAdmin ? (
              <div className="mt-4">
                <Alert kind="attention" title="Dernier administrateur">
                  <p>
                    Ce compte est le dernier compte administrateur : il ne peut pas être supprimé
                    ni rétrogradé, afin de garantir qu'il existe toujours au moins un
                    administrateur.
                  </p>
                </Alert>
              </div>
            ) : null}
            {user.statut === 'suspendu' ? (
              <div className="mt-4">
                <Alert kind="info" title="Compte suspendu">
                  <p>
                    Les sessions actives ont été invalidées, l'utilisateur ne peut plus se connecter
                    ni commenter. Les contenus publics du site restent accessibles comme pour un
                    visiteur, ses articles et commentaires existants sont conservés et son nom
                    continue d'apparaître sur ses commentaires.
                  </p>
                </Alert>
              </div>
            ) : null}
          </section>
        </div>
      </div>

      {/* Modification */}
      <Modal
        open={!!aEditer}
        onClose={() => setAEditer(null)}
        title="Modifier la fiche utilisateur"
        footer={
          <>
            <Button variant="blanc" onClick={() => setAEditer(null)}>
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (!aEditer) return
                if (!edition.prenom.trim() || !edition.nom.trim() || !edition.email.trim()) {
                  setErreurEdition('Prénom, nom et adresse e-mail sont obligatoires.')
                  return
                }
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(edition.email.trim())) {
                  setErreurEdition("Le format de l'adresse e-mail n'est pas valide.")
                  return
                }
                updateUserByAdmin(adminId, aEditer.id, {
                  prenom: edition.prenom.trim(),
                  nom: edition.nom.trim(),
                  email: edition.email.trim(),
                })
                toast('Fiche utilisateur modifiée. Une validation de la nouvelle adresse sera demandée en production (§8).')
                setAEditer(null)
              }}
            >
              Enregistrer
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {erreurEdition ? (
            <p role="alert" className="rounded-lg bg-brique-pale px-3 py-2 font-bold text-brique">
              {erreurEdition}
            </p>
          ) : null}
          <Field label="Prénom" htmlFor="ed-prenom" required>
            <Input id="ed-prenom" value={edition.prenom} onChange={(e) => setEdition({ ...edition, prenom: e.target.value })} />
          </Field>
          <Field label="Nom" htmlFor="ed-nom" required>
            <Input id="ed-nom" value={edition.nom} onChange={(e) => setEdition({ ...edition, nom: e.target.value })} />
          </Field>
          <Field
            label="Adresse e-mail"
            htmlFor="ed-email"
            required
            hint="La nouvelle adresse devra être validée par un courriel avant de devenir l'adresse principale (§8)."
          >
            <Input id="ed-email" type="email" value={edition.email} onChange={(e) => setEdition({ ...edition, email: e.target.value })} />
          </Field>
        </div>
      </Modal>

      {/* Changement de rôle : confirmation explicite (§11) */}
      <ConfirmDialog
        open={!!roleCible}
        onClose={() => setRoleCible(null)}
        onConfirm={() => {
          if (user && roleCible) {
            const res = changeRole(adminId, user.id, roleCible)
            if (!res.ok) {
              toast(res.error, 'erreur')
            } else {
              toast(`Rôle modifié : ${fullName(user)} est désormais ${ROLE_LABELS[roleCible]}. L'utilisateur est notifié.`)
            }
          }
          setRoleCible(null)
        }}
        title="Confirmer le changement de rôle"
        confirmLabel="Confirmer le changement de rôle"
      >
        <p>
          Vous modifiez le rôle de <strong>{fullName(user)}</strong> :
        </p>
        <p className="mt-2 rounded-xl bg-sand p-3">
          Rôle actuel : <strong>{user ? ROLE_LABELS[user.role] : ''}</strong>
          <br />
          Nouveau rôle : <strong>{roleCible ? ROLE_LABELS[roleCible] : ''}</strong>
        </p>
        <p className="mt-2">
          Un administrateur dispose de l'accès complet à l'administration. L'utilisateur sera
          notifié de ce changement de rôle.
        </p>
      </ConfirmDialog>

      {/* Suspension (§10) */}
      <ConfirmDialog
        open={aSuspendre}
        onClose={() => setASuspendre(false)}
        onConfirm={() => {
          if (user) {
            suspendUser(adminId, user.id)
            toast(`Compte de ${fullName(user)} suspendu : sessions invalidées, connexion et commentaires désactivés.`)
          }
          setASuspendre(false)
        }}
        title="Suspendre ce compte ?"
        confirmLabel="Suspendre le compte"
      >
        <p>
          {fullName(user)} ne pourra plus se connecter, commenter ni utiliser les fonctionnalités
          réservées aux membres. Les sessions actives seront invalidées. Les contenus publics du
          site resteront accessibles comme pour un visiteur, et ses articles et commentaires
          existants seront conservés (son nom continuera d'apparaître sur ses commentaires).
          La réactivation est possible à tout moment.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={aReactiver}
        onClose={() => setAReactiver(false)}
        onConfirm={() => {
          if (user) {
            reactivateUser(adminId, user.id)
            toast(`Compte de ${fullName(user)} réactivé : l'utilisateur peut de nouveau se connecter.`)
          }
          setAReactiver(false)
        }}
        title="Réactiver ce compte ?"
        confirmLabel="Réactiver le compte"
        destructive={false}
      >
        <p>
          {fullName(user)} pourra de nouveau se connecter, commenter et utiliser son espace
          personnel. Une notification sera envoyée dans son espace.
        </p>
      </ConfirmDialog>

      {/* Suppression (§12) */}
      <ConfirmDialog
        open={aSupprimer}
        onClose={() => setASupprimer(false)}
        onConfirm={() => {
          if (user) {
            const res = deleteUserByAdmin(adminId, user.id)
            if (!res.ok) {
              toast(res.error, 'erreur')
              setASupprimer(false)
              return
            }
            toast(`Compte de ${fullName(user)} supprimé définitivement. Ses commentaires restent visibles avec la mention « Utilisateur supprimé ».`)
            navigate('/admin/utilisateurs')
          }
        }}
        title="Supprimer définitivement ce compte ?"
        confirmLabel="Supprimer définitivement"
      >
        <p>
          Les données personnelles de {fullName(user)} et ses identifiants de connexion seront
          supprimés ; l'utilisateur ne pourra plus se connecter. Ses commentaires et réponses
          seront conservés pour préserver les discussions : leur auteur deviendra{' '}
          <strong>« Utilisateur supprimé »</strong> et aucune information permettant de
          l'identifier ne sera plus affichée.
        </p>
      </ConfirmDialog>

      {/* Avatar (§13.2) : retrait/remplacement par l'avatar par défaut */}
      <ConfirmDialog
        open={aAvatar}
        onClose={() => setAAvatar(false)}
        onConfirm={() => {
          if (user) {
            resetUserAvatar(adminId, user.id)
            toast('Avatar remplacé par l\'avatar par défaut du site.')
          }
          setAAvatar(false)
        }}
        title="Réinitialiser l'avatar ?"
        confirmLabel="Remplacer par l'avatar par défaut"
        destructive={false}
      >
        <p>
          L'avatar actuel sera retiré et remplacé par l'avatar par défaut du site. Conformément au
          cahier des charges, l'administrateur ne choisit pas à la place de l'utilisateur une
          identité personnelle.
        </p>
      </ConfirmDialog>
    </>
  )
}

function buttonClasses() {
  return 'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-line bg-white px-6 font-bold text-forest hover:bg-leaf-pale'
}
