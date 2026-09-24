import type {
  WorkspaceContainer,
  WorkspaceItem,
  WorkspaceProposal,
} from '../../shared/aiWorkspace'
import { randomUUID } from 'node:crypto'
import { redactAiHttp } from '../../shared/aiHttp'
import { applyAiPatch, inverseAiPatch } from '../../shared/aiUndo'
import {
  workspaceCreateSchema,
  workspacePlanSchema,
} from '../../shared/aiWorkspace'
import { useHttpStorage, useNotesStorage, useStorage } from '../storage'
import { PartialCreateError } from '../storage/partialCreateError'
import { assertUniqueSiblingFolderName } from '../storage/providers/markdown/runtime/validation'
import { vaultIdentity } from './vault'
import {
  applyLifecycle,
  isLifecycle,
  lifecyclePreview,
  lifecycleSnapshot,
  validateLifecycle,
} from './workspaceLifecycle'
import {
  folders,
  read,
  removeCreated,
  snapshotFields,
  validate,
  validateFileReferences,
  verifyWrite,
  write,
} from './workspaceStorage'

// Vault parsing may reorder object keys; ordering is not a user edit.
function fingerprint(value: unknown): string {
  return JSON.stringify(value, (_key, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map(key => [key, item[key]]),
        )
      : item)
}

function undoFingerprint(value: unknown, createdFolder = false): string {
  // Opening a created folder in the sidebar must not prevent its removal.
  // Only omit the folder's own UI flag, never similarly named config fields.
  if (
    createdFolder
    && value
    && typeof value === 'object'
    && 'isOpen' in value
  ) {
    const { isOpen: _isOpen, ...record } = value
    value = record
  }
  return fingerprint(
    JSON.parse(
      JSON.stringify(value, (key, item) =>
        key === 'updatedAt' || key === 'runtimeRevision' ? undefined : item),
    ),
  )
}

