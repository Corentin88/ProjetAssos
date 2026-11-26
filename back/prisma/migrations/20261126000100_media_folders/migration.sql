BEGIN;

CREATE TABLE "media_folders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "parent_id" UUID,
    CONSTRAINT "media_folders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "media_folders_no_self_parent" CHECK ("id" <> "parent_id"),
    CONSTRAINT "media_folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "media_folders"("id") ON DELETE SET NULL ON UPDATE NO ACTION
);

ALTER TABLE "media" ADD COLUMN "folder_id" UUID;
ALTER TABLE "media" ADD CONSTRAINT "media_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "media_folders"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

CREATE INDEX "idx_media_folders_parent_id" ON "media_folders"("parent_id");
CREATE INDEX "idx_media_folder_id" ON "media"("folder_id");

COMMIT;
