import { describe, expect, it, vi } from 'vitest'
import {
  applyMermaidRenderFailure,
  applyMermaidRenderSuccess,
} from '../mermaidBlocks'

describe('mermaidBlocks render handlers', () => {
  it('shows svg on successful render', () => {
    const container = {
      style: { display: 'none' },
      innerHTML: '',
    } as unknown as HTMLElement

    applyMermaidRenderSuccess(container, '<svg><text>ok</text></svg>')

    expect(container.style.display).toBe('')
    expect(container.innerHTML).toContain('<svg')
  })

  it('hides container and logs error on render failure', () => {
    const container = {
      style: { display: '' },
      innerHTML: '<svg><text>old</text></svg>',
    } as unknown as HTMLElement
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    applyMermaidRenderFailure(container, new Error('bad syntax'))

    expect(container.style.display).toBe('none')
    expect(container.innerHTML).toBe('')
    expect(errorSpy).toHaveBeenCalledOnce()
    errorSpy.mockRestore()
  })
})
