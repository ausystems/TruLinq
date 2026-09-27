/* Passwords are hashed with scrypt (N=2^15, r=8, p=1, 64-byte key) and a 16-byte random salt, in a versioned
   format so parameters can be raised later without invalidating existing hashes. Plain text never touches storage. */
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const N = 32768, R = 8, P = 1, KEYLEN = 64;

function derive(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password.normalize('NFKC'), salt, KEYLEN, { N: n, r, p, maxmem: 128 * 1024 * 1024 }, (err, key) => (err ? reject(err) : resolve(key))));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P);
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, salt, hash] = stored.split('$');
  if (algo !== 'scrypt' || !n || !r || !p || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = await derive(password, Buffer.from(salt, 'base64'), Number(n), Number(r), Number(p));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** A constant-cost comparison target for unknown emails, so login timing does not reveal whether an account exists. */
export const DUMMY_HASH_PROMISE: Promise<string> = hashPassword('correct-horse-battery-staple');
