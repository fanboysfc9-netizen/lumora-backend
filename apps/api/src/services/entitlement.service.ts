import { getCurrentEntitlements, getCurrentPlan, getCurrentSubscription, VerifiedAuth } from './account.service'

export type Entitlement = { feature_key: string; feature_value: unknown }

export function resolveEntitlements(
  subscription: { status?: string; plan_id?: string } | null,
  plan: { id?: string; is_active?: boolean } | null,
  entitlements: Entitlement[] | null | undefined
): Entitlement[] {
  if (!subscription || !plan || !plan.is_active) return []
  if (!['active', 'trialing'].includes(subscription.status || '')) return []
  if (subscription.plan_id !== plan.id) return []
  return (entitlements || []).filter((item) => Boolean(item.feature_key))
}

export async function getUserEntitlements(auth: VerifiedAuth) {
  const [subscription, plan, entitlements] = await Promise.all([
    getCurrentSubscription(auth),
    getCurrentPlan(auth),
    getCurrentEntitlements(auth)
  ]) as [any, any, Entitlement[]]
  return resolveEntitlements(subscription, plan, entitlements)
}

export async function hasEntitlement(auth: VerifiedAuth, featureKey: string) {
  if (!featureKey) return false
  const entitlements = await getUserEntitlements(auth)
  return entitlements.some((item) => item.feature_key === featureKey)
}

export default { getUserEntitlements, hasEntitlement, resolveEntitlements }
