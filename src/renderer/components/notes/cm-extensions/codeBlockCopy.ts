import type { EditorState } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import type { VNode } from 'vue'
import ActionButton from '@/components/ui/action-button/ActionButton.vue'
import { TooltipProvider } from '@/components/ui/shadcn/tooltip'
import { WidgetType } from '@codemirror/view'
import { Copy } from 'lucide-vue-next'
import { h, render } from 'vue'

export interface CodeBlockCopyOptions {
  label: string
  copy: (code: string) => void
}

export interface FencedCodeContent {
  code: string
  language: string
}

export function getFencedCodeContent(
  state: EditorState,
  node: SyntaxNode,
): FencedCodeContent {
  const codeInfo = node.getChild('CodeInfo')
  const codeText = node.getChild('CodeText')
  const info = codeInfo
    ? state.sliceDoc(codeInfo.from, codeInfo.to).trim()
    : ''

  return {
    language: info.split(/\s+/, 1)[0] ?? '',
    code: codeText ? state.sliceDoc(codeText.from, codeText.to) : '',
  }
}

export function configureCodeBlockCopyRoot(root: HTMLElement): void {
  root.className = 'cm-code-block-copy'
  root.contentEditable = 'false'
  root.style.position = 'absolute'
  root.style.top = '6px'
  root.style.right = '12px'
  root.style.zIndex = '1'
  root.style.userSelect = 'none'
}

export function createCodeBlockCopyControl(
  content: FencedCodeContent,
  options: CodeBlockCopyOptions,
): VNode {
  const onMouseDown = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
  }
  const onClick = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    options.copy(content.code)
  }

  return h(TooltipProvider, null, {
    default: () =>
      h(
        ActionButton,
        {
          'aria-label': options.label,
          'class': [
            'border-border bg-background h-6 select-none rounded-md border font-mono text-[11px] leading-3 font-normal',
            content.language ? 'px-2' : 'w-6 px-0',
          ],
          'contenteditable': false,
          'size': content.language ? 'iconText' : 'icon',
          'tooltip': options.label,
          'onMousedown': onMouseDown,
          'onClick': onClick,
        },
        {
          default: () => content.language || h(Copy, { 'aria-hidden': 'true' }),
        },
      ),
  })
}

export class CodeBlockCopyWidget extends WidgetType {
  constructor(
    readonly content: FencedCodeContent,
    readonly options: CodeBlockCopyOptions,
  ) {
    super()
  }

  eq(other: CodeBlockCopyWidget): boolean {
    return (
      this.content.code === other.content.code
      && this.content.language === other.content.language
      && this.options.label === other.options.label
      && this.options.copy === other.options.copy
    )
  }

  toDOM(_view: EditorView): HTMLElement {
    const root = document.createElement('span')
    configureCodeBlockCopyRoot(root)
    render(createCodeBlockCopyControl(this.content, this.options), root)
    return root
  }

  destroy(dom: HTMLElement): void {
    render(null, dom)
  }

  ignoreEvent(): boolean {
    return true
  }
}
