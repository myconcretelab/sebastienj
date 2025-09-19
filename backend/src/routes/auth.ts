import { Router } from 'express';
import { z } from 'zod';
import { authService, InvalidCredentialsError } from '../services/AuthService.js';
import { getSessionTokenFromRequest, requireAuth } from '../middleware/auth.js';

const router = Router();

const loginSchema = z.object({
  password: z.string().min(1)
});

router.post('/login', async (req, res, next) => {
  try {
    const { password } = loginSchema.parse(req.body ?? {});
    const valid = await authService.verifyPassword(password);
    if (!valid) {
      res.status(401).send('Mot de passe invalide');
      return;
    }
    authService.issueSession(res);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', (req, res) => {
  const token = getSessionTokenFromRequest(req);
  if (token) {
    authService.revokeSession(token);
  }
  authService.clearSessionCookie(res);
  res.json({ success: true });
});

router.get('/session', (req, res) => {
  const token = getSessionTokenFromRequest(req);
  const authenticated = token ? authService.verifySession(token) : false;
  res.json({ authenticated });
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6)
});

router.put('/password', requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = passwordSchema.parse(req.body ?? {});
    await authService.updatePassword(currentPassword, newPassword);
    authService.issueSession(res);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      res.status(400).send(error.message);
      return;
    }
    next(error);
  }
});

export default router;
