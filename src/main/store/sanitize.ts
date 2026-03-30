import type ElectronStore from 'electron-store'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}

export function readString(
  source: Record<string, unknown>,
  key: string,
  fallback: string,
): string {
  return typeof source[key] === 'string' ? String(source[key]) : fallback
}

export function readNullableString(
  source: Record<string, unknown>,
  key: string,
  fallback: string | null,
): string | null {
  const value = source[key]

  if (typeof value === 'string' || value === null) {
    return value
  }

  return fallback
}

export function readNumber(
  source: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  return typeof source[key] === 'number' ? Number(source[key]) : fallback
}

export function readOptionalNumber(
  source: Record<string, unknown>,
  key: string,
): number | undefined {
  return typeof source[key] === 'number' ? Number(source[key]) : undefined
}

export function readBoolean(
  source: Record<string, unknown>,
  key: string,
  fallback: boolean,
): boolean {
  return typeof source[key] === 'boolean' ? Boolean(source[key]) : fallback
}

export function readOptionalNumberArray(
  source: Record<string, unknown>,
  key: string,
): number[] | undefined {
  const value = source[key]

  if (
    !Array.isArray(value)
    || value.some(item => typeof item !== 'number' || !Number.isFinite(item))
  ) {
    return undefined
  }

  return [...value]
}

export function readEnum<T extends string>(
  source: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = source[key]

  return typeof value === 'string' && allowed.includes(value as T)
    ? (value as T)
    : fallback
}

export function replaceStoreIfChanged<T extends Record<string, any>>(
  store: Pick<ElectronStore<T>, 'store'>,
  value: T,
): void {
  if (JSON.stringify(store.store) !== JSON.stringify(value)) {
    store.store = value
  }
}
