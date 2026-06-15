import type {
  VaultDoctorInput,
  VaultDoctorItem,
  VaultDoctorResponse,
  VaultDoctorWarning,
} from '../../../api/dto/vault-doctor'
import type { MathNotebookStore, MathSheet } from '../../../store/types'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import fs from 'fs-extra'
import yaml from 'js-yaml'
import {
  getHttpPaths,
  loadHttpState,
  saveHttpState,
  syncHttpRuntimeWithDisk,
} from './http/runtime'
import { getNotesPaths, syncNotesRuntimeWithDisk } from './notes/runtime'
import {
  getPaths,
  getSpaceStatePath,
  getVaultPath,
  META_DIR_NAME,
  META_FILE_NAME,
  readSpaceState,
  syncRuntimeWithDisk,
  TRASH_DIR_NAME,
  writeSpaceStateImmediate,
} from './runtime'

type VaultDoctorSpace = NonNullable<VaultDoctorInput['spaces']>[number]

interface Fingerprint {
  mtimeMs: number
  path: string
  size: number
}

interface ScanContext {
  conflictGroups: VaultDoctorResponse['conflictGroups']
  items: VaultDoctorItem[]
  warnings: VaultDoctorWarning[]
}

interface EntityScanRecord {
  filePath: string
  fingerprint: Fingerprint
  id: number
  kind: 'note' | 'snippet'
  space: Extract<VaultDoctorSpace, 'code' | 'http' | 'notes'>
}

const DEFAULT_SPACES: VaultDoctorSpace[] = ['code', 'notes', 'http', 'math']
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/
const MERGE_MARKER_RE = /^(?:<<<<<<<|=======|>>>>>>>) /m
const CONFLICTED_NAME_RE
  = /\b(?:conflict|conflicted|conflicted copy|copy conflict)\b|\([^)]+(?:macbook|machine|conflict|conflicted)[^)]*\)/i

function normalizeSpaces(input?: VaultDoctorInput): VaultDoctorSpace[] {
  const requestedSpaces = input?.spaces?.length ? input.spaces : DEFAULT_SPACES
  return [...new Set(requestedSpaces)]
}

function toPosixPath(value: string): string {
  return value.replaceAll(path.sep, '/')
}

function getFingerprint(absolutePath: string): Fingerprint {
  try {
    const stat = fs.statSync(absolutePath)
    return {
      mtimeMs: stat.mtimeMs,
      path: absolutePath,
      size: stat.size,
    }
  }
  catch {
    return {
      mtimeMs: 0,
      path: absolutePath,
      size: 0,
    }
  }
}

function addItem(context: ScanContext, item: VaultDoctorItem): void {
  context.items.push(item)
}

function addWarning(context: ScanContext, warning: VaultDoctorWarning): void {
  context.warnings.push(warning)
}

function createFileItem(input: {
  action: VaultDoctorItem['action']
  absolutePath: string
  kind: VaultDoctorItem['kind']
  relativePath: string
  space: VaultDoctorSpace
  status: VaultDoctorItem['status']
}): VaultDoctorItem {
  return {
    action: input.action,
    fingerprint: getFingerprint(input.absolutePath),
    kind: input.kind,
    path: input.relativePath,
    space: input.space,
    status: input.status,
  }
}

function listMarkdownFiles(rootPath: string): string[] {
  const files: string[] = []

  function walk(currentPath: string): void {
    if (!fs.pathExistsSync(currentPath)) {
      return
    }

    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      if (entry.name.startsWith('.') && entry.name !== META_DIR_NAME) {
        continue
      }

      const absolutePath = path.join(currentPath, entry.name)
      const relativePath = toPosixPath(path.relative(rootPath, absolutePath))

      if (entry.isDirectory()) {
        walk(absolutePath)
        continue
      }

      if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        files.push(relativePath)
      }
    }
  }

  walk(rootPath)
  return files
}

function listFolders(
  rootPath: string,
  skipRootNames = new Set<string>(),
): string[] {
  const folders: string[] = []

  function walk(currentPath: string): void {
    if (!fs.pathExistsSync(currentPath)) {
      return
    }

    const isRoot = currentPath === rootPath
    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue
      }

      if (
        entry.name.startsWith('.')
        || (isRoot && skipRootNames.has(entry.name))
      ) {
        continue
      }

      const absolutePath = path.join(currentPath, entry.name)
      const relativePath = toPosixPath(path.relative(rootPath, absolutePath))
      folders.push(relativePath)
      walk(absolutePath)
    }
  }

  walk(rootPath)
  return folders
}

