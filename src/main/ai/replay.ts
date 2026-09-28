import type { AiResponseReplay } from '../../shared/aiResponses'
import type { AiSdkReplay } from '../../shared/aiSdkReplay'

export type AiReplay = AiResponseReplay | AiSdkReplay
export function replayFields(replay?: AiReplay) {
  return !replay
    ? {}
    : 'provider' in replay
      ? { sdkResponse: replay }
      : { openaiResponse: replay }
}
