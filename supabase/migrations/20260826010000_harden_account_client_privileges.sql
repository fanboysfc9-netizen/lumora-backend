-- Keep account and entitlement authority server-controlled.
REVOKE ALL ON public.profiles, public.plans, public.subscriptions, public.entitlements, public.usage_counters FROM anon, authenticated;
GRANT SELECT ON public.profiles, public.plans, public.subscriptions, public.entitlements, public.usage_counters TO authenticated;
