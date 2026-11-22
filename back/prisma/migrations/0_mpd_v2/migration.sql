-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."activity_action" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'SUSPEND', 'REACTIVATE', 'CHANGE_ROLE', 'PUBLISH', 'SCHEDULE', 'CANCEL_SCHEDULE', 'TRASH', 'RESTORE');

-- CreateEnum
CREATE TYPE "public"."article_status" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'TRASHED');

-- CreateEnum
CREATE TYPE "public"."comment_status" AS ENUM ('PUBLISHED', 'DELETED_BY_AUTHOR', 'DELETED_BY_ADMIN');

-- CreateEnum
CREATE TYPE "public"."media_type" AS ENUM ('IMAGE', 'PDF', 'GPX');

-- CreateEnum
CREATE TYPE "public"."moderation_action" AS ENUM ('UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "public"."notification_type" AS ENUM ('REPLY', 'ACCOUNT', 'MODERATION', 'INTERACTION');

-- CreateEnum
CREATE TYPE "public"."trail_difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "public"."user_role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "public"."user_status" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateTable
CREATE TABLE "public"."activity_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "action" "public"."activity_action" NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."article_media" (
    "article_id" UUID NOT NULL,
    "media_id" UUID NOT NULL,

    CONSTRAINT "article_media_pkey" PRIMARY KEY ("article_id","media_id")
);

-- CreateTable
CREATE TABLE "public"."article_tags" (
    "article_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "article_tags_pkey" PRIMARY KEY ("article_id","tag_id")
);

-- CreateTable
CREATE TABLE "public"."articles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "category_id" UUID,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "status" "public"."article_status" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."associations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "address" TEXT,
    "email" VARCHAR(254),
    "phone" VARCHAR(20),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "associations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."comment_moderations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "comment_id" UUID NOT NULL,
    "user_id" UUID,
    "action" "public"."moderation_action" NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_moderations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."comments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "article_id" UUID NOT NULL,
    "parent_id" UUID,
    "content" TEXT,
    "status" "public"."comment_status" NOT NULL DEFAULT 'PUBLISHED',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."contact_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."media" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "association_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "type" "public"."media_type" NOT NULL,
    "path" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "type" "public"."notification_type" NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."password_resets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "avatar_media_id" UUID,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "refresh_token_hash" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."trails" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "gpx_media_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "distance" DOUBLE PRECISION NOT NULL,
    "elevation_gain" DOUBLE PRECISION NOT NULL,
    "elevation_loss" DOUBLE PRECISION NOT NULL,
    "duration" INTEGER NOT NULL,
    "difficulty" "public"."trail_difficulty" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(254) NOT NULL,
    "password_hash" VARCHAR(255),
    "role" "public"."user_role" NOT NULL DEFAULT 'USER',
    "status" "public"."user_status" NOT NULL DEFAULT 'ACTIVE',
    "google_id" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_activity_logs_user_id" ON "public"."activity_logs"("user_id" ASC);

-- CreateIndex
CREATE INDEX "idx_article_media_media_id" ON "public"."article_media"("media_id" ASC);

-- CreateIndex
CREATE INDEX "idx_article_tags_tag_id" ON "public"."article_tags"("tag_id" ASC);

-- CreateIndex
CREATE INDEX "idx_articles_category_id" ON "public"."articles"("category_id" ASC);

-- CreateIndex
CREATE INDEX "idx_articles_user_id" ON "public"."articles"("user_id" ASC);

-- Contrainte unique du MPD V2.
ALTER TABLE "public"."categories" ADD CONSTRAINT "categories_name_key" UNIQUE ("name");

-- CreateIndex
CREATE INDEX "idx_comment_moderations_comment_id" ON "public"."comment_moderations"("comment_id" ASC);

-- CreateIndex
CREATE INDEX "idx_comment_moderations_user_id" ON "public"."comment_moderations"("user_id" ASC);

-- CreateIndex
CREATE INDEX "idx_comments_article_id" ON "public"."comments"("article_id" ASC);

-- CreateIndex
CREATE INDEX "idx_comments_parent_id" ON "public"."comments"("parent_id" ASC);

-- CreateIndex
CREATE INDEX "idx_comments_user_id" ON "public"."comments"("user_id" ASC);

-- CreateIndex
CREATE INDEX "idx_media_association_id" ON "public"."media"("association_id" ASC);

-- CreateIndex
CREATE INDEX "idx_notifications_user_id" ON "public"."notifications"("user_id" ASC);

-- CreateIndex
CREATE INDEX "idx_password_resets_user_id" ON "public"."password_resets"("user_id" ASC);

-- Contrainte unique du MPD V2.
ALTER TABLE "public"."password_resets" ADD CONSTRAINT "password_resets_token_hash_key" UNIQUE ("token_hash");

-- CreateIndex
CREATE INDEX "idx_profiles_avatar_media_id" ON "public"."profiles"("avatar_media_id" ASC);

-- Contrainte unique du MPD V2.
ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_user_id_key" UNIQUE ("user_id");

-- CreateIndex
CREATE INDEX "idx_sessions_user_id" ON "public"."sessions"("user_id" ASC);

-- Contrainte unique du MPD V2.
ALTER TABLE "public"."sessions" ADD CONSTRAINT "sessions_refresh_token_hash_key" UNIQUE ("refresh_token_hash");

-- Contrainte unique du MPD V2.
ALTER TABLE "public"."tags" ADD CONSTRAINT "tags_name_key" UNIQUE ("name");

-- CreateIndex
CREATE INDEX "idx_trails_gpx_media_id" ON "public"."trails"("gpx_media_id" ASC);

-- Contrainte unique du MPD V2.
ALTER TABLE "public"."users" ADD CONSTRAINT "users_email_key" UNIQUE ("email");

-- Contrainte unique du MPD V2.
ALTER TABLE "public"."users" ADD CONSTRAINT "users_google_id_key" UNIQUE ("google_id");

-- AddForeignKey
ALTER TABLE "public"."activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."article_media" ADD CONSTRAINT "article_media_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."article_media" ADD CONSTRAINT "article_media_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."article_tags" ADD CONSTRAINT "article_tags_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."article_tags" ADD CONSTRAINT "article_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."articles" ADD CONSTRAINT "articles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."articles" ADD CONSTRAINT "articles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."comment_moderations" ADD CONSTRAINT "comment_moderations_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."comment_moderations" ADD CONSTRAINT "comment_moderations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."comments" ADD CONSTRAINT "comments_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."comments" ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."comments" ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."media" ADD CONSTRAINT "media_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."password_resets" ADD CONSTRAINT "password_resets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_avatar_media_id_fkey" FOREIGN KEY ("avatar_media_id") REFERENCES "public"."media"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."trails" ADD CONSTRAINT "trails_gpx_media_id_fkey" FOREIGN KEY ("gpx_media_id") REFERENCES "public"."media"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- Contraintes du MPD relevées sur la base existante, hors diff Prisma.
ALTER TABLE public.comments ADD CONSTRAINT chk_comments_parent CHECK (parent_id IS NULL OR parent_id <> id);
ALTER TABLE public.trails
    ADD CONSTRAINT trails_distance_check CHECK (distance >= 0),
    ADD CONSTRAINT trails_duration_check CHECK (duration >= 0),
    ADD CONSTRAINT trails_elevation_gain_check CHECK (elevation_gain >= 0),
    ADD CONSTRAINT trails_elevation_loss_check CHECK (elevation_loss >= 0);
ALTER TABLE public.users ADD CONSTRAINT users_check CHECK (password_hash IS NOT NULL OR google_id IS NOT NULL);
