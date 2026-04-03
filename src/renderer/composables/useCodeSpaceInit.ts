import { useApp } from './useApp'
import { useFolders } from './useFolders'
import { useSnippets } from './useSnippets'

const { isCodeSpaceInitialized } = useApp()
const { getFolders } = useFolders()
const { getSnippets } = useSnippets()

export async function initCodeSpace(): Promise<void> {
  const results = await Promise.allSettled([getFolders(), getSnippets()])

  results.forEach((result) => {
    if (result.status === 'rejected') {
      console.error('Code space init error:', result.reason)
    }
  })

  isCodeSpaceInitialized.value = results.every(
    result => result.status === 'fulfilled',
  )
}
