import { Readable } from 'node:stream'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registerHttpHandlers, resolveEnvironment } from '../http'

const SECRET_VALUE = 'ab+cd/ef=gh ij'
const SECRET_HOST = 'secret-host.internal'

const {
  addSecretKeyMock,
  appendEntryMock,
  deleteSecretMock,
  environmentSecretKeysMock,
  handleMock,
  logMock,
  removeSecretKeyMock,
  revealSecretMock,
  requestMock,
  secretsMock,
  setSecretMock,
  unprotectSecretMock,
} = vi.hoisted(() => ({
  addSecretKeyMock: vi.fn(),
  appendEntryMock: vi.fn(),
  deleteSecretMock: vi.fn(),
  environmentSecretKeysMock: vi.fn(),
  handleMock: vi.fn(),
  logMock: vi.fn(),
  removeSecretKeyMock: vi.fn(),
  revealSecretMock: vi.fn(),
  requestMock: vi.fn(),
  secretsMock: vi.fn(),
  setSecretMock: vi.fn(),
  unprotectSecretMock: vi.fn(),
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: handleMock,
  },
}))

vi.mock('undici', () => ({
  Agent: class {},
  request: requestMock,
}))

vi.mock('../../../utils', () => ({
  log: logMock,
}))

vi.mock('../../../http/secrets', () => ({
  deleteEnvironmentSecret: deleteSecretMock,
  getEnvironmentSecrets: () => secretsMock(),
  isSecretsEncryptionAvailable: () => true,
  revealEnvironmentSecret: revealSecretMock,
  setEnvironmentSecret: setSecretMock,
}))

vi.mock('../../../storage', () => ({
  useHttpStorage: () => ({
    environments: {
      addSecretKey: addSecretKeyMock,
      getEnvironments: () => [
        {
          createdAt: 0,
          id: 1,
          name: 'Local',
          secretKeys: environmentSecretKeysMock(),
          updatedAt: 0,
          variables: {
            API_KEY: 'stale-plain',
            BASE_URL: 'https://example.test',
          },
        },
      ],
      removeSecretKey: removeSecretKeyMock,
      unprotectSecret: unprotectSecretMock,
    },
    history: {
      appendEntry: appendEntryMock,
    },
  }),
}))

function getHandler(channel: string) {
  registerHttpHandlers()
  return handleMock.mock.calls.find(([name]) => name === channel)?.[1]
}

function getExecuteHandler() {
  return getHandler('spaces:http:execute')
}

function buildPayload(url: string, query: { key: string, value: string }[]) {
  return {
    environmentId: 1,
    request: {
      auth: { type: 'none' },
      body: null,
      bodyType: 'none',
      formData: [],
      headers: [],
      method: 'GET',
      query,
      url,
    },
    requestId: 7,
  }
}

