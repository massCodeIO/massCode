import { create, type Delta } from 'jsondiffpatch'

export type DiffChangeType = 'added' | 'removed' | 'modified' | 'unchanged'

export interface DiffNode {
  key: string
  path: string
  type: 'object' | 'array' | 'value'
  changeType: DiffChangeType
  leftValue?: unknown
  rightValue?: unknown
  children?: DiffNode[]
  hasVisibleDescendant?: boolean
}

export interface JsonDiffFilterState {
  added: boolean
  removed: boolean
  modified: boolean
}

type JsonRecord = Record<string, unknown>
interface ParseResult {
  value: unknown
  error: string
}

const diffInstance = create({
  arrays: {
    detectMove: false,
  },
})

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function getNodeType(value: unknown): DiffNode['type'] {
  if (Array.isArray(value))
    return 'array'

  if (isRecord(value))
    return 'object'

  return 'value'
}

function getObjectKeys(
  left: JsonRecord | undefined,
  right: JsonRecord | undefined,
  delta: JsonRecord | undefined,
) {
  const keys = new Set<string>()

  for (const key of Object.keys(left ?? {})) keys.add(key)

  for (const key of Object.keys(right ?? {})) keys.add(key)

  for (const key of Object.keys(delta ?? {})) {
    if (key !== '_t')
      keys.add(key)
  }

  return [...keys]
}

function getArrayIndexes(
  left: unknown[] | undefined,
  right: unknown[] | undefined,
  delta: JsonRecord | undefined,
) {
  const indexes = new Set<number>()

  if (left) {
    for (const index of left.keys()) indexes.add(index)
  }

  if (right) {
    for (const index of right.keys()) indexes.add(index)
  }

  for (const key of Object.keys(delta ?? {})) {
    if (key === '_t')
      continue

    indexes.add(Number(key.startsWith('_') ? key.slice(1) : key))
  }

  return [...indexes].sort((leftIndex, rightIndex) => leftIndex - rightIndex)
}

function buildSubtree(
  value: unknown,
  parentPath: string,
  changeType: DiffChangeType,
): DiffNode[] {
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      const path = `${parentPath}[${index}]`
      const nodeType = getNodeType(item)

      return {
        key: String(index),
        path,
        type: nodeType,
        changeType,
        leftValue: changeType === 'removed' ? item : undefined,
        rightValue: changeType === 'added' ? item : undefined,
        children:
          nodeType === 'value'
            ? undefined
            : buildSubtree(item, path, changeType),
      }
    })
  }

  if (isRecord(value)) {
    return Object.entries(value).map(([key, item]) => {
      const path = parentPath ? `${parentPath}.${key}` : key
      const nodeType = getNodeType(item)

      return {
        key,
        path,
        type: nodeType,
        changeType,
        leftValue: changeType === 'removed' ? item : undefined,
        rightValue: changeType === 'added' ? item : undefined,
        children:
          nodeType === 'value'
            ? undefined
            : buildSubtree(item, path, changeType),
      }
    })
  }

  return []
}

function buildPrimitiveNode(
  left: unknown,
  right: unknown,
  delta: Delta,
  parentPath: string,
): DiffNode[] {
  const path = parentPath || '$'
  let changeType: DiffChangeType = 'unchanged'
  let leftValue = left
  let rightValue = right

  if (Array.isArray(delta)) {
    if (delta.length === 1) {
      changeType = 'added'
      leftValue = undefined
      rightValue = delta[0]
    }
    else if (delta.length === 2) {
      changeType = 'modified'
      leftValue = delta[0]
      rightValue = delta[1]
    }
    else if (delta.length === 3 && delta[2] === 0) {
      changeType = 'removed'
      leftValue = delta[0]
      rightValue = undefined
    }
  }

  return [
    {
      key: 'value',
      path,
      type: 'value',
      changeType,
      leftValue,
      rightValue,
    },
  ]
}

