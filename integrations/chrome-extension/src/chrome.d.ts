declare namespace chrome {
  namespace action {
    const setBadgeText: (details: { text: string }) => Promise<void>
    const setTitle: (details: { title: string }) => Promise<void>
  }

  namespace contextMenus {
    type ContextType = 'selection' | 'page' | 'link'

    interface OnClickData {
      linkUrl?: string
      menuItemId: number | string
      selectionText?: string
    }

    const create: (properties: {
      contexts?: ContextType[]
      id: string
      parentId?: string
      title: string
    }) => void
    const removeAll: (callback?: () => void) => void

    const onClicked: {
      addListener: (
        callback: (info: OnClickData, tab?: tabs.Tab) => void,
      ) => void
    }
  }

  namespace runtime {
    const onInstalled: {
      addListener: (callback: () => void) => void
    }
  }

  namespace scripting {
    interface InjectionResult<T> {
      result?: T
    }

    const executeScript: <T>(options: {
      func: () => T
      target: { tabId: number }
    }) => Promise<Array<InjectionResult<T>>>
  }

  namespace storage {
    const local: {
      get: <T>(defaults: T) => Promise<T>
      set: <T>(values: T) => Promise<void>
    }
  }

  namespace tabs {
    interface Tab {
      id?: number
    }

    const query: (queryInfo: {
      active: boolean
      currentWindow: boolean
    }) => Promise<Tab[]>
  }
}
