import crypto from 'crypto';
import { PREVIEW_SECRET } from '../config.js';
import { metadataStore } from './MetadataStore.js';

interface PreviewToken {
  token: string;
  expiresAt: number;
  folder?: string;
  media?: string;
}

export class PreviewService {
  private tokens = new Map<string, PreviewToken>();

  async createToken({ secret, folder, media }: { secret: string; folder?: string; media?: string }) {
    const settings = await metadataStore.readSettings();
    if (!settings.previews.enabled) {
      throw new Error('Preview disabled');
    }

    const expected = PREVIEW_SECRET;
    if (secret !== expected) {
      throw new Error('Invalid preview secret');
    }

    const token = crypto.randomBytes(20).toString('hex');
    const expiresAt = Date.now() + settings.previews.tokenExpirationMinutes * 60 * 1000;
    const entry: PreviewToken = { token, expiresAt, folder, media };
    this.tokens.set(token, entry);
    return entry;
  }

  validate(token: string) {
    const entry = this.tokens.get(token);
    if (!entry) return false;
    if (entry.expiresAt < Date.now()) {
      this.tokens.delete(token);
      return false;
    }
    return entry;
  }
}

export const previewService = new PreviewService();
