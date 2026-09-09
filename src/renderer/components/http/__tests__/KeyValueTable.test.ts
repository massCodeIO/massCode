import { renderToString } from '@vue/server-renderer'
import { describe, expect, it, vi } from 'vitest'
import { computed, createSSRApp, defineComponent, h } from 'vue'
import EditableTable from '../../ui/editable-table/EditableTable.vue'
import KeyValueTable from '../KeyValueTable.vue'

vi.mock('@/electron', () => ({ i18n: { t: (key: string) => key } }))
Object.assign(globalThis, { computed })
const text = defineComponent({
  props: ['as'],
  setup:
    (props, { slots }) =>
      () =>
        h(props.as ?? 'span', slots.default?.()),
})
async function render(secret = false) {
  const app = createSSRApp({
    render: () =>
      h(
        KeyValueTable,
        {
          modelValue: [{ key: 'TOKEN', value: 'masked', enabled: false }],
          columns: [
            { key: 'key', label: 'Name' },
            { key: 'value', label: 'Value' },
          ],
          showEnabled: !secret,
          actions: secret ? 'delete' : 'none',
          gridTemplateColumns: secret ? '1fr 1fr 24px' : '',
          fill: false,
        },
        {
          'cell-key': ({
            entry,
            index,
          }: {
            entry: { key: string }
            index: number
          }) => h('span', `${index}:${entry.key}`),
          'cell-value': () => h('input', { type: 'password', value: 'masked' }),
          'delete-action': ({
            entry,
            removeRow,
          }: {
            entry: { key: string }
            removeRow: () => void
          }) => h('button', { onClick: removeRow }, `Remove ${entry.key}`),
        },
      ),
  })
  app.component('UiEditableTable', EditableTable)
  app.component('UiEditableTableCell', text)
  app.component('UiText', text)
  app.component('UiInput', text)
  app.component('HttpAddRowButton', text)
  return renderToString(app)
}
describe('key value table shared layout adapter', () => {
  it('keeps caller cell slots, row indices and disabled-row presentation', async () => {
    const html = await render()
    expect(html).toContain('role="table"')
    expect(html).toContain('0:TOKEN')
    expect(html).toContain('opacity-50')
    expect(html).toContain('type="password"')
    expect(html).not.toContain('hover:bg-accent-hover grid')
  })
  it('preserves environment delete slot and custom column widths without enabled column', async () => {
    const html = await render(true)
    expect(html).toContain('grid-template-columns:1fr 1fr 24px')
    expect(html).toContain('Remove TOKEN')
    expect(html).not.toContain('role="checkbox"')
    expect(html).not.toContain('opacity-50')
  })
})
