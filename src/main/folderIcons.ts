import type { BrowserWindow, NativeImage } from 'electron'
import type {
  FolderIconSetPayload,
  FolderIconSpaceId,
  FolderIconTarget,
  FolderIconWritePayload,
} from './types/ipc'
import { Buffer } from 'node:buffer'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import path from 'node:path'
import { dialog, nativeImage } from 'electron'
import fs from 'fs-extra'
import { useHttpStorage, useNotesStorage, useStorage } from './storage'
import { prioritizeCloudDownload } from './storage/providers/markdown/cloudDownloads'
import { getHttpPaths } from './storage/providers/markdown/http'
import { getNotesPaths } from './storage/providers/markdown/notes'
import { getPaths, getVaultPath } from './storage/providers/markdown/runtime'
import { rememberAppFileChange } from './storage/providers/markdown/runtime/shared/appChanges'
import { getFileAvailability } from './storage/providers/markdown/runtime/shared/cloudFiles'
import { buildFolderPathMap } from './storage/providers/markdown/runtime/shared/folderIndex'

export const FOLDER_ICON_FILE_NAME = '.icon.png'
export const FOLDER_ICON_MAX_BYTES = 10 * 1024 * 1024
export const FOLDER_ICON_SIZE = 128

const FOLDER_ICON_SPACES = new Set<FolderIconSpaceId>([
  'code',
  'notes',
  'http',
])
const pendingFolderIconMutations = new Map<string, Promise<unknown>>()
interface IconState {
  icon: string | null
  png: Buffer | null
}
const iconUndo = new Map<
  string,
  {
    target: FolderIconTarget
    vault: string
    before: IconState
    after: IconState
    expiresAt: number
    undone?: boolean
  }
>()
const ICON_UNDO_TTL = 30 * 60 * 1000
const ICON_UNDO_MAX_BYTES = 64 * 1024 * 1024
function pruneIconUndo() {
  let bytes = 0
  for (const [id, receipt] of [...iconUndo].reverse()) {
    bytes
      += (receipt.before.png?.length ?? 0) + (receipt.after.png?.length ?? 0)
    if (
      receipt.vault !== getVaultPath()
      || receipt.expiresAt <= Date.now()
      || bytes > ICON_UNDO_MAX_BYTES
    ) {
      iconUndo.delete(id)
    }
  }
  while (iconUndo.size > 128) iconUndo.delete(iconUndo.keys().next().value!)
}
// Release private image buffers even when the user leaves the conversation idle.
setInterval(pruneIconUndo, 60 * 1000).unref()
const emojiSegmenter = new Intl.Segmenter(undefined, {
  granularity: 'grapheme',
})

function isSingleEmojiGrapheme(value: string): boolean {
  if (value.length === 0 || value.length > 32)
    return false

  const segments = [...emojiSegmenter.segment(value)]
  if (segments.length !== 1 || segments[0]?.segment !== value)
    return false

  return (
    /\p{Extended_Pictographic}/u.test(value)
    || /^\p{Regional_Indicator}{2}$/u.test(value)
    || /^[#*0-9]\uFE0F?\u20E3$/u.test(value)
  )
}

function isSupportedImageSignature(buffer: Buffer): boolean {
  const isPng
    = buffer.length >= 8
      && buffer
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))
  const isJpeg
    = buffer.length >= 3
      && buffer[0] === 0xFF
      && buffer[1] === 0xD8
      && buffer[2] === 0xFF

  return isPng || isJpeg
}

export function parseFolderIconTarget(value: unknown): FolderIconTarget | null {
  if (!value || typeof value !== 'object')
    return null

  const { folderId, spaceId } = value as Record<string, unknown>
  if (
    !Number.isInteger(folderId)
    || (folderId as number) <= 0
    || typeof spaceId !== 'string'
    || !FOLDER_ICON_SPACES.has(spaceId as FolderIconSpaceId)
  ) {
    return null
  }

  return {
    folderId: folderId as number,
    spaceId: spaceId as FolderIconSpaceId,
  }
}

