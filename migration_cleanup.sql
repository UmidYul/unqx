ALTER TABLE public.profile_cards
  ADD COLUMN IF NOT EXISTS hashtag varchar(50),
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS postcode varchar(20),
  ADD COLUMN IF NOT EXISTS extra_phone varchar(30);
