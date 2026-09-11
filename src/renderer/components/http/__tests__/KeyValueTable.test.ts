import { renderToString } from '@vue/server-renderer'
import { describe, expect, it, vi } from 'vitest'
import { computed, createSSRApp, defineComponent, h, ref, watch } from 'vue'
import EditableTable from '../../ui/editable-table/EditableTable.vue'
import Footer from '../../ui/editable-table/Footer.vue'
import KeyValueTable from '../KeyValueTable.vue'

vi.mock('@/electron', () => ({ i18n: { t: (key: string) => key } }))
Object.assign(globalThis, { computed, ref, watch })
const text = defineComponent({
  props: ['as'],
  setup:
    (props, { slots }) =>
      () =>
        h(props.as ?? 'span', slots.default?.()),
})
async function render(secret = false, customFooter = false) {
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
          ...(customFooter
            ? {
                'footer-actions': ({ addRow }: { addRow: () => void }) => {
                  expect(addRow).toBeTypeOf('function')
                  return h('button', { onClick: addRow }, 'Custom add')
                },
              }
            : {}),
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
  app.component('UiEditableTableFooter', Footer)
  app.component('UiEditableTableCell', text)
  app.component('UiText', text)
  app.component('UiInput', text)
  app.component('HttpAddRowButton', text)
  app.component('HttpBodyEditor', text)
  return renderToString(app)
}
describe('key value table shared layout adapter', () => {
  it('renders custom footer actions with the shared add callback', async () => {
    const html = await render(false, true)
    expect(html).toContain('Custom add')
    expect(html).toContain('flex-wrap items-center gap-2 p-1')
    expect(html).not.toContain('spaces.http.editor.keyValue.addRow')
  })
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

it('keeps unfinished bulk input while updating the model and follows external replacements', async () => {
  const { createRenderer, nextTick, ssrContextKey } = await import('vue')
  const component = KeyValueTable as unknown as import('vue').ComponentOptions
  const rows = ref([
    { key: 'x', value: 'one', description: 'keep', enabled: true },
  ])
  const renderer = createRenderer({
    patchProp() {},
    insert() {},
    remove() {},
    createElement: () => ({}),
    createText: () => ({}),
    createComment: () => ({}),
    setText() {},
    setElementText() {},
    parentNode: () => null,
    nextSibling: () => null,
  })
  let state: any
  const probe = defineComponent({
    ...component,
    setup(props, context) {
      state = component.setup!(props, context)
      return () => null
    },
  })
  const app = renderer.createApp(
    defineComponent({
      setup() {
        return () =>
          h(probe, {
            'modelValue': rows.value,
            'bulkEdit': true,
            'onUpdate:modelValue': (value: typeof rows.value) => {
              rows.value = value
            },
          })
      },
    }),
  )
  app.provide(ssrContextKey, {})
  app.mount({})
  try {
    state.toggleBulkEdit()
    expect(state.bulkText.value).toBe('x:one')
    state.updateBulkText('x:two\n\nunfinished')
    expect(rows.value[0]?.description).toBe('keep')
    await nextTick()
    expect(rows.value[1]?.key).toBe('unfinished')
    expect(state.bulkText.value).toBe('x:two\n\nunfinished')
    rows.value = [
      { key: 'external', value: 'new', description: '', enabled: true },
    ]
    await nextTick()
    expect(state.bulkText.value).toBe('external:new')
  }
  finally {
    app.unmount()
  }
})
