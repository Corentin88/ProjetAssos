BEGIN;

ALTER TABLE "profiles"
    DROP CONSTRAINT "profiles_avatar_coherent",
    ADD CONSTRAINT "profiles_avatar_coherent" CHECK (
        ("avatar_kind" <> 'PERSONAL' OR "avatar_media_id" IS NOT NULL)
        AND ("avatar_kind" = 'PRESET') = ("avatar_preset" IS NOT NULL)
        AND ("avatar_kind" <> 'GOOGLE' OR "google_avatar" IS NOT NULL)
    );

COMMIT;
