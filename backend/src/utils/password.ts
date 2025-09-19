import crypto from 'crypto';

const ITERATIONS = 120_000;
const KEY_LENGTH = 64;
const DIGEST = 'sha512';

export interface PasswordHash {
  hash: string;
  salt: string;
}

export const hashPassword = (password: string, salt?: string): PasswordHash => {
  const actualSalt = salt ?? crypto.randomBytes(16).toString('hex');
  const derived = crypto.pbkdf2Sync(password, actualSalt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
  return { hash: derived, salt: actualSalt };
};

export const verifyPassword = (password: string, hash: string, salt: string): boolean => {
  const { hash: candidate } = hashPassword(password, salt);
  const expected = Buffer.from(hash, 'hex');
  const received = Buffer.from(candidate, 'hex');

  if (expected.length !== received.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, received);
};
