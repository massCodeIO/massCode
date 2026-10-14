import type { AiErrorCode } from '../../../shared/ai'
import type {
  AiSemanticProgress,
  AiSemanticSearchResult,
  AiSemanticStatus,
} from '../../../shared/aiSemantic'
import type { CorpusEntry } from './corpus'
import type { SemanticKey } from './embeddings'
import type { PreparedVectors } from './score'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { app, BrowserWindow } from 'electron'
import { z } from 'zod'
import { AiError, aiErrorCode } from '../errors'
import { getAiSemanticSettings } from '../settings'
import { BATCH_LIMITS, planEmbeddingBatches } from './batching'
import { builtinStatus, onBuiltinFailure } from './builtin'
import { chunkRecord } from './chunks'
import { vaultCorpus } from './corpus'
import { currentSemanticKey, embedTexts, sameSemanticKey } from './embeddings'
import { prepareVectors } from './score'
import { decodeVector, encodeVector, formatDocument } from './text'

// Версия нарезки входит в fingerprint: другие чанки не сопоставимы со старыми векторами.
// v2: из текста заметок убраны адреса ссылок и картинок; v3: и из описаний, код и заголовки ссылок учтены;
// v4: у заметок отдельный вектор названия.
const CHUNKING = 'v4'

export interface StoredChunk {
  n: number
  title: string
  hasWords: boolean
  // null — чанк без слов, он не эмбеддится.
  v: Float32Array | null
}
export interface StoredRecord {
  h: string
  chunks: StoredChunk[]
}
export interface SemanticFingerprint extends SemanticKey {
  dims: number
  chunking: typeof CHUNKING
}
export interface SemanticIndex {
  fingerprint: SemanticFingerprint
  // Первый полный прогон для этого fingerprint завершён. Частичный индекс после перезапуска
  // не используется для смысла: z-статистика по половине vault искажена.
  complete: boolean
  records: Map<string, StoredRecord>
}
export type MeaningState = AiSemanticSearchResult['meaning']

const BATCH_TIMEOUT_MS = 120_000
const REMOVE_WAIT_MS = 5_000
// В чанках: столько векторов может потеряться при аварийном выходе.
const SAVE_EVERY = 200
const PROGRESS_THROTTLE_MS = 250

const indexFileSchema = z.object({
  version: z.literal(3),
  fingerprint: z.object({
    vault: z.string(),
    source: z.literal('builtin'),
    model: z.string(),
    dims: z.number().int().min(0),
    chunking: z.literal(CHUNKING),
  }),
  complete: z.boolean(),
  records: z.record(
    z.string(),
    z.object({
      h: z.string(),
      chunks: z.array(
        z.object({
          n: z.number().int().min(0),
          title: z.string(),
          hasWords: z.boolean(),
          v: z.string().nullable(),
        }),
      ),
    }),
  ),
})

let cached: SemanticIndex | undefined
// Общая загрузка с диска: второй читатель не должен перезаписать индекс, который уже наполняет прогон.
let loading: Promise<SemanticIndex | undefined> | undefined
// Индекс меняется на месте, поэтому подготовленные векторы сбрасываются при каждой правке records.
let prepared: PreparedVectors | undefined
let running: Promise<void> | undefined
let again = false
let generation = 0
let progress: Pick<AiSemanticStatus['index'], 'done' | 'total'> | undefined
let failure: { code: AiErrorCode, key?: SemanticKey } | undefined
let progressTimer: NodeJS.Timeout | undefined

function indexPath() {
  return path.join(app.getPath('userData'), 'v2', 'ai-semantic', 'index.json')
}

function changed() {
  prepared = undefined
}

export async function loadIndex(
  file = indexPath(),
): Promise<SemanticIndex | undefined> {
  try {
    const parsed = indexFileSchema.parse(
      JSON.parse(await fs.readFile(file, 'utf8')),
    )
    const records = new Map<string, StoredRecord>()
    for (const [ref, record] of Object.entries(parsed.records)) {
      const chunks: StoredChunk[] = []
      for (const chunk of record.chunks) {
        const v = chunk.v === null ? null : decodeVector(chunk.v)
        if (v && v.length !== parsed.fingerprint.dims)
          return undefined
        chunks.push({ ...chunk, v })
      }
      records.set(ref, { h: record.h, chunks })
    }
    return {
      fingerprint: parsed.fingerprint,
      complete: parsed.complete,
      records,
    }
  }
  catch {
    // Отсутствующий, повреждённый или старого формата индекс перестраивается из vault.
    return undefined
  }
}

