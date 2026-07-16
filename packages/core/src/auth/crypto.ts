/**
 * Generate cryptographically secure random bytes and return as base64url string.
 */
export function generateRandomBase64url(byteLength: number = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64urlEncode(bytes);
}

/**
 * Encode a Uint8Array to a base64url string (RFC 4648 §5).
 */
export function base64urlEncode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Compute SHA-256 hash of a string and return as base64url.
 * Used for PKCE code_challenge = BASE64URL(SHA256(code_verifier)).
 */
export async function sha256Base64url(input: string): Promise<string> {
  if (typeof crypto === 'undefined' || typeof crypto.subtle === 'undefined') {
    throw new Error(
      'Web Crypto API is unavailable. PKCE requires a secure context (HTTPS or localhost). ' +
        'If serving insecurely, use a local HTTPS server.'
    );
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  let hashBuffer: ArrayBuffer;
  try {
    hashBuffer = await crypto.subtle.digest('SHA-256', data);
  } catch (err) {
    throw new Error(`SHA-256 digest failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  return base64urlEncode(new Uint8Array(hashBuffer));
}
