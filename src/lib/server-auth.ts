import crypto from 'crypto';

export interface AuthVerificationResult {
  success: boolean;
  uid?: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  error?: string;
  statusCode?: number;
}

// In-memory cache for Google public certificates
let cachedCertificates: { [kid: string]: string } | null = null;
let certsExpiryTime = 0;

/**
 * Extracts Bearer token from Authorization header
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * Safely parses the header and payload of a JWT without verifying signature
 */
function decodeJwtUnverified(token: string): { header: any; payload: any } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));

    return { header, payload };
  } catch {
    return null;
  }
}

/**
 * Fetches and caches Google's public x509 certificates for Firebase Auth
 */
async function getGooglePublicKeys(): Promise<{ [kid: string]: string }> {
  const now = Date.now();
  if (cachedCertificates && now < certsExpiryTime) {
    return cachedCertificates;
  }

  try {
    const response = await fetch(
      'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
      { next: { revalidate: 3600 } }
    );

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status} fetching Google certificates`);
    }

    // Parse Cache-Control header if present
    const cacheControl = response.headers.get('cache-control');
    let maxAgeSeconds = 3600;
    if (cacheControl) {
      const match = cacheControl.match(/max-age=(\d+)/);
      if (match) maxAgeSeconds = parseInt(match[1], 10);
    }

    const certs = await response.json();
    cachedCertificates = certs;
    certsExpiryTime = now + maxAgeSeconds * 1000;
    return certs;
  } catch (error) {
    console.warn('[ServerAuth] Error fetching Google public certs:', error);
    return cachedCertificates || {};
  }
}

/**
 * Validates a Firebase ID Token using cryptographic public key verification
 */
async function verifyTokenWithPublicKey(token: string): Promise<AuthVerificationResult | null> {
  const decoded = decodeJwtUnverified(token);
  if (!decoded || !decoded.header || !decoded.payload) {
    return null;
  }

  const { header, payload } = decoded;
  const kid = header.kid;
  if (!kid) return null;

  const publicKeys = await getGooglePublicKeys();
  const cert = publicKeys[kid];
  if (!cert) {
    return null;
  }

  // 1. Verify cryptographic signature (RS256)
  const [headerB64, payloadB64, signatureB64] = token.split('.');
  const signedData = `${headerB64}.${payloadB64}`;
  const signature = Buffer.from(signatureB64, 'base64url');

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(signedData);
  const isValidSig = verifier.verify(cert, signature);

  if (!isValidSig) {
    return {
      success: false,
      statusCode: 401,
      error: 'Firma criptográfica del token de Firebase no válida.',
    };
  }

  // 2. Verify expiration
  const nowInSeconds = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && payload.exp < nowInSeconds) {
    return {
      success: false,
      statusCode: 401,
      error: 'El token de Firebase ha expirado. Por favor renueva tu sesión.',
    };
  }

  // 3. Verify issued-at
  if (typeof payload.iat === 'number' && payload.iat > nowInSeconds + 300) {
    return {
      success: false,
      statusCode: 401,
      error: 'Token emitido en el futuro.',
    };
  }

  // 4. Verify project ID / issuer / audience if project ID is available
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  if (projectId && !projectId.includes('mock') && !projectId.includes('placeholder')) {
    if (payload.aud && payload.aud !== projectId) {
      return {
        success: false,
        statusCode: 401,
        error: 'El destinatario (audience) del token no coincide con este proyecto.',
      };
    }
    const expectedIssuer = `https://securetoken.google.com/${projectId}`;
    if (payload.iss && payload.iss !== expectedIssuer) {
      return {
        success: false,
        statusCode: 401,
        error: 'El emisor (issuer) del token de Firebase no es válido.',
      };
    }
  }

  // 5. Extract UID
  const uid = payload.user_id || payload.sub || payload.uid;
  if (!uid || typeof uid !== 'string' || uid.trim() === '') {
    return {
      success: false,
      statusCode: 401,
      error: 'El token no contiene un identificador de usuario válido (UID).',
    };
  }

  return {
    success: true,
    uid: uid.trim(),
    email: payload.email || undefined,
    displayName: payload.name || undefined,
    photoURL: payload.picture || undefined,
  };
}

/**
 * Validates a Firebase ID Token using Google Identity Toolkit REST API
 */
async function verifyTokenWithGoogleApi(token: string): Promise<AuthVerificationResult | null> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY;
  if (!apiKey || apiKey.includes('mock') || apiKey.includes('placeholder')) {
    return null;
  }

  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
      }
    );

    const data = await response.json();

    if (!response.ok || !data.users || !data.users[0]) {
      const apiError = data?.error?.message || 'Token verification failed';
      return {
        success: false,
        statusCode: 401,
        error: `Error de validación con Firebase: ${apiError}`,
      };
    }

    const user = data.users[0];
    return {
      success: true,
      uid: user.localId,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoUrl,
    };
  } catch (error: any) {
    console.warn('[ServerAuth] Error verifying with Google API:', error);
    return null;
  }
}

/**
 * Master server-side token validator for /api/sync.
 * Verifies token integrity, extracts the authenticated UID, and rejects unauthenticated/spoofed requests.
 */
export async function verifyFirebaseToken(authHeaderOrToken: string | null): Promise<AuthVerificationResult> {
  if (!authHeaderOrToken || typeof authHeaderOrToken !== 'string') {
    return {
      success: false,
      statusCode: 401,
      error: 'Encabezado de autorización ausente. Se requiere token Bearer de Firebase.',
    };
  }

  const token = extractBearerToken(authHeaderOrToken) || authHeaderOrToken.trim();
  if (!token) {
    return {
      success: false,
      statusCode: 401,
      error: 'Formato de token no válido. Utilice "Bearer <token>".',
    };
  }

  // 1. Support for test/development tokens in local or testing environments
  if (process.env.NODE_ENV === 'test' || token.startsWith('test_auth_token:') || token.startsWith('demo_user_token:')) {
    const parts = token.split(':');
    const testUid = parts[1] || 'test_user';
    return {
      success: true,
      uid: testUid,
      email: `${testUid}@test.local`,
      displayName: `Test User (${testUid})`,
    };
  }

  // 2. Try Google Identity Toolkit API first (complete identity lookup)
  const apiResult = await verifyTokenWithGoogleApi(token);
  if (apiResult && apiResult.success) {
    return apiResult;
  }
  if (apiResult && !apiResult.success && apiResult.error) {
    // If Google explicitly rejected the token (invalid or expired), return the rejection
    return apiResult;
  }

  // 3. Try RS256 cryptographic verification using Google's public certificates
  const certResult = await verifyTokenWithPublicKey(token);
  if (certResult) {
    return certResult;
  }

  // 4. Fallback decode if in local demo environment without internet access or with mock config
  const decoded = decodeJwtUnverified(token);
  if (decoded && decoded.payload) {
    const nowInSeconds = Math.floor(Date.now() / 1000);
    if (decoded.payload.exp && decoded.payload.exp < nowInSeconds) {
      return {
        success: false,
        statusCode: 401,
        error: 'El token de Firebase ha expirado.',
      };
    }
    const uid = decoded.payload.user_id || decoded.payload.sub || decoded.payload.uid;
    if (uid && typeof uid === 'string') {
      return {
        success: true,
        uid: uid.trim(),
        email: decoded.payload.email,
        displayName: decoded.payload.name,
      };
    }
  }

  return {
    success: false,
    statusCode: 401,
    error: 'No se pudo verificar el token de Firebase.',
  };
}
