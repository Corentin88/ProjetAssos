BEGIN;

ALTER TYPE "block_type" ADD VALUE 'CAROUSEL';

ALTER TABLE "categories"
  ADD COLUMN "icon" VARCHAR(40),
  ADD COLUMN "visual_media_id" UUID,
  ADD CONSTRAINT "categories_one_visual_check" CHECK ("icon" IS NULL OR "visual_media_id" IS NULL),
  ADD CONSTRAINT "categories_visual_media_id_fkey" FOREIGN KEY ("visual_media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE INDEX "categories_visual_media_id_idx" ON "categories"("visual_media_id");

CREATE TABLE "article_block_images" (
  "block_id" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "media_id" UUID NOT NULL,
  "alt" VARCHAR(1000) NOT NULL,
  "caption" VARCHAR(1000),
  CONSTRAINT "article_block_images_pkey" PRIMARY KEY ("block_id", "position"),
  CONSTRAINT "article_block_images_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "article_blocks"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "article_block_images_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);

CREATE INDEX "article_block_images_media_id_idx" ON "article_block_images"("media_id");

COMMIT;
