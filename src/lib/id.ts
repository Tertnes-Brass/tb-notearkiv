const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz'

/** Kort, URL-vennlig id (24 tegn, ~120 bits). */
export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  let out = ''
  for (const b of bytes) out += ALPHABET[b % 32]
  return out
}

/** Hemmelig token for delingslenker (40 tegn). */
export function newShareToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(40))
  let out = ''
  for (const b of bytes) out += ALPHABET[b % 32]
  return out
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
