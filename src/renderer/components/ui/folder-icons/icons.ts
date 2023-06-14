const files = import.meta.glob('@/assets/svg/icons/**.svg', { as: 'raw' })
const re = /\/([^/]+)\.svg$/

const iconsSet: Record<string, string> = {}

const icons = Object.entries(files).map(([k, v]) => {
  const name = k.match(re)?.[1]
  if (name) {
    iconsSet[name] = v as unknown as string
  }
  return {
    name,
    source: v
  }
})

export { icons, iconsSet }
