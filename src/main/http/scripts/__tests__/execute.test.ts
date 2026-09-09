import { describe, expect, it } from 'vitest'
import { executeScript } from '../execute'

const input = {
  variables: { token: 'secret' },
  request: { method: 'GET' },
  response: { status: 200 },
}
function run(code: string) {
  return executeScript(code, input, new AbortController().signal)
}

describe('quickJS worker boundary', () => {
  it('supports variables and isolated tests', async () => {
    expect(
      await run(
        'mc.variables.set("next", "value"); mc.test("status", () => mc.assert(mc.response.status === 200)); mc.test("failure", () => mc.assert(false));',
      ),
    ).toEqual({
      output: {
        variables: { next: 'value' },
        tests: [
          { name: 'status', ok: true },
          { name: 'failure', ok: false },
        ],
      },
    })
  })
  it('has no host, network or filesystem capabilities, including constructor escape', async () => {
    const result = await run(
      `mc.test('boundary', () => { for (const key of ['process', 'require', 'fetch', 'XMLHttpRequest', 'WebSocket', 'Buffer', 'window', 'electron', 'std', 'os', 'console']) mc.assert(typeof globalThis[key] === 'undefined'); mc.assert(mc.variables.get.constructor('return typeof process')() === 'undefined'); });`,
    )
    expect(result.output?.tests).toEqual([{ name: 'boundary', ok: true }])
  })
  it('terminates an endless loop and recovers', async () => {
    expect((await run('while (true) {}')).error).toBe('timeout')
    expect((await run('mc.assert(true)')).error).toBeUndefined()
  })
  it('bounds allocation and recovers', async () => {
    expect(
      (
        await run(
          'const a = []; while (true) a.push(new Array(100000).fill(1))',
        )
      ).error,
    ).toBeTruthy()
    expect((await run('mc.assert(true)')).error).toBeUndefined()
  })
  it('cancels while executing', async () => {
    const controller = new AbortController()
    const task = executeScript('while (true) {}', input, controller.signal)
    setTimeout(() => controller.abort(), 50)
    expect(await task).toEqual({ error: 'cancelled' })
  })
  it('bounds output even if the user catches errors', async () => {
    expect(
      (
        await run(
          'for(let i=0;i<200;i++) { try { mc.variables.set("v"+i,"x") } catch {} }',
        )
      ).error,
    ).toBe('limit')
  })
  it('does not expose exception text or getters', async () => {
    expect(
      await run(
        'throw { get message() { while(true){} }, secret: mc.variables.get("token") }',
      ),
    ).toEqual({ error: 'exception' })
  })
  it('rejects async work, modules and oversized input', async () => {
    expect(
      (await run('Promise.resolve().then(() => mc.variables.set("x","y"))'))
        .error,
    ).toBeTruthy()
    expect((await run('import x from "node:fs"')).error).toBeTruthy()
    expect(
      (
        await executeScript(
          '',
          'x'.repeat(3 * 1024 * 1024),
          new AbortController().signal,
        )
      ).error,
    ).toBe('limit')
  })
  it('does not share globals across phases', async () => {
    await run('globalThis.secret = 123')
    expect(
      (
        await run(
          'mc.test("fresh", () => mc.assert(typeof secret === "undefined"))',
        )
      ).output?.tests[0]?.ok,
    ).toBe(true)
  })
})

describe('response JSON API', () => {
  it.each(['{"value":"ok"}', 'null', '[1,2]', 'false'])(
    'parses %s in the sandbox',
    async (body) => {
      const result = await executeScript(
        'mc.test("json", () => { mc.assert(JSON.stringify(mc.response.json()) === mc.response.body); });',
        { ...input, response: { body, bodyKind: 'text', truncated: false } },
        new AbortController().signal,
      )
      expect(result.output?.tests).toEqual([{ name: 'json', ok: true }])
    },
  )
  it.each([
    { body: '{}', truncated: true },
    { body: '{}', bodyKind: 'binary' },
    { body: 'invalid' },
    null,
  ])('rejects unreadable response %j', async (response) => {
    const result = await executeScript(
      'mc.response.json()',
      { ...input, response },
      new AbortController().signal,
    )
    expect(result.error).toBe('exception')
  })
})
