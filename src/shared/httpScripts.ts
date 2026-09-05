import { z } from 'zod'

export const httpScriptsSchema = z
  .object({
    preRequest: z.string().max(65536),
    postResponse: z.string().max(65536),
  })
  .strict()
export type HttpScripts = z.infer<typeof httpScriptsSchema>
export function emptyHttpScripts(): HttpScripts {
  return {
    preRequest: '',
    postResponse: '',
  }
}
export function hasHttpScripts(scripts?: HttpScripts) {
  return !!(scripts?.preRequest.trim() || scripts?.postResponse.trim())
}

export const scriptTrustSchema = z
  .object({
    requestId: z.number().int().positive(),
    scripts: httpScriptsSchema,
  })
  .strict()
export const scriptOutputSchema = z
  .object({
    variables: z.record(
      z
        .string()
        .regex(/^(?!__proto__$|constructor$|prototype$)[\w.-]{1,128}$/u),
      z.string().max(16384).nullable(),
    ),
    tests: z
      .array(z.object({ name: z.string().max(128), ok: z.boolean() }).strict())
      .max(100),
  })
  .strict()
export type HttpScriptOutput = z.infer<typeof scriptOutputSchema>
export type HttpScriptError =
  | 'untrusted'
  | 'timeout'
  | 'cancelled'
  | 'limit'
  | 'exception'
  | 'destination'
export interface HttpScriptResult {
  phase: 'preRequest' | 'postResponse'
  error?: HttpScriptError
  tests: { name: string, ok: boolean }[]
}
