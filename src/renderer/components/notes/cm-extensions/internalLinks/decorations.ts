import type { DecorationSet, EditorView, ViewUpdate } from '@codemirror/view'
import type { CachedEntity } from './cache'
import type { InternalLinkMatch, InternalLinkType } from './parser'
import { i18n } from '@/electron'
import { api } from '@/services/api'
import { StateEffect } from '@codemirror/state'
import { Decoration, ViewPlugin, WidgetType } from '@codemirror/view'
import { entityCache } from './cache'
import { findInternalLinks } from './parser'

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
      : 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
  )
  svg.append(path)

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
    label.textContent = this.link.label
    root.append(label)

    if (this.status === 'broken') {
      root.title = i18n.t(
        this.resolvedTarget?.type === 'snippet'
          ? 'internalLinks.missing.snippet'
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
  return `title:${title.trim().toLocaleLowerCase()}`
}

function findExactNameMatch<T extends { name: string }>(
  items: T[],
  title: string,
): T | undefined {
  const normalizedTitle = title.trim().toLocaleLowerCase()

  return items.find(
    item => item.name.trim().toLocaleLowerCase() === normalizedTitle,
  )
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

async function resolveInternalLinkByTitle(
  title: string,
): Promise<CachedEntity> {
  try {
    const [{ data: snippets }, { data: notes }] = await Promise.all([
      api.snippets.getSnippets({ search: title, isDeleted: 0 }),
      api.notes.getNotes({ search: title, isDeleted: 0 }),
    ])

    const snippet = findExactNameMatch(snippets, title)
    if (snippet) {
      return {
        exists: true,
        data: {
          firstContent: snippet.contents[0]
            ? {
                language: snippet.contents[0].language,
                value: snippet.contents[0].value,
              }
            : null,
          folder: snippet.folder,
          id: snippet.id,
          isDeleted: snippet.isDeleted,
          name: snippet.name,
          type: 'snippet',
        },
      }
    }

    const note = findExactNameMatch(notes, title)
    if (note) {
      return {
        exists: true,
        data: {
          contentExcerpt: note.content.slice(0, 400).trim(),
          folder: note.folder,
          id: note.id,
          isDeleted: note.isDeleted,
          name: note.name,
          type: 'note',
        },
      }
    }

    return { exists: false }
  }
  catch {
    return { exists: false }
  }
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
          || update.selectionSet
          || update.focusChanged
          || hasRefreshEffect
        ) {
          this.decorations = this.build()
        }
      }

      private build() {
        const decorations = []
        const selections = this.view.state.selection.ranges.map(range => ({
          empty: range.empty,
          from: range.from,
          to: range.to,
        }))

        for (const link of findInternalLinks(this.view.state.doc.toString())) {
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

        return Decoration.set(decorations, true)
      }
    },
    {
      decorations: value => value.decorations,
    },
  )
}
