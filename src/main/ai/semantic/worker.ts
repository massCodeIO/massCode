import type {
  PretrainedConfig,
  PreTrainedModel,
  PreTrainedTokenizer,
  Tensor,
} from '@huggingface/transformers'
import process from 'node:process'
import { embedWithinLimit } from './batching'
import { BUILTIN_MODEL, modelSnapshotDir } from './builtinModel'

// Работает в utility process Electron: единственный модуль, который загружает transformers и нативный runtime.
// В сеть не ходит: читает только файлы, уже проверенные main по закреплённым хэшам.

type Request =
  | { type: 'load', modelDir: string, threads: number }
  | { id: number, type: 'embed', texts: string[] }

let model: PreTrainedModel | undefined
let tokenizer: PreTrainedTokenizer | undefined
let queue = Promise.resolve()

function post(message: unknown) {
  process.parentPort.postMessage(message)
}

// Без этого загрузились бы ещё энкодеры изображений и звука.
function textOnly(config: PretrainedConfig) {
  const multimodal = config as PretrainedConfig & {
    vision_config: unknown
    audio_config: unknown
  }
  multimodal.vision_config = null
  multimodal.audio_config = null
  return config
}

// Загрузка по пути, а не по id модели: поиск по id запросил бы tokenizer_config.json ревизии "main".
async function load(modelDir: string, threads: number) {
  let transformers: typeof import('@huggingface/transformers')
  try {
    transformers = await import('@huggingface/transformers')
  }
  catch (error) {
    console.error('[masscode:embeddings]', error)
    post({ type: 'error' })
    return
  }
  const { env, AutoConfig, AutoModel, AutoTokenizer } = transformers
  // Кэш по умолчанию лежит рядом с пакетом, а внутри app.asar он только для чтения.
  env.cacheDir = modelDir
  env.allowRemoteModels = false
  env.allowLocalModels = true
  env.useFSCache = false
  try {
    const snapshot = modelSnapshotDir(modelDir)
    const options = { local_files_only: true }
    const config = textOnly(
      await AutoConfig.from_pretrained(snapshot, options),
    )
    tokenizer = await AutoTokenizer.from_pretrained(snapshot, options)
    model = await AutoModel.from_pretrained(snapshot, {
      ...options,
      config,
      dtype: BUILTIN_MODEL.dtype,
      device: 'cpu',
      session_options: { intraOpNumThreads: threads },
    })
    post({ type: 'ready' })
  }
  catch (error) {
    console.error('[masscode:embeddings]', error)
    post({ type: 'error' })
  }
}

// 2026-10-12: процесс падал (exit 5) на батчах около 4200+ токенов с паддингом; предел с запасом.
const MAX_PADDED_TOKENS = 3000

async function embed(id: number, texts: string[]) {
  try {
    if (!model || !tokenizer)
      throw new Error('Model is not loaded')
    const loaded = { model, tokenizer }
    const vectors = await embedWithinLimit(
      texts,
      MAX_PADDED_TOKENS,
      async (batch) => {
        const inputs = await loaded.tokenizer(batch, {
          padding: true,
          truncation: true,
          max_length: 2048,
        })
        const [rows, length] = (inputs.input_ids as Tensor).dims
        return { inputs, padded: rows * length }
      },
      async (inputs) => {
        const output = (await loaded.model(inputs)) as {
          sentence_embedding: Tensor
        }
        return output.sentence_embedding.tolist() as number[][]
      },
    )
    post({ id, vectors })
  }
  catch (error) {
    post({ id, error: error instanceof Error ? error.message : String(error) })
  }
}

process.parentPort.on('message', ({ data }: { data: Request }) => {
  // Сессия и токенизатор общие, поэтому запросы выполняются строго по одному.
  queue = queue.then(() =>
    'id' in data
      ? embed(data.id, data.texts)
      : load(data.modelDir, data.threads),
  )
})
