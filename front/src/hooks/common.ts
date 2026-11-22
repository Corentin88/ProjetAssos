import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

/** État de chargement simulé pour présenter les squelettes (maquette) */
export function useFakeLoad(delay = 500): boolean {
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), delay)
    return () => clearTimeout(t)
  }, [delay])
  return loading
}

/** Mémoire de position de défilement par clé de location + paramètres d'URL
 *  (restauration après retour depuis un article — §25).
 *  La clé inclut la recherche : revenir sur la même liste (mêmes critères)
 *  restaure la position de défilement ; une navigation vers une liste avec
 *  d'autres critères (badge de catégorie, pagination…) repart du haut de page. */
const scrollMemory = new Map<string, number>()

export function useScrollMemory(key: string): void {
  const location = useLocation()
  const navigation = useNavigationType()
  const cle = `${key}${location.pathname}${location.search}`
  const dejaMontee = useRef(false)
  useLayoutEffect(() => {
    // La saisie et la normalisation remplacent l'URL sur place, sans déplacer le champ actif.
    const remplacementSurPlace = navigation === 'REPLACE' && dejaMontee.current
    if (!remplacementSurPlace) {
      window.scrollTo({ top: scrollMemory.get(cle) ?? 0, behavior: 'instant' })
    }
    dejaMontee.current = true
    const onScroll = () => {
      scrollMemory.set(cle, window.scrollY)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [cle, navigation])
}

export function clearScrollMemory(key?: string): void {
  if (key) scrollMemory.delete(key)
  else scrollMemory.clear()
}

/** Fermeture au clavier + clic extérieur pour les popovers/menus */
export function useDismissable<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T | null>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open, onClose])
  return ref
}

/** Compteur à rebours (limitation des tentatives de connexion — §9) */
export function useCountdown(seconds: number, active: boolean): number {
  const [remaining, setRemaining] = useState(seconds)
  useEffect(() => {
    if (!active) {
      setRemaining(seconds)
      return
    }
    setRemaining(seconds)
    const t = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(t)
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [active, seconds])
  return remaining
}

/** Helper de formulaire : champs, erreurs accessibles */
export interface FormErrors {
  [champ: string]: string
}

export function useForm<T extends Record<string, string>>(initial: T) {
  const [values, setValues] = useState<T>(initial)
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitted, setSubmitted] = useState(false)

  const set = useCallback((champ: keyof T, value: string) => {
    setValues((v) => ({ ...v, [champ]: value }))
    setErrors((e) => {
      const next = { ...e }
      delete next[champ as string]
      return next
    })
  }, [])

  const setFieldErrors = useCallback((errs: FormErrors) => {
    setErrors(errs)
    setSubmitted(true)
  }, [])

  const reset = useCallback(() => {
    setValues(initial)
    setErrors({})
    setSubmitted(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { values, errors, submitted, set, setFieldErrors, reset }
}

/** Même longueur que le DTO d’authentification. */
export function validatePassword(pwd: string): string | null {
  const longueur = Array.from(pwd).length
  if (longueur < 12 || longueur > 128) return 'Le mot de passe doit contenir entre 12 et 128 caractères.'
  return null
}

export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Veuillez saisir une adresse e-mail.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
    return 'Le format de l\'adresse e-mail n\'est pas valide (exemple : nom@exemple.fr).'
  }
  return null
}
