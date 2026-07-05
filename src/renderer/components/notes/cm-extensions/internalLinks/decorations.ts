import type { DecorationSet, EditorView, ViewUpdate } from '@codemirror/view'
import type { CachedEntity } from './cache'
import type { InternalLinkMatch, InternalLinkType } from './parser'
import { i18n } from '@/electron'
import { api } from '@/services/api'
import { StateEffect } from '@codemirror/state'
import { Decoration, ViewPlugin, WidgetType } from '@codemirror/view'
import { getRevealSelection, revealSelectionChanged } from '../revealSelection'
import { entityCache } from './cache'
import { findInternalLinks, normalizeInternalLinkLookupKey } from './parser'

type InternalLinksMode = 'raw' | 'livePreview' | 'preview'

const refreshInternalLinksEffect = StateEffect.define<null>()

interface SelectionSnapshot {
  from: number
  to: number
  empty: boolean
}

type InternalLinkEntityStatus = 'pending' | 'valid' | 'broken'

export function getInternalLinkEntityStatus(
  entity: CachedEntity | undefined,
): InternalLinkEntityStatus {
  if (!entity) {
    return 'pending'
  }

  return entity.exists ? 'valid' : 'broken'
}

export function shouldShowInternalLinkWidget(
  mode: InternalLinksMode,
  hasFocus: boolean,
  selections: SelectionSnapshot[],
  from: number,
  to: number,
): boolean {
  if (mode === 'raw') {
    return false
  }

  if (!hasFocus) {
    return true
  }

  return !selections.some(({ from: selectionFrom, to: selectionTo, empty }) => {
    if (empty) {
      return selectionFrom >= from && selectionFrom < to
    }

    return selectionFrom < to && selectionTo > from
  })
}

function createTypeIcon(type: InternalLinkType): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('width', '14')
  svg.setAttribute('height', '14')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '2')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.classList.add('cm-internal-link__icon')

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute(
    'd',
    type === 'snippet'
      ? 'M8 9l-3 3 3 3M16 9l3 3-3 3M13 6l-2 12'
      : type === 'http-request'
        ? 'm22 2-7 20-4-9-9-4Z'
        : 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
  )
  svg.append(path)

  if (type === 'http-request') {
    const second = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'path',
    )
    second.setAttribute('d', 'M22 2 11 13')
    svg.append(second)
  }

  if (type === 'note') {
    const second = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'path',
    )
    second.setAttribute('d', 'M14 2v6h6M8 13h8M8 17h5')
    svg.append(second)
  }

  return svg
}

class InternalLinkWidget extends WidgetType {
  constructor(
    readonly link: InternalLinkMatch,
    readonly status: InternalLinkEntityStatus,
    readonly resolvedTarget: { id: number, type: InternalLinkType } | null,
  ) {
    super()
  }

  eq(other: InternalLinkWidget): boolean {
    return (
      this.link.raw === other.link.raw
      && this.link.label === other.link.label
      && this.status === other.status
      && this.resolvedTarget?.id === other.resolvedTarget?.id
      && this.resolvedTarget?.type === other.resolvedTarget?.type
    )
  }

  toDOM(): HTMLElement {
    const root = document.createElement('span')
    root.className = `cm-internal-link is-${this.status}`
    root.style.textIndent = '0'
    root.dataset.internalLink = 'true'
    root.dataset.internalLinkBroken = String(this.status === 'broken')
    root.dataset.internalLinkFrom = String(this.link.from)

    if (this.resolvedTarget) {
      root.dataset.internalLinkId = String(this.resolvedTarget.id)
      root.dataset.internalLinkType = this.resolvedTarget.type
    }

    root.append(createTypeIcon(this.resolvedTarget?.type ?? 'note'))

    const label = document.createElement('span')
    label.className = 'cm-internal-link__label'
    label.textContent = this.link.alias ?? this.link.basename
    root.append(label)

    if (this.status === 'broken') {
      root.title = i18n.t(
        this.resolvedTarget?.type === 'snippet'
          ? 'internalLinks.missing.snippet'
          : this.resolvedTarget?.type === 'http-request'
            ? 'internalLinks.missing.httpRequest'
            : 'internalLinks.missing.note',
      )
    }

    return root
  }

  ignoreEvent(): boolean {
    return false
  }
}