export async function saveIndex(index: SemanticIndex, file = indexPath()) {
  const data: z.infer<typeof indexFileSchema> = {
    version: 3,
    fingerprint: index.fingerprint,
    complete: index.complete,
    records: Object.fromEntries(
      [...index.records].map(([ref, record]) => [
        ref,
        {
          h: record.h,
          chunks: record.chunks.map(chunk => ({
            ...chunk,
            v: chunk.v && encodeVector(chunk.v),
          })),
        },
      ]),
    ),
  }
  await fs.mkdir(path.dirname(file), { recursive: true })
  const temporary = `${file}.${randomUUID()}.tmp`
  try {
    await fs.writeFile(temporary, JSON.stringify(data))
    await fs.rename(temporary, file)
  }
  catch (error) {
    await fs.rm(temporary, { force: true })
    throw error
  }
}

export function planIndexUpdate(
  records: SemanticIndex['records'],
  entries: Iterable<CorpusEntry>,
) {
  const live = new Set<string>()
  const toEmbed: (CorpusEntry & Required<Pick<CorpusEntry, 'record' | 'h'>>)[]
    = []
  const toCopy: { entry: CorpusEntry & { h: string }, from: StoredRecord }[]
    = []
  const list = [...entries]
  for (const entry of list) live.add(entry.ref)
  const toDelete = [...records.keys()].filter(ref => !live.has(ref))
  const byHash = new Map(
    toDelete.map(ref => [records.get(ref)!.h, records.get(ref)!]),
  )
  for (const entry of list) {
    // Записи, ещё не скачанные из облака, сохраняют прежние векторы.
    if (entry.pending || !entry.record || !entry.h)
      continue
    if (records.get(entry.ref)?.h === entry.h)
      continue
    // Файл переименован извне и получил новый id: векторы того же текста переносятся без эмбеддинга.
    const from = byHash.get(entry.h)
    if (from)
      toCopy.push({ entry: { ...entry, h: entry.h }, from })
    else toEmbed.push({ ...entry, record: entry.record, h: entry.h })
  }
  return { toEmbed, toCopy, toDelete }
}

export async function readIndex() {
  if (!cached) {
    const promise = (loading ??= loadIndex())
    const loaded = await promise
    if (loading === promise)
      cached ??= loaded
  }
  return cached
}

function failedFor(key: SemanticKey) {
  return Boolean(failure?.key && sameSemanticKey(failure.key, key))
}

// Без подготовки векторов: фаза слов спрашивает только, есть ли смысл и готов ли он.
// Полный индекс остаётся рабочим и после упавшей догоняющей синхронизации: старые векторы
// допустимы. Смысла нет, только если первая сборка для этого ключа упала.
export async function meaningState(
  key: SemanticKey | undefined,
): Promise<MeaningState> {
  if (!key)
    return 'off'
  const index = await readIndex()
  if (index?.complete && sameSemanticKey(index.fingerprint, key))
    return 'ready'
  return failedFor(key) ? 'off' : 'warming'
}

// Векторы чанков с центрированием для смыслового поиска; undefined, пока смысл не готов.
export async function readPreparedVectors(key: SemanticKey) {
  if ((await meaningState(key)) !== 'ready')
    return undefined
  const index = cached!
  prepared ??= prepareVectors(
    [...index.records].flatMap(([ref, record]) =>
      record.chunks.flatMap(chunk =>
        chunk.v ? [{ ref, n: chunk.n, vector: chunk.v }] : [],
      ),
    ),
  )
  return prepared
}

interface EmbedItem {
  ref: string
  n: number
  text: string
}

function isStale(runGeneration: number, key: SemanticKey) {
  const current = currentSemanticKey()
  return (
    runGeneration !== generation || !current || !sameSemanticKey(current, key)
  )
}

