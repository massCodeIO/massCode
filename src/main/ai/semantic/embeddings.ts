import { getVaultPath } from '../../storage/providers/markdown/runtime/paths'
import { AiError } from '../errors'
import { getAiSemanticSettings } from '../settings'
import { embedBuiltin, isBuiltinReady } from './builtin'
import { BUILTIN_MODEL } from './builtinModel'
import { formatQuery, normalize } from './text'

export interface SemanticKey {
  vault: string
  source: 'builtin'
  model: string
}

export function sameSemanticKey(a: SemanticKey, b: SemanticKey) {
  return a.vault === b.vault && a.source === b.source && a.model === b.model
}

export function currentSemanticKey(): SemanticKey | undefined {
  if (getAiSemanticSettings().source !== 'builtin' || !isBuiltinReady())
    return undefined
  try {
    return {
      vault: getVaultPath(),
      source: 'builtin',
      model: `${BUILTIN_MODEL.id}@${BUILTIN_MODEL.revision}`,
    }
  }
  catch {
    return undefined
  }
}

export async function embedTexts(
  key: SemanticKey,
  texts: string[],
  signal: AbortSignal,
) {
  const vectors = await embedBuiltin(texts, signal)
  if (vectors.length !== texts.length)
    throw new AiError('invalidResponse')
  if (vectors.some(vector => vector.length !== vectors[0].length))
    throw new AiError('invalidResponse')
  return vectors.map(normalize)
}

// Пользователь стирает и снова набирает те же слова: вектор запроса не пересчитывается.
const QUERY_CACHE_SIZE = 64
const queryVectors = new Map<string, Float32Array>()

export async function embedQuery(
  key: SemanticKey,
  query: string,
  signal: AbortSignal,
) {
  const text = formatQuery(query)
  const cacheKey = JSON.stringify([key.model, text])
  const cached = queryVectors.get(cacheKey)
  if (cached) {
    queryVectors.delete(cacheKey)
    queryVectors.set(cacheKey, cached)
    return cached
  }
  const [vector] = await embedTexts(key, [text], signal)
  queryVectors.set(cacheKey, vector)
  if (queryVectors.size > QUERY_CACHE_SIZE)
    queryVectors.delete(queryVectors.keys().next().value!)
  return vector
}
