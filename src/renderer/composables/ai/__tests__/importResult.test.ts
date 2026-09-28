import { expect, it, vi } from 'vitest'
import { ref } from 'vue'
import {
  aiDataWarningsSchema,
  sanitizeAiDataWarnings,
} from '~/shared/aiDataActions'
import { createImportResultSession } from '../../importResult'

Object.assign(globalThis, { ref })

it.each(['applied', 'failed'] as const)(
  'reports %s to the original opening after asynchronous Apply closes and is replaced',
  async (status) => {
    const session = createImportResultSession()
    const first = vi.fn()
    const second = vi.fn()
    session.open(first)
    const preview = session.capture()
    preview('previewed')
    const application = session.beginApply()!
    let complete!: () => void
    const pending = new Promise<void>((resolve) => {
      complete = resolve
    }).then(() =>
      application.report(status, { notes: status === 'applied' ? 2 : 0 }),
    )
    session.close()
    session.open(second)
    expect(first).not.toHaveBeenCalledWith('cancelled')
    expect(application.isCurrent()).toBe(false)
    preview('previewed', { notes: 99 })
    expect(first).not.toHaveBeenCalledWith('previewed', { notes: 99 })
    complete()
    await pending
    expect(first).toHaveBeenLastCalledWith(status, {
      notes: status === 'applied' ? 2 : 0,
    })
    expect(second).not.toHaveBeenCalled()
    expect(session.canContinue()).toBe(true)
    session.close()
    expect(second).toHaveBeenCalledExactlyOnceWith('cancelled')
  },
)
it('preserves manual autodetection and limits an explicit parser to its AI opening', async () => {
  vi.resetModules()
  const { useImportDialog } = await import('../../useImportDialog')
  const dialog = useImportDialog()
  for (const source of [
    'github-gists',
    'raycast-snippets',
    'snippetslab',
    'vscode-snippets',
  ] as const) {
    dialog.openImportDialog(source)
    expect(dialog.importDialogSource.value).toBeUndefined()
  }
  dialog.openImportDialog('raycast-snippets', 'code', vi.fn())
  expect(dialog.importDialogSource.value).toBe('raycast-snippets')
  dialog.closeImportResult()
  dialog.openImportDialog('vscode-snippets')
  expect(dialog.importDialogSource.value).toBeUndefined()
})

it('retains native warning details and numeric counts after the import dialog closes', () => {
  const session = createImportResultSession()
  const report = vi.fn()
  const warnings = {
    items: [{ source: 'collection.json', message: 'Duplicate variables' }],
    count: 1,
    truncated: false,
  }
  session.open(report)
  const application = session.beginApply()!
  session.close()
  session.open(vi.fn())
  application.report('applied', { requests: 2 }, warnings)
  application.report('failed')
  expect(report).toHaveBeenCalledExactlyOnceWith(
    'applied',
    { requests: 2 },
    warnings,
  )
})

it('redacts warning credentials before bounding strings and preserves the native receipt count', () => {
  const warnings = sanitizeAiDataWarnings({
    items: [
      {
        source: `${'s'.repeat(190)} token=${'source-credential'.repeat(100)}`,
        message: `${'m'.repeat(970)} token=${'message-credential'.repeat(100)}`,
      },
    ],
    count: 1,
    truncated: false,
  })
  expect(aiDataWarningsSchema.safeParse(warnings).success).toBe(true)
  expect(warnings.count).toBe(1)
  expect(warnings.truncated).toBe(true)
  expect(warnings.items[0]!.source).toHaveLength(200)
  expect(warnings.items[0]!.message).toBe(
    `${'m'.repeat(970)} token=[REDACTED]`,
  )
  expect(JSON.stringify(warnings)).not.toContain('credential')
})
