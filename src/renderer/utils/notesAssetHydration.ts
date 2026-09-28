const NOTES_ASSET_HOST = 'notes-asset'

export function retryNotesAssetImages(
  root: ParentNode,
  fileName: string,
  cacheKey: number = Date.now(),
): void {
  const images = root.querySelectorAll<HTMLImageElement>(
    'img[src^="masscode://notes-asset/"]',
  )

  for (const image of Array.from(images)) {
    const source = image.getAttribute('src')
    if (!source) {
      continue
    }

    try {
      const url = new URL(source)
      const sourceFileName = decodeURIComponent(
        url.pathname.replace(/^\//, ''),
      )
      if (url.hostname !== NOTES_ASSET_HOST || sourceFileName !== fileName) {
        continue
      }

      url.searchParams.set('hydrated', String(cacheKey))
      image.setAttribute('src', url.toString())
    }
    catch {
      // Некорректный src не должен мешать обновлению остальных изображений.
    }
  }
}
