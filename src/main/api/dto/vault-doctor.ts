import Elysia, { t } from 'elysia'

const vaultDoctorSpace = t.Union([
  t.Literal('code'),
  t.Literal('notes'),
  t.Literal('http'),
  t.Literal('math'),
])

const vaultDoctorAction = t.Union([
  t.Literal('create-folder-metadata'),
  t.Literal('detect-conflict'),
  t.Literal('write-frontmatter'),
  t.Literal('register-file'),
  t.Literal('reassign-id'),
  t.Literal('repair-environment-state'),
  t.Literal('repair-math-state'),
  t.Literal('sync-state'),
  t.Literal('skip'),
])

const vaultDoctorKind = t.Union([
  t.Literal('conflict'),
  t.Literal('environment'),
  t.Literal('file'),
  t.Literal('folder'),
  t.Literal('math-sheet'),
  t.Literal('note'),
  t.Literal('snippet'),
])

const vaultDoctorStatus = t.Union([
  t.Literal('applied'),
  t.Literal('blocked'),
  t.Literal('needs-decision'),
  t.Literal('pending'),
  t.Literal('skipped'),
])

const vaultDoctorConflictReason = t.Union([
  t.Literal('conflicted-copy'),
  t.Literal('duplicate-id'),
  t.Literal('invalid-frontmatter'),
  t.Literal('merge-markers'),
])

const vaultDoctorFingerprint = t.Object({
  mtimeMs: t.Number(),
  path: t.String(),
  size: t.Number(),
})

const vaultDoctorItem = t.Object({
  action: vaultDoctorAction,
  fingerprint: vaultDoctorFingerprint,
  kind: vaultDoctorKind,
  path: t.String(),
  space: vaultDoctorSpace,
  status: vaultDoctorStatus,
})

const vaultDoctorWarning = t.Object({
  code: t.String(),
  details: t.Optional(t.Record(t.String(), t.String())),
  path: t.String(),
  space: vaultDoctorSpace,
})

const vaultDoctorConflictGroup = t.Object({
  id: t.String(),
  items: t.Array(vaultDoctorItem),
  reason: vaultDoctorConflictReason,
})

const vaultDoctorInput = t.Object({
  decisions: t.Optional(
    t.Array(
      t.Object({
        groupId: t.String(),
        keepPath: t.String(),
      }),
    ),
  ),
  spaces: t.Optional(t.Array(vaultDoctorSpace)),
})

const vaultDoctorResponse = t.Object({
  conflictGroups: t.Array(vaultDoctorConflictGroup),
  items: t.Array(vaultDoctorItem),
  summary: t.Object({
    affectedFiles: t.Number(),
    blocked: t.Number(),
    conflicts: t.Number(),
    folders: t.Number(),
    httpEnvironments: t.Number(),
    httpRequests: t.Number(),
    mathSheets: t.Number(),
    notes: t.Number(),
    skipped: t.Number(),
    snippets: t.Number(),
    warnings: t.Number(),
  }),
  warnings: t.Array(vaultDoctorWarning),
})

export const vaultDoctorDTO = new Elysia().model({
  vaultDoctorInput,
  vaultDoctorResponse,
})

export type VaultDoctorInput = typeof vaultDoctorInput.static
export type VaultDoctorResponse = typeof vaultDoctorResponse.static
export type VaultDoctorItem = typeof vaultDoctorItem.static
export type VaultDoctorWarning = typeof vaultDoctorWarning.static
