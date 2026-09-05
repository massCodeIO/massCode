import type { HttpMethod } from '../main/types/http'
import type { HttpRuntimeResult } from './httpRuntime'
import type { HttpScriptResult } from './httpScripts'
import { z } from 'zod'

export const httpRunPrepareSchema = z.object({
  folderId: z.number().int().positive(),
})
export const httpRunStartSchema = z.object({
  runId: z.string(),
  requestIds: z.array(z.number().int().positive()).max(500),
  continueOnFailure: z.boolean(),
  skipCertificateVerification: z.boolean(),
})
export type HttpRunStart = z.infer<typeof httpRunStartSchema>
export type HttpRunStatus =
  | 'ready'
  | 'running'
  | 'passed'
  | 'failed'
  | 'cancelled'
export type HttpRunStepStatus =
  | 'pending'
  | 'running'
  | 'passed'
  | 'failed'
  | 'skipped'
  | 'cancelled'
export interface HttpRunStep {
  requestId: number
  name: string
  folderPath: string
  method: HttpMethod
  state: HttpRunStepStatus
  status?: number | null
  durationMs?: number
  scripts?: HttpScriptResult[]
  assertions?: HttpRuntimeResult[]
  extractions?: HttpRuntimeResult[]
  error?: 'transport' | 'contextChanged'
}
export interface HttpRunView {
  runId: string
  folderName: string
  environmentName: string | null
  state: HttpRunStatus
  steps: HttpRunStep[]
}
