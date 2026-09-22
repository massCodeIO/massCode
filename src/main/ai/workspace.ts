import type {
  WorkspaceContainer,
  WorkspaceItem,
  WorkspaceProposal,
} from '../../shared/aiWorkspace'
import { randomUUID } from 'node:crypto'
import { redactAiHttp } from '../../shared/aiHttp'
import {
  workspaceCreateSchema,
  workspacePlanSchema,
} from '../../shared/aiWorkspace'
import { useHttpStorage, useNotesStorage, useStorage } from '../storage'
import { PartialCreateError } from '../storage/partialCreateError'
import { vaultIdentity } from './vault'
import {
  folders,
  read,
  removeCreated,
  snapshotFields,
  validate,
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
      undo: Map<number, { id: number, baseline: string }>
    }
  >()
  return {
    clear() {
      proposals.clear()
    },
    propose(input: unknown): WorkspaceProposal {
      const plan = workspacePlanSchema.parse(input)
      if (JSON.stringify(plan).length > 500000)
        throw new Error('PLAN_TOO_LARGE')
      const targets = new Set<string>()
      const before = plan.operations.map((op, index) => {
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
        const target = `${op.space}:${op.kind}:${op.id}`
        if (op.action === 'update' && targets.has(target))
          throw new Error('DUPLICATE_TARGET')
        targets.add(target)
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
        changes: plan.operations.map((operation, i) => ({
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
          after: JSON.stringify(preview(operation, operation.fields), null, 2),
        })),
      }
      if (proposals.size >= 30)
        proposals.delete(proposals.keys().next().value!)
      proposals.set(value.id, {
        vault: vaultIdentity(),
        value,
        before,
        baselines: before.map(fingerprint),
        applied: new Set(),
        failed: new Set(),
        undo: new Map(),
      })
      return value
    },
    undo(id: string, index: number) {
      const plan = proposals.get(id)
      const applied = plan?.undo.get(index)
      const op = plan?.value.changes[index]?.operation
      if (
        !plan
        || !op
        || !applied
        || plan.vault !== vaultIdentity()
        || fingerprint(read({ ...op, id: applied.id })) !== applied.baseline
      ) {
        throw new Error('STALE_PROPOSAL')
      }
      if (op.action === 'create') {
        removeCreated(op, applied.id)
      }
      else {
        write(
          { ...op, fields: snapshotFields(op, plan.before[index]!) },
          applied.id,
        )
      }
      plan.undo.delete(index)
      plan.applied.delete(index)
      plan.failed.add(index)
      return true
    },
    create(input: unknown) {
      const plan = workspaceCreateSchema.parse(input)
      const proposal = this.propose(plan)
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
          || fingerprint(validate(change.operation)) !== plan.baselines[i]
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
        let target = op.id
        try {
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
          }
          write(op, target!)
          const saved = verifyWrite(op, target!)
          plan.undo.set(i, {
            id: target!,
            baseline: fingerprint(saved),
          })
          plan.applied.add(i)
          applied.push(i)
          if (op.kind === 'folder') {
            containers.push({
              operationIndex: i,
              id: target!,
              name: saved.name,
              space: op.space,
              kind: op.fields.collection ? 'collection' : 'folder',
            })
          }
          if (op.kind === 'item') {
            items.push({
              operationIndex: i,
              id: target!,
              name: saved.name,
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
          if (target) {
            try {
              if (op.action === 'create') {
                removeCreated(op, target)
              }
              else {
                write(
                  { ...op, fields: snapshotFields(op, plan.before[i]!) },
                  target,
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
