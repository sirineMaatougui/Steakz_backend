import type { Response } from 'express';
import type { PageMeta } from '../types/index.js';

/** Send a standard success envelope: { success: true, data }. */
export function ok<T>(res: Response, data: T, status = 200): Response {
  return res.status(status).json({ success: true, data });
}

/** Send a paginated success envelope with meta. */
export function okPaginated<T>(res: Response, data: T[], meta: PageMeta): Response {
  return res.status(200).json({ success: true, data, meta });
}
