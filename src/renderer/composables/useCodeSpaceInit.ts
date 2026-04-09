import { useApp } from './useApp'
import { normalizeCodeSelectionState } from './useCodeSelectionNormalization'
import { useFolders } from './useFolders'
import { useTags } from './useTags'

const { isCodeSpaceInitialized } = useApp()
const { getFolders } = useFolders()
const { getTags } = useTags()

export async function initCodeSpace(): Promise<void> {
  const results = await Promise.allSettled([getFolders(), getTags()])

  results.forEach((result) => {
    if (result.status === 'rejected') {
      console.error('Code space init error:', result.reason)
    }
  })

  isCodeSpaceInitialized.value = results.every(
    result => result.status === 'fulfilled',
  )

  if (isCodeSpaceInitialized.value) {
    await normalizeCodeSelectionState()
  }
}
