BEGIN;
CREATE TYPE "public_name_format" AS ENUM ('FULL', 'INITIAL', 'ADMIN');
ALTER TABLE "profiles" ADD COLUMN "public_name_format" "public_name_format" NOT NULL DEFAULT 'INITIAL';
ALTER TABLE "article_versions" ADD COLUMN "author_name_format" "public_name_format";
ALTER TABLE "comments" ADD COLUMN "public_name_format" "public_name_format";
ALTER TABLE "media" ADD COLUMN "gpx_elevations" JSONB;

CREATE TABLE "_MediaCategories" (
    "A" UUID NOT NULL REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "B" UUID NOT NULL REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_MediaCategories_AB_pkey" PRIMARY KEY ("A", "B")
);
CREATE INDEX "_MediaCategories_B_index" ON "_MediaCategories"("B");

CREATE TABLE "_MediaTags" (
    "A" UUID NOT NULL REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "B" UUID NOT NULL REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_MediaTags_AB_pkey" PRIMARY KEY ("A", "B")
);
CREATE INDEX "_MediaTags_B_index" ON "_MediaTags"("B");
COMMIT;
