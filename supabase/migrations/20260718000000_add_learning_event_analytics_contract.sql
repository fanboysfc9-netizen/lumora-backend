ALTER TABLE public.learning_events
  ADD COLUMN IF NOT EXISTS session_id text,
  ADD COLUMN IF NOT EXISTS interaction_id text,
  ADD COLUMN IF NOT EXISTS correctness numeric(5,4),
  ADD COLUMN IF NOT EXISTS response_latency_ms integer,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS clarification_indicators jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS confusion_indicators jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.learning_events ALTER COLUMN source SET DEFAULT 'chat';
CREATE UNIQUE INDEX IF NOT EXISTS learning_events_user_interaction_unique ON public.learning_events (user_id, interaction_id) WHERE interaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS learning_events_user_created_idx ON public.learning_events (user_id, created_at DESC);
