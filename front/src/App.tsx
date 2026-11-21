import { Navigate, Route, Routes } from 'react-router-dom'
import { ErreurBoundary } from './components/ErreurBoundary'
import { ToastProvider } from './hooks/useToast'
import { PublicLayout } from './components/layout/PublicLayout'
import { AdminLayout } from './components/layout/AdminLayout'
import { RequireAdmin, RequireAuth } from './components/layout/guards'

// Pages publiques
import { Accueil } from './pages/public/Accueil'
import { AssociationPage, Contact } from './pages/public/Contact'
import { Actualites } from './pages/public/Actualites'
import { RedirectionRecherche } from './pages/public/Recherche'
import { ArticleDetail } from './pages/public/ArticleDetail'
import { Connexion, Inscription, MotDePasseOublie, ReinitialiserMotDePasse } from './pages/public/AuthPages'
import { ProfilPublic, ProfilPublicCommentaires } from './pages/public/ProfilPublic'
import { Accessibilite, Confidentialite, MentionsLegales, PageIntrouvable } from './pages/public/LegalPages'

// Espace personnel (§13)
import { MonCompte } from './pages/compte/MonCompte'
import { Profil } from './pages/compte/Profil'
import { Securite } from './pages/compte/Securite'
import { MesCommentaires } from './pages/compte/MesCommentaires'
import { NotificationsPage } from './pages/compte/NotificationsPage'
import { SuppressionCompte } from './pages/compte/SuppressionCompte'

// Administration
import { Dashboard } from './pages/admin/Dashboard'
import { ArticlesAdmin } from './pages/admin/ArticlesAdmin'
import { ArticleEditor, ArticlePreview } from './pages/admin/ArticleEditor'
import { CategoriesTagsAdmin } from './pages/admin/CategoriesTagsAdmin'
import { CommentairesAdmin } from './pages/admin/CommentairesAdmin'
import { MediasAdmin } from './pages/admin/MediasAdmin'
import { UtilisateursAdmin, UtilisateurDetail } from './pages/admin/UtilisateursAdmin'
import { MessagesAdmin } from './pages/admin/MessagesAdmin'
import { AssociationAdmin } from './pages/admin/AssociationAdmin'
import { StatistiquesAdmin } from './pages/admin/StatistiquesAdmin'
import { JournalAdmin } from './pages/admin/JournalAdmin'

export default function App() {
  return (
    <ErreurBoundary>
      <ToastProvider>
        <Routes>
          {/* Site public */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Accueil />} />
            <Route path="/association" element={<AssociationPage />} />
            <Route path="/actualites" element={<Actualites />} />
            <Route path="/actualites/:slug" element={<ArticleDetail />} />
            {/* La recherche est intégrée à la page des actualités (brief V3 §2) :
                l'ancienne route redirige vers /actualites avec ses paramètres */}
            <Route path="/recherche" element={<RedirectionRecherche />} />
            <Route path="/contact" element={<Contact />} />

            {/* Authentification (§3 à §9) */}
            <Route path="/connexion" element={<Connexion />} />
            <Route path="/inscription" element={<Inscription />} />
            <Route path="/mot-de-passe-oublie" element={<MotDePasseOublie />} />
            <Route path="/reinitialiser-mot-de-passe" element={<ReinitialiserMotDePasse />} />

            {/* Profils publics (§14, §15) — réservés aux utilisateurs connectés */}
            <Route
              path="/profil/:id"
              element={
                <RequireAuth>
                  <ProfilPublic />
                </RequireAuth>
              }
            />
            <Route
              path="/profil/:id/commentaires"
              element={
                <RequireAuth>
                  <ProfilPublicCommentaires />
                </RequireAuth>
              }
            />

            {/* Pages légales et accessibilité */}
            <Route path="/mentions-legales" element={<MentionsLegales />} />
            <Route path="/confidentialite" element={<Confidentialite />} />
            <Route path="/accessibilite" element={<Accessibilite />} />

            {/* Espace personnel « Mon compte » (§13) */}
            <Route path="/mon-compte" element={<MonCompte />}>
              <Route index element={<Profil />} />
              <Route path="securite" element={<Securite />} />
              <Route path="mes-commentaires" element={<MesCommentaires />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="supprimer" element={<SuppressionCompte />} />
            </Route>

            <Route path="*" element={<PageIntrouvable />} />
          </Route>

          {/* Administration (§2.3, §37 à §41) */}
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <AdminLayout />
              </RequireAdmin>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="articles" element={<ArticlesAdmin />} />
            <Route path="articles/nouveau" element={<ArticleEditor />} />
            <Route path="articles/:id" element={<ArticleEditor />} />
            <Route path="articles/:id/preview" element={<ArticlePreview />} />
            <Route path="categories" element={<CategoriesTagsAdmin />} />
            <Route path="commentaires" element={<CommentairesAdmin />} />
            <Route path="medias" element={<MediasAdmin />} />
            <Route path="utilisateurs" element={<UtilisateursAdmin />} />
            <Route path="utilisateurs/:id" element={<UtilisateurDetail />} />
            <Route path="messages" element={<MessagesAdmin />} />
            <Route path="association" element={<AssociationAdmin />} />
            <Route path="statistiques" element={<StatistiquesAdmin />} />
            <Route path="journal" element={<JournalAdmin />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
        </Routes>
      </ToastProvider>
    </ErreurBoundary>
  )
}
