import type { NextFunction, Request, Response } from 'express';
import { authService, SESSION_COOKIE_NAME } from '../services/AuthService.js';

const parseCookies = (cookieHeader: string | undefined): Record<string, string> => {
  if (!cookieHeader) {
    return {};
  }
  return cookieHeader.split(';').reduce<Record<string, string>>((acc, entry) => {
    const index = entry.indexOf('=');
    if (index === -1) {
      return acc;
    }
    const key = entry.slice(0, index).trim();
    const value = entry.slice(index + 1).trim();
    if (!key) {
      return acc;
    }
    acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
};

export const getSessionTokenFromRequest = (req: Request): string | undefined => {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[SESSION_COOKIE_NAME];
};

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const token = getSessionTokenFromRequest(req);
  if (!token) {
    res.status(401).json({ error: 'Authentification requise' });
    return;
  }

  const valid = authService.verifySession(token);
  if (!valid) {
    res.status(401).json({ error: 'Authentification requise' });
    return;
  }

  next();
};