export function parseFolderIconWritePayload(
  value: unknown,
): FolderIconWritePayload | null {
  const target = parseFolderIconTarget(value)
  if (!target)
    return null

  const { buffer } = value as { buffer?: unknown }
  if (
    !(buffer instanceof ArrayBuffer)
    || buffer.byteLength === 0
    || buffer.byteLength > FOLDER_ICON_MAX_BYTES
  ) {
    return null
  }

  const bytes = Buffer.from(buffer)
  if (!isSupportedImageSignature(bytes))
    return null

  return { ...target, buffer }
}

export function parseFolderIconSetPayload(
  value: unknown,
): FolderIconSetPayload | null {
  const target = parseFolderIconTarget(value)
  if (!target)
    return null

  const { icon } = value as { icon?: unknown }
  if (icon === null)
    return { ...target, icon }

  if (
    typeof icon !== 'string'
    || icon.length === 0
    || icon.length > 256
    || icon.startsWith('custom:')
  ) {
    return null
  }

  if (icon.startsWith('emoji:') && !isSingleEmojiGrapheme(icon.slice(6)))
    return null

  return { ...target, icon }
}

async function runFolderIconMutation<T>(
  target: FolderIconTarget,
  mutation: () => Promise<T>,
): Promise<T> {
  const key = `${target.spaceId}:${target.folderId}`
  const previous = pendingFolderIconMutations.get(key) ?? Promise.resolve()
  const current = previous.catch(() => undefined).then(mutation)
  pendingFolderIconMutations.set(key, current)

  try {
    return await current
  }
  finally {
    if (pendingFolderIconMutations.get(key) === current)
      pendingFolderIconMutations.delete(key)
  }
}

function getSpaceFoldersAndRoot(spaceId: FolderIconSpaceId) {
  const vaultPath = getVaultPath()

  if (spaceId === 'notes') {
    const storage = useNotesStorage()
    return {
      folders: storage.folders.getFolders(),
      root: getNotesPaths(vaultPath).notesRoot,
      updateIcon: (folderId: number, icon: string | null) =>
        storage.folders.updateFolder(folderId, { icon }),
    }
  }

  if (spaceId === 'http') {
    const storage = useHttpStorage()
    return {
      folders: storage.folders.getFolders(),
      root: getHttpPaths(vaultPath).httpRoot,
      updateIcon: (folderId: number, icon: string | null) =>
        storage.folders.updateFolder(folderId, { icon }),
    }
  }

  const storage = useStorage()
  return {
    folders: storage.folders.getFolders(),
    root: getPaths(vaultPath).vaultPath,
    updateIcon: (folderId: number, icon: string | null) =>
      storage.folders.updateFolder(folderId, { icon }),
  }
}

export function resolveFolderIconPath(
  spaceId: FolderIconSpaceId,
  folderId: number,
): string | null {
  if (
    !FOLDER_ICON_SPACES.has(spaceId)
    || !Number.isInteger(folderId)
    || folderId <= 0
  ) {
    return null
  }

  const { folders, root } = getSpaceFoldersAndRoot(spaceId)
  const relativeFolderPath = buildFolderPathMap(folders).get(folderId)
  if (!relativeFolderPath)
    return null

  const resolvedRoot = path.resolve(root)
  const folderPath = path.resolve(resolvedRoot, relativeFolderPath)
  if (!folderPath.startsWith(`${resolvedRoot}${path.sep}`))
    return null

  try {
    const realRoot = fs.realpathSync(resolvedRoot)
    const realFolderPath = fs.realpathSync(folderPath)
    if (!realFolderPath.startsWith(`${realRoot}${path.sep}`))
      return null
  }
  catch {
    return null
  }

  return path.join(folderPath, FOLDER_ICON_FILE_NAME)
}

