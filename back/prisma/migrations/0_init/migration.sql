BEGIN;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "avatar_kind" AS ENUM ('DEFAULT', 'PRESET', 'PERSONAL', 'GOOGLE');

-- CreateEnum
CREATE TYPE "account_token_purpose" AS ENUM ('PASSWORD_RESET', 'INVITATION', 'EMAIL_CHANGE');

-- CreateEnum
CREATE TYPE "article_status" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'TRASHED');

-- CreateEnum
CREATE TYPE "article_version_kind" AS ENUM ('WORKING', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "block_type" AS ENUM ('HEADING', 'SUBHEADING', 'PARAGRAPH', 'IMAGE', 'YOUTUBE', 'LIST', 'LINK', 'QUOTE');

-- CreateEnum
CREATE TYPE "comment_status" AS ENUM ('PUBLISHED', 'DELETED_BY_AUTHOR', 'DELETED_BY_ADMIN');

-- CreateEnum
CREATE TYPE "moderation_reason" AS ENUM ('SPAM', 'INAPPROPRIATE', 'OFF_TOPIC', 'ILLEGAL', 'OTHER');

-- CreateEnum
CREATE TYPE "media_type" AS ENUM ('IMAGE', 'PDF', 'GPX');

-- CreateEnum
CREATE TYPE "media_format" AS ENUM ('JPEG', 'PNG', 'WEBP', 'PDF', 'GPX');

-- CreateEnum
CREATE TYPE "trail_difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('REPLY', 'ACCOUNT', 'MODERATION', 'INTERACTION');

-- CreateEnum
CREATE TYPE "activity_action" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'SUSPEND', 'REACTIVATE', 'CHANGE_ROLE', 'PUBLISH', 'SCHEDULE', 'CANCEL_SCHEDULE', 'TRASH', 'RESTORE', 'UNPUBLISH');

-- CreateEnum
CREATE TYPE "activity_target" AS ENUM ('ACCOUNT', 'ARTICLE', 'CATEGORY', 'TAG', 'COMMENT', 'MEDIA', 'ASSOCIATION', 'CONTACT_MESSAGE', 'ACTIVITY_LOG');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(254) NOT NULL,
    "password_hash" VARCHAR(255),
    "google_id" VARCHAR(255),
    "password_setup_pending" BOOLEAN NOT NULL DEFAULT false,
    "role" "user_role" NOT NULL DEFAULT 'USER',
    "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "login_blocked_until" TIMESTAMPTZ(6),
    "last_active_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "avatar_kind" "avatar_kind" NOT NULL DEFAULT 'DEFAULT',
    "avatar_media_id" UUID,
    "avatar_preset" TEXT,
    "google_avatar" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "purpose" "account_token_purpose" NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "new_email" VARCHAR(254),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "account_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "articles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "slug" VARCHAR(255) NOT NULL,
    "status" "article_status" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ(6),
    "scheduled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "article_id" UUID NOT NULL,
    "kind" "article_version_kind" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "cover_media_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_blocks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "version_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "type" "block_type" NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "media_id" UUID,

    CONSTRAINT "article_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_categories" (
    "version_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,

    CONSTRAINT "article_categories_pkey" PRIMARY KEY ("version_id","category_id")
);

