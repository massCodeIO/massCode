import { renderToString } from '@vue/server-renderer'
import { describe, expect, it } from 'vitest'
import { computed, createSSRApp, defineComponent, h, ref, watch } from 'vue'
import EditableTable from '../EditableTable.vue'
import Footer from '../Footer.vue'

Object.assign(globalThis, { computed, ref, watch })
const text = defineComponent({
  props: ['as'],
  setup:
    (props, { slots }) =>
      () =>
        h(props.as ?? 'span', slots.default?.()),
})
async function render(variant: 'default' | 'compact', rawRow = '') {
  const app = createSSRApp({
    render: () =>
      h(
        EditableTable<{ uid: string, name: string, value: string }>,
        {
          rows: [
            { uid: 'first', name: 'BASE', value: 'https://example.com' },
            { uid: 'second', name: 'TOKEN', value: 'masked' },
          ],
          columns: [
            { key: 'name', label: 'Name' },
            { key: 'value', label: 'Value' },
          ],
          rowKey: (row: { uid: string }) => row.uid,
          label: 'Variables',
          variant,
          replaceRow: (row: { uid: string }) => row.uid === rawRow,
        },
        {
          'row-editor': () => h('textarea', 'raw draft'),
          'cell-name': ({ row }: { row: { name: string } }) =>
            h('span', [row.name, h('small', 'Environment · Local')]),
        },
      ),
  })
  app.component('UiText', text)
  app.component('UiEditableTableFooter', Footer)
  app.component('UiEditableTableCell', text)
  return renderToString(app)
}
describe('shared editable table layouts', () => {
  it('renders inspector-style metadata, wrapping and borders without a header', async () => {
    const html = await render('compact')
    expect(html).not.toContain('role="columnheader"')
    expect(html).toContain('Environment · Local')
    expect(html).toContain('break-all')
    expect(html).toContain('border-l')
  })
  it('replaces only the selected row with its editor in the default layout', async () => {
    const html = await render('default', 'first')
    expect(html).toContain('role="columnheader"')
    expect(html).toContain('raw draft')
    expect(html).not.toContain('https://example.com')
    expect(html).toContain('TOKEN')
    expect(html).toContain('masked')
  })
})
