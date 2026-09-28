import type { AiTaskPolicy } from '../../shared/aiTask'

const reads = new Set([
  'read_native_state',
  'ask_user',
  'search_vault',
  'read_vault_item',
  'read_http_context',
  'read_current_workspace',
  'read_http_state',
  'read_workspace_item',
  'list_workspace_items',
  'list_workspace_structure',
])
const draftWrites = new Set(['patchDraft', 'saveDraft', 'discardDraft'])

export function taskEffect(
  policy: AiTaskPolicy,
  tool: string,
  input: Record<string, unknown>,
): 'read' | 'blocked' | 'apply' | 'preview' {
  if (
    reads.has(tool)
    || (tool === 'control_http_activity' && input.action === 'status')
  ) {
    return 'read'
  }
  if (
    tool === 'perform_native_action'
    && input.operation
    && typeof input.operation === 'object'
    && 'action' in input.operation
    && [
      'readPreferences',
      'readDrawings',
      'readFolderIcons',
      'readNotesDashboard',
    ].includes(String(input.operation.action))
  ) {
    return 'read'
  }
  if (
    tool === 'perform_native_action'
    && input.operation
    && typeof input.operation === 'object'
    && 'action' in input.operation
    && input.operation.action === 'storage'
    && 'command' in input.operation
    && input.operation.command === 'doctorScan'
  ) {
    return 'read'
  }
  if (
    tool === 'perform_native_action'
    && input.operation
    && typeof input.operation === 'object'
    && 'action' in input.operation
    && input.operation.action === 'httpDevtools'
    && 'command' in input.operation
    && input.operation.command === 'terminalList'
  ) {
    return 'read'
  }
  if (
    tool === 'perform_native_action'
    && input.operation
    && typeof input.operation === 'object'
    && 'action' in input.operation
    && ['httpOverview', 'httpRunner'].includes(String(input.operation.action))
    && 'command' in input.operation
    && input.operation.command === 'read'
  ) {
    return 'read'
  }
  if (policy === 'readOnly')
    return 'blocked'
  if (
    tool === 'perform_native_action'
    && input.operation
    && typeof input.operation === 'object'
    && 'action' in input.operation
    && ['storage', 'configureAi', 'reload', 'codePreview'].includes(
      String(input.operation.action),
    )
  ) {
    return 'preview'
  }
  if (tool === 'propose_http_action' && !draftWrites.has(String(input.action)))
    return 'preview'
  if (
    tool === 'perform_native_action'
    && input.operation
    && typeof input.operation === 'object'
    && 'view' in input.operation
    && input.operation.view === 'codePreview'
  ) {
    return 'preview'
  }
  if (
    tool === 'perform_native_action'
    && input.operation
    && typeof input.operation === 'object'
    && 'action' in input.operation
    && input.operation.action === 'setPreferences'
    && 'change' in input.operation
  ) {
    const change = input.operation.change as {
      group?: string
      values?: Record<string, unknown>
    }
    if (
      change.group === 'tasks'
      || (change.group === 'http'
        && (change.values?.skipCertificateVerification === true
          || (change.values?.transport as Record<string, unknown> | undefined)
            ?.skipCertificateVerification === true
            || (change.values?.transport as Record<string, unknown> | undefined)
              ?.followAuthorizationHeader === true))
    ) {
      return 'preview'
    }
  }
  if (tool === 'request_import' || tool === 'request_export')
    return 'preview'
  if (
    Array.isArray(input.operations)
    && input.operations.some(op =>
      ['permanentDelete', 'delete'].includes(op.action),
    )
  ) {
    return 'preview'
  }
  return policy
}