async function runOnce(runGeneration: number, key: SemanticKey) {
  const stale = () => isStale(runGeneration, key)
  let index = await readIndex()
  // Пока шло чтение, vault мог переехать: индекс уже переписан на новый путь, и удалять его нельзя.
  if (stale())
    return
  if (!index || !sameSemanticKey(index.fingerprint, key)) {
    // Векторы другой модели или vault несопоставимы с новыми: файл удаляется, индекс строится заново.
    await fs.rm(indexPath(), { force: true })
    index = {
      fingerprint: { ...key, dims: 0, chunking: CHUNKING },
      complete: false,
      records: new Map(),
    }
  }
  cached = index
  changed()
  // Индекс в памяти: снимок отличает сверку готового индекса от сборки, пока не началась сама сборка.
  scheduleSemanticProgress()
  let unsaved = 0
  progress = undefined
  try {
    await vaultCorpus.refresh()
    if (stale())
      return
    const { toEmbed, toCopy, toDelete } = planIndexUpdate(
      index.records,
      vaultCorpus.entries.values(),
    )
    for (const ref of toDelete) index.records.delete(ref)
    for (const { entry, from } of toCopy)
      index.records.set(entry.ref, { h: entry.h, chunks: from.chunks })
    unsaved += toDelete.length + toCopy.length

    // Запись заменяется целиком, когда готовы все её чанки: до этого поиск ранжирует её старыми векторами.
    const assembling = new Map<
      string,
      { h: string, chunks: StoredChunk[], left: number }
    >()
    const items: EmbedItem[] = []
    for (const entry of toEmbed) {
      const chunks = chunkRecord(entry.record)
      const embeddable = chunks.filter(chunk => chunk.hasWords)
      const stored = chunks.map(chunk => ({
        n: chunk.n,
        title: chunk.title,
        hasWords: chunk.hasWords,
        v: null,
      }))
      if (!embeddable.length) {
        index.records.set(entry.ref, { h: entry.h, chunks: stored })
        unsaved++
        continue
      }
      assembling.set(entry.ref, {
        h: entry.h,
        chunks: stored,
        left: embeddable.length,
      })
      for (const chunk of embeddable) {
        items.push({
          ref: entry.ref,
          n: chunk.n,
          text: formatDocument(chunk.title, chunk.text),
        })
      }
    }
    changed()
    const current = { done: 0, total: items.length }
    if (items.length) {
      progress = current
      scheduleSemanticProgress()
    }
    for (const batch of planEmbeddingBatches(
      items,
      item => item.text,
      BATCH_LIMITS,
    )) {
      if (stale())
        return
      const vectors = await embedTexts(
        key,
        batch.map(item => item.text),
        AbortSignal.timeout(BATCH_TIMEOUT_MS),
      )
      if (stale())
        return
      index.fingerprint.dims ||= vectors[0].length
      if (vectors[0].length !== index.fingerprint.dims)
        throw new AiError('invalidResponse')
      batch.forEach((item, position) => {
        const record = assembling.get(item.ref)
        if (!record)
          return
        record.chunks[item.n].v = vectors[position]
        if (--record.left > 0)
          return
        assembling.delete(item.ref)
        // Запись удалили или снова изменили, пока шёл эмбеддинг: её подберёт следующий прогон.
        if (vaultCorpus.entries.get(item.ref)?.h === record.h)
          index.records.set(item.ref, { h: record.h, chunks: record.chunks })
      })
      changed()
      current.done += batch.length
      scheduleSemanticProgress()
      unsaved += batch.length
      if (unsaved >= SAVE_EVERY) {
        await saveIndex(index)
        unsaved = 0
      }
    }
    if (!index.complete) {
      index.complete = true
      unsaved++
    }
  }
  finally {
    progress = undefined
    changed()
    if (unsaved && cached === index)
      await saveIndex(index).catch(() => {})
  }
}

export function syncIndex() {
  if (running) {
    again = true
    return running
  }
  failure = undefined
  // Без ключа тело ниже завершилось бы синхронно, и finally обнулил бы running раньше присваивания:
  // running навсегда остался бы выполненным промисом, и следующие запуски ничего бы не делали.
  if (!currentSemanticKey())
    return Promise.resolve()
  running = (async () => {
    let key: SemanticKey | undefined
    try {
      let runGeneration
      do {
        again = false
        runGeneration = generation
        key = currentSemanticKey()
        if (!key)
          break
        try {
          await runOnce(runGeneration, key)
        }
        catch (error) {
          // Ошибка прогона, который уже заменён новым поколением или ключом, не ошибка текущего индекса.
          // Повтор только по новому поколению (условие цикла) или явному запросу (again): при смене vault
          // или источника тексты нового vault не должны уйти на сервер эмбеддингов без поиска.
          if (!isStale(runGeneration, key))
            throw error
        }
      } while (again || runGeneration !== generation)
    }
    catch (error) {
      failure = { code: aiErrorCode(error), key }
    }
    finally {
      running = undefined
      broadcastSemanticProgress()
    }
  })()
  broadcastSemanticProgress()
  return running
}

// Фоновая синхронизация из поиска не повторяет упавший для этого ключа прогон на каждое нажатие:
// повтор — после restartIndex или когда vault изменился (afterChange).
export function syncIndexInBackground(key: SemanticKey, afterChange = false) {
  if (!afterChange && failedFor(key))
    return
  void syncIndex()
}

