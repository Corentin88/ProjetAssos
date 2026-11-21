import { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { Accessibility, Info, Moon, RotateCcw, Sun, X } from 'lucide-react'
import { Button, Checkbox, Select } from '../ui/form'

const CLE = 'projetassos_affichage_v1'
const THEME_SYSTEME = '(prefers-color-scheme: dark)'
const MOUVEMENT_SYSTEME = '(prefers-reduced-motion: reduce)'

type Theme = 'systeme' | 'clair' | 'sombre'

const ESPACEMENTS = {
  interligne: { choix: [1.5, 1.75, 2], unite: '', confort: 1.75 },
  lettres: { choix: [0, 0.04, 0.08, 0.12], unite: 'em', confort: 0.06 },
  mots: { choix: [0, 0.08, 0.12, 0.16], unite: 'em', confort: 0.12 },
  paragraphes: { choix: [0.5, 1, 1.5, 2], unite: 'em', confort: 1.25 },
} as const

type Espacement = keyof typeof ESPACEMENTS
const CLES_ESPACEMENT = Object.keys(ESPACEMENTS) as Espacement[]

const REGLAGES_ESPACEMENT = {
  interligne: {
    label: 'Lignes',
    choix: [[1.5, 'Normal'], [1.75, 'Aéré'], [2, 'Très aéré']],
  },
  mots: {
    label: 'Mots',
    choix: [[0, 'Normal'], [0.12, 'Augmenté']],
  },
  lettres: {
    label: 'Lettres',
    choix: [[0, 'Normal'], [0.08, 'Augmenté']],
  },
} as const
type EspacementReglable = keyof typeof REGLAGES_ESPACEMENT
const CLES_REGLAGE = Object.keys(REGLAGES_ESPACEMENT) as EspacementReglable[]

const OPTIONS = {
  contraste: 'Contraste renforcé',
  dyslexie: 'Lecture facilitée (dyslexie)',
  reperes: 'Mieux distinguer les éléments',
  liens: 'Souligner les liens',
  animations: 'Réduire les animations',
} as const

type Option = keyof typeof OPTIONS
const CLES_OPTION = Object.keys(OPTIONS) as Option[]
const AIDES_OPTION: Record<Option, string> = {
  contraste: 'Accentue le contraste des textes, des fonds et des bordures.',
  dyslexie: 'Utilise une police sans empattement et aère le texte.',
  reperes: 'Ajoute des contours aux titres, aux champs et à la page active.',
  liens: 'Souligne les liens pour les repérer plus facilement.',
  animations: 'Réduit les mouvements, notamment le défilement automatique du carrousel.',
}

type Preferences = {
  theme: Theme
  taille: number
} & Record<Espacement, number | null> & Record<Option, boolean>

const DEFAUT: Preferences = {
  theme: 'systeme',
  taille: 100,
  contraste: false,
  dyslexie: false,
  reperes: false,
  liens: false,
  animations: false,
  interligne: null,
  lettres: null,
  mots: null,
  paragraphes: null,
}

function chargerPreferences(): Preferences {
  try {
    const valeur = JSON.parse(localStorage.getItem(CLE) ?? 'null') as Partial<Preferences> | null
    if (!valeur) return DEFAUT

    const preferences = { ...DEFAUT }
    if (valeur.theme === 'clair' || valeur.theme === 'sombre') preferences.theme = valeur.theme
    if (typeof valeur.taille === 'number' && Number.isFinite(valeur.taille)) {
      preferences.taille = Math.min(150, Math.max(80, Math.round(valeur.taille / 5) * 5))
    }
    for (const cle of CLES_OPTION) preferences[cle] = valeur[cle] === true
    for (const cle of CLES_ESPACEMENT) {
      const nombre = valeur[cle]
      const choix: readonly number[] = ESPACEMENTS[cle].choix
      if (typeof nombre === 'number' && choix.includes(nombre)) preferences[cle] = nombre
    }
    return preferences
  } catch {
    // Les réglages restent utilisables en mémoire si le navigateur bloque le stockage.
    return DEFAUT
  }
}

function mesureEspacement(preferences: Preferences, cle: Espacement) {
  return preferences[cle] ?? (preferences.dyslexie ? ESPACEMENTS[cle].confort : null)
}

function selectionEspacement(preferences: Preferences, cle: EspacementReglable) {
  // Les anciennes valeurs restent appliquées. Seul leur libellé est regroupé dans le panneau.
  const mesure = mesureEspacement(preferences, cle)
  const choix = REGLAGES_ESPACEMENT[cle].choix
  if (cle === 'interligne') return mesure ?? choix[0][0]
  return mesure && mesure > 0 ? choix[1][0] : choix[0][0]
}

function usePreferenceSysteme(requete: string) {
  const [active, setActive] = useState(() => window.matchMedia(requete).matches)
  useEffect(() => {
    const media = window.matchMedia(requete)
    const actualiser = () => setActive(media.matches)
    actualiser()
    media.addEventListener('change', actualiser)
    return () => media.removeEventListener('change', actualiser)
  }, [requete])
  return active
}

interface ContexteAffichage {
  sombre: boolean
  reduireAnimations: boolean
  navigationCompacte: boolean
  basculerTheme: () => void
  ouvrirPanneau: (declencheur: HTMLButtonElement) => void
  panneauId: string
}

const Contexte = createContext<ContexteAffichage | null>(null)

export function useAffichage() {
  const contexte = useContext(Contexte)
  if (!contexte) throw new Error('AffichageProvider est requis.')
  return contexte
}

export function AffichageProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(chargerPreferences)
  const [aideOuverte, setAideOuverte] = useState<Option | null>(null)
  const sombreSysteme = usePreferenceSysteme(THEME_SYSTEME)
  const mouvementReduitSysteme = usePreferenceSysteme(MOUVEMENT_SYSTEME)
  const sombre = preferences.theme === 'systeme' ? sombreSysteme : preferences.theme === 'sombre'
  const reduireAnimations = preferences.animations || mouvementReduitSysteme
  const navigationCompacte = preferences.taille > 100 || preferences.dyslexie
    || (preferences.lettres ?? 0) > 0 || (preferences.mots ?? 0) > 0
  const panneauId = useId()
  const dialogue = useRef<HTMLDialogElement>(null)
  const boutonFermer = useRef<HTMLButtonElement>(null)
  const boutonAide = useRef<HTMLButtonElement | null>(null)
  const origine = useRef<HTMLButtonElement | null>(null)
  const { key } = useLocation()

  const modifier = <K extends keyof Preferences,>(cle: K, valeur: Preferences[K]) => {
    setPreferences((precedentes) => ({ ...precedentes, [cle]: valeur }))
  }

  useLayoutEffect(() => {
    // Les attributs racine couvrent aussi les dialogues et les espaces hors du layout public.
    const racine = document.documentElement
    racine.dataset.themeAffichage = sombre ? 'sombre' : 'clair'
    racine.style.setProperty('--affichage-taille', `${preferences.taille}%`)
    racine.toggleAttribute('data-contraste-renforce', preferences.contraste)
    racine.toggleAttribute('data-confort-dyslexie', preferences.dyslexie)
    racine.toggleAttribute('data-reperes-renforces', preferences.reperes)
    racine.toggleAttribute('data-liens-soulignes', preferences.liens)
    racine.toggleAttribute('data-mouvements-reduits', reduireAnimations)
    racine.toggleAttribute('data-navigation-compacte', navigationCompacte)
    for (const cle of CLES_ESPACEMENT) {
      const definition = ESPACEMENTS[cle]
      const valeur = mesureEspacement(preferences, cle)
      racine.toggleAttribute(`data-espacement-${cle}`, valeur !== null)
      if (valeur === null) racine.style.removeProperty(`--affichage-${cle}`)
      else racine.style.setProperty(`--affichage-${cle}`, `${valeur}${definition.unite}`)
    }
  }, [navigationCompacte, preferences, reduireAnimations, sombre])

  useEffect(() => {
    try {
      localStorage.setItem(CLE, JSON.stringify(preferences))
    } catch {
      // Les préférences de la session restent actives.
    }
  }, [preferences])

  useLayoutEffect(() => {
    if (!dialogue.current?.open) return
    origine.current = null
    dialogue.current?.close()
  }, [key])

  const ouvrirPanneau = (declencheur: HTMLButtonElement) => {
    if (!dialogue.current || dialogue.current.open) return
    origine.current = declencheur
    dialogue.current.showModal()
    boutonFermer.current?.focus()
  }

  return (
    <Contexte.Provider value={{
      sombre,
      reduireAnimations,
      navigationCompacte,
      basculerTheme: () => modifier('theme', sombre ? 'clair' : 'sombre'),
      ouvrirPanneau,
      panneauId,
    }}>
      {children}
      <dialog
        ref={dialogue}
        id={panneauId}
        aria-labelledby={`${panneauId}-titre`}
        className="fixed inset-0 m-auto max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-xl overflow-auto rounded-xl border border-line bg-white text-bark shadow-xl"
        onClose={() => {
          setAideOuverte(null)
          boutonAide.current = null
          if (!origine.current) return
          // Un agrandissement du texte peut remplacer la barre de bureau par celle du menu compact.
          const bouton = origine.current.getClientRects().length
            ? origine.current
            : Array.from(document.querySelectorAll<HTMLButtonElement>('[data-ouvrir-affichage]'))
              .find((element) => element.getClientRects().length > 0)
          bouton?.focus({ preventScroll: true })
          origine.current = null
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialogue.current?.close()
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Escape' || !aideOuverte) return
          // Le premier Échap ferme l’aide. Le suivant ferme le panneau natif.
          event.preventDefault()
          setAideOuverte(null)
          boutonAide.current?.focus()
        }}
      >
        <div className="space-y-4 p-[12px] sm:p-5">
          <div className="flex flex-wrap-reverse items-center justify-between gap-2">
            <h2 id={`${panneauId}-titre`} className="text-base text-forest sm:text-xl">Accessibilité et affichage</h2>
            <Button
              ref={boutonFermer}
              variant="secondaire"
              size="petit"
              className="ml-auto w-[44px] shrink-0 px-0!"
              aria-label="Fermer les réglages"
              onClick={() => dialogue.current?.close()}
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </Button>
          </div>
          <div className="grid gap-2">
            <div className="flex flex-wrap justify-between gap-x-3 text-base font-bold">
              <label htmlFor={`${panneauId}-taille`}>Taille du texte</label>
              <span aria-hidden="true">{preferences.taille} %</span>
            </div>
            <input
              id={`${panneauId}-taille`}
              type="range"
              min={80}
              max={150}
              step={5}
              value={preferences.taille}
              aria-valuetext={`${preferences.taille} %`}
              className="min-h-[32px] w-full accent-forest"
              onChange={(e) => modifier('taille', e.target.valueAsNumber)}
            />
          </div>
          <fieldset className="min-w-0 border-t border-line pt-2">
            <legend className="pr-2 text-lg font-bold text-forest">Confort de lecture</legend>
            {CLES_OPTION.map((cle) => (
              <div key={cle} className="grid grid-cols-[minmax(0,1fr)_44px] items-start gap-x-2 py-1">
                <Checkbox
                  id={`${panneauId}-${cle}`}
                  className="min-w-0 pt-2 [&>input]:mt-0.5 [&>label]:min-w-0"
                  checked={preferences[cle]}
                  onChange={(e) => modifier(cle, e.target.checked)}
                  label={OPTIONS[cle]}
                />
                <Button
                  variant="fantome"
                  size="petit"
                  className="min-h-[max(44px,2.75rem)]! w-[44px] px-0!"
                  aria-label={`Informations : ${OPTIONS[cle]}`}
                  aria-expanded={aideOuverte === cle}
                  aria-controls={`${panneauId}-${cle}-aide`}
                  aria-describedby={aideOuverte === cle ? `${panneauId}-${cle}-aide` : undefined}
                  onClick={(e) => {
                    boutonAide.current = e.currentTarget
                    setAideOuverte((precedente) => precedente === cle ? null : cle)
                  }}
                >
                  <Info aria-hidden="true" className="h-4 w-4" />
                </Button>
                <p
                  id={`${panneauId}-${cle}-aide`}
                  hidden={aideOuverte !== cle}
                  className="col-span-2 mt-1 rounded-lg border border-line bg-sand px-3 py-2 text-sm text-bark"
                >
                  {AIDES_OPTION[cle]}
                  {cle === 'animations' && mouvementReduitSysteme ? ' Votre système demande déjà cette réduction.' : null}
                </p>
              </div>
            ))}
          </fieldset>
          <fieldset className="min-w-0 border-t border-line pt-2">
            <legend className="pr-2 text-lg font-bold text-forest">Espacement du texte</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {CLES_REGLAGE.map((cle) => {
                const { label, choix } = REGLAGES_ESPACEMENT[cle]
                const id = `${panneauId}-${cle}`
                return (
                  <div key={cle} className="grid min-w-0 gap-1 text-base sm:grid-rows-[1fr_auto]">
                    <label htmlFor={id}>{label}</label>
                    <Select
                      id={id}
                      className="min-h-[44px]! px-2! py-1! text-base!"
                      value={selectionEspacement(preferences, cle)}
                      onChange={(e) => modifier(cle, Number(e.target.value))}
                    >
                      {choix.map(([valeur, libelle]) => <option key={valeur} value={valeur}>{libelle}</option>)}
                    </Select>
                  </div>
                )
              })}
            </div>
          </fieldset>
          <Button variant="secondaire" size="petit" onClick={() => setPreferences(({ theme }) => ({ ...DEFAUT, theme }))}>
            <RotateCcw aria-hidden="true" className="h-4 w-4 shrink-0" />
            Réinitialiser les préférences
          </Button>
        </div>
      </dialog>
    </Contexte.Provider>
  )
}

export function CommandesAffichage() {
  const { sombre, basculerTheme, ouvrirPanneau, panneauId } = useAffichage()
  const Icone = sombre ? Sun : Moon
  const libelle = sombre ? 'Passer au thème jour' : 'Passer au thème nuit'
  const classe = 'w-[44px] shrink-0 px-0!'

  return (
    <div role="group" aria-label="Réglages d’affichage" className="flex shrink-0 items-center gap-1">
      <Button variant="secondaire" size="petit" className={classe} aria-label={libelle} title={libelle} onClick={basculerTheme}>
        <Icone aria-hidden="true" className="h-5 w-5" />
      </Button>
      <Button
        variant="secondaire"
        size="petit"
        className={classe}
        aria-label="Ouvrir les réglages d’accessibilité"
        title="Accessibilité"
        data-ouvrir-affichage
        aria-haspopup="dialog"
        aria-controls={panneauId}
        onClick={(e) => ouvrirPanneau(e.currentTarget)}
      >
        <Accessibility aria-hidden="true" className="h-5 w-5" />
      </Button>
    </div>
  )
}
