export const notesEditorScrollbarTheme = {
  '.cm-scroller': {
    overflow: 'auto',
    scrollbarWidth: 'auto',
    scrollbarColor: 'var(--scrollbar) transparent',
  },
  '.cm-scroller::-webkit-scrollbar': {
    width: '6px',
    height: '6px',
  },
  '.cm-scroller::-webkit-scrollbar-track': {
    background: 'transparent',
  },
  '.cm-scroller::-webkit-scrollbar-thumb': {
    backgroundColor: 'var(--scrollbar)',
    borderRadius: '3px',
  },
  '.cm-scroller::-webkit-scrollbar-thumb:hover': {
    opacity: '0.8',
  },
  '.cm-scroller::-webkit-scrollbar-thumb:active': {
    opacity: '1',
  },
} as const