export function createFolderIconPng(
  input: Buffer,
  decode: (buffer: Buffer) => NativeImage = nativeImage.createFromBuffer,
): Buffer {
  const image = decode(input)
  if (image.isEmpty())
    throw new TypeError('Image could not be decoded')

  const { height, width } = image.getSize()
  if (height <= 0 || width <= 0)
    throw new TypeError('Image has invalid dimensions')

  const side = Math.min(width, height)
  const square = image.crop({
    height: side,
    width: side,
    x: Math.floor((width - side) / 2),
    y: Math.floor((height - side) / 2),
  })
  const png = square
    .resize({
      height: FOLDER_ICON_SIZE,
      quality: 'best',
      width: FOLDER_ICON_SIZE,
    })
    .toPNG()

  if (png.length === 0)
    throw new TypeError('Image could not be encoded')

  return png
}

async function replaceFolderIconFile(tempPath: string, iconPath: string) {
  try {
    await fs.rename(tempPath, iconPath)
  }
  catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (
      (code !== 'EEXIST' && code !== 'EPERM')
      || !(await fs.pathExists(iconPath))
    ) {
      throw error
    }

    // Windows can reject rename-over-existing. Keep the normal path atomic
    // and use a short remove+rename fallback only on that platform behavior.
    await fs.remove(iconPath)
    await fs.rename(tempPath, iconPath)
  }
}

async function writeFolderIconUnlocked(payload: FolderIconWritePayload) {
  const vault = getVaultPath()
  const context = getSpaceFoldersAndRoot(payload.spaceId)
  const folder = context.folders.find(item => item.id === payload.folderId)
  if (!folder)
    throw new TypeError('Folder was not found')
  const previousIconValue = folder.icon

  const iconPath = resolveFolderIconPath(payload.spaceId, payload.folderId)
  if (!iconPath)
    throw new TypeError('Folder was not found')

  const png = createFolderIconPng(Buffer.from(payload.buffer))
  const iconValue = `custom:${createHash('sha256').update(png).digest('hex').slice(0, 16)}`
  const tempPath = `${iconPath}.${randomBytes(6).toString('hex')}.tmp`
  let previousPng: Buffer | null = null
  let metadataUpdateAttempted = false
  const previousAvailability = getFileAvailability(iconPath)

  if (previousAvailability.isCloudPlaceholder) {
    prioritizeCloudDownload(iconPath)
    throw new TypeError('Folder icon is temporarily unavailable')
  }

  if (previousAvailability.exists) {
    const stats = await fs.lstat(iconPath)
    if (!stats.isFile() || stats.isSymbolicLink())
      throw new TypeError('Folder icon path is not a regular file')

    previousPng = await fs.readFile(iconPath)
  }

  try {
    await fs.writeFile(tempPath, png, { flag: 'wx' })
    await replaceFolderIconFile(tempPath, iconPath)
    rememberAppFileChange(iconPath)

    if (getVaultPath() !== vault)
      throw new Error('Stale folder icon vault')
    metadataUpdateAttempted = true
    const result = context.updateIcon(payload.folderId, iconValue)
    if (result.invalidInput || result.notFound)
      throw new TypeError('Folder icon metadata could not be updated')
  }
  catch (error) {
    if (metadataUpdateAttempted && getVaultPath() === vault) {
      try {
        context.updateIcon(payload.folderId, previousIconValue)
      }
      catch {
        // Preserve the original failure; storage sync can reconcile metadata.
      }
    }

    if (previousPng) {
      await fs.writeFile(iconPath, previousPng)
      rememberAppFileChange(iconPath)
    }
    else {
      await fs.remove(iconPath)
      rememberAppFileChange(iconPath)
    }
    throw error
  }
  finally {
    await fs.remove(tempPath).catch(() => undefined)
    rememberAppFileChange(tempPath)
  }

  return { icon: iconValue, png }
}

async function removeFolderIconFile(target: FolderIconTarget): Promise<void> {
  const iconPath = resolveFolderIconPath(target.spaceId, target.folderId)
  if (iconPath) {
    await fs.remove(iconPath)
    rememberAppFileChange(iconPath)
  }
}

export function writeFolderIcon(payload: FolderIconWritePayload) {
  return runFolderIconMutation(
    payload,
    async () => (await writeFolderIconUnlocked(payload)).icon,
  )
}

