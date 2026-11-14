BEGIN;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS community_preferences jsonb;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_community_preferences_object;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_community_preferences_object
  CHECK(community_preferences IS NULL OR jsonb_typeof(community_preferences)='object');
COMMENT ON COLUMN public.profiles.community_preferences IS 'Private recommendation scope and campus reference. Does not change public affiliation and contains no GPS or diagnosis.';
NOTIFY pgrst,'reload schema';
COMMIT;
