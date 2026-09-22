import { expect, it, vi } from 'vitest'
import { ref } from 'vue'
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
