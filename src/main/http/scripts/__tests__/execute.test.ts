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
      `mc.test('boundary', () => { for (const key of ['process', 'require', 'fetch', 'XMLHttpRequest', 'WebSocket', 'Buffer', 'window', 'electron', 'std', 'os', '__emitLog']) mc.assert(typeof globalThis[key] === 'undefined'); mc.assert(mc.variables.get.constructor('return typeof process')() === 'undefined'); });`,
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

describe('script console', () => {
  it('streams levels and structured arguments before an exception', async () => {
    const messages: unknown[] = []
    const result = await executeScript(
      'console.log("hello", { value: 42 }); console.info("info"); console.warn("warn"); console.error("error"); throw Error("private");',
      input,
      new AbortController().signal,
      message => messages.push(message),
    )
    expect(result.error).toBe('exception')
    expect(messages).toEqual([
      { level: 'log', args: ['hello', { value: 42 }] },
      { level: 'info', args: ['info'] },
      { level: 'warn', args: ['warn'] },
      { level: 'error', args: ['error'] },
    ])
  })
  it('streams more than 5000 logs and preserves late clear and error events', async () => {
    const messages: { level: string, args: unknown[] }[] = []
    const result = await executeScript(
      'const value = {}; value.self = value; console.log(value); for(let i=0;i<5005;i++) console.log(i); console.clear(); console.error("tail");',
      input,
      new AbortController().signal,
      message => messages.push(message),
    )
    expect(messages[0]).toEqual({
      level: 'log',
      args: [{ self: '[Circular]' }],
    })
    expect(result.error).toBeUndefined()
    expect(messages).toHaveLength(5008)
    expect(messages.slice(1, 5006)).toEqual(
      Array.from({ length: 5005 }, (_, index) => ({
        level: 'log',
        args: [index],
      })),
    )
    expect(messages.slice(-2)).toEqual([
      { level: 'clear', args: [] },
      { level: 'error', args: ['tail'] },
    ])
  })
})
