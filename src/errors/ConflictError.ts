import { ApiError } from './ApiError';

export class ConflictError extends ApiError {
  constructor(message = 'Resource conflict.') {
    super(409, message);
  }
}
