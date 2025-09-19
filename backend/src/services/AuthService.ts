import crypto from 'crypto';
import type { Response } from 'express';
import { metadataStore } from './MetadataStore.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import type { Settings } from '../types/metadata.js';

export const SESSION_COOKIE_NAME = 'atelier_admin_session';
const SESSION_DURATION_MS = 1000 * 60 * 60 * 12; // 12 hours

export class InvalidCredentialsError extends Error {
  constructor(message: string = 'Identifiants invalides') {
    super(message);
    this.name = 'InvalidCredentialsError';
  }
}

type SessionEntry = {
  expiresAt: number;
};

class AuthService {
  private sessions = new Map<string, SessionEntry>();

  get sessionDurationMs(): number {
    return SESSION_DURATION_MS;
  }

  private pruneExpiredSessions() {
    const now = Date.now();
    for (const [token, session] of this.sessions.entries()) {
      if (session.expiresAt <= now) {
        this.sessions.delete(token);
      }
    }
  }

  private nextSessionToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  verifySession(token: string): boolean {
    this.pruneExpiredSessions();
    const entry = this.sessions.get(token);
    if (!entry) {
      return false;
    }
    if (entry.expiresAt <= Date.now()) {
      this.sessions.delete(token);
      return false;
    }
    return true;
  }

  createSession(): string {
    const token = this.nextSessionToken();
    this.sessions.set(token, { expiresAt: Date.now() + SESSION_DURATION_MS });
    return token;
  }

  issueSession(res: Response): string {
    const token = this.createSession();
    this.setSessionCookie(res, token);
    return token;
  }

  revokeSession(token: string) {
    this.sessions.delete(token);
  }

  revokeAllSessions() {
    this.sessions.clear();
  }

  setSessionCookie(res: Response, token: string) {
    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_DURATION_MS,
      path: '/' // ensure cookie available to all routes
    });
  }

  clearSessionCookie(res: Response) {
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
  }

  private async readSecuritySettings(): Promise<NonNullable<Settings['security']>> {
    const settings = await metadataStore.readSettings();
    return settings.security ?? { adminPasswordHash: null, adminPasswordSalt: null };
  }

  async verifyPassword(password: string): Promise<boolean> {
    const security = await this.readSecuritySettings();
    if (!security.adminPasswordHash || !security.adminPasswordSalt) {
      return false;
    }
    return verifyPassword(password, security.adminPasswordHash, security.adminPasswordSalt);
  }

  async updatePassword(currentPassword: string, nextPassword: string): Promise<void> {
    const settings = await metadataStore.readSettings();
    const security = settings.security ?? { adminPasswordHash: null, adminPasswordSalt: null };

    if (!security.adminPasswordHash || !security.adminPasswordSalt) {
      throw new InvalidCredentialsError('Configuration de sécurité invalide');
    }

    const valid = verifyPassword(currentPassword, security.adminPasswordHash, security.adminPasswordSalt);
    if (!valid) {
      throw new InvalidCredentialsError('Mot de passe actuel invalide');
    }

    const { hash, salt } = hashPassword(nextPassword);
    const updated: Settings = {
      ...settings,
      security: {
        adminPasswordHash: hash,
        adminPasswordSalt: salt,
        passwordUpdatedAt: new Date().toISOString()
      }
    };
    await metadataStore.updateSettings(updated);
    this.revokeAllSessions();
  }
}

export const authService = new AuthService();