function buildTree(
  left: unknown,
  right: unknown,
  delta: Delta,
  parentPath = '',
): DiffNode[] {
  if (delta === undefined) {
    if (Array.isArray(left) || Array.isArray(right)) {
      const source = Array.isArray(left)
        ? left
        : Array.isArray(right)
          ? right
          : []

      return source.map((item, index) => {
        const path = parentPath ? `${parentPath}[${index}]` : `[${index}]`
        const nodeType = getNodeType(item)

        return {
          key: String(index),
          path,
          type: nodeType,
          changeType: 'unchanged' as const,
          leftValue: item,
          rightValue: item,
          children:
            nodeType === 'value'
              ? undefined
              : buildTree(item, item, undefined, path),
        }
      })
    }

    if (isRecord(left) || isRecord(right)) {
      const source = isRecord(left) ? left : isRecord(right) ? right : {}

      return Object.entries(source).map(([key, item]) => {
        const path = parentPath ? `${parentPath}.${key}` : key
        const nodeType = getNodeType(item)

        return {
          key,
          path,
          type: nodeType,
          changeType: 'unchanged' as const,
          leftValue: item,
          rightValue: item,
          children:
            nodeType === 'value'
              ? undefined
              : buildTree(item, item, undefined, path),
        }
      })
    }

    if (left !== undefined || right !== undefined)
      return buildPrimitiveNode(left, right, undefined, parentPath)

    return []
  }

  if (Array.isArray(delta))
    return buildPrimitiveNode(left, right, delta, parentPath)

  const deltaRecord = delta as JsonRecord
  const isArrayDelta = deltaRecord._t === 'a'

  if (isArrayDelta) {
    const leftArray = Array.isArray(left) ? left : []
    const rightArray = Array.isArray(right) ? right : []
    const indexes = getArrayIndexes(leftArray, rightArray, deltaRecord)

    return indexes.map((index) => {
      const key = String(index)
      const path = parentPath ? `${parentPath}[${index}]` : `[${index}]`
      const keyDelta = deltaRecord[key] as Delta
      const removedDelta = deltaRecord[`_${key}`] as Delta
      let changeType: DiffChangeType = 'unchanged'
      let leftValue = leftArray[index]
      let rightValue = rightArray[index]
      let children: DiffNode[] | undefined

      if (
        Array.isArray(removedDelta)
        && removedDelta.length === 3
        && removedDelta[2] === 0
      ) {
        changeType = 'removed'
        leftValue = removedDelta[0]
        rightValue = undefined
      }
      else if (Array.isArray(keyDelta)) {
        if (keyDelta.length === 1) {
          changeType = 'added'
          leftValue = undefined
          rightValue = keyDelta[0]
        }
        else if (keyDelta.length === 2) {
          changeType = 'modified'
          leftValue = keyDelta[0]
          rightValue = keyDelta[1]
        }
        else if (keyDelta.length === 3 && keyDelta[2] === 0) {
          changeType = 'removed'
          leftValue = keyDelta[0]
          rightValue = undefined
        }
      }
      else if (keyDelta !== undefined) {
        changeType = 'modified'
      }

      const nodeType = getNodeType(leftValue ?? rightValue)

      if (keyDelta && !Array.isArray(keyDelta)) {
        children = buildTree(
          leftArray[index],
          rightArray[index],
          keyDelta,
          path,
        )
      }
      else if (changeType === 'unchanged' && nodeType !== 'value') {
        children = buildTree(
          leftArray[index],
          rightArray[index],
          undefined,
          path,
        )
      }
      else if (
        (changeType === 'added' || changeType === 'removed')
        && nodeType !== 'value'
      ) {
        children = buildSubtree(
          changeType === 'added' ? rightValue : leftValue,
          path,
          changeType,
        )
      }

      return {
        key,
        path,
        type: nodeType,
        changeType,
        leftValue,
        rightValue,
        children,
      }
    })
  }

  const leftRecord = isRecord(left) ? left : undefined
  const rightRecord = isRecord(right) ? right : undefined
  const keys = getObjectKeys(leftRecord, rightRecord, deltaRecord)

  return keys.map((key) => {
    const path = parentPath ? `${parentPath}.${key}` : key
    const keyDelta = deltaRecord[key] as Delta
    let changeType: DiffChangeType = 'unchanged'
    let leftValue = leftRecord?.[key]
    let rightValue = rightRecord?.[key]
    let children: DiffNode[] | undefined

    if (Array.isArray(keyDelta)) {
      if (keyDelta.length === 1) {
        changeType = 'added'
        leftValue = undefined
        rightValue = keyDelta[0]
      }
      else if (keyDelta.length === 2) {
        changeType = 'modified'
        leftValue = keyDelta[0]
        rightValue = keyDelta[1]
      }
      else if (keyDelta.length === 3 && keyDelta[2] === 0) {
        changeType = 'removed'
        leftValue = keyDelta[0]
        rightValue = undefined
      }
    }
    else if (keyDelta !== undefined) {
      changeType = 'modified'
    }

    const nodeType = getNodeType(leftValue ?? rightValue)

    if (keyDelta && !Array.isArray(keyDelta)) {
      children = buildTree(
        leftRecord?.[key],
        rightRecord?.[key],
        keyDelta,
        path,
      )
    }
    else if (changeType === 'unchanged' && nodeType !== 'value') {
      children = buildTree(
        leftRecord?.[key],
        rightRecord?.[key],
        undefined,
        path,
      )
    }
    else if (
      (changeType === 'added' || changeType === 'removed')
      && nodeType !== 'value'
    ) {
      children = buildSubtree(
        changeType === 'added' ? rightValue : leftValue,
        path,
        changeType,
      )
    }

    return {
      key,
      path,
      type: nodeType,
      changeType,
      leftValue,
      rightValue,
      children,
    }
  })
}

