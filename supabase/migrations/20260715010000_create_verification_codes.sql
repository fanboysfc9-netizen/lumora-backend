CREATE TABLE IF NOT EXISTS public.verification_codes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, email text NOT NULL, code text NOT NULL, expires_at timestamptz NOT NULL, used boolean DEFAULT false NOT NULL, created_at timestamptz DEFAULT now() NOT NULL);
ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "verification_codes_owner_only" ON public.verification_codes FOR SELECT USING (auth.role() = 'service_role' OR user_id = auth.uid()::uuid);
CREATE POLICY "verification_codes_owner_update" ON public.verification_codes FOR UPDATE USING (auth.role() = 'service_role' OR user_id = auth.uid()::uuid);
