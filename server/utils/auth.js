import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'jobauto-super-secret-key-for-local-dev-123456';

// Helper to base64url encode a buffer or string
function base64url(str, encoding = 'utf8') {
  const buf = Buffer.isBuffer(str) ? str : Buffer.from(str, encoding);
  return buf.toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

// Helper to base64url decode a string
function base64urlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

// 1. Password Hashing with Salt
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

export function verifyPassword(password, hash, salt) {
  const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

// 2. Custom Signed Token (JWT Compliant)
export function generateToken(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  
  // Set expiration to 30 days
  const exp = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);
  const tokenPayload = { ...payload, exp };
  
  const headerEncoded = base64url(JSON.stringify(header));
  const payloadEncoded = base64url(JSON.stringify(tokenPayload));
  
  const signatureInput = `${headerEncoded}.${payloadEncoded}`;
  const signature = crypto.createHmac('sha256', JWT_SECRET)
    .update(signatureInput)
    .digest();
  
  const signatureEncoded = base64url(signature);
  return `${headerEncoded}.${payloadEncoded}.${signatureEncoded}`;
}

export function verifyToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [headerEncoded, payloadEncoded, signatureEncoded] = parts;
    const signatureInput = `${headerEncoded}.${payloadEncoded}`;
    
    const expectedSignature = crypto.createHmac('sha256', JWT_SECRET)
      .update(signatureInput)
      .digest();
    
    const expectedSignatureEncoded = base64url(expectedSignature);
    
    if (signatureEncoded !== expectedSignatureEncoded) {
      return null;
    }
    
    const payload = JSON.parse(base64urlDecode(payloadEncoded));
    
    // Check expiration
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return null; // Token expired
    }
    
    return payload;
  } catch (error) {
    return null;
  }
}
