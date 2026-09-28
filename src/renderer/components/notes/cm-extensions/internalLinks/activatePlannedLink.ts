import type { NoteLinkSource } from './creationSource'
import type { InternalLinkType } from './parser'
import { useNoteContent } from '@/composables/spaces/notes/useNoteContent'
import { useSonner } from '@/composables/useSonner'
import { i18n } from '@/electron'
import { openInternalTarget } from '@/ipc/listeners/deepLinks'
import {
  createHttpRequestOperation,
  createNoteOperation,
  createSnippetOperation,
  getPlannedHttpCollection,
} from './createPlannedTarget'
import { buildLinkMarkdown } from './parser'

type Operation = ReturnType<
  | typeof createNoteOperation
  | typeof createSnippetOperation
  | typeof createHttpRequestOperation
>
const pending = new WeakMap<
  NoteLinkSource,
  { operation?: Operation, flight?: Promise<void>, inserted: boolean }
>()

export function activatePlannedLink(
  source: NoteLinkSource,
  type: InternalLinkType,
  name: string,
): Promise<void> {
  let entry = pending.get(source)
  if (!entry) {
    entry = { inserted: false }
    pending.set(source, entry)
  }
  if (entry.flight)
    return entry.flight
  const owned = entry
  const checkSource = () => {
    if (!source.valid())
      throw new Error('LINK_SOURCE_CHANGED')
  }
  const flush = () => useNoteContent().flushNoteContent(source.noteId)
  owned.flight = (async () => {
    try {
      checkSource()
      await flush()
      checkSource()
      if (!owned.operation) {
        const input = { name: name || undefined }
        if (type === 'http-request') {
          const folderId = await getPlannedHttpCollection(checkSource)
          checkSource()
          owned.operation = createHttpRequestOperation(
            { ...input, folderId },
            checkSource,
          )
        }
        else {
          owned.operation
            = type === 'note'
              ? createNoteOperation(input, checkSource)
              : createSnippetOperation(input, checkSource)
        }
      }
      const operation = owned.operation
      if (
        operation.state.uncertain
        && operation.state.id
        && 'reconcileFragment' in operation
      ) {
        await operation.reconcileFragment()
      }
      const id = await operation.run()
      checkSource()
      const unlock = source.lock()
      try {
        await flush()
        checkSource()
        if (!owned.inserted) {
          source.insert(buildLinkMarkdown(`${type}:${id}`))
          owned.inserted = true
        }
        await flush()
        checkSource()
        await openInternalTarget({ type, id })
        await new Promise<void>((resolve) => {
          const observer = new MutationObserver(focusTitle)
          const timeout = setTimeout(finish, 5000)
          function finish() {
            clearTimeout(timeout)
            observer.disconnect()
            resolve()
          }
          function focusTitle() {
            const input = document.querySelector<HTMLInputElement>(
              `input[data-planned-title="${type}:${id}"]`,
            )
            if (!input || input.disabled)
              return
            input.focus()
            input.select()
            if (document.activeElement === input)
              finish()
          }
          observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
          })
          focusTitle()
        })
        source.release()
        pending.delete(source)
      }
      finally {
        unlock()
      }
    }
    catch {
      useSonner().sonner({
        type: 'error',
        message: i18n.t('internalLinks.planned.failed'),
        action:
          owned.operation?.state.uncertain && !owned.operation.state.id
            ? undefined
            : {
                label: i18n.t('contentLoad.retry'),
                onClick: () => {
                  void activatePlannedLink(source, type, name)
                },
              },
      })
    }
    finally {
      owned.flight = undefined
    }
  })()
  return owned.flight
}
