import type { Request, Response, NextFunction } from 'express';
import type { AnyZodObject } from 'zod';
import { ValidationError } from '../errors/ValidationError';

export function validate(schema: AnyZodObject) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      // Assign sanitized and parsed values back to request
      req.body = parsed.body || req.body;
      req.query = parsed.query || req.query;
      req.params = parsed.params || req.params;

      next();
    } catch (error: any) {
      if (error.errors) {
        // Format Zod errors cleanly
        const formattedErrors = error.errors.map((err: any) => ({
          field: err.path.join('.').replace(/^(body|query|params)\./, ''),
          message: err.message,
        }));
        next(new ValidationError(formattedErrors));
      } else {
        next(error);
      }
    }
  };
}
