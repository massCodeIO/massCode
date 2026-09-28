import mermaid from 'mermaid'

let counter = 0
let queue: Promise<unknown> = Promise.resolve()

// Initialization is global in Mermaid. Serialize configuration and rendering so
// light export cannot change a concurrently rendered editor diagram's theme.
export function renderMermaidSvg(
  code: string,
  theme: 'dark' | 'default',
  portable = false,
): Promise<string> {
  const render = queue.then(async () => {
    mermaid.initialize({
      startOnLoad: false,
      suppressErrorRendering: true,
      securityLevel: 'strict',
      theme,
      htmlLabels: !portable,
      flowchart: { htmlLabels: !portable },
    })
    const result = await mermaid.render(`notes-mermaid-${counter++}`, code)
    return typeof result === 'string' ? result : result.svg
  })
  queue = render.catch(() => {})
  return render
}
