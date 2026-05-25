import { ApiError } from './ApiError';

export class ValidationError extends ApiError {
  public errors: any;

  constructor(errors: any, message = 'Validation Failed') {
    super(422, message);
    this.errors = errors;
  }
}
