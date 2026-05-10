import Elysia, { t } from 'elysia'

const importSource = t.Union([
  t.Literal('github-gists'),
  t.Literal('obsidian'),
  t.Literal('raycast-snippets'),
  t.Literal('snippetslab'),
  t.Literal('vscode-snippets'),
])

const importSpace = t.Union([t.Literal('code'), t.Literal('notes')])

const importFile = t.Object({
  content: t.String(),
  encoding: t.Optional(t.Union([t.Literal('text'), t.Literal('base64')])),
  name: t.String(),
  relativePath: t.Optional(t.String()),
})

const importWarning = t.Object({
  message: t.String(),
  source: t.String(),
})

const importPreviewInput = t.Object({
  files: t.Optional(t.Array(importFile)),
  source: t.Optional(importSource),
  space: t.Optional(importSpace),
  url: t.Optional(t.String()),
})

const importApplyInput = t.Object({
  files: t.Optional(t.Array(importFile)),
  source: t.Optional(importSource),
  space: t.Optional(importSpace),
  url: t.Optional(t.String()),
})

const importPreviewResponse = t.Object({
  folders: t.Array(
    t.Object({
      path: t.String(),
      snippets: t.Number(),
    }),
  ),
  groups: t.Array(
    t.Object({
      name: t.String(),
      snippets: t.Number(),
    }),
  ),
  notes: t.Number(),
  snippets: t.Number(),
  source: importSource,
  tags: t.Array(t.String()),
  warnings: t.Array(importWarning),
})

const importApplyResponse = t.Object({
  createdRootFolderName: t.String(),
  createdSnippetNames: t.Array(t.String()),
  folders: t.Number(),
  notes: t.Number(),
  snippets: t.Number(),
  source: importSource,
  tags: t.Number(),
  warnings: t.Array(importWarning),
})

export const importsDTO = new Elysia().model({
  importApplyInput,
  importApplyResponse,
  importPreviewInput,
  importPreviewResponse,
})

export type ImportPreviewInput = typeof importPreviewInput.static
export type ImportApplyInput = typeof importApplyInput.static
export type ImportPreviewResponse = typeof importPreviewResponse.static
export type ImportApplyResponse = typeof importApplyResponse.static