function getCacheKey(type: InternalLinkType, id: number) {
  return `${type}:${id}`
}

function getTitleCacheKey(title: string) {
  return `title:${normalizeInternalLinkLookupKey(title)}`
}

export async function fetchInternalLinkEntity(
  type: InternalLinkType,
  id: number,
): Promise<CachedEntity> {
  try {
    if (type === 'snippet') {
      const { data } = await api.snippets.getSnippetsById(String(id))

      if (data.isDeleted) {
        return { exists: false }
      }

      return {
        exists: true,
        data: {
          firstContent: data.contents[0]
            ? {
                language: data.contents[0].language,
                value: data.contents[0].value,
              }
            : null,
          folder: data.folder,
          id: data.id,
          isDeleted: data.isDeleted,
          name: data.name,
          type,
        },
      }
    }

    if (type === 'http-request') {
      const { data } = await api.httpRequests.getHttpRequestsById(String(id))

      return {
        exists: true,
        data: {
          folder: null,
          id: data.id,
          isDeleted: 0,
          name: data.name,
          request: {
            description: data.description,
            method: data.method,
            url: data.url,
          },
          type,
        },
      }
    }

    const { data } = await api.notes.getNotesById(String(id))

    if (data.isDeleted) {
      return { exists: false }
    }

    return {
      exists: true,
      data: {
        contentExcerpt: data.content.slice(0, 400).trim(),
        folder: data.folder,
        id: data.id,
        isDeleted: data.isDeleted,
        name: data.name,
        type,
      },
    }
  }
  catch {
    return { exists: false }
  }
}

// Резолв по title собирается в один batch-запрос на все ссылки документа:
// все запросы одного тика (build-проход по видимым ссылкам) уходят одним
// POST /internal-links/resolve вместо пакета из 5 запросов на ссылку.
interface PendingTitleResolution {
  title: string
  resolvers: ((entity: CachedEntity) => void)[]
}

const pendingTitleResolutions = new Map<string, PendingTitleResolution>()
let isTitleResolutionFlushScheduled = false

function toCachedEntity(
  resolved:
    | {
      type: InternalLinkType
      id: number
      name: string
      folder: { id: number, name: string } | null
      isDeleted: number
      firstContent?: { language: string, value: string | null } | null
      contentExcerpt?: string
      request?: { method: string, url: string, description: string }
    }
    | null
    | undefined,
): CachedEntity {
  if (!resolved || resolved.isDeleted) {
    return { exists: false }
  }

  return {
    exists: true,
    data: {
      contentExcerpt: resolved.contentExcerpt,
      firstContent: resolved.firstContent ?? null,
      folder: resolved.folder,
      id: resolved.id,
      isDeleted: resolved.isDeleted,
      name: resolved.name,
      request: resolved.request,
      type: resolved.type,
    },
  }
}

async function flushTitleResolutions() {
  isTitleResolutionFlushScheduled = false

  const batch = [...pendingTitleResolutions.values()]
  pendingTitleResolutions.clear()

  if (!batch.length) {
    return
  }

  try {
    const { data } = await api.internalLinks.postInternalLinksResolve({
      titles: batch.map(entry => entry.title),
    })
    const resolvedByTitle = new Map(data.map(item => [item.title, item]))

    for (const entry of batch) {
      const entity = toCachedEntity(
        resolvedByTitle.get(entry.title)?.resolved as Parameters<
          typeof toCachedEntity
        >[0],
      )
      entry.resolvers.forEach(resolve => resolve(entity))
    }
  }
  catch {
    for (const entry of batch) {
      entry.resolvers.forEach(resolve => resolve({ exists: false }))
    }
  }
}

function resolveInternalLinkByTitle(title: string): Promise<CachedEntity> {
  return new Promise((resolve) => {
    const normalizedTitle = title.trim()

    if (!normalizedTitle) {
      resolve({ exists: false })
      return
    }

    const entry = pendingTitleResolutions.get(normalizedTitle) ?? {
      resolvers: [],
      title: normalizedTitle,
    }
    entry.resolvers.push(resolve)
    pendingTitleResolutions.set(normalizedTitle, entry)

    if (!isTitleResolutionFlushScheduled) {
      isTitleResolutionFlushScheduled = true
      queueMicrotask(() => {
        void flushTitleResolutions()
      })
    }
  })
}

