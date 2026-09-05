import type {
  HttpScriptError,
  HttpScriptOutput,
} from '../../../shared/httpScripts'
import { Buffer } from 'node:buffer'
import { Worker } from 'node:worker_threads'
import { scriptOutputSchema } from '../../../shared/httpScripts'
import { scriptWorkerSource } from './worker'

export type ScriptExecution =
  | { output: HttpScriptOutput, error?: never }
  | { error: HttpScriptError, output?: never }

export async function executeScript(
  code: string,
  input: unknown,
  signal: AbortSignal,
): Promise<ScriptExecution> {
  if (signal.aborted)
    return { error: 'cancelled' }
  const serialized = JSON.stringify(input)
  if (code.length > 65536 || Buffer.byteLength(serialized) > 2 * 1024 * 1024)
    return { error: 'limit' }
  return new Promise((resolve) => {
    const worker = new Worker(scriptWorkerSource, {
      eval: true,
      workerData: {
        code,
        input: serialized,
        modulePath: require.resolve('quickjs-emscripten'),
      },
      resourceLimits: {
        maxOldGenerationSizeMb: 32,
        maxYoungGenerationSizeMb: 8,
        stackSizeMb: 2,
      },
      stdout: true,
      stderr: true,
    })
    let finished = false
    const abort = () => finish({ error: 'cancelled' })
    const timer = setTimeout(() => finish({ error: 'timeout' }), 1500)
    function finish(result: ScriptExecution) {
      if (finished)
        return
      finished = true
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      void worker.terminate().then(
        () => resolve(result),
        () => resolve({ error: 'limit' }),
      )
    }
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted)
      abort()
    worker.once('error', () => finish({ error: 'limit' }))
    worker.once('exit', () => finish({ error: 'limit' }))
    worker.once('message', (message: unknown) => {
      if (!message || typeof message !== 'object')
        return finish({ error: 'limit' })
      if (
        'output' in message
        && typeof message.output === 'string'
        && message.output.length <= 65536
      ) {
        try {
          const output = scriptOutputSchema.parse(JSON.parse(message.output))
          if (Object.keys(output.variables).length > 100)
            return finish({ error: 'limit' })
          return finish({ output })
        }
        catch {
          return finish({ error: 'limit' })
        }
      }
      finish({
        error:
          'error' in message && message.error === 'timeout'
            ? 'timeout'
            : 'error' in message && message.error === 'exception'
              ? 'exception'
              : 'limit',
      })
    })
  })
}
