BEGIN;

ALTER TABLE "articles" ADD COLUMN "carousel_position" INTEGER;

ALTER TABLE "articles" ADD CONSTRAINT "articles_carousel_position_eligible_check"
  CHECK ("carousel_position" IS NULL OR ("status" = 'PUBLISHED' AND "carousel_position" BETWEEN 1 AND 3));

CREATE UNIQUE INDEX "articles_carousel_position_key" ON "articles" ("carousel_position");

COMMIT;
