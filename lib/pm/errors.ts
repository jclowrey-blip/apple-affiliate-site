/** An error whose message is safe to show to the user. */
export class PmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PmError";
  }
}

export class NotFoundError extends PmError {
  constructor(what: string) {
    super(`${what} not found`);
    this.name = "NotFoundError";
  }
}
