import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TriangleAlert } from 'lucide-react'
import { db, deleteOwnAccount, session, useDb } from '../../lib/db'
import { Button, Checkbox } from '../../components/ui/form'
import { ConfirmDialog } from '../../components/ui/overlay'
import { Alert } from '../../components/ui/feedback'
import { useToast } from '../../hooks/useToast'

/** Suppression définitive du compte (§12) */
export function SuppressionCompte() {
  useDb()
  const navigate = useNavigate()
  const { toast } = useToast()
  const user = session.current ? db.users.find((u) => u.id === session.current!.userId) ?? null : null
  const [compris, setCompris] = useState(false)
  const [confirme, setConfirme] = useState(false)

  if (!user) return null

  const estDernierAdmin = user.role === 'administrateur' && db.users.filter((u) => u.role === 'administrateur').length <= 1

  return (
    <section aria-labelledby="titre-suppression" className="mx-auto max-w-3xl">
      <h2 id="titre-suppression" className="text-xl text-forest">
        Supprimer mon compte
      </h2>

      <div className="mt-4">
        <Alert kind="attention" title="Action définitive et irréversible">
          <ul className="flex list-disc flex-col gap-1 pl-5">
            <li>Vos données personnelles et vos identifiants de connexion seront supprimés.</li>
            <li>Vous ne pourrez plus vous connecter.</li>
            <li>
              Vos commentaires et réponses seront conservés pour préserver les discussions :
              leur auteur deviendra « Utilisateur supprimé ».
            </li>
            <li>Les informations permettant de vous identifier ne seront plus affichées.</li>
          </ul>
        </Alert>
      </div>

      {estDernierAdmin ? (
        <div className="mt-4">
          <Alert kind="erreur" title="Suppression impossible">
            <p>
              Vous êtes le dernier administrateur de l'association. Le système garantit qu'il
              existe toujours au moins un administrateur : votre compte ne peut pas être supprimé.
              Désignez d'abord un autre administrateur depuis l'administration.
            </p>
          </Alert>
        </div>
      ) : null}

      <div className="mt-6 rounded-2xl border border-line bg-white p-6">
        <Checkbox
          id="supp-compris"
          checked={compris}
          onChange={(e) => setCompris(e.target.checked)}
          label="J'ai compris les conséquences de la suppression de mon compte."
        />
        <div className="mt-5">
          <Button
            variant="danger"
            disabled={!compris || estDernierAdmin}
            onClick={() => setConfirme(true)}
          >
            <TriangleAlert aria-hidden="true" className="h-5 w-5" />
            Demander la suppression définitive de mon compte
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirme}
        onClose={() => setConfirme(false)}
        onConfirm={() => {
          deleteOwnAccount(user.id)
          setConfirme(false)
          toast('Votre compte a été supprimé. Vos anciens commentaires restent visibles sous la mention « Utilisateur supprimé ».', 'info')
          navigate('/')
        }}
        title="Confirmer la suppression de votre compte"
        confirmLabel="Supprimer mon compte définitivement"
      >
        <p>
          Dernière étape : confirmez-vous la suppression définitive du compte de{' '}
          <strong>
            {user.prenom} {user.nom}
          </strong>{' '}
          ({user.email}) ? Cette action ne peut pas être annulée.
        </p>
      </ConfirmDialog>
    </section>
  )
}
