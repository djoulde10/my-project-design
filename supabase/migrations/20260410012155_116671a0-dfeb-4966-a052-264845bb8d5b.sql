
-- Add is_published to sessions
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false;

-- Add is_published to minutes
ALTER TABLE public.minutes ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false;
