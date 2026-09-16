import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { compileScript, compileTemplate, parse } from 'vue/compiler-sfc'

const filename = new URL('../TreeNode.vue', import.meta.url).pathname
const source = fs.readFileSync(filename, 'utf8')

describe('tree node CSS variable ownership', () => {
  it('compiles without Vue CSS variable traversal for each recursive instance', () => {
    const { descriptor, errors } = parse(source, { filename })
    expect(errors).toEqual([])
    expect(descriptor.cssVars).toEqual([])
    const script = compileScript(descriptor, { id: 'tree-node' })
    expect(script.content).not.toContain('useCssVars')
    const template = compileTemplate({
      source: descriptor.template!.content,
      filename,
      id: 'tree-node',
      compilerOptions: { bindingMetadata: script.bindings },
    })
    expect(template.errors).toEqual([])
  })

  it('defines both variables on each node root, overriding inherited depth', () => {
    const { descriptor } = parse(source, { filename })
    const root = descriptor.template!.ast!.children.find(
      node => node.type === 1,
    )!
    if (root.type !== 1)
      throw new Error('Expected a root element')
    const style = root.props.find(
      prop =>
        prop.type === 7
        && prop.name === 'bind'
        && prop.arg?.type === 4
        && prop.arg.content === 'style',
    )
    expect(style?.type).toBe(7)
    if (style?.type !== 7 || style.exp?.type !== 4)
      throw new Error('Expected root style bindings')
    expect(style.exp.content).toContain('\'--ui-tree-indent\': indentStyle')
    expect(style.exp.content).toContain(
      '\'--ui-tree-hover-offset\': hoveredOffsetStyle',
    )
    const css = descriptor.styles.map(style => style.content).join('\n')
    expect(css.match(/left: var\(--ui-tree-hover-offset\)/g)).toHaveLength(2)
    expect(css).toContain('padding-left: var(--ui-tree-indent)')
  })
})
