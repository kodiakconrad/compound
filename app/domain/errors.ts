// Domain error types — mirrors internal/domain/errors.go.
// These are thrown by repository functions and caught by UI hooks.

export class NotFoundError extends Error {
  readonly entity: string;
  readonly id: string;

  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`);
    this.name = "NotFoundError";
    this.entity = entity;
    this.id = id;
  }
}

export class ValidationError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class UnprocessableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnprocessableError";
  }
}

export class NoActiveSessionError extends Error {
  constructor() {
    super("no active session");
    this.name = "NoActiveSessionError";
  }
}
