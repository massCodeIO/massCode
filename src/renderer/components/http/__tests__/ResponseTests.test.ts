import { renderToString } from '@vue/server-renderer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, createSSRApp, h } from 'vue'
import ResponseTests from '../ResponseTests.vue'
import RuntimeResultGroup from '../RuntimeResultGroup.vue'

const state = vi.hoisted(() => ({ lastResponse: { value: null as any } }))
vi.mock('@/composables', () => ({ useHttpExecute: () => state }))
vi.mock('@/electron', () => ({ i18n: { t: (key: string) => key } }))
Object.assign(globalThis, { computed })

async function renderResults() {
  const app = createSSRApp(ResponseTests)
  app.component('HttpRuntimeResultGroup', RuntimeResultGroup)
  app.component('UiText', {
    setup:
      (_, { slots }) =>
        () =>
          h('span', slots.default?.()),
  })
  return (await renderToString(app)).replace(/\s+/g, ' ')
}

beforeEach(() => {
  state.lastResponse.value = {
    runtimeResults: { assertions: [], extractions: [] },
  }
})

describe('hTTP rule results', () => {
  it('counts assertions only, even when an extraction fails', async () => {
    state.lastResponse.value.runtimeResults = {
      assertions: [{ name: 'Status', ok: true }],
      extractions: [{ name: 'Token', ok: false, errorCode: 'missing' }],
    }
    const html = await renderResults()
    expect(html).toContain('1/1')
    expect(html).not.toContain('1/2')
    expect(html).toContain('spaces.http.runtime.extractionResults')
    expect(html).toContain('Token')
    expect(html).toContain('spaces.http.runtime.errors.missing')
  })

  it('shows extraction-only diagnostics without a test summary', async () => {
    state.lastResponse.value.runtimeResults.extractions = [
      { name: 'Token', ok: true },
    ]
    const html = await renderResults()
    expect(html).toContain('Token')
    expect(html).toContain('spaces.http.runtime.extractionResults')
    expect(html).not.toContain('spaces.http.runtime.testResults')
    expect(html).not.toContain('0/0')
  })
})
