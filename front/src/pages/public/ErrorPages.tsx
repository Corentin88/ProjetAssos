import { useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { buttonClasses } from '../../components/ui/form'
import { useAuthSession } from '../../lib/auth'

type ErrorLink = { to: string; label: string }

function ErrorPage({ code, title, description, primary, secondary }: {
  code: 404 | 409
  title: string
  description: string
  primary?: ErrorLink
  secondary: ErrorLink[]
}) {
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const previousTitle = document.title
    document.title = `${code} · ${title} | ProjetAssos`
    // Une ressource peut devenir introuvable après le chargement. Respecter le focus déjà déplacé par l’utilisateur.
    const frame = requestAnimationFrame(() => {
      const active = document.activeElement
      if (active === document.body || active?.id === 'contenu-principal') heading.current?.focus({ preventScroll: true })
    })
    return () => {
      cancelAnimationFrame(frame)
      document.title = previousTitle
    }
  }, [code, title])

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
      <div className="rounded-2xl border border-line bg-white px-4 py-8 text-center sm:px-10 sm:py-12">
        <h1 ref={heading} tabIndex={-1} className="text-forest" aria-describedby="description-erreur">
          <span className="mb-3 block text-5xl font-bold sm:text-6xl">{code}</span>
          {title}
        </h1>
        <p id="description-erreur" className="mx-auto mt-4 max-w-xl text-lg text-mist">{description}</p>
        <div className="mt-7 flex flex-col flex-wrap justify-center gap-3 sm:flex-row">
          {primary && <Link to={primary.to} className={buttonClasses()}>{primary.label}</Link>}
          {secondary.map(link => (
            <Link key={link.to} to={link.to} className={buttonClasses('secondaire')}>{link.label}</Link>
          ))}
        </div>
      </div>
    </div>
  )
}

const accueil = { to: '/', label: 'Retour à l’accueil' }

export function PageIntrouvable({ description = 'La page demandée n’existe pas ou n’est plus disponible.', actualites }: {
  description?: string
  actualites?: string
}) {
  return (
    <ErrorPage
      code={404}
      title="Cette page est introuvable"
      description={description}
      primary={accueil}
      secondary={actualites
        ? [{ to: actualites, label: 'Retour aux actualités' }]
        : [
            { to: '/actualites', label: 'Voir les actualités' },
            { to: '/actualites?avancee=1', label: 'Rechercher un contenu' },
          ]}
    />
  )
}

export function PageConflit() {
  const [params] = useSearchParams()
  const { user, status } = useAuthSession()
  const googleDejaAssocie = params.get('motif') === 'GOOGLE_ACCOUNT_ALREADY_LINKED'
  const actionCompte = user
    ? { to: '/mon-compte', label: 'Retour à mon compte' }
    : status === 'ready' || status === 'unavailable'
      ? { to: '/connexion', label: 'Se connecter' }
      : undefined

  return (
    <ErrorPage
      code={409}
      title="Cette opération n’a pas pu être effectuée"
      description={googleDejaAssocie
        ? 'Ce compte Google est déjà associé à un autre compte ProjetAssos. Vous pouvez utiliser un autre compte Google ou vous connecter au compte déjà associé.'
        : 'L’état actuel du compte ou du contenu empêche de terminer cette opération.'}
      primary={actionCompte}
      secondary={[accueil]}
    />
  )
}
