import { describe, expect, it } from 'vitest'
import {
  mapNormalizedCursorIndex,
  normalizeTerminalText,
} from '../normalizeTerminalText'

describe('normalizeTerminalText', () => {
  it('normalizes copied terminal output into readable paragraphs', () => {
    const input = `1. Prepare the deployment package. The repository has no release tag, so provide the version explicitly:
  ./scripts/package.sh 1.4.0
  The script validates metadata, generates artifacts, and creates a signed archive.

2. Publish the changes:
  git push --follow-tags

3. Open the dashboard and verify that the new version appears in the release list.`

    expect(normalizeTerminalText(input))
      .toBe(`1. Prepare the deployment package. The repository has no release tag, so provide the version explicitly:

./scripts/package.sh 1.4.0

The script validates metadata, generates artifacts, and creates a signed archive.

2. Publish the changes:

git push --follow-tags

3. Open the dashboard and verify that the new version appears in the release list.`)
  })

  it('joins wrapped prose with spaces', () => {
    expect(normalizeTerminalText('A wrapped\nline with\nwords.')).toBe(
      'A wrapped line with words.',
    )
  })

  it('normalizes CRLF and CR line endings', () => {
    expect(normalizeTerminalText('first\r\nsecond\rthird')).toBe(
      'first second third',
    )
  })

  it('collapses repeated blank lines between blocks and trims outer blanks', () => {
    expect(normalizeTerminalText('\n\nfirst\n\n\nsecond\n\n')).toBe(
      'first\n\nsecond',
    )
  })

  it('removes leading and trailing spaces outside fenced blocks', () => {
    expect(normalizeTerminalText('   first line   \n  second line  ')).toBe(
      'first line second line',
    )
  })

  it('keeps shell commands in separate blocks', () => {
    const input = `Before
$ npm test
> git status
git status
../scripts/release.sh
~/bin/tool
/usr/bin/env node
After`

    expect(normalizeTerminalText(input)).toBe(
      'Before\n\n$ npm test\n\n> git status\n\ngit status\n\n../scripts/release.sh\n\n~/bin/tool\n\n/usr/bin/env node\n\nAfter',
    )
  })

  it('keeps tight list items together and joins continuation prose', () => {
    const input = `1. First item
continues here
2) Second item
also continues
- Bullet item
last continuation`

    expect(normalizeTerminalText(input)).toBe(
      '1. First item continues here\n2) Second item also continues\n- Bullet item last continuation',
    )
  })

  it('preserves a GFM table line by line', () => {
    const input = `| Name | Value |
| :--- | ---: |
| first | wrapped |
| second | value |`

    expect(normalizeTerminalText(input)).toBe(input)
  })

  it('preserves tight ordered and bullet lists', () => {
    const input = `1. First
2. Second
- Third
* Fourth`

    expect(normalizeTerminalText(input)).toBe(input)
  })

  it('preserves indentation for nested list items', () => {
    const input = `- Parent
  - Nested with two spaces
    - Nested with four spaces`

    expect(normalizeTerminalText(input)).toBe(input)
  })

  it('treats an indented list marker without a parent list as code', () => {
    const input = `    - literal
      continuation`
    const normalized = normalizeTerminalText(input)

    expect(normalized).toBe(input)
    expect(normalizeTerminalText(normalized)).toBe(normalized)
  })

  it('preserves tab-indented and four-space indented code', () => {
    const input = [
      'Before',
      '\tconst tabbed = true',
      '    const spaced = true',
      'After',
    ].join('\n')

    expect(normalizeTerminalText(input)).toBe(
      'Before\n\n\tconst tabbed = true\n    const spaced = true\n\nAfter',
    )
  })

  it('preserves multi-line quotes', () => {
    const input = `> First line
> second line
> third line`

    expect(normalizeTerminalText(input)).toBe(input)
  })

  it('treats command-like lines prefixed with > as a quote sequence', () => {
    const input = `> git status
> npm test`

    expect(normalizeTerminalText(input)).toBe(input)
  })

  it('preserves backtick fenced blocks except for line endings', () => {
    const input
      = 'Before\r\n```sh\r\n  echo one\r\n\r\n echo two\r\n```\r\nAfter'

    expect(normalizeTerminalText(input)).toBe(
      'Before\n\n```sh\n  echo one\n\n echo two\n```\n\nAfter',
    )
  })

  it('preserves tilde fenced blocks', () => {
    const input = '~~~ text\n  one\n two\n~~~~'

    expect(normalizeTerminalText(input)).toBe(input)
  })

  it('preserves an unmatched fence through the end of the input', () => {
    const input = 'Intro\n```sh\n  echo one\n\n  echo two'

    expect(normalizeTerminalText(input)).toBe(
      'Intro\n\n```sh\n  echo one\n\n  echo two',
    )
  })

  it('returns an empty string for empty or whitespace-only input', () => {
    expect(normalizeTerminalText('')).toBe('')
    expect(normalizeTerminalText(' \n\t\n')).toBe('')
  })

  it('is idempotent', () => {
    const input = `1. Run this command:
  pnpm test
  Then inspect the result.

~~~sh
  echo preserved
~~~`
    const normalized = normalizeTerminalText(input)

    expect(normalizeTerminalText(normalized)).toBe(normalized)
  })

  it('is idempotent for mixed markdown', () => {
    const input = `# Release
Wrapped prose
continues here

- First item
  - Nested item
second line of nested item

> Quote one
> Quote two

    pnpm test

| Name | Value |
| --- | --- |
| one | two |`
    const normalized = normalizeTerminalText(input)

    expect(normalizeTerminalText(normalized)).toBe(normalized)
  })

  it('keeps markdown structural lines in separate blocks', () => {
    expect(normalizeTerminalText('# Heading\nText\n> Quote\n---')).toBe(
      '# Heading\n\nText\n\n> Quote\n\n---',
    )
  })

  it('maps a cursor using the normalized suffix at paragraph boundaries', () => {
    const prose = 'first\nsecond'
    const command = 'Before\ngit status'

    expect(mapNormalizedCursorIndex(prose, 5)).toBe(5)
    expect(mapNormalizedCursorIndex(prose, 6)).toBe(6)
    expect(mapNormalizedCursorIndex(command, 'Before\n'.length)).toBe(
      'Before\n\n'.length,
    )
  })

  it('falls back to prefix mapping inside a fenced block', () => {
    const input = '```sh\n  first\n  second\n```'
    const cursorIndex = input.indexOf('second')

    expect(mapNormalizedCursorIndex(input, cursorIndex)).toBe(cursorIndex)
  })
})
