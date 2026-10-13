import type { KeywordDocument } from './keywordIndex'
import { DENSE_SCRIPT } from '../../../shared/aiSemantic'
import { wordSpans } from './terms'
import { httpSearchPath } from './text'

// Чистые функции без electron: их вызывает и индексация в main, и eval-runner на собранном build.

// folder — имя папки записи: ищется словами («background job» -> папка Background Jobs), в эмбеддинг не входит.
export type CorpusRecord = { folder?: string } & (
  | {
    type: 'snippet'
    id: number
    name: string
    description: string | null
    contents: { label: string, language: string, value: string | null }[]
  }
  | { type: 'note', id: number, name: string, content: string }
  | {
    type: 'http_request'
    id: number
    name: string
    method: string
    url: string
    description: string
  }
)

export interface Chunk {
  ref: string
  n: number
  title: string
  text: string
  code: boolean
  // Чанк без слов (дамп чисел, hex) не эмбеддится: его вектор шумит в z-статистике.
  hasWords: boolean
  // Чанк только с названием заметки: отрывком для него служит начало текста.
  name: boolean
}

export interface ChunkOptions {
  size: number
  overlap: number
  // Чанк с меньшим числом букв в словах не эмбеддится: вектор пустой записи
  // «Untitled» оказывался ближайшим к случайным запросам.
  minLetters: number
}

// 2026-10-12, eval S1, ALL MRR. Первый проход (88 запросов, hex и логи ещё эмбеддились):
// по заголовкам 1800/200 — 0.938, 1800/200 — 0.940, 3000/200 — 0.960, целиком 4000 — 0.965, но целиком
// смысл глубоких фраз теряется (z 1.2–2.4, держат только слова), а заголовки множат чанки-конкуренты.
// Повтор (102 запроса, дампы без векторов): 1800/200 — 0.953 против 0.940 у 3000/200,
// пересказ глубокой части длинной заметки R@1 0.5 против 0.33.
// Заголовок чанка «имя · метка фрагмента»: имя, имя с меткой и путь папки дали 0.946 / 0.938 / 0.946;
// метка оставлена, она различает фрагменты.
// minLetters 12: без порога пустые «Untitled» и «copy of copy» оказывались ближайшими к случайным запросам.
export const CHUNK_OPTIONS: ChunkOptions = {
  size: 1800,
  overlap: 200,
  minLetters: 12,
}

// Перекрытие кода в строках: строка кода обычно целостнее, чем окно в символах.
const CODE_OVERLAP_LINES = 2
// Буквенный токен длиннее этого почти всегда кусок base64, а не слово.
const MAX_WORD = 24

const DENSE_LETTER_WEIGHT = 3

// Словом считается только буквенный токен из 3+ букв (у плотных письменностей — из 1+): hex-байты,
// UUID и base64 состоят из коротких или смешанных с цифрами кусков и словами не считаются.
function isWord(token: string) {
  if (token.length > MAX_WORD || !/^[\p{L}\p{M}]+$/u.test(token))
    return false
  return token.length >= 3 || DENSE_SCRIPT.test(token)
}

export function hasWords(text: string, minLetters = 1) {
  let letters = 0
  let weighted = 0
  for (const span of wordSpans(text)) {
    if (!isWord(span.text))
      continue
    letters += span.text.length
    weighted += DENSE_SCRIPT.test(span.text)
      ? span.text.length * DENSE_LETTER_WEIGHT
      : span.text.length
  }
  const others = text.replace(/\s/g, '').length - letters
  return weighted >= Math.max(1, minLetters) && letters * 4 >= others
}

// Окно в символах с концом по последнему пробелу во второй половине окна.
export function splitText(text: string, size: number, overlap: number) {
  const parts: string[] = []
  let start = 0
  while (start < text.length) {
    let end = Math.min(text.length, start + size)
    if (end < text.length) {
      // Поиск ограничен второй половиной окна: на тексте без пробелов lastIndexOf не уходит к началу.
      const from = start + Math.floor(size / 2)
      const window = text.slice(from, end)
      const boundary = Math.max(
        window.lastIndexOf(' '),
        window.lastIndexOf('\n'),
      )
      if (boundary > 0)
        end = from + boundary
    }
    const part = text.slice(start, end).trim()
    if (part)
      parts.push(part)
    if (end >= text.length)
      break
    let next = Math.max(end - overlap, start + 1)
    // Следующее окно начинается с целого слова.
    while (next < end && !/\s/.test(text[next - 1])) next++
    start = next
  }
  return parts
}

// Целые строки до size, соседние куски делят до двух строк; строка длиннее size режется по символам.
export function splitCode(text: string, size: number) {
  const parts: string[] = []
  let current: string[] = []
  let length = 0
  const flush = () => {
    const part = current.join('\n').trim()
    if (part)
      parts.push(part)
  }
  for (const line of text.split('\n')) {
    if (line.length > size) {
      flush()
      current = []
      length = 0
      for (let start = 0; start < line.length; start += size)
        parts.push(line.slice(start, start + size))
      continue
    }
    if (length + line.length + 1 > size && current.length) {
      flush()
      current = current.slice(-CODE_OVERLAP_LINES)
      length = current.reduce((sum, item) => sum + item.length + 1, 0)
      // Перекрытие уступает место новой строке, иначе кусок вышел бы больше size.
      while (current.length && length + line.length + 1 > size)
        length -= current.shift()!.length + 1
    }
    current.push(line)
    length += line.length + 1
  }
  flush()
  return parts
}

