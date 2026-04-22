async function getUserById(userId: string) {
  const res = await fetch(`/api/auth/users/${encodeURIComponent(userId)}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.user ?? null;
}

export { getUserById };