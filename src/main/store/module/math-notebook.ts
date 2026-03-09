import type { MathNotebookStore } from '../types'
import Store from 'electron-store'

export default new Store<MathNotebookStore>({
  name: 'math-notebook',
  cwd: 'v2',

  defaults: {
    sheets: [],
    activeSheetId: null,
  },
})