function readFrontmatter(source: string): {
  frontmatter: Record<string, unknown>
  hasFrontmatter: boolean
  invalid: boolean
} {
  const match = source.match(FRONTMATTER_RE)
  if (!match) {
    return {
      frontmatter: {},
      hasFrontmatter: false,
      invalid: false,
    }
  }

  try {
    const parsed = yaml.load(match[1])
    return {
      frontmatter:
        parsed && typeof parsed === 'object'
          ? (parsed as Record<string, unknown>)
          : {},
      hasFrontmatter: true,
      invalid: false,
    }
  }
  catch {
    return {
      frontmatter: {},
      hasFrontmatter: true,
      invalid: true,
    }
  }
}

function normalizeId(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : null
}

function inspectMarkdownEntity(input: {
  context: ScanContext
  filePath: string
  kind: EntityScanRecord['kind']
  rootPath: string
  space: EntityScanRecord['space']
}): EntityScanRecord | null {
  const absolutePath = path.join(input.rootPath, input.filePath)
  const source = fs.readFileSync(absolutePath, 'utf8')
  const fileName = path.basename(input.filePath)
  const fingerprint = getFingerprint(absolutePath)

  if (MERGE_MARKER_RE.test(source)) {
    addItem(input.context, {
      action: 'detect-conflict',
      fingerprint,
      kind: 'conflict',
      path: input.filePath,
      space: input.space,
      status: 'blocked',
    })
    input.context.conflictGroups.push({
      id: `${input.space}:merge-markers:${input.filePath}`,
      items: [input.context.items[input.context.items.length - 1]],
      reason: 'merge-markers',
    })
    return null
  }

  if (CONFLICTED_NAME_RE.test(fileName)) {
    addWarning(input.context, {
      code: 'CONFLICTED_COPY_NAME',
      path: input.filePath,
      space: input.space,
    })
  }

  const parsed = readFrontmatter(source)
  if (parsed.invalid) {
    addItem(input.context, {
      action: 'detect-conflict',
      fingerprint,
      kind: 'conflict',
      path: input.filePath,
      space: input.space,
      status: 'blocked',
    })
    input.context.conflictGroups.push({
      id: `${input.space}:invalid-frontmatter:${input.filePath}`,
      items: [input.context.items[input.context.items.length - 1]],
      reason: 'invalid-frontmatter',
    })
    return null
  }

  const id = normalizeId(parsed.frontmatter.id)
  if (!parsed.hasFrontmatter || !id) {
    addItem(input.context, {
      action: parsed.hasFrontmatter ? 'register-file' : 'write-frontmatter',
      fingerprint,
      kind: input.kind,
      path: input.filePath,
      space: input.space,
      status: 'pending',
    })
  }

  return id
    ? {
        filePath: input.filePath,
        fingerprint,
        id,
        kind: input.kind,
        space: input.space,
      }
    : null
}

function collectDuplicateIds(
  context: ScanContext,
  records: EntityScanRecord[],
): void {
  const recordsByKey = new Map<string, EntityScanRecord[]>()

  records.forEach((record) => {
    const key = `${record.space}:${record.kind}:${record.id}`
    recordsByKey.set(key, [...(recordsByKey.get(key) ?? []), record])
  })

  recordsByKey.forEach((group, key) => {
    if (group.length < 2) {
      return
    }

    const items = group.map(
      record =>
        ({
          action: 'reassign-id',
          fingerprint: record.fingerprint,
          kind: record.kind,
          path: record.filePath,
          space: record.space,
          status: 'needs-decision',
        }) satisfies VaultDoctorItem,
    )

    context.items.push(...items)
    context.conflictGroups.push({
      id: key,
      items,
      reason: 'duplicate-id',
    })
  })
}

function scanCode(context: ScanContext): void {
  const paths = getPaths(getVaultPath())
  const records: EntityScanRecord[] = []
  const skipRootNames = new Set([META_DIR_NAME, 'inbox', TRASH_DIR_NAME])

  listFolders(paths.vaultPath, skipRootNames).forEach((folderPath) => {
    const metaPath = path.join(paths.vaultPath, folderPath, META_FILE_NAME)
    if (!fs.pathExistsSync(metaPath)) {
      addItem(
        context,
        createFileItem({
          action: 'create-folder-metadata',
          absolutePath: path.join(paths.vaultPath, folderPath),
          kind: 'folder',
          relativePath: folderPath,
          space: 'code',
          status: 'pending',
        }),
      )
    }
  })

  listMarkdownFiles(paths.vaultPath)
    .filter(filePath => !filePath.startsWith(`${META_DIR_NAME}/`))
    .forEach((filePath) => {
      const record = inspectMarkdownEntity({
        context,
        filePath,
        kind: 'snippet',
        rootPath: paths.vaultPath,
        space: 'code',
      })
      if (record) {
        records.push(record)
      }
    })

  collectDuplicateIds(context, records)
}

