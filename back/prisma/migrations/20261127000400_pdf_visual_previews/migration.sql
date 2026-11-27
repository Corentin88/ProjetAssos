BEGIN;

ALTER TABLE public.media ADD COLUMN preview_of_id UUID;
CREATE UNIQUE INDEX media_preview_of_id_key ON public.media (preview_of_id);
ALTER TABLE public.media
  ADD CONSTRAINT media_preview_of_id_fkey FOREIGN KEY (preview_of_id)
    REFERENCES public.media (id) ON DELETE CASCADE ON UPDATE NO ACTION,
  ADD CONSTRAINT media_pdf_preview_coherent CHECK (
    preview_of_id IS NULL OR (type = 'IMAGE' AND format = 'PNG' AND preview_of_id <> id)
  );

CREATE TRIGGER media_preview_source_pdf BEFORE INSERT OR UPDATE OF preview_of_id ON public.media
FOR EACH ROW EXECUTE FUNCTION public.verifier_type_media('preview_of_id', 'PDF');

ALTER TABLE public.article_block_images
  ADD COLUMN view_pdf BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN download_pdf BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TRIGGER article_block_images_media_image BEFORE INSERT OR UPDATE OF media_id ON public.article_block_images
FOR EACH ROW EXECUTE FUNCTION public.verifier_type_media('media_id', 'IMAGE');

COMMIT;
