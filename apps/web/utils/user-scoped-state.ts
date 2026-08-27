export function userScopedStorageKey(name: string, userId: string | null | undefined) {
  return userId ? `${name}:${userId}` : null
}
