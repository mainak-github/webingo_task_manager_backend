import morgan from 'morgan';
import type { Request, Response } from 'express';

// Formatter for API execution timing in Morgan
export const httpLogger = morgan((tokens, req: Request, res: Response) => {
  const status = tokens.status(req, res);
  const responseTime = tokens['response-time'](req, res);
  const color = parseInt(status || '200', 10) >= 400 ? '\x1b[31m' : '\x1b[32m'; // Red for errors, Green for OK
  const reset = '\x1b[0m';

  return [
    `[HTTP]`,
    tokens.method(req, res),
    tokens.url(req, res),
    `-> Status: ${color}${status}${reset}`,
    `- Duration: ${responseTime}ms`,
  ].join(' ');
});

export const logger = {
  info: (message: string, ...meta: any[]) => {
    console.log(`[INFO] \x1b[36m${message}\x1b[0m`, ...meta);
  },
  warn: (message: string, ...meta: any[]) => {
    console.warn(`[WARN] \x1b[33m${message}\x1b[0m`, ...meta);
  },
  error: (message: string, ...meta: any[]) => {
    console.error(`[ERROR] \x1b[31m${message}\x1b[0m`, ...meta);
  },
  // Profiles the execution time of any async operation
  profile: async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
    const start = process.hrtime();
    try {
      const result = await fn();
      const diff = process.hrtime(start);
      const durationMs = (diff[0] * 1e9 + diff[1]) / 1e6;
      console.log(`[PROFILE] \x1b[35m${name}\x1b[0m took \x1b[32m${durationMs.toFixed(2)}ms\x1b[0m`);
      return result;
    } catch (error) {
      const diff = process.hrtime(start);
      const durationMs = (diff[0] * 1e9 + diff[1]) / 1e6;
      console.error(`[PROFILE ERROR] \x1b[35m${name}\x1b[0m failed after \x1b[31m${durationMs.toFixed(2)}ms\x1b[0m`);
      throw error;
    }
  },
};
