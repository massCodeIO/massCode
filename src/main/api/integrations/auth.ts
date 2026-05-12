import { Buffer } from 'node:buffer'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { store } from '../../store'

const TOKEN_PREFIX = 'mc_'
const TOKEN_BYTES = 32

export function hashIntegrationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function getTokenPreview(token: string): string {
  return `${token.slice(0, 5)}...${token.slice(-4)}`
}

function isSameHash(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a, 'hex')
  const bBuffer = Buffer.from(b, 'hex')

  if (aBuffer.length !== bBuffer.length) {
    return false
  }

  return timingSafeEqual(aBuffer, bBuffer)
}

export function generateIntegrationToken(): {
  token: string
  tokenPreview: string
} {
  const token = `${TOKEN_PREFIX}${randomBytes(TOKEN_BYTES).toString('base64url')}`
  const tokenPreview = getTokenPreview(token)

  store.preferences.set('api.integrations.enabled', true)
  store.preferences.set(
    'api.integrations.tokenHash',
    hashIntegrationToken(token),
  )
  store.preferences.set('api.integrations.tokenPreview', tokenPreview)

  return { token, tokenPreview }
}

export function revokeIntegrationToken(): void {
  store.preferences.set('api.integrations.enabled', false)
  store.preferences.set('api.integrations.tokenHash', null)
  store.preferences.set('api.integrations.tokenPreview', null)
}

export function isIntegrationTokenAuthorized(
  authorizationHeader?: string,
): boolean {
  const enabled = store.preferences.get('api.integrations.enabled') as boolean
  const tokenHash = store.preferences.get('api.integrations.tokenHash') as
    | string
    | null

  if (!enabled || !tokenHash || !authorizationHeader) {
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

  return isSameHash(hashIntegrationToken(token), tokenHash)
}
