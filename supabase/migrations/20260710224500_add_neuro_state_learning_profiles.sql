-- Add neuro-adaptive learning profile fields
ALTER TABLE public.learning_profiles
  ADD COLUMN preferred_mode TEXT NOT NULL DEFAULT 'Concept Builder',
  ADD COLUMN neuro_state JSONB NOT NULL DEFAULT '{}'::jsonb;
