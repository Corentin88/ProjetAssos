import { useState } from 'react'
import { ArrowDown, ArrowUp, X } from 'lucide-react'
import { useToast } from '../../hooks/useToast'
import { authErrorMessage } from '../../lib/auth'
import { articlesSelectionnes, CAPACITE_CARROUSEL } from '../../lib/carousel'
import { saveCarousel } from '../../lib/content'
import { publicContent, useDb } from '../../lib/db'
import { Button, Field, Select } from '../ui/form'
import { Modal } from '../ui/overlay'
import { Alert } from '../ui/feedback'

export function CarouselSelection({ onClose }: { onClose: () => void }) {
  const { articles } = useDb()
  const { toast } = useToast()
  const publies = articles.filter(article => article.statut === 'publie')
  const [selection, setSelection] = useState(() => articlesSelectionnes(publies).map(article => article.id))
  const [aAjouter, setAAjouter] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState('')
  const disponibles = publies.filter(article => !selection.includes(article.id))

  const titre = (id: string) => publicContent.articles.find(article => article.id === id)?.titre
    ?? publies.find(article => article.id === id)?.titre
    ?? 'Article indisponible'

  const deplacer = (index: number, sens: -1 | 1) => {
    setSelection(precedente => {
      const cible = index + sens
      if (cible < 0 || cible >= precedente.length) return precedente
      const suivante = [...precedente]
      suivante[index] = precedente[cible]
      suivante[cible] = precedente[index]
      return suivante
    })
  }

  const enregistrer = async () => {
    if (enCours) return
    setEnCours(true)
    setErreur('')
    try {
      await saveCarousel(selection)
      toast('Sélection du carrousel enregistrée.')
      onClose()
    } catch (error) {
      setErreur(authErrorMessage(error))
    } finally {
      setEnCours(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Gérer le carrousel de l’accueil" footer={
      <>
        <Button variant="secondaire" disabled={enCours} onClick={onClose}>Annuler</Button>
        <Button disabled={enCours} onClick={() => void enregistrer()}>Enregistrer la sélection</Button>
      </>
    }>
      {erreur ? <Alert kind="erreur" title="Sélection non enregistrée">{erreur}</Alert> : null}
      <p className="text-mist">
        Les articles sélectionnés s’affichent dans cet ordre. Les places libres sont complétées par les publications les plus récentes.
      </p>
      <p className="mt-3 font-bold" role="status">{selection.length} article(s) sélectionné(s) sur {CAPACITE_CARROUSEL}</p>
      <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5">
        {selection.map((id, index) => (
          <li key={id}>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-sand p-2">
              <span>{titre(id)}</span>
              <div className="flex flex-wrap gap-1">
                <Button size="petit" variant="fantome" aria-label={`Monter ${titre(id)}`}
                  disabled={enCours || index === 0} onClick={() => deplacer(index, -1)}>
                  <ArrowUp aria-hidden="true" className="h-4 w-4" />
                </Button>
                <Button size="petit" variant="fantome" aria-label={`Descendre ${titre(id)}`}
                  disabled={enCours || index === selection.length - 1} onClick={() => deplacer(index, 1)}>
                  <ArrowDown aria-hidden="true" className="h-4 w-4" />
                </Button>
                <Button size="petit" variant="fantome" aria-label={`Retirer ${titre(id)}`}
                  disabled={enCours} onClick={() => setSelection(actuelle => actuelle.filter(articleId => articleId !== id))}>
                  <X aria-hidden="true" className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ol>
      {selection.length < CAPACITE_CARROUSEL && disponibles.length ? (
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <Field label="Article publié" htmlFor="carrousel-article" className="min-w-0 flex-1">
            <Select id="carrousel-article" disabled={enCours} value={aAjouter}
              onChange={event => setAAjouter(event.target.value)}>
              <option value="">Choisir un article</option>
              {disponibles.map(article => <option key={article.id} value={article.id}>{titre(article.id)}</option>)}
            </Select>
          </Field>
          <Button variant="secondaire" disabled={enCours || !disponibles.some(article => article.id === aAjouter)} onClick={() => {
            setSelection(actuelle => actuelle.includes(aAjouter) || actuelle.length >= CAPACITE_CARROUSEL
              ? actuelle : [...actuelle, aAjouter])
            setAAjouter('')
          }}>Ajouter</Button>
        </div>
      ) : null}
    </Modal>
  )
}
