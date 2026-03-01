import crypto from "crypto"

const WISE_API_BASE = "https://api.wise.com"

export function isWiseConfigured(): boolean {
  return !!process.env.WISE_API_TOKEN
}

export interface WiseBalance {
  id: number
  currency: string
  amount: {
    value: number
    currency: string
  }
  reservedAmount: {
    value: number
    currency: string
  }
  type: string
}

export async function getWiseBalances(profileId: string): Promise<WiseBalance[]> {
  const token = process.env.WISE_API_TOKEN
  if (!token) {
    throw new Error("WISE_API_TOKEN is not configured")
  }

  const res = await fetch(
    `${WISE_API_BASE}/v4/profiles/${profileId}/balances?types=STANDARD`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      next: { revalidate: 0 },
    }
  )

  if (!res.ok) {
    throw new Error(`Wise API error: ${res.status} ${res.statusText}`)
  }

  return res.json()
}

export function verifyWiseWebhook(body: string, signature: string): boolean {
  const publicKeyPem = process.env.WISE_WEBHOOK_PUBLIC_KEY
  if (!publicKeyPem) {
    return false
  }

  try {
    // The public key may have \n escaped as literal characters in env
    const key = publicKeyPem.replace(/\\n/g, "\n")
    return crypto.verify(
      "RSA-SHA256",
      Buffer.from(body),
      key,
      Buffer.from(signature, "base64")
    )
  } catch {
    return false
  }
}