function nodeMatchesFilter(node: DiffNode, filters: JsonDiffFilterState) {
  if (node.changeType === 'added' && filters.added)
    return true

  if (node.changeType === 'removed' && filters.removed)
    return true

  if (node.changeType === 'modified' && filters.modified)
    return true

  return false
}

function filterNodes(
  nodes: DiffNode[],
  filters: JsonDiffFilterState,
): DiffNode[] {
  const hasActiveFilter = filters.added || filters.removed || filters.modified

  if (!hasActiveFilter)
    return nodes.map(node => ({ ...node, hasVisibleDescendant: false }))

  return nodes.flatMap((node) => {
    const filteredChildren = node.children
      ? filterNodes(node.children, filters)
      : undefined
    const matches = nodeMatchesFilter(node, filters)
    const hasVisibleDescendant = !!filteredChildren?.length

    if (!matches && !hasVisibleDescendant)
      return []

    return [
      {
        ...node,
        children: filteredChildren,
        hasVisibleDescendant,
      },
    ]
  })
}

function parseJson(text: string): ParseResult {
  if (!text.trim())
    return { value: undefined, error: '' }

  try {
    return {
      value: JSON.parse(text),
      error: '',
    }
  }
  catch {
    return {
      value: undefined,
      error: 'invalidJson',
    }
  }
}

function tryFormat(text: string) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  }
  catch {
    return text
  }
}

export function useJsonDiff() {
  const leftText = ref('')
  const rightText = ref('')
  const viewerError = ref('')
  const filters = ref<JsonDiffFilterState>({
    added: false,
    removed: false,
    modified: false,
  })
  const expandedPaths = ref<Record<string, boolean>>({})

  const parsedLeftState = computed(() => parseJson(leftText.value))
  const parsedRightState = computed(() => parseJson(rightText.value))
  const parsedLeft = computed(() => parsedLeftState.value.value)
  const parsedRight = computed(() => parsedRightState.value.value)
  const leftError = computed(() => parsedLeftState.value.error)
  const rightError = computed(() => parsedRightState.value.error)

  const isReady = computed(() => {
    return (
      !!leftText.value.trim()
      && !!rightText.value.trim()
      && !leftError.value
      && !rightError.value
    )
  })

  const showEmptyState = computed(() => {
    if (isReady.value)
      return false

    if (leftError.value || rightError.value)
      return false

    return !leftText.value.trim() || !rightText.value.trim()
  })

  const rawNodes = computed(() => {
    if (!isReady.value) {
      viewerError.value = ''
      return []
    }

    try {
      viewerError.value = ''
      const delta = diffInstance.diff(parsedLeft.value, parsedRight.value)
      return buildTree(parsedLeft.value, parsedRight.value, delta)
    }
    catch {
      viewerError.value = 'diffFailed'
      return []
    }
  })

  const nodes = computed(() => filterNodes(rawNodes.value, filters.value))

  function scheduleLeftFormat() {
    nextTick(() => {
      if (leftText.value.trim() && !leftError.value)
        leftText.value = tryFormat(leftText.value)
    })
  }

  function scheduleRightFormat() {
    nextTick(() => {
      if (rightText.value.trim() && !rightError.value)
        rightText.value = tryFormat(rightText.value)
    })
  }

  function formatLeftOnBlur() {
    if (leftText.value.trim() && !leftError.value)
      leftText.value = tryFormat(leftText.value)
  }

  function formatRightOnBlur() {
    if (rightText.value.trim() && !rightError.value)
      rightText.value = tryFormat(rightText.value)
  }

  function toggleExpanded(path: string) {
    expandedPaths.value = {
      ...expandedPaths.value,
      [path]: !expandedPaths.value[path],
    }
  }

  function isExpanded(node: DiffNode, depth: number) {
    if (node.hasVisibleDescendant)
      return true

    if (depth === 0)
      return expandedPaths.value[node.path] ?? true

    return expandedPaths.value[node.path] ?? false
  }

  return {
    leftText,
    rightText,
    leftError,
    rightError,
    viewerError,
    filters,
    nodes,
    isReady,
    showEmptyState,
    expandedPaths,
    scheduleLeftFormat,
    scheduleRightFormat,
    formatLeftOnBlur,
    formatRightOnBlur,
    toggleExpanded,
    isExpanded,
  }
}
