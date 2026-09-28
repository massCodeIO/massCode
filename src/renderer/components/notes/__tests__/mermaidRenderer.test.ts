import { expect, it, vi } from 'vitest'
import { renderMermaidSvg } from '../mermaidRenderer'

const fixture = vi.hoisted(() => ({ initialize: vi.fn(), render: vi.fn() }))
vi.mock('mermaid', () => ({ default: fixture }))

it('serializes editor and portable export configurations and recovers after invalid syntax', async () => {
  let finish!: (value: { svg: string }) => void
  fixture.render
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    .mockRejectedValueOnce(new Error('invalid diagram'))
    .mockResolvedValueOnce({ svg: '<svg>export</svg>' })
  const editor = renderMermaidSvg('graph TD; A-->B', 'dark')
  const invalid = renderMermaidSvg('invalid', 'default', true)
  const recovered = renderMermaidSvg('graph LR; C-->D', 'default', true)
  const failure = expect(invalid).rejects.toThrow('invalid diagram')
  await Promise.resolve()
  expect(fixture.initialize).toHaveBeenCalledTimes(1)
  expect(fixture.initialize.mock.calls[0]![0]).toMatchObject({
    theme: 'dark',
    htmlLabels: true,
    securityLevel: 'strict',
    suppressErrorRendering: true,
  })
  finish({ svg: '<svg>editor</svg>' })
  await expect(editor).resolves.toBe('<svg>editor</svg>')
  await failure
  await expect(recovered).resolves.toBe('<svg>export</svg>')
  expect(fixture.initialize.mock.calls[2]![0]).toMatchObject({
    theme: 'default',
    htmlLabels: false,
    flowchart: { htmlLabels: false },
    securityLevel: 'strict',
  })
  expect(new Set(fixture.render.mock.calls.map(call => call[0])).size).toBe(
    3,
  )
})
