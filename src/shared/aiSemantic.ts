import type { AiErrorCode, AiVaultRef } from './ai'
import { z } from 'zod'
import { aiVaultRefSchema } from './ai'

export const aiSemanticSourceSchema = z.enum(['off', 'builtin'])
export type AiSemanticSource = z.infer<typeof aiSemanticSourceSchema>

export const aiSemanticConfigureSchema = z
  .object({
    source: aiSemanticSourceSchema,
  })
  .strict()
export type AiSemanticConfigure = z.infer<typeof aiSemanticConfigureSchema>

// Иероглиф, кана, хангыль или тайская буква несут столько же, сколько около трёх латинских букв.
export const DENSE_SCRIPT
  = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}]/u
const DENSE_WEIGHT = 3
// Короче этого запрос — начало слова, а не мысль: смысл по нему не ищется ни в main, ни в renderer.
export const MIN_MEANING_QUERY_WEIGHT = 3

export function semanticQueryWeight(query: string) {
  let weight = 0
  for (const char of query) {
    if (/[\p{L}\p{N}]/u.test(char))
      weight += DENSE_SCRIPT.test(char) ? DENSE_WEIGHT : 1
  }
  return weight
}

// tagId и folderId принадлежат одному пространству, поэтому с ними ищут только по одному типу.
export const aiSemanticSearchSchema = z
  .object({
    query: z.string().trim().min(1).max(500),
    types: z.array(aiVaultRefSchema.shape.type).min(1).max(3),
    mode: z.enum(['words', 'full']),
    tagId: z.number().int().positive().optional(),
    folderId: z.number().int().positive().optional(),
    limit: z.number().int().min(1).max(50).optional(),
  })
  .strict()
  .refine(
    search =>
      (search.tagId === undefined && search.folderId === undefined)
      || search.types.length === 1,
  )
  .refine(
    search =>
      search.tagId === undefined || search.types[0] !== 'http_request',
  )
export type AiSemanticSearch = z.infer<typeof aiSemanticSearchSchema>

export type PaletteMatchReason = 'name' | 'words' | 'meaning' | 'both'

export interface PaletteSearchItem {
  type: AiVaultRef['type']
  // Элемент списка соответствующего API (без тел): GET /snippets, /notes или /http-requests.
  item: Record<string, unknown>
  score: number
  reason: PaletteMatchReason
  // Подсветка — диапазоны [from, to) в text, без HTML.
  excerpt?: { text: string, ranges: [number, number][] }
}

export interface AiSemanticSearchResult {
  items: PaletteSearchItem[]
  // Столько первых items показываются сразу, остальные свёрнуты как слабые.
  strongCount: number
  // off — семантики нет (выключена, нет модели, первая индексация упала); warming — индекс строится.
  meaning: 'ready' | 'warming' | 'off'
}

export interface AiSemanticStatus {
  source: AiSemanticSource
  builtin: {
    supported: boolean
    state: 'absent' | 'downloading' | 'ready' | 'error'
    progress?: number
    error?: 'download' | 'runtime'
  }
  index: {
    // off — смысла нет: источник выключен или встроенная модель не скачана.
    state: 'off' | 'idle' | 'indexing' | 'error'
    indexed: number
    // Первая полная сборка для текущего источника завершена; пока нет — renderer опрашивает статус.
    complete: boolean
    done?: number
    total?: number
    error?: AiErrorCode
  }
}

// Рассылается во все окна для индикатора в рейке пространств, поэтому без счётчиков.
export interface AiSemanticProgress {
  source: AiSemanticSource
  builtin: Pick<AiSemanticStatus['builtin'], 'state' | 'progress' | 'error'>
  index: Pick<AiSemanticStatus['index'], 'state' | 'done' | 'total' | 'error'>
}