-- CreateTable
CREATE TABLE "article_tags" (
    "version_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "article_tags_pkey" PRIMARY KEY ("version_id","tag_id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "article_id" UUID NOT NULL,
    "parent_id" UUID,
    "content" TEXT,
    "status" "comment_status" NOT NULL DEFAULT 'PUBLISHED',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment_edits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "comment_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "edited_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_edits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment_moderations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "comment_id" UUID NOT NULL,
    "user_id" UUID,
    "reason" "moderation_reason" NOT NULL,
    "details" TEXT,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_moderations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "associations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "address" TEXT,
    "postal_code" TEXT,
    "city" TEXT,
    "email" VARCHAR(254),
    "phone" VARCHAR(20),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "hours" TEXT,
    "social_links" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "associations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "association_blocks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "association_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "type" "block_type" NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "media_id" UUID,

    CONSTRAINT "association_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "type" "media_type" NOT NULL,
    "format" "media_format" NOT NULL,
    "path" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "alt_text" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trails" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "version_id" UUID NOT NULL,
    "gpx_media_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "distance" DOUBLE PRECISION NOT NULL,
    "elevation_gain" DOUBLE PRECISION NOT NULL,
    "elevation_loss" DOUBLE PRECISION NOT NULL,
    "duration" INTEGER NOT NULL,
    "difficulty" "trail_difficulty" NOT NULL,
    "map_preview" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "article_id" UUID,
    "comment_id" UUID,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "type" "notification_type" NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "replied_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "action" "activity_action" NOT NULL,
    "target" "activity_target" NOT NULL,
    "target_id" UUID,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- CreateIndex
CREATE INDEX "users_role_status_idx" ON "users"("role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_user_id_key" ON "profiles"("user_id");

-- CreateIndex
CREATE INDEX "idx_profiles_avatar_media_id" ON "profiles"("avatar_media_id");

-- CreateIndex
CREATE INDEX "idx_sessions_user_id" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_session_id_idx" ON "refresh_tokens"("session_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "account_tokens_token_hash_key" ON "account_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "account_tokens_user_id_purpose_idx" ON "account_tokens"("user_id", "purpose");

-- CreateIndex
CREATE INDEX "account_tokens_expires_at_idx" ON "account_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "articles_slug_key" ON "articles"("slug");

-- CreateIndex
CREATE INDEX "idx_articles_user_id" ON "articles"("user_id");

-- CreateIndex
CREATE INDEX "articles_status_published_at_idx" ON "articles"("status", "published_at");

-- CreateIndex
CREATE INDEX "articles_status_scheduled_at_idx" ON "articles"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "article_versions_cover_media_id_idx" ON "article_versions"("cover_media_id");

-- CreateIndex
CREATE UNIQUE INDEX "article_versions_article_id_kind_key" ON "article_versions"("article_id", "kind");

-- CreateIndex
CREATE INDEX "article_blocks_media_id_idx" ON "article_blocks"("media_id");

-- CreateIndex
CREATE UNIQUE INDEX "article_blocks_version_id_position_key" ON "article_blocks"("version_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- CreateIndex
CREATE INDEX "article_categories_category_id_idx" ON "article_categories"("category_id");

-- CreateIndex
CREATE INDEX "idx_article_tags_tag_id" ON "article_tags"("tag_id");

-- CreateIndex
CREATE INDEX "idx_comments_user_id" ON "comments"("user_id");

-- CreateIndex
CREATE INDEX "comments_article_id_created_at_idx" ON "comments"("article_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_comments_parent_id" ON "comments"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "comments_article_id_id_key" ON "comments"("article_id", "id");

-- CreateIndex
CREATE INDEX "comment_edits_comment_id_edited_at_idx" ON "comment_edits"("comment_id", "edited_at");

-- CreateIndex
CREATE UNIQUE INDEX "comment_moderations_comment_id_key" ON "comment_moderations"("comment_id");

-- CreateIndex
CREATE INDEX "idx_comment_moderations_user_id" ON "comment_moderations"("user_id");

-- CreateIndex
CREATE INDEX "comment_moderations_created_at_idx" ON "comment_moderations"("created_at");

-- CreateIndex
CREATE INDEX "association_blocks_media_id_idx" ON "association_blocks"("media_id");

-- CreateIndex
CREATE UNIQUE INDEX "association_blocks_association_id_position_key" ON "association_blocks"("association_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "media_path_key" ON "media"("path");

-- CreateIndex
CREATE UNIQUE INDEX "trails_version_id_key" ON "trails"("version_id");

-- CreateIndex
CREATE INDEX "idx_trails_gpx_media_id" ON "trails"("gpx_media_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_created_at_idx" ON "notifications"("user_id", "is_read", "created_at");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE INDEX "notifications_article_id_idx" ON "notifications"("article_id");

-- CreateIndex
CREATE INDEX "notifications_comment_id_idx" ON "notifications"("comment_id");

-- CreateIndex
CREATE INDEX "contact_messages_is_read_created_at_idx" ON "contact_messages"("is_read", "created_at");

-- CreateIndex
CREATE INDEX "activity_logs_user_id_created_at_idx" ON "activity_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "activity_logs_action_created_at_idx" ON "activity_logs"("action", "created_at");

-- CreateIndex
CREATE INDEX "activity_logs_target_target_id_created_at_idx" ON "activity_logs"("target", "target_id", "created_at");

-- CreateIndex
CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs"("created_at");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_avatar_media_id_fkey" FOREIGN KEY ("avatar_media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "account_tokens" ADD CONSTRAINT "account_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "article_versions" ADD CONSTRAINT "article_versions_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "article_versions" ADD CONSTRAINT "article_versions_cover_media_id_fkey" FOREIGN KEY ("cover_media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "article_blocks" ADD CONSTRAINT "article_blocks_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "article_versions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "article_blocks" ADD CONSTRAINT "article_blocks_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "article_categories" ADD CONSTRAINT "article_categories_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "article_versions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "article_categories" ADD CONSTRAINT "article_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "article_tags" ADD CONSTRAINT "article_tags_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "article_versions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "article_tags" ADD CONSTRAINT "article_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_article_id_parent_id_fkey" FOREIGN KEY ("article_id", "parent_id") REFERENCES "comments"("article_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "comment_edits" ADD CONSTRAINT "comment_edits_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "comment_moderations" ADD CONSTRAINT "comment_moderations_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "comment_moderations" ADD CONSTRAINT "comment_moderations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "association_blocks" ADD CONSTRAINT "association_blocks_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "association_blocks" ADD CONSTRAINT "association_blocks_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "trails" ADD CONSTRAINT "trails_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "article_versions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "trails" ADD CONSTRAINT "trails_gpx_media_id_fkey" FOREIGN KEY ("gpx_media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- Contrôles hérités du MPD V2.
ALTER TABLE public.comments
    ADD CONSTRAINT chk_comments_parent CHECK (parent_id IS NULL OR parent_id <> id);

ALTER TABLE public.trails
    ADD CONSTRAINT trails_distance_check CHECK (distance >= 0),
    ADD CONSTRAINT trails_duration_check CHECK (duration >= 0),
    ADD CONSTRAINT trails_elevation_gain_check CHECK (elevation_gain >= 0),
    ADD CONSTRAINT trails_elevation_loss_check CHECK (elevation_loss >= 0);

-- Contraintes PostgreSQL hors schéma Prisma.
ALTER TABLE public.users
    ADD CONSTRAINT users_email_normalise CHECK (email = lower(btrim(email)) AND email <> ''),
    ADD CONSTRAINT users_identifiant_ou_invitation CHECK (
        (password_setup_pending AND password_hash IS NULL AND google_id IS NULL)
        OR (NOT password_setup_pending AND (password_hash IS NOT NULL OR google_id IS NOT NULL))
    ),
    ADD CONSTRAINT users_echecs_non_negatifs CHECK (failed_login_count >= 0);

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_avatar_coherent CHECK (
        (avatar_kind = 'PERSONAL') = (avatar_media_id IS NOT NULL)
        AND (avatar_kind = 'PRESET') = (avatar_preset IS NOT NULL)
        AND (avatar_kind <> 'GOOGLE' OR google_avatar IS NOT NULL)
    );

ALTER TABLE public.sessions
    ADD CONSTRAINT sessions_dates_coherentes CHECK (expires_at > created_at AND revoked_at >= created_at);

ALTER TABLE public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_dates_coherentes CHECK (
        expires_at > created_at AND consumed_at >= created_at AND revoked_at >= created_at
    );

ALTER TABLE public.account_tokens
    ADD CONSTRAINT account_tokens_adresse_coherente CHECK (
        (purpose = 'EMAIL_CHANGE') = (new_email IS NOT NULL)
        AND (new_email IS NULL OR (new_email = lower(btrim(new_email)) AND new_email <> ''))
    ),
    ADD CONSTRAINT account_tokens_dates_coherentes CHECK (
        expires_at > created_at AND consumed_at >= created_at AND revoked_at >= created_at
    );

ALTER TABLE public.articles
    ADD CONSTRAINT articles_dates_publication_coherentes CHECK (
        (status = 'SCHEDULED') = (scheduled_at IS NOT NULL)
        AND (status <> 'PUBLISHED' OR published_at IS NOT NULL)
    );

ALTER TABLE public.article_blocks
    ADD CONSTRAINT article_blocks_position_valide CHECK (position >= 0),
    ADD CONSTRAINT article_blocks_media_coherent CHECK ((type = 'IMAGE') = (media_id IS NOT NULL));

ALTER TABLE public.association_blocks
    ADD CONSTRAINT association_blocks_position_valide CHECK (position >= 0),
    ADD CONSTRAINT association_blocks_media_coherent CHECK ((type = 'IMAGE') = (media_id IS NOT NULL));

ALTER TABLE public.comments
    ADD CONSTRAINT comments_contenu_coherent CHECK (
        (status = 'PUBLISHED') = (content IS NOT NULL)
    );

ALTER TABLE public.comment_moderations
    ADD CONSTRAINT comment_moderations_precision_obligatoire CHECK (
        reason <> 'OTHER' OR nullif(btrim(details), '') IS NOT NULL
    );

ALTER TABLE public.associations
    ADD CONSTRAINT associations_position_carte_coherente CHECK (
        (latitude IS NULL) = (longitude IS NULL)
        AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180
    );

ALTER TABLE public.media
    ADD CONSTRAINT media_format_coherent CHECK (
        (type = 'IMAGE' AND format IN ('JPEG', 'PNG', 'WEBP'))
        OR (type = 'GPX' AND format = 'GPX')
        OR (type = 'PDF' AND format = 'PDF')
    ),
    ADD CONSTRAINT media_taille_positive CHECK (size_bytes > 0);

ALTER TABLE public.trails
    ADD CONSTRAINT trails_mesures_finies CHECK (
        distance < 'Infinity'::double precision
        AND elevation_gain < 'Infinity'::double precision
        AND elevation_loss < 'Infinity'::double precision
    ),
    ADD CONSTRAINT trails_apercu_carte_objet CHECK (jsonb_typeof(map_preview) = 'object');

-- Le profil peut être inséré après le compte dans la même transaction.
CREATE FUNCTION public.verifier_profil_du_compte() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    compte_id uuid;
BEGIN
    IF TG_TABLE_NAME = 'users' THEN
        compte_id := NEW.id;
    ELSE
        compte_id := OLD.user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM public.users WHERE id = compte_id)
       AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = compte_id) THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Un compte doit avoir un profil';
    END IF;
    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER users_profil_obligatoire
AFTER INSERT OR UPDATE OF id ON public.users
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.verifier_profil_du_compte();

CREATE CONSTRAINT TRIGGER profiles_compte_obligatoire
AFTER DELETE OR UPDATE OF user_id ON public.profiles
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.verifier_profil_du_compte();

-- Verrouiller un autre administrateur actif pour empêcher deux retraits simultanés.
CREATE FUNCTION public.proteger_dernier_administrateur() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.role <> 'ADMIN' OR OLD.status <> 'ACTIVE' OR OLD.password_setup_pending THEN
        RETURN NULL;
    END IF;
    IF TG_OP = 'UPDATE' THEN
        IF NEW.role = 'ADMIN' AND NEW.status = 'ACTIVE' AND NOT NEW.password_setup_pending THEN
            RETURN NULL;
        END IF;
    END IF;

    PERFORM id FROM public.users
    WHERE role = 'ADMIN' AND status = 'ACTIVE' AND NOT password_setup_pending
    ORDER BY id LIMIT 1 FOR NO KEY UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Le dernier administrateur actif doit être conservé';
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER users_dernier_administrateur
AFTER DELETE OR UPDATE OF role, status, password_setup_pending ON public.users
FOR EACH ROW EXECUTE FUNCTION public.proteger_dernier_administrateur();

-- La permutation des versions est atomique. Vérifier son résultat au commit.
CREATE FUNCTION public.verifier_version_publique_article() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    article_a_verifier uuid;
    etat public.article_status;
BEGIN
    IF TG_TABLE_NAME = 'articles' THEN
        article_a_verifier := NEW.id;
    ELSE
        article_a_verifier := OLD.article_id;
    END IF;

    SELECT status INTO etat FROM public.articles
    WHERE id = article_a_verifier FOR NO KEY UPDATE;

    IF etat = 'PUBLISHED' AND NOT EXISTS (
        SELECT 1 FROM public.article_versions
        WHERE article_id = article_a_verifier AND kind = 'PUBLISHED'
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Un article publié doit avoir une version publique';
    END IF;
    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER articles_version_publique_obligatoire
AFTER INSERT OR UPDATE OF status ON public.articles
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.verifier_version_publique_article();
CREATE CONSTRAINT TRIGGER article_versions_conserver_version_publique
AFTER DELETE OR UPDATE OF kind, article_id ON public.article_versions
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.verifier_version_publique_article();

-- L'appartenance à une discussion est fixée à la création. La FK composée
-- vérifie l'article et le déclencheur interdit les réponses imbriquées.
CREATE FUNCTION public.verifier_parent_commentaire() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF (NEW.article_id, NEW.parent_id) IS DISTINCT FROM (OLD.article_id, OLD.parent_id) THEN
            RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Une discussion ne peut pas être déplacée';
        END IF;
        RETURN NEW;
    END IF;

    IF NEW.parent_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.comments WHERE id = NEW.parent_id
        AND article_id = NEW.article_id AND parent_id IS NULL
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'La réponse doit viser un commentaire racine du même article';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER comments_parent_racine
BEFORE INSERT OR UPDATE OF article_id, parent_id ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.verifier_parent_commentaire();

-- Empêcher qu'un GPX soit rattaché à un emplacement d'image publique.
-- Le type du média reste fixe pour protéger les références existantes.
CREATE FUNCTION public.verifier_type_media() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    media_id uuid := (to_jsonb(NEW) ->> TG_ARGV[0])::uuid;
BEGIN
    IF media_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.media WHERE id = media_id AND type = TG_ARGV[1]::public.media_type
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Type de média incompatible avec cet usage';
    END IF;
    RETURN NEW;
END;
$$;

CREATE FUNCTION public.proteger_type_media() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.type IS DISTINCT FROM OLD.type THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Le type d’un média ne peut pas être modifié';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER media_type_fixe BEFORE UPDATE OF type ON public.media
FOR EACH ROW EXECUTE FUNCTION public.proteger_type_media();
CREATE TRIGGER profiles_avatar_image BEFORE INSERT OR UPDATE OF avatar_media_id ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.verifier_type_media('avatar_media_id', 'IMAGE');
CREATE TRIGGER article_versions_couverture_image BEFORE INSERT OR UPDATE OF cover_media_id ON public.article_versions
FOR EACH ROW EXECUTE FUNCTION public.verifier_type_media('cover_media_id', 'IMAGE');
CREATE TRIGGER article_blocks_media_image BEFORE INSERT OR UPDATE OF media_id ON public.article_blocks
FOR EACH ROW EXECUTE FUNCTION public.verifier_type_media('media_id', 'IMAGE');
CREATE TRIGGER association_blocks_media_image BEFORE INSERT OR UPDATE OF media_id ON public.association_blocks
FOR EACH ROW EXECUTE FUNCTION public.verifier_type_media('media_id', 'IMAGE');
CREATE TRIGGER trails_media_gpx BEFORE INSERT OR UPDATE OF gpx_media_id ON public.trails
FOR EACH ROW EXECUTE FUNCTION public.verifier_type_media('gpx_media_id', 'GPX');

COMMIT;
