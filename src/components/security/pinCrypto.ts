export const AUTO_LOCK_TIMEOUT_MS = 2 * 60 * 1000

export const EASTERN_ARABIC_DIGITS: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
}

/**
 * Simple SHA-256 hash helper using Web Crypto API.
 */
export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(pin)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = window.atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

export async function registerBiometricCredential(
  uid: string,
  displayName: string
): Promise<boolean> {
  if (
    typeof window === 'undefined' ||
    !window.PublicKeyCredential ||
    typeof navigator.credentials?.create !== 'function'
  ) {
    return false
  }

  try {
    const challenge = new Uint8Array(32)
    crypto.getRandomValues(challenge)

    const encoder = new TextEncoder()
    const userId = encoder.encode(uid)

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: 'بَصير (Baseer)',
          id: window.location.hostname || undefined,
        },
        user: {
          id: userId,
          name: displayName || uid,
          displayName: displayName || uid,
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },
          { alg: -257, type: 'public-key' },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
        },
        timeout: 60000,
        attestation: 'none',
      },
    })) as PublicKeyCredential | null

    if (!credential || !credential.rawId) return false

    const credId = arrayBufferToBase64(credential.rawId)
    localStorage.setItem(`baseer_biometrics_cred_${uid}`, credId)
    return true
  } catch (err) {
    console.warn('Biometric registration failed:', err)
    return false
  }
}

export async function verifyBiometricCredential(uid: string): Promise<boolean> {
  if (
    typeof window === 'undefined' ||
    !window.PublicKeyCredential ||
    typeof navigator.credentials?.get !== 'function'
  ) {
    return false
  }

  try {
    const challenge = new Uint8Array(32)
    crypto.getRandomValues(challenge)

    const storedCredId = localStorage.getItem(`baseer_biometrics_cred_${uid}`)
    const allowCredentials: PublicKeyCredentialDescriptor[] = []

    if (storedCredId) {
      try {
        allowCredentials.push({
          id: base64ToArrayBuffer(storedCredId),
          type: 'public-key',
        })
      } catch {
        // ignore malformed stored cred id
      }
    }

    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge,
        userVerification: 'required',
        allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
        timeout: 60000,
      },
    })) as PublicKeyCredential | null

    return Boolean(assertion && assertion.id)
  } catch (err) {
    console.warn('Biometric verification failed:', err)
    return false
  }
}
