import { useCurrentUser } from '../../lib/auth'
import { useState } from 'react'
import { CheckCircle2, Clock, MapPin, Pencil, Save, Users } from 'lucide-react'
import { db, logAction, saveAssociation, useDb } from '../../lib/db'
import { toInputDateTime } from '../../lib/format'
import { AdminPageHead } from '../../components/layout/AdminLayout'
import { BlockEditor } from '../../components/admin/BlockEditor'
import { Button, Field, Input } from '../../components/ui/form'
import { TabPanel, Tabs } from '../../components/ui/nav'
import { useToast } from '../../hooks/useToast'
import { Alert } from '../../components/ui/feedback'

/** Gestion de la page « L'association » (§32 à §34) : contenu par blocs +
 *  coordonnées et réseaux sociaux. Aucune modification du code nécessaire. */
export function AssociationAdmin() {
  useDb()
  const { toast } = useToast()
  const [onglet, setOnglet] = useState('contenu')
  const [blocks, setBlocks] = useState(db.association.blocks)
  const [coords, setCoords] = useState({ ...db.association.coordonnees })
  const [erreurs, setErreurs] = useState<Record<string, string>>({})

  const admin = useCurrentUser()
  const adminId = admin?.id ?? 'u1'

  const setCoord = (champ: keyof typeof coords, val: string) => {
    setCoords((c) => ({ ...c, [champ]: val }))
    setErreurs((e) => {
      const n = { ...e }
      delete n[champ]
      return n
    })
  }

  const enregistrer = () => {
    const errs: Record<string, string> = {}
    if (!coords.adresse.trim()) errs.adresse = "L'adresse est obligatoire."
    if (!coords.codePostal.trim()) errs.codePostal = 'Le code postal est obligatoire.'
    if (!coords.ville.trim()) errs.ville = 'La ville est obligatoire.'
    if (!coords.telephone.trim()) errs.telephone = 'Le téléphone est obligatoire.'
    if (!coords.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(coords.email.trim()))
      errs.email = 'Saisissez une adresse e-mail de contact valide.'
    if (Object.keys(errs).length) {
      setErreurs(errs)
      toast('Le formulaire contient des erreurs : corrigez les champs signalés.', 'erreur')
      return
    }
    saveAssociation(blocks, coords, adminId)
    toast('Page « L\'association » enregistrée : les modifications sont visibles publiquement.')
  }

  return (
    <>
      <AdminPageHead
        titre="Page « L'association »"
        description="Le contenu et les coordonnées de la page publique sont administrables ici, sans modification du code. Les informations générales de l'association sont gérées depuis cette page (pas de section « Paramètres du site » distincte, §37)."
      >
        <Button onClick={enregistrer}>
          <Save aria-hidden="true" className="h-5 w-5" />
          Enregistrer la page
        </Button>
      </AdminPageHead>

      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        <Tabs
          label="Sections de la page de l'association"
          activeId={onglet}
          onChange={setOnglet}
          tabs={[
            { id: 'contenu', label: 'Contenu de la page' },
            { id: 'coordonnees', label: 'Coordonnées et réseaux sociaux' },
          ]}
        />

        <div className="mt-6">
          <TabPanel panelId="contenu" activeId={onglet}>
            <div className="rounded-2xl border border-line bg-white p-6">
              <BlockEditor blocks={blocks} onChange={setBlocks} />
            </div>
          </TabPanel>

          <TabPanel panelId="coordonnees" activeId={onglet}>
            <div className="grid gap-8 lg:grid-cols-2">
              <section aria-labelledby="titre-coord" className="rounded-2xl border border-line bg-white p-6">
                <h2 id="titre-coord" className="flex items-center gap-2 text-xl text-forest">
                  <MapPin aria-hidden="true" className="h-6 w-6" />
                  Coordonnées (§34)
                </h2>
                <div className="mt-4 flex flex-col gap-5">
                  <Field label="Adresse" htmlFor="co-adresse" required error={erreurs.adresse}>
                    <Input id="co-adresse" value={coords.adresse} onChange={(e) => setCoord('adresse', e.target.value)} invalid={!!erreurs.adresse} describedBy={erreurs.adresse ? 'co-adresse-err' : undefined} />
                  </Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Code postal" htmlFor="co-cp" required error={erreurs.codePostal}>
                      <Input id="co-cp" value={coords.codePostal} onChange={(e) => setCoord('codePostal', e.target.value)} invalid={!!erreurs.codePostal} describedBy={erreurs.codePostal ? 'co-cp-err' : undefined} />
                    </Field>
                    <Field label="Ville" htmlFor="co-ville" required error={erreurs.ville}>
                      <Input id="co-ville" value={coords.ville} onChange={(e) => setCoord('ville', e.target.value)} invalid={!!erreurs.ville} describedBy={erreurs.ville ? 'co-ville-err' : undefined} />
                    </Field>
                  </div>
                  <Field label="Numéro de téléphone" htmlFor="co-tel" required error={erreurs.telephone}>
                    <Input id="co-tel" type="tel" value={coords.telephone} onChange={(e) => setCoord('telephone', e.target.value)} invalid={!!erreurs.telephone} describedBy={erreurs.telephone ? 'co-tel-err' : undefined} />
                  </Field>
                  <Field label="Adresse e-mail de contact" htmlFor="co-email" required error={erreurs.email}>
                    <Input id="co-email" type="email" value={coords.email} onChange={(e) => setCoord('email', e.target.value)} invalid={!!erreurs.email} describedBy={erreurs.email ? 'co-email-err' : undefined} />
                  </Field>
                  <Field label="Horaires d'ouverture (permanence)" htmlFor="co-horaires">
                    <Input id="co-horaires" value={coords.horaires} onChange={(e) => setCoord('horaires', e.target.value)} />
                  </Field>
                </div>
              </section>

              <section aria-labelledby="titre-carte-pos" className="rounded-2xl border border-line bg-white p-6">
                <h2 id="titre-carte-pos" className="text-xl text-forest">
                  Position de la carte interactive
                </h2>
                <p className="mt-2 text-[0.9375rem] text-mist">
                  Latitude et longitude utilisées par la carte de la page publique et par le lien
                  OpenStreetMap.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <Field label="Latitude" htmlFor="co-lat" required>
                    <Input id="co-lat" value={coords.latitude} onChange={(e) => setCoord('latitude', e.target.value)} placeholder="48.0723" />
                  </Field>
                  <Field label="Longitude" htmlFor="co-lon" required>
                    <Input id="co-lon" value={coords.longitude} onChange={(e) => setCoord('longitude', e.target.value)} placeholder="6.8796" />
                  </Field>
                </div>
                <h2 className="mt-8 text-xl text-forest">Réseaux sociaux</h2>
                <div className="mt-4 flex flex-col gap-5">
                  <Field label="Page Facebook" htmlFor="co-fb" hint="Laisser vide si la page n'existe pas.">
                    <Input id="co-fb" type="url" value={coords.facebook} onChange={(e) => setCoord('facebook', e.target.value)} placeholder="https://…" />
                  </Field>
                  <Field label="Compte Instagram" htmlFor="co-ig">
                    <Input id="co-ig" type="url" value={coords.instagram} onChange={(e) => setCoord('instagram', e.target.value)} placeholder="https://…" />
                  </Field>
                  <Field label="Chaîne YouTube" htmlFor="co-yt">
                    <Input id="co-yt" type="url" value={coords.youtube} onChange={(e) => setCoord('youtube', e.target.value)} placeholder="https://…" />
                  </Field>
                </div>
              </section>
            </div>
          </TabPanel>
        </div>

        <div className="mt-8">
          <Alert kind="info" title="Aperçu">
            <p>
              Les modifications n'apparaissent publiquement qu'après « Enregistrer la page ».
              Dernière modification : {toInputDateTime(db.association.updatedAt).replace('T', ' à ')}.
            </p>
          </Alert>
        </div>
      </div>
    </>
  )
}
