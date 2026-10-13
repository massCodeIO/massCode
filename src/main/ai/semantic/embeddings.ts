import { getVaultPath } from '../../storage/providers/markdown/runtime/paths'
import { requestAiEmbeddings } from '../client'
import { AiError } from '../errors'
import { getAiSemanticSettings } from '../settings'
import { embedBuiltin, isBuiltinReady } from './builtin'
import { BUILTIN_MODEL } from './builtinModel'
import { formatQuery, normalize } from './text'

export interface SemanticKey {
  vault: string
  source: 'builtin' | 'provider'
  baseURL?: string
  model: string
}

export function sameSemanticKey(a: SemanticKey, b: SemanticKey) {
  return (
    a.vault === b.vault
    && a.source === b.source
    && a.baseURL === b.baseURL
    && a.model === b.model
  )
}

export function currentSemanticKey(): SemanticKey | undefined {
  const { source, provider } = getAiSemanticSettings()
  try {
    if (source === 'builtin') {
      // В имени модели остаётся «embeddinggemma», поэтому документы и запросы получают её task-промпты.
      return isBuiltinReady()
        ? {
            vault: getVaultPath(),
            source,
            model: `${BUILTIN_MODEL.id}@${BUILTIN_MODEL.revision}`,
          }
        : undefined
    }
    if (source !== 'provider' || !provider.model)
      return undefined
    return {
      vault: getVaultPath(),
      source,
      baseURL: provider.baseURL,
      model: provider.model,
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
  let vectors: number[][]
  if (key.source === 'builtin') {
    vectors = await embedBuiltin(texts, signal)
  }
  else {
    const { provider } = getAiSemanticSettings()
    // Настройки могут смениться между вычислением ключа и отправкой батча.
    if (provider.baseURL !== key.baseURL)
      throw new AiError('invalidRequest')
    // Без apiKey: ключ чатового провайдера не должен уходить на сервер эмбеддингов.
    vectors = await requestAiEmbeddings(
      { provider: provider.kind, baseURL: provider.baseURL, model: key.model },
      key.model,
      texts,
      signal,
    )
  }
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
  const text = formatQuery(key.model, query)
  const cacheKey = JSON.stringify([key.source, key.baseURL, key.model, text])
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
