import type { AiErrorCode } from '../../shared/ai'

export class AiError extends Error {
  constructor(
    readonly code: AiErrorCode,
    readonly diagnostic?: string,
  ) {
    super(code)
  }
}
export function aiErrorCode(error: unknown): AiErrorCode {
  return error instanceof AiError ? error.code : 'connection'
}