// Старт приложения = полное чтение vault: keyword-индекс корпуса живёт только в памяти. Прогрев делает
// это заранее при любом источнике семантики, иначе всё чтение пришлось бы на первое нажатие в палитре.
// Встроенная модель индексирует локально и бесплатно, поэтому её векторы тоже готовятся заранее.
export function warmSemanticIndex() {
  const key = currentSemanticKey()
  // После смены vault ошибка старого ключа к новому не относится. Ошибка текущего ключа (поиск упал до
  // прогрева, тот же путь выбран снова) остаётся: иначе фоновый sync повторял бы её без restartIndex.
  if (failure && !(key && failedFor(key))) {
    failure = undefined
    broadcastSemanticProgress()
  }
  void vaultCorpus
    .refresh()
    .catch(error => console.error('[masscode:semantic]', error))
  if (key)
    syncIndexInBackground(key)
}

// При переносе vault id и содержимое записей не меняются: индекс переходит на новый путь без эмбеддинга.
// Выбор другого vault (set-vault-path) так делать не должен: там другие записи под теми же id.
// Ключ не сверяется: источник может быть выключен, а индекс другой модели удалит ближайший прогон.
export async function moveIndexVault(from: string, to: string) {
  const index = await readIndex()
  if (index?.fingerprint.vault !== from)
    return
  index.fingerprint.vault = to
  await saveIndex(index)
}

export function restartIndex() {
  failure = undefined
  generation++
  return syncIndex()
}

// Векторы удалённой модели больше никогда не будут запрошены.
export async function removeIndex() {
  if (!(await readIndex()))
    return
  generation++
  cached = undefined
  loading = undefined
  changed()
  failure = undefined
  // Прогон, заменённый новым поколением, ещё может дописать файл: удаляем после его выхода.
  const current = running
  if (current) {
    await Promise.race([
      current,
      new Promise(resolve => setTimeout(resolve, REMOVE_WAIT_MS)),
    ])
  }
  await fs.rm(indexPath(), { force: true })
  // Прогон, начавшийся в окно ожидания, мог успеть прочитать ещё не удалённый файл.
  cached = undefined
  loading = undefined
  changed()
}

async function indexStatus(): Promise<AiSemanticStatus['index']> {
  const key = currentSemanticKey()
  if (!key)
    return { state: 'off', indexed: 0, complete: false }
  const index = await readIndex()
  const current
    = index && sameSemanticKey(index.fingerprint, key) ? index : undefined
  const indexed = current?.records.size ?? 0
  const complete = Boolean(current?.complete)
  // Недостроенный индекс без прогона (перезапуск посреди сборки, включение источника) достраивается сразу,
  // а не на первом поиске.
  if (!complete && !running)
    syncIndexInBackground(key)
  // Сверка готового индекса без эмбеддинга не считается индексацией: после включения источника сразу видно N.
  if (running && (progress || !complete))
    return { state: 'indexing', indexed, complete, ...progress }
  if (failure)
    return { state: 'error', indexed, complete, error: failure.code }
  return { state: 'idle', indexed, complete }
}

export async function semanticStatus(): Promise<AiSemanticStatus> {
  const { source } = getAiSemanticSettings()
  return {
    source,
    builtin: builtinStatus(),
    index: await indexStatus(),
  }
}

// Снимок для индикатора без диска и без запуска sync: начальный запрос окна не должен читать index.json.
export function semanticProgress(): AiSemanticProgress {
  const { source } = getAiSemanticSettings()
  const { state, progress: percent, error } = builtinStatus()
  return {
    source,
    builtin: { state, progress: percent, error },
    index: indexProgress(),
  }
}

function indexProgress(): AiSemanticProgress['index'] {
  const key = currentSemanticKey()
  if (!key)
    return { state: 'off' }
  // cached выставляет прогон: готовый индекс без эмбеддинга сверяется, а не индексируется.
  const complete = Boolean(
    cached?.complete && sameSemanticKey(cached.fingerprint, key),
  )
  if (running && (progress || !complete))
    return { state: 'indexing', ...progress }
  if (failure)
    return { state: 'error', error: failure.code }
  return { state: 'idle' }
}

export function broadcastSemanticProgress() {
  clearTimeout(progressTimer)
  progressTimer = undefined
  let status: AiSemanticProgress
  try {
    status = semanticProgress()
  }
  catch (error) {
    console.error('[masscode:semantic]', error)
    return
  }
  // Закрытое окно не должно ломать прогон индексации, из которого идёт рассылка.
  try {
    for (const window of BrowserWindow.getAllWindows()) {
      if (window.isDestroyed())
        continue
      try {
        window.webContents.send('system:ai:semantic-progress', status)
      }
      catch {}
    }
  }
  catch {}
}

export function scheduleSemanticProgress() {
  progressTimer ??= setTimeout(broadcastSemanticProgress, PROGRESS_THROTTLE_MS)
}

onBuiltinFailure(scheduleSemanticProgress)
