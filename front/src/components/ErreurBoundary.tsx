import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { CircleAlert } from 'lucide-react'
import { Button } from '../components/ui/form'

/** Barrière d'erreur globale : état d'erreur accessible avec action de
 *  reprise (brief : états de chargement, d'erreur et de succès) */
interface ErreurBoundaryProps {
  children: ReactNode
}

interface ErreurBoundaryState {
  erreur: Error | null
}

export class ErreurBoundary extends Component<ErreurBoundaryProps, ErreurBoundaryState> {
  state: ErreurBoundaryState = { erreur: null }

  static getDerivedStateFromError(erreur: Error): ErreurBoundaryState {
    return { erreur }
  }

  componentDidCatch(erreur: Error, info: ErrorInfo) {
    // En production, ceci serait envoyé au système de suivi du backend
    console.error('Erreur capturée par la barrière :', erreur, info.componentStack)
  }

  render() {
    if (this.state.erreur) {
      return (
        <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-4 text-center">
          <CircleAlert aria-hidden="true" className="h-16 w-16 text-brique" />
          <h1 className="text-forest">Une erreur inattendue est survenue</h1>
          <p className="text-mist">
            La page n'a pas pu s'afficher correctement. Vous pouvez réessayer ou revenir à
            l'accueil du site.
          </p>
          <p className="rounded-xl bg-sand-dark p-3 text-left text-[0.875rem] text-mist">
            Détail technique : {this.state.erreur.message}
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button onClick={() => this.setState({ erreur: null })}>Réessayer</Button>
            <Button
              variant="secondaire"
              onClick={() => {
                window.location.hash = '#/'
                this.setState({ erreur: null })
              }}
            >
              Retour à l'accueil
            </Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
