import { getThemeName } from '@/components/editor/themes'
import { useAppStore } from '@/store/app'
import type { EditorConfiguration } from 'codemirror'
import CodeMirror from 'codemirror'

export const useCodemirror = (elemId: string, options: EditorConfiguration) => {
  const appStore = useAppStore()

  CodeMirror(document.getElementById(elemId)!, {
    ...options,
    theme: getThemeName(appStore.theme) || 'GitHub',
    scrollbarStyle: 'null',
    readOnly: true,
    cursorBlinkRate: -1
  })
}
