CREATE TABLE IF NOT EXISTS public.profiles (id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, username text UNIQUE NOT NULL, email text UNIQUE NOT NULL, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.learning_profiles (id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE, strengths jsonb DEFAULT '{}'::jsonb, weaknesses jsonb DEFAULT '{}'::jsonb, preferred_style text, difficulty_level text, cognitive_load double precision, attention_stability double precision, retrieval_strength double precision, forgetting_probability double precision, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.student_progress (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, topic text, progress integer, updated_at timestamptz DEFAULT now());
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY; ALTER TABLE public.learning_profiles ENABLE ROW LEVEL SECURITY; ALTER TABLE public.student_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_is_owner" ON public.profiles FOR SELECT, UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "learning_profiles_is_owner" ON public.learning_profiles FOR SELECT, UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "student_progress_is_owner" ON public.student_progress FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