// A proposal is owned by the main process; the renderer can only approve its ID.
// Existing-record changes require review. Creation uses a create-only schema.
// Baselines are checked again immediately before writes.
export function createWorkspaceManager() {
  const proposals = new Map<
    string,
    {
      vault: ReturnType<typeof vaultIdentity>
      value: WorkspaceProposal
      baselines: string[]
      before: ReturnType<typeof read>[]
      applied: Set<number>
      failed: Set<number>
      undo: Map<
        number,
        {
          id: number
          baseline: string
          fields?: {
            before: Record<string, unknown>
            after: Record<string, unknown>
          }
          folderOrder?: {
            read: () => string
            baseline: string
            restore: (name?: string) => void
          }
          restore?: () => void
          read?: () => unknown
        }
      >
    }
  >()
  return {
    clear() {
      proposals.clear()
    },
    propose(input: unknown, userMessages: string[] = []): WorkspaceProposal {
      const plan = workspacePlanSchema.parse(input)
      if (JSON.stringify(plan).length > 500000)
        throw new Error('PLAN_TOO_LARGE')
      const targets = new Set<string>()
      const before = plan.operations.map((op, index) => {
        validateFileReferences(op, userMessages)
        if (op.fields.folderOperation !== undefined) {
          const dependency = plan.operations[op.fields.folderOperation]
          if (
            op.fields.folderOperation >= index
            || dependency?.action !== 'create'
            || dependency.kind !== 'folder'
            || dependency.space !== op.space
          ) {
            throw new Error('INVALID_DEPENDENCY')
          }
        }
        const target = `${op.space}:${op.kind}:${op.id}:${op.fields.contentId ?? ''}`
        if (op.action !== 'create' && targets.has(target))
          throw new Error('DUPLICATE_TARGET')
        targets.add(target)
        if (isLifecycle(op)) {
          validateLifecycle(op)
          return structuredClone(read(op))
        }
        return structuredClone(validate(op))
      })
      const preview = (
        operation: (typeof plan.operations)[number],
        fields: Record<string, unknown>,
      ) => {
        const result = { ...fields }
        if (typeof result.folderId === 'number') {
          result.folderId
            = folders(operation.space)
              .getFolders()
              .find(folder => folder.id === result.folderId)
              ?.name
              ?? result.folderId
        }
        if (typeof result.folderOperation === 'number') {
          result.folderId
            = plan.operations[result.folderOperation]?.fields.name
          delete result.folderOperation
        }
        return redactAiHttp(result)
      }
      const value: WorkspaceProposal = {
        id: randomUUID(),
        summary: plan.summary,
        changes: plan.operations.map((operation, i) => {
          if (isLifecycle(operation)) {
            const preview = lifecyclePreview(operation)
            return {
              operation,
              name: String(
                'name' in preview ? preview.name : preview.before.name,
              ),
              irreversible: preview.irreversible,
              before: JSON.stringify(preview.before, null, 2),
              after: JSON.stringify(preview.after, null, 2),
            }
          }
          return {
            operation,
            name: operation.fields.name ?? before[i]?.name ?? '',
            before: JSON.stringify(
              preview(
                operation,
                before[i] ? snapshotFields(operation, before[i]) : {},
              ),
              null,
              2,
            ),
            after: JSON.stringify(
              preview(operation, operation.fields),
              null,
              2,
            ),
          }
        }),
      }
      if (proposals.size >= 30)
        proposals.delete(proposals.keys().next().value!)
      proposals.set(value.id, {
        vault: vaultIdentity(),
        value,
        before,
        baselines: plan.operations.map((op, index) =>
          fingerprint(isLifecycle(op) ? lifecycleSnapshot(op) : before[index]),
        ),
        applied: new Set(),
        failed: new Set(),
        undo: new Map(),
      })
      return value
    },
    undo(id: string, index: number, partial = false) {
      const plan = proposals.get(id)
      const applied = plan?.undo.get(index)
      const op = plan?.value.changes[index]?.operation
      if (
        !plan
        || !op
        || !applied
        || plan.vault !== vaultIdentity()
        || (!applied.fields
          && undoFingerprint(
            applied.read ? applied.read() : read({ ...op, id: applied.id }),
            op.action === 'create' && op.kind === 'folder',
          ) !== applied.baseline)
      ) {
        throw new Error('STALE_PROPOSAL')
      }
      if (applied.folderOrder) {
        if (applied.folderOrder.read() !== applied.folderOrder.baseline)
          throw new Error('STALE_PROPOSAL')
      }
      if (applied.fields) {
        const current = read({ ...op, id: applied.id })
        if (!current)
          throw new Error('STALE_PROPOSAL')
        const inverse = inverseAiPatch(
          applied.fields.before,
          applied.fields.after,
          snapshotFields(op, current, true),
        )
        if (inverse.conflicts.length && !partial)
          throw new Error('STALE_PROPOSAL')
        if (applied.folderOrder) {
          applied.folderOrder.restore(
            typeof inverse.patch.name === 'string'
              ? inverse.patch.name
              : undefined,
          )
          delete inverse.patch.name
          delete applied.folderOrder
        }
        if (Object.keys(inverse.patch).length) {
          const currentFields = snapshotFields(op, current, true)
          const merged = applyAiPatch(currentFields, inverse.patch)
          // Runtime version is a discriminator: an independently edited script
          // retained by partial Undo still requires v2.
          for (const path of [['runtime'], ['collectionConfig', 'runtime']]) {
            const runtimeIn = (fields: Record<string, unknown>) =>
              path.reduce<Record<string, unknown> | undefined>(
                (value, key) =>
                  value?.[key] as Record<string, unknown> | undefined,
                fields,
              )
            const runtime = runtimeIn(merged)
            if (!runtime?.scripts || runtime.version === 2)
              continue
            runtime.version = 2
            // The discriminator was deferred, not undone. Keep it with the
            // conflicting scripts so a later retry can restore the exact v1.
            if (
              inverse.conflicts.length
              && runtimeIn(inverse.patch)?.version === 1
            ) {
              for (const [remaining, original] of [
                [inverse.remainingBefore, applied.fields.before],
                [inverse.remainingAfter, applied.fields.after],
              ]) {
                let target = remaining!
                for (const key of path) {
                  target[key] ??= {}
                  target = target[key] as Record<string, unknown>
                }
                target.version = runtimeIn(original!)?.version
              }
            }
          }
          const fields = Object.fromEntries(
            Object.keys(inverse.patch).map(key => [key, merged[key]]),
          )
          const restored = {
            ...op,
            fields: {
              ...fields,
              ...(op.fields.contentId
                ? { contentId: op.fields.contentId }
                : {}),
            },
          }
          write(restored, applied.id, true)
          verifyWrite(restored, applied.id)
        }
        if (inverse.conflicts.length) {
          applied.fields = {
            before: inverse.remainingBefore,
            after: inverse.remainingAfter,
          }
          return { undone: false, conflicts: inverse.conflicts }
        }
      }
      else if (applied.restore) {
        applied.restore()
      }
      else if (op.action === 'create') {
        removeCreated(op, applied.id)
      }
      else {
        const restored = {
          ...op,
          fields: snapshotFields(op, plan.before[index]!, true),
        }
        write(restored, applied.id, true)
        verifyWrite(restored, applied.id)
      }
      plan.undo.delete(index)
      plan.applied.delete(index)
      plan.failed.add(index)
      return partial ? { undone: true, conflicts: [] } : true
    },
    create(input: unknown, userMessages: string[] = []) {
      const plan = workspaceCreateSchema.parse(input)
      const proposal = this.propose(plan, userMessages)
      const result = this.apply(
        proposal.id,
        plan.operations.map((_, i) => i),
      )
      return { proposal, ...result }
    },
    apply(id: string, indexes: number[]) {
      const plan = proposals.get(id)
      if (
        !plan
        || plan.vault !== vaultIdentity()
        || !indexes.length
        || indexes.length > 30
        || new Set(indexes).size !== indexes.length
      ) {
        throw new Error('STALE_PROPOSAL')
      }
      for (const i of indexes) {
        const change = plan.value.changes[i]
        if (
          !change
          || plan.applied.has(i)
          || plan.failed.has(i)
          || fingerprint(
            isLifecycle(change.operation)
              ? validateLifecycle(change.operation)
              : validate(change.operation),
          ) !== plan.baselines[i]
        ) {
          throw new Error('STALE_PROPOSAL')
        }
      }
      const selected = new Set(indexes)
      for (const index of indexes) {
        const dependency
          = plan.value.changes[index]!.operation.fields.folderOperation
        if (
          dependency !== undefined
          && !selected.has(dependency)
          && !plan.applied.has(dependency)
        ) {
          throw new Error('MISSING_DEPENDENCY')
        }
      }
      const applied: number[] = []
      const items: WorkspaceItem[] = []
      const containers: WorkspaceContainer[] = []
      for (const i of [...indexes].sort((a, b) => a - b)) {
        const original = plan.value.changes[i]!.operation
        const op = structuredClone(original)
        if (op.fields.folderOperation !== undefined) {
          op.fields.folderId = plan.undo.get(op.fields.folderOperation)!.id
          delete op.fields.folderOperation
        }
        const requestedName
          = op.action === 'create' ? op.fields.name : undefined
        let target = op.id
        try {
          if (isLifecycle(op)) {
            const result = applyLifecycle(op)
            if (op.action === 'duplicate')
              plan.value.changes[i]!.name = result.name
            if (result.restore) {
              plan.undo.set(i, {
                id: result.id,
                baseline: undoFingerprint(result.read()),
                restore: result.restore,
                read: result.read,
              })
            }
            plan.applied.add(i)
            applied.push(i)
            if (
              (op.kind === 'item'
                && ['duplicate', 'restore'].includes(op.action))
              || (op.kind === 'fragment' && op.action !== 'delete')
            ) {
              items.push({
                operationIndex: i,
                id: result.id,
                name: result.name,
                type:
                  op.space === 'code'
                    ? 'snippet'
                    : op.space === 'notes'
                      ? 'note'
                      : 'http_request',
              })
            }
            continue
          }

          if (op.action === 'create') {
            const input = {
              name: op.fields.name!,
              folderId: op.fields.folderId,
            }
            target
              = op.kind === 'folder'
                ? folders(op.space).createFolder({
                  name: input.name,
                  parentId: input.folderId,
                }).id
                : op.space === 'code'
                  ? useStorage().snippets.createSnippet(input).id
                  : op.space === 'notes'
                    ? useNotesStorage().notes.createNote(input).id
                    : useHttpStorage().requests.createRequest(input).id
            const created = read({ ...op, id: target })
            if (!created)
              throw new Error('WRITE_NOT_VERIFIED')
            // Native storage may choose a suffix for an occupied vault path.
            op.fields.name = created.name
          }
          const originalFolder
            = op.space === 'code'
              && op.kind === 'folder'
              && op.action === 'update'
              && (op.fields.orderIndex !== undefined
                || op.fields.folderId !== undefined)
              ? useStorage()
                  .folders
                  .getFolders()
                  .find(folder => folder.id === target)
              : undefined
          if (
            originalFolder
            && op.fields.folderId !== undefined
            && op.fields.folderId !== originalFolder.parentId
          ) {
            assertUniqueSiblingFolderName(
              { folders: useStorage().folders.getFolders() },
              op.fields.folderId,
              op.fields.name ?? originalFolder.name,
              target,
            )
          }
          const orderBefore = originalFolder
            ? {
                parentId: originalFolder.parentId,
                orderIndex: originalFolder.orderIndex,
              }
            : undefined
          const orderParents = orderBefore
            ? new Set([
              orderBefore.parentId,
              op.fields.folderId === undefined
                ? orderBefore.parentId
                : op.fields.folderId,
            ])
            : undefined
          const readOrder = () =>
            JSON.stringify(
              useStorage()
                .folders.getFolders()
                .filter(folder => orderParents?.has(folder.parentId))
                .map(({ id, parentId, orderIndex }) => ({
                  id,
                  parentId,
                  orderIndex,
                }))
                .sort((a, b) => a.id - b.id),
            )
          const writeOp = structuredClone(op)
          if (op.action === 'create')
            delete writeOp.fields.name
          write(writeOp, target!)
          const saved = verifyWrite(op, target!)
          if (op.action === 'create') {
            const change = plan.value.changes[i]!
            change.name = saved.name
            change.operation.fields.name = saved.name
            change.after = JSON.stringify(
              { ...JSON.parse(change.after), name: saved.name },
              null,
              2,
            )
          }
          const fieldSnapshot = (
            record: NonNullable<ReturnType<typeof read>>,
          ) => {
            const fields = snapshotFields(op, record, true)
            if (orderBefore) {
              delete fields.folderId
              delete fields.orderIndex
            }
            return fields
          }
          plan.undo.set(i, {
            id: target!,
            baseline: undoFingerprint(
              saved,
              op.action === 'create' && op.kind === 'folder',
            ),
            ...(orderBefore
              ? {
                  folderOrder: {
                    read: readOrder,
                    baseline: readOrder(),
                    restore: (name) => {
                      const currentFolders = useStorage().folders.getFolders()
                      const currentFolder = currentFolders.find(
                        folder => folder.id === target,
                      )
                      if (!currentFolder)
                        throw new Error('STALE_PROPOSAL')
                      assertUniqueSiblingFolderName(
                        { folders: currentFolders },
                        orderBefore.parentId,
                        name ?? currentFolder.name,
                        target,
                      )
                      const result = useStorage().folders.updateFolder(
                        target!,
                        {
                          ...orderBefore,
                          ...(name !== undefined ? { name } : {}),
                        },
                      )
                      if (
                        ('notFound' in result && result.notFound)
                        || ('invalidInput' in result && result.invalidInput)
                      ) {
                        throw new Error('WRITE_NOT_VERIFIED')
                      }
                    },
                  },
                }
              : {}),
            ...(op.action === 'update'
              ? {
                  fields: {
                    before: fieldSnapshot(plan.before[i]!),
                    after: fieldSnapshot(saved),
                  },
                }
              : {}),
          })
          plan.applied.add(i)
          applied.push(i)
          if (op.kind === 'folder') {
            containers.push({
              operationIndex: i,
              id: target!,
              name: saved.name,
              ...(requestedName !== undefined && requestedName !== saved.name
                ? { requestedName }
                : {}),
              space: op.space,
              kind: op.fields.collection ? 'collection' : 'folder',
            })
          }
          if (op.kind === 'item') {
            items.push({
              operationIndex: i,
              id: target!,
              name: saved.name,
              ...(requestedName !== undefined && requestedName !== saved.name
                ? { requestedName }
                : {}),
              type:
                op.space === 'code'
                  ? 'snippet'
                  : op.space === 'notes'
                    ? 'note'
                    : 'http_request',
            })
          }
        }
        catch (error) {
          if (error instanceof PartialCreateError)
            target = error.itemId
          plan.failed.add(i)
          if (target && !isLifecycle(op)) {
            try {
              if (op.action === 'create') {
                removeCreated(op, target)
              }
              else {
                write(
                  { ...op, fields: snapshotFields(op, plan.before[i]!, true) },
                  target,
                  true,
                )
              }
            }
            catch {
              /* The UI reports failure; never retry a partly written operation. */
            }
          }
          return { applied, items, containers, failed: i }
        }
      }
      return { applied, items, containers }
    },
  }
}
