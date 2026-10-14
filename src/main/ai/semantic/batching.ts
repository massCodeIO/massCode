// Чистые функции без electron: их вызывает и индексация в main, и worker эмбеддингов.

// Письменности без пробелов и hex/base64 токенизатор режет почти по символу.
const DENSE_SCRIPT
  = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}]/gu
// Длинная смесь букв и цифр (hex, base64, UUID без дефисов): буквы в ней не складываются в слова.
const ENCODED = /[\p{L}\p{N}+/=_-]{8,}/gu
const DENSE_TOKENS_PER_CHAR = 0.7

function isEncoded(run: string) {
  return /\d/.test(run) && /\p{L}/u.test(run)
}

// Токенизатора в main нет. По токенизатору EmbeddingGemma: слово прозы ru/en — около 4 букв на токен,
// цифры, знаки и переводы строк — почти по токену на символ (строка лога в 1210 символов — 1059 токенов).
// Оценка заведомо приблизительная: предел батча по реальным токенам держит worker (embedWithinLimit).
export function estimateTokens(text: string) {
  let tokens = 0
  const rest = text
    .replace(DENSE_SCRIPT, () => {
      tokens += DENSE_TOKENS_PER_CHAR
      return ' '
    })
    .replace(ENCODED, (run) => {
      if (!isEncoded(run))
        return run
      // Цифры и знаки остаются по токену, буквы в такой смеси — около 0.7 токена.
      const letters = run.match(/\p{L}/gu)?.length ?? 0
      tokens += run.length - letters + letters * DENSE_TOKENS_PER_CHAR
      return ' '
    })
  const letters = rest.match(/\p{L}/gu)?.length ?? 0
  const others = rest.match(/[^\p{L} \t]/gu)?.length ?? 0
  return Math.ceil(tokens + letters / 4 + others)
}

export interface BatchLimits {
  // Предел для батча с паддингом до самого длинного текста: число текстов × длиннейший.
  tokens: number
  items: number
}

// 2026-10-12: worker встроенной модели падает (exit 5) на батчах около 4200+ реальных токенов с паддингом
// (64 текста по 89 токенов; 4 текста, самый длинный 1059), прежние батчи по 8 падали и отсортированными.
// Время эмбеддинга линейно по токенам (~200 мс на 1800 символов при любом размере батча),
// поэтому двукратный запас по бюджету скорость не снижает.
export const BATCH_LIMITS: BatchLimits = { tokens: 2000, items: 16 }

// Тексты сортируются по длине, чтобы паддинг не раздувал короткие. Текст длиннее бюджета идёт один.
export function planEmbeddingBatches<T>(
  items: T[],
  textOf: (item: T) => string,
  limits: BatchLimits,
): T[][] {
  const sorted = items
    .map(item => ({ item, tokens: estimateTokens(textOf(item)) }))
    .sort((a, b) => a.tokens - b.tokens)
  const batches: T[][] = []
  let batch: T[] = []
  for (const { item, tokens } of sorted) {
    // Отсортировано по возрастанию, поэтому текущий текст и есть длиннейший в батче.
    if (
      batch.length
      && (batch.length >= limits.items
        || (batch.length + 1) * tokens > limits.tokens)
    ) {
      batches.push(batch)
      batch = []
    }
    batch.push(item)
  }
  if (batch.length)
    batches.push(batch)
  return batches
}

// Страховка worker: батч, который после токенизации оказался больше предела, делится пополам,
// векторы возвращаются в исходном порядке. Одиночный текст считается как есть (его режет max_length).
export async function embedWithinLimit<Inputs, Vector>(
  texts: string[],
  limit: number,
  prepare: (texts: string[]) => Promise<{ inputs: Inputs, padded: number }>,
  embed: (inputs: Inputs) => Promise<Vector[]>,
): Promise<Vector[]> {
  const { inputs, padded } = await prepare(texts)
  if (texts.length < 2 || padded <= limit)
    return embed(inputs)
  const middle = Math.ceil(texts.length / 2)
  return [
    ...(await embedWithinLimit(texts.slice(0, middle), limit, prepare, embed)),
    ...(await embedWithinLimit(texts.slice(middle), limit, prepare, embed)),
  ]
}
