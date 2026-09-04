import type { Buffer } from 'node:buffer'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

const SESSION_TOKEN_BYTES = 32
const SESSION_TOKEN_PREFIX = 'mc_session_'

export function generateApiSessionToken(): string {
  return `${SESSION_TOKEN_PREFIX}${randomBytes(SESSION_TOKEN_BYTES).toString('base64url')}`
}

export function resolveApiSessionToken(
  allowDevelopmentToken: boolean,
  developmentToken: string | undefined,
): string {
  if (allowDevelopmentToken && developmentToken?.trim()) {
    return developmentToken.trim()
  }

  return generateApiSessionToken()
}

function hashToken(token: string): Buffer {
  return createHash('sha256').update(token).digest()
}

export function isSessionTokenAuthorized(
  authorizationHeader: string | undefined,
  sessionToken: string,
): boolean {
  if (!authorizationHeader) {
    return false
  }

  const bearerPrefix = 'bearer '
  if (!authorizationHeader.toLowerCase().startsWith(bearerPrefix)) {
    return false
  }

  const token = authorizationHeader.slice(bearerPrefix.length).trim()
  if (!token) {
    return false
  }

  return timingSafeEqual(hashToken(token), hashToken(sessionToken))
}
