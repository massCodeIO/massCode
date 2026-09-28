export interface VariableSource {
  scope: 'collection' | 'folder' | 'environment' | 'session'
  label: string
  folderId?: number
  value: string
}
export interface VariableLayer {
  scope: VariableSource['scope']
  label: string
  folderId?: number
  values: Record<string, string>
}

export function inspectVariables(layers: VariableLayer[], used: string[]) {
  const sources = new Map<string, VariableSource[]>()
  for (const layer of layers) {
    for (const [name, value] of Object.entries(layer.values)) {
      const list = sources.get(name) ?? []
      list.unshift({
        scope: layer.scope,
        label: layer.label,
        folderId: layer.folderId,
        value,
      })
      sources.set(name, list)
    }
  }
  for (const name of used) {
    if (!sources.has(name))
      sources.set(name, [])
  }
  return [...sources]
    .map(([name, values]) => ({
      name,
      current: values[0],
      overridden: values.slice(1),
      used: used.includes(name),
    }))
    .sort(
      (a, b) =>
        Number(!b.current) - Number(!a.current) || a.name.localeCompare(b.name),
    )
}

export function referencedVariables(values: string[]) {
  return [
    ...new Set(
      values.flatMap(value =>
        [...value.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)].map(
          match => match[1]!,
        ),
      ),
    ),
  ]
}
