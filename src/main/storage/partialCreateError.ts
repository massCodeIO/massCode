// The item is already on disk even though post-create bookkeeping failed.
export class PartialCreateError extends Error {
  constructor(
    readonly itemId: number,
    cause: unknown,
  ) {
    super(cause instanceof Error ? cause.message : 'STORAGE_ERROR', { cause })
    this.name = 'PartialCreateError'
  }
}