function getInternalLinkCacheKey(link: InternalLinkMatch): string {
  if (link.legacyTarget) {
    return getCacheKey(link.legacyTarget.type, link.legacyTarget.id)
  }

  return getTitleCacheKey(link.target)
}

function requestEntityRefresh(view: EditorView, link: InternalLinkMatch) {
  const key = getInternalLinkCacheKey(link)
  if (entityCache.get(key) || entityCache.isPending(key)) {
    return
  }

  entityCache.markPending(key)
  const request = link.legacyTarget
    ? fetchInternalLinkEntity(link.legacyTarget.type, link.legacyTarget.id)
    : resolveInternalLinkByTitle(link.target)

  void request.then((entity) => {
    entityCache.set(key, entity)
    view.dispatch({
      effects: refreshInternalLinksEffect.of(null),
    })
  })
}

export function createInternalLinksDecorations(mode: InternalLinksMode) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet = Decoration.none

      constructor(private readonly view: EditorView) {
        this.decorations = this.build()
      }

      private linkRanges: { from: number, to: number }[] = []

      update(update: ViewUpdate) {
        const hasRefreshEffect = update.transactions.some(transaction =>
          transaction.effects.some(
            effect =>
              typeof effect === 'object'
              && effect !== null
              && 'is' in effect
              && typeof effect.is === 'function'
              && effect.is(refreshInternalLinksEffect),
          ),
        )

        if (
          update.docChanged
          || update.viewportChanged
          || update.focusChanged
          || hasRefreshEffect
        ) {
          this.decorations = this.build()
          return
        }

        // Widgets only depend on whether the selection intersects a link
        // range, so a pure selection move outside every link cannot change
        // the decorations. Unfreezing the reveal selection (mouseup after a
        // drag) changes the effective selection too.
        if (
          (update.selectionSet && this.selectionTouchesLinks(update))
          || revealSelectionChanged(update)
        ) {
          this.decorations = this.build()
        }
      }

      private selectionTouchesLinks(update: ViewUpdate): boolean {
        if (this.linkRanges.length === 0) {
          return false
        }

        const selections = [
          ...update.startState.selection.ranges,
          ...update.state.selection.ranges,
        ]

        return this.linkRanges.some(link =>
          selections.some((range) => {
            if (range.empty) {
              return range.from >= link.from && range.from < link.to
            }

            return range.from < link.to && range.to > link.from
          }),
        )
      }

      private build() {
        const decorations = []
        const linkRanges: { from: number, to: number }[] = []
        const doc = this.view.state.doc
        const selections = getRevealSelection(this.view.state).ranges.map(
          range => ({
            empty: range.empty,
            from: range.from,
            to: range.to,
          }),
        )

        let scannedTo = 0

        for (const visibleRange of this.view.visibleRanges) {
          // Internal links never span multiple lines, so extending the
          // visible range to full line boundaries is enough to avoid
          // cutting a link at the viewport edge.
          const from = Math.max(doc.lineAt(visibleRange.from).from, scannedTo)
          const to = doc.lineAt(visibleRange.to).to

          if (to <= from) {
            continue
          }

          scannedTo = to

          for (const match of findInternalLinks(doc.sliceString(from, to))) {
            const link: InternalLinkMatch = {
              ...match,
              from: from + match.from,
              to: from + match.to,
            }

            linkRanges.push({ from: link.from, to: link.to })

            if (
              !shouldShowInternalLinkWidget(
                mode,
                this.view.hasFocus,
                selections,
                link.from,
                link.to,
              )
            ) {
              continue
            }

            const key = getInternalLinkCacheKey(link)
            const entity = entityCache.get(key)
            const status = getInternalLinkEntityStatus(entity)

            if (status === 'pending') {
              requestEntityRefresh(this.view, link)
            }

            decorations.push(
              Decoration.replace({
                widget: new InternalLinkWidget(
                  link,
                  status,
                  entity?.exists
                    ? { id: entity.data.id, type: entity.data.type }
                    : link.legacyTarget,
                ),
              }).range(link.from, link.to),
            )
          }
        }

        this.linkRanges = linkRanges

        return Decoration.set(decorations, true)
      }
    },
    {
      decorations: value => value.decorations,
    },
  )
}