// Адреса ссылок и картинок — не смысл текста: заметка из одной картинки иначе получала вектор
// из слов «image masscode notes asset» и всплывала на случайные запросы, а адреса с токенами
// уходили бы на сервер эмбеддингов. Подпись ссылки остаётся. Цель ссылки — схема или путь, поэтому
// вызов obj[key](arg) в тексте не трогается; после цели допустим заголовок в кавычках. Содержимое `кода`
// и блоков кода (``` или ~~~) не меняется.
const LINK_TARGET
  = /(!?\[[^\]\n]*\])\((?:[a-z][\w+.-]*:|\.{0,2}\/|#)(?:[^()\s]|\([^()\s]*\))*(?:\s+(?:"[^"\n]*"|'[^'\n]*'))?\)/gi
const BARE_URL = /\b(?:https?|masscode):\/\/(?:[^\s()]|\([^()\s]*\))+/gi
const INLINE_CODE = /(`[^`\n]*`)/
const FENCE = /^\s*(`{3,}|~{3,})/

function stripProse(text: string) {
  return text
    .split(INLINE_CODE)
    .map((part, index) =>
      index % 2 ? part : part.replace(LINK_TARGET, '$1').replace(BARE_URL, ' '),
    )
    .join('')
}

// Блок кода — от забора из трёх и больше ` или ~ до забора не короче (или до конца текста).
export function stripLinks(text: string) {
  const out: string[] = []
  let prose: string[] = []
  let fence: string | undefined
  for (const line of text.split('\n')) {
    if (fence) {
      out.push(line)
      if (line.trim().startsWith(fence))
        fence = undefined
      continue
    }
    const opening = FENCE.exec(line)
    if (!opening) {
      prose.push(line)
      continue
    }
    if (prose.length)
      out.push(stripProse(prose.join('\n')))
    prose = []
    fence = opening[1]
    out.push(line)
  }
  if (prose.length)
    out.push(stripProse(prose.join('\n')))
  return out.join('\n')
}

function titleOf(record: CorpusRecord, detail?: string) {
  const name = record.name.trim() || 'none'
  return detail ? `${name} · ${detail}` : name
}

export function chunkRecord(
  record: CorpusRecord,
  options: ChunkOptions = CHUNK_OPTIONS,
): Chunk[] {
  const ref = `${record.type}:${record.id}`
  const chunks: (Omit<Chunk, 'n' | 'ref' | 'hasWords' | 'name'> & {
    name?: boolean
  })[] = []
  if (record.type === 'http_request') {
    const text = [
      `${record.method} ${httpSearchPath(record.url ?? '')}`,
      stripLinks(record.description ?? '').trim(),
    ]
      .filter(Boolean)
      .join('\n')
    chunks.push({ title: titleOf(record), text, code: false })
  }
  else if (record.type === 'snippet') {
    // Нулевой чанк держит имя и описание: короткая запись находится по ним, даже если код пустой.
    chunks.push({
      title: titleOf(record),
      text: [record.name, record.description && stripLinks(record.description)]
        .filter(Boolean)
        .join('\n'),
      code: false,
    })
    for (const content of record.contents) {
      const detail = [content.label, content.language]
        .filter(Boolean)
        .join(' · ')
      for (const text of splitCode(content.value ?? '', options.size))
        chunks.push({ title: titleOf(record, detail), text, code: true })
    }
  }
  else {
    for (const text of splitText(
      stripLinks(record.content),
      options.size,
      options.overlap,
    ))
      chunks.push({ title: titleOf(record), text, code: false })
    if (!chunks.length)
      chunks.push({ title: titleOf(record), text: '', code: false })
    // Отдельный вектор названия: длинный текст заметки размывает его, и перевод названия
    // («дорожная карта» -> «Orbit roadmap») не находился. Последним, чтобы номера чанков текста не сдвигались.
    if (record.name.trim()) {
      chunks.push({
        title: titleOf(record),
        text: record.name.trim(),
        code: false,
        name: true,
      })
    }
  }
  return chunks.map((chunk, n) => ({
    ...chunk,
    name: chunk.name === true,
    ref,
    n,
    hasWords: hasWords(chunk.text, options.minLetters),
  }))
}

// Текст для поиска по словам. HTTP: путь без хоста и query — в них часто лежат токены и ключи.
export function keywordDocument(record: CorpusRecord): KeywordDocument {
  const body
    = record.type === 'snippet'
      ? [
          record.description,
          ...record.contents.flatMap(content => [
            content.label,
            content.value,
          ]),
        ]
      : record.type === 'note'
        ? [record.content]
        : [
            `${record.method} ${httpSearchPath(record.url ?? '')}`,
            record.description,
          ]
  return {
    ref: `${record.type}:${record.id}`,
    name: record.name,
    body: body.filter(Boolean).join('\n'),
    ...(record.folder ? { folder: record.folder } : {}),
  }
}