async function setFolderIconUnlocked(payload: FolderIconSetPayload) {
  const vault = getVaultPath()
  const context = getSpaceFoldersAndRoot(payload.spaceId)
  const folder = context.folders.find(item => item.id === payload.folderId)
  if (!folder)
    throw new TypeError('Folder was not found')

  const previousIcon = folder.icon
  const result = context.updateIcon(payload.folderId, payload.icon)
  if (result.invalidInput || result.notFound)
    throw new TypeError('Folder icon metadata could not be updated')

  if (previousIcon?.startsWith('custom:')) {
    try {
      await removeFolderIconFile(payload)
    }
    catch (error) {
      try {
        if (getVaultPath() === vault)
          context.updateIcon(payload.folderId, previousIcon)
      }
      catch {
        // Preserve the cleanup failure; storage sync can reconcile metadata.
      }
      throw error
    }
  }
}

export function setFolderIcon(payload: FolderIconSetPayload) {
  return runFolderIconMutation(payload, () => setFolderIconUnlocked(payload))
}

async function readIconState(target: FolderIconTarget): Promise<IconState> {
  const folder = getSpaceFoldersAndRoot(target.spaceId).folders.find(
    item => item.id === target.folderId,
  )
  if (!folder)
    throw new Error('Folder was not found')
  let png: Buffer | null = null
  if (folder.icon?.startsWith('custom:')) {
    const file = resolveFolderIconPath(target.spaceId, target.folderId)
    if (!file)
      throw new Error('Folder icon is unavailable')
    const availability = getFileAvailability(file)
    if (availability.isCloudPlaceholder)
      throw new Error('Folder icon is temporarily unavailable')
    if (availability.exists) {
      const stat = await fs.lstat(file)
      if (
        !stat.isFile()
        || stat.isSymbolicLink()
        || stat.size > FOLDER_ICON_MAX_BYTES
      ) {
        throw new Error('Invalid folder icon')
      }
      png = await fs.readFile(file)
      if (png.length > FOLDER_ICON_MAX_BYTES)
        throw new Error('Invalid folder icon')
    }
  }
  return { icon: folder.icon, png }
}

async function restoreIconState(
  target: FolderIconTarget,
  state: IconState,
  previous: IconState,
  vault: string,
) {
  if (getVaultPath() !== vault)
    throw new Error('Stale folder icon vault')
  const context = getSpaceFoldersAndRoot(target.spaceId)
  const file = resolveFolderIconPath(target.spaceId, target.folderId)
  if (!file)
    throw new Error('Folder was not found')
  async function write(value: IconState) {
    if (value.png) {
      const temporary = `${file}.${randomBytes(6).toString('hex')}.tmp`
      try {
        await fs.writeFile(temporary, value.png, { flag: 'wx' })
        await replaceFolderIconFile(temporary, file!)
      }
      finally {
        await fs.remove(temporary).catch(() => {})
        rememberAppFileChange(temporary)
      }
    }
    else {
      await fs.remove(file!)
    }
    rememberAppFileChange(file!)
  }
  try {
    await write(state)
    if (getVaultPath() !== vault)
      throw new Error('Stale folder icon vault')
    const result = context.updateIcon(target.folderId, state.icon)
    if (result.invalidInput || result.notFound)
      throw new Error('Folder icon metadata could not be updated')
  }
  catch (error) {
    await write(previous)
    if (getVaultPath() === vault)
      context.updateIcon(target.folderId, previous.icon)
    throw error
  }
}