describe('http secrets in request execution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    secretsMock.mockReturnValue({ API_KEY: SECRET_VALUE })
    environmentSecretKeysMock.mockReturnValue(['API_KEY', 'ABSENT_KEY'])
    addSecretKeyMock.mockReturnValue({ notFound: false })
    revealSecretMock.mockReturnValue(null)
  })

  it('resolves the stored secret over a same-named plain variable', () => {
    const { variables } = resolveEnvironment(1)

    expect(variables.API_KEY).toBe(SECRET_VALUE)
    expect(variables.BASE_URL).toBe('https://example.test')
  })

  it('resolves a secret missing on this device to an empty string', () => {
    const { variables } = resolveEnvironment(1)

    // Иначе в запрос ушёл бы литерал `{{ABSENT_KEY}}`.
    expect(variables.ABSENT_KEY).toBe('')
  })

  it('masks secrets in history even when the URL percent-encodes them', async () => {
    requestMock.mockResolvedValueOnce({
      body: Readable.from([]),
      headers: {},
      statusCode: 200,
    })

    const handler = getExecuteHandler()
    await handler(
      null,
      buildPayload('{{BASE_URL}}/items', [
        { key: 'token', value: '{{API_KEY}}' },
      ]),
    )

    // Запрос уходит с настоящим значением секрета.
    const [requestedUrl] = requestMock.mock.calls[0]
    expect(requestedUrl).toContain(
      encodeURIComponent(SECRET_VALUE).slice(0, 8),
    )

    // А в vault попадает только маска: ни сырого, ни закодированного значения.
    const [historyEntry] = appendEntryMock.mock.calls[0]
    expect(historyEntry.url).not.toContain(SECRET_VALUE)
    expect(historyEntry.url).not.toContain('ab%2Bcd')
    expect(historyEntry.url).toContain('token=')
  })

  it('keeps the secret out of history when the request fails', async () => {
    requestMock.mockRejectedValueOnce(
      new Error(`connect ECONNREFUSED for token=${SECRET_VALUE}`),
    )

    const handler = getExecuteHandler()
    await handler(
      null,
      buildPayload('https://example.test/items', [
        { key: 'token', value: '{{API_KEY}}' },
      ]),
    )

    const [historyEntry] = appendEntryMock.mock.calls[0]
    expect(historyEntry.url).not.toContain(SECRET_VALUE)
    expect(historyEntry.url).not.toContain('ab%2Bcd')
    expect(historyEntry.error).not.toContain(SECRET_VALUE)
    expect(historyEntry.error).not.toContain('ab%2Bcd')
    expect(historyEntry.error).toBe('••••••')
  })

  it('masks a secret used as the host in the history error', async () => {
    secretsMock.mockReturnValue({ API_KEY: SECRET_HOST })
    // Текст от undici не содержит собранного URL, поэтому замена по URL
    // такое значение не поймала бы.
    requestMock.mockRejectedValueOnce(
      new Error(`getaddrinfo ENOTFOUND ${SECRET_HOST}`),
    )

    const handler = getExecuteHandler()
    const result = await handler(
      null,
      buildPayload('https://{{API_KEY}}/items', []),
    )

    const [historyEntry] = appendEntryMock.mock.calls[0]
    expect(historyEntry.error).not.toContain(SECRET_HOST)
    // Ответ в renderer остаётся неизменным: инвариант касается только vault.
    expect(result.error).toContain(SECRET_HOST)
  })

  it('uses a generic history error when DNS normalizes secret casing', async () => {
    secretsMock.mockReturnValue({ API_KEY: 'XN--BCHER-KVA.EXAMPLE' })
    requestMock.mockRejectedValueOnce(
      new Error('getaddrinfo ENOTFOUND xn--bcher-kva.example'),
    )

    const result = await getExecuteHandler()(
      null,
      buildPayload('https://{{API_KEY}}/items', []),
    )

    const [historyEntry] = appendEntryMock.mock.calls[0]
    expect(historyEntry.error).toBe('••••••')
    expect(result.error).toContain('xn--bcher-kva.example')
  })
})

describe('set-secret ordering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    secretsMock.mockReturnValue({})
    environmentSecretKeysMock.mockReturnValue([])
    addSecretKeyMock.mockReturnValue({ notFound: false })
    revealSecretMock.mockReturnValue(null)
  })

  it('keeps the plain value in the vault when encryption fails', async () => {
    setSecretMock.mockImplementationOnce(() => {
      throw new Error('safeStorage unavailable')
    })

    const handler = getHandler('spaces:http:set-secret')
    const result = await handler(null, {
      environmentId: 1,
      key: 'API_KEY',
      value: 'plain-value',
    })

    expect(result).toEqual({ error: 'unknown', ok: false })
    expect(addSecretKeyMock).not.toHaveBeenCalled()
  })

  it('rolls the local secret back when the environment is gone', async () => {
    addSecretKeyMock.mockReturnValue({ notFound: true })

    const handler = getHandler('spaces:http:set-secret')
    const result = await handler(null, {
      environmentId: 1,
      key: 'API_KEY',
      value: 'plain-value',
    })

    expect(result).toEqual({ error: 'notFound', ok: false })
    expect(deleteSecretMock).toHaveBeenCalledWith('1', 'API_KEY')
  })

  it('encrypts the value before dropping the plain one from the vault', async () => {
    const handler = getHandler('spaces:http:set-secret')
    const result = await handler(null, {
      environmentId: 1,
      key: 'API_KEY',
      value: 'plain-value',
    })

    expect(result).toEqual({ ok: true })
    // Обратный порядок терял бы значение целиком при сбое шифрования.
    expect(setSecretMock.mock.invocationCallOrder[0]).toBeLessThan(
      addSecretKeyMock.mock.invocationCallOrder[0],
    )
  })

  it('updates an existing secret without rewriting vault metadata', async () => {
    environmentSecretKeysMock.mockReturnValue(['API_KEY'])
    revealSecretMock.mockReturnValue('old-value')

    const result = await getHandler('spaces:http:set-secret')(null, {
      environmentId: 1,
      key: 'API_KEY',
      value: 'new-value',
    })

    expect(result).toEqual({ ok: true })
    expect(setSecretMock).toHaveBeenCalledWith('1', 'API_KEY', 'new-value')
    expect(addSecretKeyMock).not.toHaveBeenCalled()
  })

  it('restores the prior local value when protecting metadata fails', async () => {
    revealSecretMock.mockReturnValue('old-value')
    addSecretKeyMock.mockImplementationOnce(() => {
      throw new Error('flush failed')
    })

    const result = await getHandler('spaces:http:set-secret')(null, {
      environmentId: 1,
      key: 'API_KEY',
      value: 'new-value',
    })

    expect(result).toEqual({ error: 'unknown', ok: false })
    expect(setSecretMock).toHaveBeenNthCalledWith(
      2,
      '1',
      'API_KEY',
      'old-value',
    )
    expect(deleteSecretMock).not.toHaveBeenCalled()
  })

  it('rolls the local secret back when adding the key throws', async () => {
    addSecretKeyMock.mockImplementationOnce(() => {
      throw new Error('vault is hydrating')
    })

    const handler = getHandler('spaces:http:set-secret')
    const result = await handler(null, {
      environmentId: 1,
      key: 'API_KEY',
      value: 'plain-value',
    })

    expect(result).toEqual({ error: 'unknown', ok: false })
    // Иначе локальное значение осталось бы без ключа в `secretKeys`.
    expect(deleteSecretMock).toHaveBeenCalledWith('1', 'API_KEY')
  })
})

