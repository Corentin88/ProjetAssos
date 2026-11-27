BEGIN;

ALTER TABLE public.article_blocks
    DROP CONSTRAINT article_blocks_media_coherent,
    ADD CONSTRAINT article_blocks_media_coherent
        CHECK ((type IN ('IMAGE', 'PDF')) = (media_id IS NOT NULL));

-- Les blocs Image et PDF partagent la clé étrangère, chacun avec son propre type de média.
DROP TRIGGER article_blocks_media_image ON public.article_blocks;

CREATE TRIGGER article_blocks_media_image
BEFORE INSERT OR UPDATE OF type, media_id ON public.article_blocks
FOR EACH ROW WHEN (NEW.type = 'IMAGE')
EXECUTE FUNCTION public.verifier_type_media('media_id', 'IMAGE');

CREATE TRIGGER article_blocks_media_pdf
BEFORE INSERT OR UPDATE OF type, media_id ON public.article_blocks
FOR EACH ROW WHEN (NEW.type = 'PDF')
EXECUTE FUNCTION public.verifier_type_media('media_id', 'PDF');

COMMIT;