/** Capture and apply share the same native mutation queue as the manual picker. */
export async function changeFolderIconWithUndo(
  payload: unknown,
  parent?: BrowserWindow,
) {
  const input = payload as {
    vault?: unknown
    chooseImage?: unknown
    icon?: unknown
  }
  const target = parseFolderIconTarget(payload)
  if (
    !target
    || typeof input.vault !== 'string'
    || input.vault !== getVaultPath()
  ) {
    return { status: 'stale' as const }
  }
  const vault = input.vault
  let mutation = parseFolderIconSetPayload(payload) as
    | FolderIconSetPayload
    | FolderIconWritePayload
    | null
  if (input.chooseImage === true) {
    const options = {
      properties: ['openFile'] as ['openFile'],
      filters: [{ name: 'PNG / JPEG', extensions: ['png', 'jpg', 'jpeg'] }],
    }
    const chosen = parent
      ? await dialog.showOpenDialog(parent, options)
      : await dialog.showOpenDialog(options)
    if (chosen.canceled || chosen.filePaths.length !== 1)
      return { status: 'cancelled' as const }
    if (getVaultPath() !== vault)
      return { status: 'stale' as const }
    const stat = await fs.lstat(chosen.filePaths[0])
    if (
      !stat.isFile()
      || stat.isSymbolicLink()
      || stat.size > FOLDER_ICON_MAX_BYTES
    ) {
      return { status: 'failed' as const }
    }
    const bytes = await fs.readFile(chosen.filePaths[0])
    mutation = parseFolderIconWritePayload({
      ...target,
      buffer: bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ),
    })
  }
  if (!mutation)
    return { status: 'unavailable' as const }
  const change = mutation
  return runFolderIconMutation(target, async () => {
    if (getVaultPath() !== vault)
      return { status: 'stale' as const }
    const before = await readIconState(target)
    if (getVaultPath() !== vault)
      return { status: 'stale' as const }
    let after: IconState
    if ('buffer' in change) {
      after = await writeFolderIconUnlocked(change)
    }
    else {
      await setFolderIconUnlocked(change)
      after = { icon: change.icon, png: null }
    }
    // Save the exact PNG bytes in a private receipt; never return them to the model.
    const id = randomUUID()
    iconUndo.set(id, {
      target,
      vault,
      before,
      after,
      expiresAt: Date.now() + ICON_UNDO_TTL,
    })
    pruneIconUndo()
    return { status: 'done' as const, receiptId: id, icon: after.icon }
  })
}

export async function undoFolderIconChange(id: unknown) {
  pruneIconUndo()
  const receipt = typeof id === 'string' ? iconUndo.get(id) : undefined
  if (!receipt || receipt.vault !== getVaultPath())
    return { undone: false }
  return runFolderIconMutation(receipt.target, async () => {
    if (receipt.undone)
      return { undone: true }
    if (receipt.vault !== getVaultPath())
      return { undone: false }
    const current = await readIconState(receipt.target)
    if (
      current.icon !== receipt.after.icon
      || (current.png === null) !== (receipt.after.png === null)
      || (current.png && !current.png.equals(receipt.after.png!))
      || receipt.vault !== getVaultPath()
    ) {
      return { undone: false }
    }
    await restoreIconState(
      receipt.target,
      receipt.before,
      current,
      receipt.vault,
    )
    receipt.undone = true
    receipt.before.png = null
    receipt.after.png = null
    return { undone: true }
  })
}

export async function resolveFolderIconResponse(
  spaceId: string,
  rawFolderId: string,
): Promise<Response> {
  if (!/^[1-9]\d*$/.test(rawFolderId))
    return new Response('Not found', { status: 404 })

  const target = parseFolderIconTarget({
    folderId: Number(rawFolderId),
    spaceId,
  })
  const iconPath
    = target && resolveFolderIconPath(target.spaceId, target.folderId)

  if (!iconPath)
    return new Response('Not found', { status: 404 })

  try {
    const stats = await fs.lstat(iconPath)
    if (!stats.isFile() || stats.isSymbolicLink())
      return new Response('Not found', { status: 404 })

    const availability = getFileAvailability(iconPath)
    if (!availability.exists || !availability.stats?.isFile())
      return new Response('Not found', { status: 404 })

    if (availability.isCloudPlaceholder) {
      prioritizeCloudDownload(iconPath)
      return new Response('Temporarily unavailable', {
        headers: {
          'Cache-Control': 'no-store',
          'Retry-After': '1',
          'X-Content-Type-Options': 'nosniff',
        },
        status: 503,
      })
    }

    const icon = await fs.readFile(iconPath)
    return new Response(icon, {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'image/png',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  }
  catch {
    return new Response('Not found', { status: 404 })
  }
}
