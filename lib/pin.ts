export async function hashPin(pin: string, userId: string): Promise<string> {
  const data = new TextEncoder().encode(pin + userId)
  const buffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function verifyPin(pin: string, userId: string, storedHash: string): Promise<boolean> {
  const computed = await hashPin(pin, userId)
  return computed === storedHash
}