describe('delete-secret', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    secretsMock.mockReturnValue({})
    environmentSecretKeysMock.mockReturnValue(['API_KEY'])
    removeSecretKeyMock.mockReturnValue({ notFound: false })
  })

  it('removes the key and the local value', async () => {
    const handler = getHandler('spaces:http:delete-secret')
    const result = await handler(null, { environmentId: 1, key: ' API_KEY ' })

    expect(result).toEqual({ ok: true })
    expect(removeSecretKeyMock).toHaveBeenCalledWith(1, 'API_KEY')
    expect(deleteSecretMock).toHaveBeenCalledWith('1', 'API_KEY')
  })

  it('keeps the local value when the environment is gone', async () => {
    removeSecretKeyMock.mockReturnValue({ notFound: true })

    const handler = getHandler('spaces:http:delete-secret')
    const result = await handler(null, { environmentId: 2, key: 'API_KEY' })

    expect(result).toEqual({ error: 'notFound', ok: false })
    expect(deleteSecretMock).not.toHaveBeenCalled()
  })

  it('succeeds when ciphertext cleanup fails after metadata commit', async () => {
    deleteSecretMock.mockImplementationOnce(() => {
      throw new Error('local store failed')
    })

    const result = await getHandler('spaces:http:delete-secret')(null, {
      environmentId: 1,
      key: 'API_KEY',
    })

    expect(result).toEqual({ ok: true })
    expect(logMock).toHaveBeenCalledWith(
      'http:delete-secret-cleanup',
      expect.any(Error),
    )
  })
})

describe('unprotect-secret', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    revealSecretMock.mockReturnValue('plain-value')
    environmentSecretKeysMock.mockReturnValue(['API_KEY'])
    unprotectSecretMock.mockReturnValue({ notFound: false })
  })

  it('persists plaintext metadata before deleting ciphertext', async () => {
    const result = await getHandler('spaces:http:unprotect-secret')(null, {
      environmentId: 1,
      key: 'API_KEY',
    })

    expect(result).toEqual({ ok: true })
    expect(unprotectSecretMock).toHaveBeenCalledWith(
      1,
      'API_KEY',
      'plain-value',
    )
    expect(deleteSecretMock).toHaveBeenCalledWith('1', 'API_KEY')
    expect(unprotectSecretMock.mock.invocationCallOrder[0]).toBeLessThan(
      deleteSecretMock.mock.invocationCallOrder[0],
    )
  })

  it('keeps ciphertext when the durable transition fails', async () => {
    unprotectSecretMock.mockImplementationOnce(() => {
      throw new Error('flush failed')
    })

    const result = await getHandler('spaces:http:unprotect-secret')(null, {
      environmentId: 1,
      key: 'API_KEY',
    })

    expect(result).toEqual({ error: 'unknown', ok: false })
    expect(deleteSecretMock).not.toHaveBeenCalled()
  })

  it('succeeds when ciphertext cleanup fails after unprotect commit', async () => {
    deleteSecretMock.mockImplementationOnce(() => {
      throw new Error('local store failed')
    })

    const result = await getHandler('spaces:http:unprotect-secret')(null, {
      environmentId: 1,
      key: 'API_KEY',
    })

    expect(result).toEqual({ ok: true })
    expect(logMock).toHaveBeenCalledWith(
      'http:unprotect-secret-cleanup',
      expect.any(Error),
    )
  })
})