function scanNotes(context: ScanContext): void {
  const paths = getNotesPaths(getVaultPath())
  const records: EntityScanRecord[] = []

  listFolders(paths.notesRoot).forEach((folderPath) => {
    const metaPath = path.join(paths.notesRoot, folderPath, META_FILE_NAME)
    if (!fs.pathExistsSync(metaPath)) {
      addItem(
        context,
        createFileItem({
          action: 'create-folder-metadata',
          absolutePath: path.join(paths.notesRoot, folderPath),
          kind: 'folder',
          relativePath: folderPath,
          space: 'notes',
          status: 'pending',
        }),
      )
    }
  })

  listMarkdownFiles(paths.notesRoot).forEach((filePath) => {
    const record = inspectMarkdownEntity({
      context,
      filePath,
      kind: 'note',
      rootPath: paths.notesRoot,
      space: 'notes',
    })
    if (record) {
      records.push(record)
    }
  })

  collectDuplicateIds(context, records)
}

function scanHttp(context: ScanContext): void {
  const paths = getHttpPaths(getVaultPath())
  const records: EntityScanRecord[] = []
  const state = loadHttpState(paths)

  listMarkdownFiles(paths.httpRoot).forEach((filePath) => {
    const record = inspectMarkdownEntity({
      context,
      filePath,
      kind: 'note',
      rootPath: paths.httpRoot,
      space: 'http',
    })
    if (record) {
      records.push({
        ...record,
        kind: 'snippet',
      })
    }
  })

  const seenEnvironmentIds = new Set<number>()
  let hasEnvironmentRepair = false
  for (const environment of state.environments) {
    if (
      !Number.isInteger(environment.id)
      || environment.id <= 0
      || seenEnvironmentIds.has(environment.id)
      || !environment.variables
      || typeof environment.variables !== 'object'
    ) {
      hasEnvironmentRepair = true
    }
    if (Number.isInteger(environment.id) && environment.id > 0) {
      seenEnvironmentIds.add(environment.id)
    }
  }
  if (
    state.activeEnvironmentId !== null
    && !state.environments.some(env => env.id === state.activeEnvironmentId)
  ) {
    hasEnvironmentRepair = true
  }

  if (hasEnvironmentRepair) {
    addItem(context, {
      action: 'repair-environment-state',
      fingerprint: getFingerprint(paths.statePath),
      kind: 'environment',
      path: toPosixPath(path.relative(paths.httpRoot, paths.statePath)),
      space: 'http',
      status: 'pending',
    })
  }

  collectDuplicateIds(context, records)
}

function normalizeMathSheet(
  sheet: Partial<MathSheet>,
  usedIds: Set<string>,
): { changed: boolean, sheet: MathSheet } {
  let changed = false
  let id = typeof sheet.id === 'string' && sheet.id ? sheet.id : randomUUID()
  if (usedIds.has(id)) {
    id = randomUUID()
    changed = true
  }
  usedIds.add(id)

  if (id !== sheet.id) {
    changed = true
  }

  const now = Date.now()
  const normalized: MathSheet = {
    content: typeof sheet.content === 'string' ? sheet.content : '',
    createdAt: typeof sheet.createdAt === 'number' ? sheet.createdAt : now,
    id,
    name:
      typeof sheet.name === 'string' && sheet.name.trim()
        ? sheet.name
        : 'Sheet',
    updatedAt: typeof sheet.updatedAt === 'number' ? sheet.updatedAt : now,
  }

  return {
    changed:
      changed
      || normalized.content !== sheet.content
      || normalized.createdAt !== sheet.createdAt
      || normalized.name !== sheet.name
      || normalized.updatedAt !== sheet.updatedAt,
    sheet: normalized,
  }
}

function getMathStatePath(): string {
  return getSpaceStatePath(getVaultPath(), 'math')
}

function readNormalizedMathState(): {
  changed: boolean
  state: MathNotebookStore
} {
  const statePath = getMathStatePath()
  const raw = readSpaceState<Partial<MathNotebookStore>>(statePath)
  const usedIds = new Set<string>()
  let changed = false
  const sheets: MathSheet[] = []

  if (!raw || !Array.isArray(raw.sheets)) {
    changed = !!raw
  }
  else {
    raw.sheets.forEach((sheet) => {
      if (!sheet || typeof sheet !== 'object') {
        changed = true
        return
      }

      const result = normalizeMathSheet(sheet, usedIds)
      if (result.changed) {
        changed = true
      }
      sheets.push(result.sheet)
    })
  }

  let activeSheetId
    = typeof raw?.activeSheetId === 'string' ? raw.activeSheetId : null
  if (activeSheetId && !sheets.some(sheet => sheet.id === activeSheetId)) {
    activeSheetId = sheets[0]?.id ?? null
    changed = true
  }

  return {
    changed,
    state: {
      activeSheetId,
      sheets,
    },
  }
}

