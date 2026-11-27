import { useState } from 'react'
import { Pencil, Plus, Tag, Tags as TagsIcon, Trash2 } from 'lucide-react'
import { db, useDb } from '../../lib/db'
import { deleteClassification, saveClassification, useContentAction } from '../../lib/content'
import { AdminPageHead } from '../../components/layout/AdminLayout'
import { Button, Field, Input } from '../../components/ui/form'
import { ConfirmDialog } from '../../components/ui/overlay'
import { useToast } from '../../hooks/useToast'
import type { CategoryVisual } from '../../types'
import { CategoryVisualPicker } from '../../components/admin/CategoryVisualPicker'
import { CategoryVisualMark } from '../../components/content/CategoryVisualMark'

function nbArticlesCategorie(id: string): number {
  return db.categories.find(item => item.id === id)?.articleCount ?? 0
}
function nbArticlesTag(id: string): number {
  return db.tags.find(item => item.id === id)?.articleCount ?? 0
}

/** Gestion des catégories et des tags (§23) : création, modification,
 *  suppression avec comptage des articles concernés + dissociation auto */
export function CategoriesTagsAdmin() {
  useDb()
  const { toast } = useToast()
  const effectuer = useContentAction()

  const [nouvelleCat, setNouvelleCat] = useState('')
  const [nouveauVisuel, setNouveauVisuel] = useState<CategoryVisual | null>(null)
  const [nouveauTag, setNouveauTag] = useState('')
  const [editionCat, setEditionCat] = useState<{ id: string; nom: string; visual: CategoryVisual | null } | null>(null)
  const [editionTag, setEditionTag] = useState<{ id: string; nom: string } | null>(null)
  const [aSupprimerCat, setASupprimerCat] = useState<{ id: string; nom: string } | null>(null)
  const [aSupprimerTag, setASupprimerTag] = useState<{ id: string; nom: string } | null>(null)

  return (
    <>
      <AdminPageHead
        titre="Catégories et tags"
        description="Organisez les articles. Lors de la suppression d'une catégorie ou d'un tag utilisé, le nombre d'articles concernés est affiché et une confirmation est demandée ; les articles sont automatiquement dissociés et conservés."
      />
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:px-8 lg:grid-cols-2">
        {/* Catégories */}
        <section aria-labelledby="titre-categories" className="rounded-2xl border border-line bg-white p-6">
          <h2 id="titre-categories" className="flex items-center gap-2 text-xl text-forest">
            <TagsIcon aria-hidden="true" className="h-6 w-6" />
            Catégories
          </h2>
          <form
            className="mt-4 grid min-w-0 gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (!nouvelleCat.trim()) return
              void effectuer(async () => {
                await saveClassification('categories', nouvelleCat, undefined, nouveauVisuel)
                toast('Catégorie créée.')
                setNouvelleCat('')
                setNouveauVisuel(null)
              })
            }}
          >
            <Field label="Nouvelle catégorie" htmlFor="nouvelle-cat" required className="flex-1">
              <Input
                id="nouvelle-cat"
                value={nouvelleCat}
                onChange={(e) => setNouvelleCat(e.target.value)}
                placeholder="Exemple : Patrimoine local"
              />
            </Field>
            <CategoryVisualPicker value={nouveauVisuel} onChange={setNouveauVisuel} />
            <Button type="submit" className="justify-self-start">
              <Plus aria-hidden="true" className="h-5 w-5" />
              Créer
            </Button>
          </form>
          <ul className="mt-5 flex flex-col gap-3">
            {db.categories.map((c) => {
              const n = nbArticlesCategorie(c.id)
              return (
                <li key={c.id} className="rounded-xl border border-line bg-sand p-4">
                  {editionCat?.id === c.id ? (
                    <form
                      className="grid min-w-0 gap-3"
                      onSubmit={(e) => {
                        e.preventDefault()
                        void effectuer(async () => {
                          await saveClassification('categories', editionCat.nom, c.id, editionCat.visual)
                          toast('Catégorie modifiée.')
                          setEditionCat(null)
                        })
                      }}
                    >
                      <Field label="Nom de la catégorie" htmlFor={`cat-${c.id}`} className="flex-1">
                        <Input
                          id={`cat-${c.id}`}
                          value={editionCat.nom}
                          onChange={(e) => setEditionCat({ ...editionCat, nom: e.target.value })}
                        />
                      </Field>
                      <CategoryVisualPicker value={editionCat.visual} onChange={visual => setEditionCat({ ...editionCat, visual })} />
                      <div className="flex flex-wrap gap-2">
                        <Button type="submit" size="petit">Enregistrer</Button>
                        <Button type="button" size="petit" variant="blanc" onClick={() => setEditionCat(null)}>Annuler</Button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="flex min-w-0 items-center gap-2 break-words font-bold"><CategoryVisualMark visual={c.visual} />{c.nom}</p>
                      <p className="text-[0.9375rem] text-mist">
                        {n} article{n > 1 ? 's' : ''} lié{n > 1 ? 's' : ''}
                      </p>
                      <div className="flex gap-2">
                        <Button size="petit" variant="secondaire" onClick={() => setEditionCat({ id: c.id, nom: c.nom, visual: c.visual ?? null })}>
                          <Pencil aria-hidden="true" className="h-4 w-4" />
                          Modifier
                        </Button>
                        <Button size="petit" variant="danger" onClick={() => setASupprimerCat({ id: c.id, nom: c.nom })}>
                          <Trash2 aria-hidden="true" className="h-4 w-4" />
                          Supprimer
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>

        {/* Tags */}
        <section aria-labelledby="titre-tags" className="rounded-2xl border border-line bg-white p-6">
          <h2 id="titre-tags" className="flex items-center gap-2 text-xl text-forest">
            <Tag aria-hidden="true" className="h-6 w-6" />
            Tags
          </h2>
          <form
            className="mt-4 flex items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (!nouveauTag.trim()) return
              void effectuer(async () => {
                await saveClassification('tags', nouveauTag)
              toast('Tag créé.')
              setNouveauTag('')
              })
            }}
          >
            <Field label="Nouveau tag" htmlFor="nouveau-tag" required className="flex-1">
              <Input
                id="nouveau-tag"
                value={nouveauTag}
                onChange={(e) => setNouveauTag(e.target.value)}
                placeholder="Exemple : chorale"
              />
            </Field>
            <Button type="submit" className="mb-0.5">
              <Plus aria-hidden="true" className="h-5 w-5" />
              Créer
            </Button>
          </form>
          <ul className="mt-5 flex flex-col gap-3">
            {db.tags.map((t) => {
              const n = nbArticlesTag(t.id)
              return (
                <li key={t.id} className="rounded-xl border border-line bg-sand p-4">
                  {editionTag?.id === t.id ? (
                    <form
                      className="flex flex-wrap items-end gap-3"
                      onSubmit={(e) => {
                        e.preventDefault()
                        void effectuer(async () => {
                await saveClassification('tags', editionTag.nom, t.id)
                        toast('Tag modifié.')
                        setEditionTag(null)
              })
                      }}
                    >
                      <Field label="Nom du tag" htmlFor={`tag-${t.id}`} className="flex-1">
                        <Input
                          id={`tag-${t.id}`}
                          value={editionTag.nom}
                          onChange={(e) => setEditionTag({ ...editionTag, nom: e.target.value })}
                        />
                      </Field>
                      <Button type="submit" size="petit" className="mb-0.5">Enregistrer</Button>
                      <Button type="button" size="petit" variant="blanc" className="mb-0.5" onClick={() => setEditionTag(null)}>
                        Annuler
                      </Button>
                    </form>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-bold">#{t.nom}</p>
                      <p className="text-[0.9375rem] text-mist">
                        {n} article{n > 1 ? 's' : ''} lié{n > 1 ? 's' : ''}
                      </p>
                      <div className="flex gap-2">
                        <Button size="petit" variant="secondaire" onClick={() => setEditionTag({ id: t.id, nom: t.nom })}>
                          <Pencil aria-hidden="true" className="h-4 w-4" />
                          Modifier
                        </Button>
                        <Button size="petit" variant="danger" onClick={() => setASupprimerTag({ id: t.id, nom: t.nom })}>
                          <Trash2 aria-hidden="true" className="h-4 w-4" />
                          Supprimer
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      </div>

      {/* Confirmations de suppression : comptage + dissociation (§23) */}
      <ConfirmDialog
        open={!!aSupprimerCat}
        onClose={() => setASupprimerCat(null)}
        onConfirm={() => effectuer(async () => {
          if (aSupprimerCat) {
            const n = nbArticlesCategorie(aSupprimerCat.id)
            await deleteClassification('categories', aSupprimerCat.id)
            toast(`Catégorie supprimée : ${n} article(s) dissocié(s) automatiquement. Les articles sont conservés.`, 'info')
          }
          setASupprimerCat(null)
        })}
        title="Supprimer cette catégorie ?"
        confirmLabel="Supprimer la catégorie"
      >
        <p>
          La catégorie « {aSupprimerCat?.nom} » est utilisée par{' '}
          <strong>{aSupprimerCat ? nbArticlesCategorie(aSupprimerCat.id) : 0} article(s)</strong>
          {' '}et {db.categories.find(item => item.id === aSupprimerCat?.id)?.mediaCount ?? 0} média(s).
          En confirmant, elle sera supprimée et les articles concernés seront automatiquement
          dissociés. Les médias utilisant cette catégorie seront aussi dissociés. Les articles et fichiers sont conservés.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={!!aSupprimerTag}
        onClose={() => setASupprimerTag(null)}
        onConfirm={() => effectuer(async () => {
          if (aSupprimerTag) {
            const n = nbArticlesTag(aSupprimerTag.id)
            await deleteClassification('tags', aSupprimerTag.id)
            toast(`Tag supprimé : ${n} article(s) dissocié(s) automatiquement. Les articles sont conservés.`, 'info')
          }
          setASupprimerTag(null)
        })}
        title="Supprimer ce tag ?"
        confirmLabel="Supprimer le tag"
      >
        <p>
          Le tag « {aSupprimerTag?.nom} » est utilisé par{' '}
          <strong>{aSupprimerTag ? nbArticlesTag(aSupprimerTag.id) : 0} article(s)</strong>
          {' '}et {db.tags.find(item => item.id === aSupprimerTag?.id)?.mediaCount ?? 0} média(s). En
          confirmant, il sera supprimé et les articles concernés seront automatiquement dissociés.
          Les médias utilisant ce tag seront aussi dissociés. Les articles et fichiers sont conservés.
        </p>
      </ConfirmDialog>
    </>
  )
}

