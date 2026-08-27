ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS intelligence_mode text NOT NULL DEFAULT 'standard';
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_intelligence_mode_check') THEN ALTER TABLE public.profiles ADD CONSTRAINT profiles_intelligence_mode_check CHECK (intelligence_mode IN ('standard', 'web', 'hybrid')); END IF; END $$;