function scanMath(context: ScanContext): void {
  const statePath = getMathStatePath()
  const { changed } = readNormalizedMathState()
  if (!changed) {
    return
  }

  addItem(context, {
    action: 'repair-math-state',
    fingerprint: getFingerprint(statePath),
    kind: 'math-sheet',
    path: 'math/.state.yaml',
    space: 'math',
    status: 'pending',
  })
}

function buildSummary(context: ScanContext): VaultDoctorResponse['summary'] {
  const items = context.items

  return {
    affectedFiles: items.filter(item => item.status === 'pending').length,
    blocked: items.filter(item => item.status === 'blocked').length,
    conflicts: context.conflictGroups.length,
    folders: items.filter(item => item.kind === 'folder').length,
    httpEnvironments: items.filter(item => item.kind === 'environment')
      .length,
    httpRequests: items.filter(item => item.space === 'http').length,
    mathSheets: items.filter(item => item.kind === 'math-sheet').length,
    notes: items.filter(item => item.kind === 'note').length,
    skipped: items.filter(item => item.status === 'skipped').length,
    snippets: items.filter(item => item.kind === 'snippet').length,
    warnings: context.warnings.length,
  }
}

function createContext(): ScanContext {
  return {
    conflictGroups: [],
    items: [],
    warnings: [],
  }
}

export function previewVaultDoctor(
  input?: VaultDoctorInput,
): VaultDoctorResponse {
  const context = createContext()
  const spaces = normalizeSpaces(input)

  if (spaces.includes('code')) {
    scanCode(context)
  }
  if (spaces.includes('notes')) {
    scanNotes(context)
  }
  if (spaces.includes('http')) {
    scanHttp(context)
  }
  if (spaces.includes('math')) {
    scanMath(context)
  }

  return {
    conflictGroups: context.conflictGroups,
    items: context.items,
    summary: buildSummary(context),
    warnings: context.warnings,
  }
}

function spacesWithConflicts(
  result: VaultDoctorResponse,
): Set<VaultDoctorSpace> {
  return new Set(
    result.items
      .filter(
        item => item.status === 'blocked' || item.status === 'needs-decision',
      )
      .map(item => item.space),
  )
}

function repairHttpEnvironmentState(): void {
  const paths = getHttpPaths(getVaultPath())
  const state = loadHttpState(paths)
  const usedIds = new Set<number>()
  let nextId = Math.max(
    state.counters.environmentId,
    ...state.environments.map(env =>
      Number.isInteger(env.id) && env.id > 0 ? env.id : 0,
    ),
  )

  state.environments.forEach((environment) => {
    if (
      !Number.isInteger(environment.id)
      || environment.id <= 0
      || usedIds.has(environment.id)
    ) {
      nextId += 1
      environment.id = nextId
    }
    usedIds.add(environment.id)

    if (!environment.variables || typeof environment.variables !== 'object') {
      environment.variables = {}
    }
  })

  if (
    state.activeEnvironmentId !== null
    && !state.environments.some(env => env.id === state.activeEnvironmentId)
  ) {
    state.activeEnvironmentId = null
  }
  state.counters.environmentId = Math.max(nextId, state.counters.environmentId)
  saveHttpState(paths, state)
}

function repairMathState(): void {
  const { state } = readNormalizedMathState()
  writeSpaceStateImmediate(getMathStatePath(), state)
}

export function applyVaultDoctor(
  input?: VaultDoctorInput,
): VaultDoctorResponse {
  const before = previewVaultDoctor(input)
  const conflictedSpaces = spacesWithConflicts(before)
  const spaces = normalizeSpaces(input)

  if (spaces.includes('code') && !conflictedSpaces.has('code')) {
    syncRuntimeWithDisk(getPaths(getVaultPath()))
  }
  if (spaces.includes('notes') && !conflictedSpaces.has('notes')) {
    syncNotesRuntimeWithDisk(getNotesPaths(getVaultPath()))
  }
  if (spaces.includes('http') && !conflictedSpaces.has('http')) {
    syncHttpRuntimeWithDisk(getHttpPaths(getVaultPath()))
    repairHttpEnvironmentState()
  }
  if (spaces.includes('math') && !conflictedSpaces.has('math')) {
    repairMathState()
  }

  const after = previewVaultDoctor(input)
  const appliedItems = before.items
    .filter(
      item => item.status === 'pending' && !conflictedSpaces.has(item.space),
    )
    .map(item => ({
      ...item,
      status: 'applied' as const,
    }))

  return {
    conflictGroups: after.conflictGroups,
    items: [...appliedItems, ...after.items],
    summary: buildSummary({
      conflictGroups: after.conflictGroups,
      items: [...appliedItems, ...after.items],
      warnings: after.warnings,
    }),
    warnings: after.warnings,
  }
}
