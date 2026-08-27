-- Create a simple touch_updated_at trigger function
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN NEW.updated_at = now(); END IF;
  RETURN NEW;
END;
$$ SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.touch_updated_at() TO service_role;
