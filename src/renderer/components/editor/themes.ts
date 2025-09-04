import type { ITextmateThemePlus } from 'codemirror-textmate'
import { addTheme } from 'codemirror-textmate'
import type { Theme } from '@shared/types/renderer/store/app'

interface ThemeConfig {
  name: string // Имя темы из файла .tmTheme.json
  label: string
  value: Theme
  loader: () => Promise<ITextmateThemePlus>
  gutterSettings: {
    background: string
    divider: string
  }
}

export const themes: ThemeConfig[] = [
  {
    name: 'Dracula',
    label: 'Dracula',
    value: 'dark:dracula',
    loader: () => import('./themes/dracula.tmTheme.json'),
    gutterSettings: {
      background: '#282A36',
      divider: '#282A36'
    }
  },
  {
    name: 'Material-Theme',
    label: 'Material',
    value: 'dark:material',
    loader: () => import('./themes/material-theme.tmTheme.json'),
    gutterSettings: {
      background: '#263238',
      divider: '#263238'
    }
  },
  {
    name: 'Material-Theme-Palenight',
    label: 'Material Palenight',
    value: 'dark:material-palenight',
    loader: () => import('./themes/material-theme-palenight.tmTheme.json'),
    gutterSettings: {
      background: '#292D3F',
      divider: '#292D3F'
    }
  },
  {
    name: 'Merbivore-Soft',
    label: 'Merbivore Soft',
    value: 'dark:merbivore',
    loader: () => import('./themes/merbivore-soft.tmTheme.json'),
    gutterSettings: {
      background: '#1C1C1C',
      divider: '#1C1C1C'
    }
  },
  {
    name: 'Monokai',
    label: 'Monokai',
    value: 'dark:monokai',
    loader: () => import('./themes/monokai.tmTheme.json'),
    gutterSettings: {
      background: '#272822',
      divider: '#272822'
    }
  },
  {
    name: 'One-Dark',
    label: 'One',
    value: 'dark:one',
    loader: () => import('./themes/one-dark.tmTheme.json'),
    gutterSettings: {
      background: '#282C34',
      divider: '#282C34'
    }
  },
  {
    name: 'Tokyo-Night',
    label: 'Tokyo Night',
    value: 'dark:tokyo-night',
    loader: () => import('./themes/tokyo-night.tmTheme.json'),
    gutterSettings: {
      background: '#1C2029',
      divider: '#1C2029'
    }
  },
  {
    name: 'Matrix',
    label: 'Matrix',
    value: 'dark:matrix',
    loader: () => import('./themes/matrix.tmTheme.json'),
    gutterSettings: {
      background: '#1C2029',
      divider: '#1C2029'
    }
  },
  {
    name: 'GitHub',
    label: 'GitHub',
    value: 'light:github',
    loader: () => import('./themes/github.tmTheme.json'),
    gutterSettings: {
      background: '#FFFFFF',
      divider: '#FFFFFF'
    }
  },
  {
    name: 'Solarized-Light',
    label: 'Solarized',
    value: 'light:solarized',
    loader: () => import('./themes/solarized-light.tmTheme.json'),
    gutterSettings: {
      background: '#FDF6E3',
      divider: '#FDF6E3'
    }
  },
  {
    name: 'Material-Theme-Lighter',
    label: 'Material',
    value: 'light:material',
    loader: () => import('./themes/material-theme-lighter.tmTheme.json'),
    gutterSettings: {
      background: '#FAFAFA',
      divider: '#FAFAFA'
    }
  }
]

export const loadThemes = async () => {
  for (const i of themes) {
    const config = await i.loader()
    const theme = {
      ...config,
      gutterSettings: i.gutterSettings
    }
    addTheme(theme)
  }
}

export const setTheme = async (theme: Theme, editor: CodeMirror.Editor) => {
  const name = getThemeName(theme)
  if (name) editor.setOption('theme', name)
}

export const getThemeName = (theme: Theme) =>
  themes.find(i => i.value === theme)?.name
