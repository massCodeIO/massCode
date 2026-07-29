import type { Ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref, watch } from 'vue'

globalThis.computed = computed
globalThis.nextTick = nextTick
globalThis.ref = ref
globalThis.watch = watch

interface EnvFixture {
  id: number
  name: string
  variables: Record<string, string>
  secretKeys: string[]
  missingSecretKeys: string[]
}

interface SetupOptions {
  envs?: EnvFixture[]
  isConfirmed?: boolean
  revealValue?: string | null
  setSecretResult?: boolean
}

function createEnv(patch: Partial<EnvFixture> = {}): EnvFixture {
  return {
    id: 1,
    missingSecretKeys: [],
    name: 'Local',
    secretKeys: [],
    variables: {},
    ...patch,
  }
}

async function flush() {
  await nextTick()
  await nextTick()
}

/** Watcher на `open` асинхронный: нужно дождаться и его await-ов, и ресинка. */
async function openDialog(open: Ref<boolean>) {
  open.value = true
  await flush()
  await flush()
}

async function setup(options: SetupOptions = {}) {
  vi.resetModules()

  const environments = ref<EnvFixture[]>(
    options.envs ?? [createEnv({ variables: { A: '1' } })],
  )
  const activeEnvironmentId = ref<number | null>(
    environments.value[0]?.id ?? null,
  )
  const isSecretsEncryptionAvailable = ref(true)

  const getHttpEnvironments = vi.fn(async () => undefined)
  const updateHttpEnvironment = vi.fn(async () => undefined)
  const createHttpEnvironment = vi.fn(async () => 1)
  const deleteHttpEnvironment = vi.fn(async () => undefined)

  const setSecret = vi.fn(async () => options.setSecretResult ?? true)
  const deleteSecret = vi.fn(async () => true)
  const revealSecret = vi.fn(async () =>
    options.revealValue === undefined ? 'revealed' : options.revealValue,
  )
  const confirm = vi.fn(async () => options.isConfirmed ?? true)

  vi.doMock('../useHttpEnvironments', () => ({
    useHttpEnvironments: () => ({
      activeEnvironmentId,
      createHttpEnvironment,
      deleteHttpEnvironment,
      environments,
      getHttpEnvironments,
      updateHttpEnvironment,
    }),
  }))

  vi.doMock('../useHttpEnvironmentSecrets', () => ({
    useHttpEnvironmentSecrets: () => ({
      deleteSecret,
      isSecretsEncryptionAvailable,
      refreshSecretsStatus: vi.fn(async () => undefined),
      revealSecret,
      setSecret,
    }),
  }))

  vi.doMock('@/composables/useDialog', () => ({
    useDialog: () => ({ confirm }),
  }))

  vi.doMock('@/electron', () => ({
    i18n: { t: (key: string) => key },
  }))

  // Автосохранение по debounce не участвует в проверяемых сценариях: без
  // подмены оно добавляло бы фоновые вызовы update поверх явных flush.
  // Мок частичный: остальной `@vueuse/core` остаётся настоящим, иначе любой
  // новый импорт из него в composable ронял бы тесты.
  vi.doMock('@vueuse/core', async importOriginal => ({
    ...(await importOriginal<typeof import('@vueuse/core')>()),
    useDebounceFn: () => vi.fn(),
  }))

  const { useHttpEnvironmentEditor } = await import(
    '../useHttpEnvironmentEditor'
  )

  const open = ref(false)
  const editor = useHttpEnvironmentEditor(open)

  editor.selectedEnvId.value = environments.value[0]?.id ?? null
  await flush()

  return {
    activeEnvironmentId,
    confirm,
    deleteSecret,
    editor,
    environments,
    getHttpEnvironments,
    open,
    revealSecret,
    setSecret,
    updateHttpEnvironment,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useHttpEnvironmentEditor', () => {
  it('keeps secret values out of the plain variables payload', async () => {
    const { editor, setSecret, updateHttpEnvironment } = await setup({
      envs: [
        createEnv({
          secretKeys: ['S'],
          variables: { A: '1' },
        }),
        createEnv({ id: 2, name: 'Staging' }),
      ],
    })

    const secretRow = editor.localVariables.value.find(
      entry => entry.secret,
    )!
    expect(secretRow.key).toBe('S')

    editor.setSecretValue(secretRow, 'topsecret')
    editor.localName.value = 'Renamed'

    await editor.onSelectEnvironment(2)

    expect(setSecret).toHaveBeenCalledWith(1, 'S', 'topsecret')
    expect(updateHttpEnvironment).toHaveBeenCalledWith(1, { name: 'Renamed' })
    expect(JSON.stringify(updateHttpEnvironment.mock.calls)).not.toContain(
      'topsecret',
    )
  })

  it('keeps an unfinished new secret row on resync', async () => {
    const { editor, environments, getHttpEnvironments } = await setup()

    // Запись секрета в main отражается в окружении: строка TOKEN должна
    // прийти обратно уже как сохранённый секрет.
    getHttpEnvironments.mockImplementation(async () => {
      environments.value = [
        { ...environments.value[0]!, secretKeys: ['TOKEN'] },
      ]
    })

    editor.addSecretVariable()
    const rowA = editor.localVariables.value.at(-1)!
    rowA.key = 'TOKEN'
    editor.setSecretValue(rowA, 'v1')

    editor.addSecretVariable()
    const rowB = editor.localVariables.value.at(-1)!
    editor.setSecretValue(rowB, 'draftB')

    await editor.onSecretValueBlur(rowA)

    const saved = editor.localVariables.value.find(
      entry => entry.key === 'TOKEN' && !entry.isNew,
    )
    expect(saved?.secret).toBe(true)

    const pending = editor.localVariables.value.find(
      entry => entry.uid === rowB.uid,
    )
    expect(pending?.isNew).toBe(true)
    expect(editor.getSecretValue(rowB)).toBe('draftB')
  })

  it('restores the plain row with its old value when setSecret fails', async () => {
    const { editor, setSecret } = await setup({ setSecretResult: false })

    await editor.onToggleSecret(0)

    expect(setSecret).toHaveBeenCalledWith(1, 'A', '1')
    expect(editor.localVariables.value[0]).toMatchObject({
      key: 'A',
      secret: false,
      value: '1',
    })
  })

  it('does not delete the secret when reveal returns null', async () => {
    const { deleteSecret, editor, revealSecret } = await setup({
      envs: [createEnv({ secretKeys: ['S'] })],
      revealValue: null,
    })

    const index = editor.localVariables.value.findIndex(
      entry => entry.secret,
    )
    await editor.onToggleSecret(index)

    expect(revealSecret).toHaveBeenCalledWith(1, 'S')
    expect(deleteSecret).not.toHaveBeenCalled()
    expect(editor.localVariables.value[index]?.secret).toBe(true)
  })

  it('keeps the selected environment on reopen and drops stale secret state', async () => {
    const { editor, open } = await setup({
      envs: [
        createEnv({ secretKeys: ['S'], variables: { A: '1' } }),
        createEnv({ id: 2, name: 'Staging' }),
      ],
    })

    const secretRow = editor.localVariables.value.find(
      entry => entry.secret,
    )!
    editor.setSecretValue(secretRow, 'draft')
    editor.revealedSecrets.value[secretRow.uid] = 'revealed'
    editor.localName.value = 'Renamed'

    await openDialog(open)

    expect(editor.selectedEnvId.value).toBe(1)
    expect(editor.localName.value).toBe('Local')
    expect(editor.revealedSecrets.value).toEqual({})
    const reopenedSecretRow = editor.localVariables.value.find(
      entry => entry.secret,
    )!
    expect(editor.getSecretValue(reopenedSecretRow)).toBe('')
  })

  it('falls back to the active environment when the selected one is gone', async () => {
    const {
      activeEnvironmentId,
      editor,
      environments,
      getHttpEnvironments,
      open,
    } = await setup({
      envs: [
        createEnv({ id: 2, name: 'Staging' }),
        createEnv({ id: 3, name: 'Prod' }),
      ],
    })

    const secretRow = editor.localVariables.value[0]
    if (secretRow)
      editor.revealedSecrets.value[secretRow.uid] = 'revealed'

    // Окружение удалили в другом месте, пока диалог был закрыт.
    getHttpEnvironments.mockImplementation(async () => {
      environments.value = environments.value.filter(env => env.id !== 2)
    })
    activeEnvironmentId.value = 3

    await openDialog(open)

    expect(editor.selectedEnvId.value).toBe(3)
    expect(editor.localName.value).toBe('Prod')
    expect(editor.revealedSecrets.value).toEqual({})
  })

  it('falls back to the first environment when there is no active one', async () => {
    const {
      activeEnvironmentId,
      editor,
      environments,
      getHttpEnvironments,
      open,
    } = await setup({
      envs: [
        createEnv({ id: 2, name: 'Staging' }),
        createEnv({ id: 3, name: 'Prod' }),
      ],
    })

    getHttpEnvironments.mockImplementation(async () => {
      environments.value = environments.value.filter(env => env.id !== 2)
    })
    activeEnvironmentId.value = null

    await openDialog(open)

    expect(editor.selectedEnvId.value).toBe(3)
    expect(editor.localName.value).toBe('Prod')
  })
})
