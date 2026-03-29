import { describe, expect, it } from 'vitest'
import { analysisNormalize } from '../pipeline/analysisNormalize'
import { classify } from '../pipeline/classify'

function classifyRaw(raw: string) {
  return classify(analysisNormalize(raw))
}

describe('classify — primary intent', () => {
  it('empty', () => expect(classifyRaw('').primary).toBe('empty'))
  it('whitespace', () => expect(classifyRaw('   ').primary).toBe('empty'))

  it('// comment', () =>
    expect(classifyRaw('// text').primary).toBe('comment'))
  it('# heading', () =>
    expect(classifyRaw('# heading').primary).toBe('comment'))

  it('sum', () => expect(classifyRaw('sum').primary).toBe('aggregate-block'))
  it('total', () =>
    expect(classifyRaw('total').primary).toBe('aggregate-block'))
  it('average', () =>
    expect(classifyRaw('average').primary).toBe('aggregate-block'))
  it('avg', () => expect(classifyRaw('avg').primary).toBe('aggregate-block'))
  it('median', () =>
    expect(classifyRaw('median').primary).toBe('aggregate-block'))
  it('count', () =>
    expect(classifyRaw('count').primary).toBe('aggregate-block'))
  it('sUM case insensitive', () =>
    expect(classifyRaw('SUM').primary).toBe('aggregate-block'))

  it('total of list', () =>
    expect(classifyRaw('total of 3, 4 and 9').primary).toBe(
      'aggregate-inline',
    ))
  it('average of list', () =>
    expect(classifyRaw('average of 10, 20').primary).toBe('aggregate-inline'))

  it('days since', () =>
    expect(classifyRaw('days since January 1').primary).toBe('calendar'))
  it('days till', () =>
    expect(classifyRaw('days till December 25').primary).toBe('calendar'))
  it('days between', () =>
    expect(classifyRaw('days between March 1 and March 31').primary).toBe(
      'calendar',
    ))
  it('5 days from now', () =>
    expect(classifyRaw('5 days from now').primary).toBe('calendar'))
  it('3 days ago', () =>
    expect(classifyRaw('3 days ago').primary).toBe('calendar'))
  it('day of the week', () =>
    expect(classifyRaw('day of the week on Jan 1, 2024').primary).toBe(
      'calendar',
    ))
  it('week of year', () =>
    expect(classifyRaw('week of year').primary).toBe('calendar'))
  it('days in February', () =>
    expect(classifyRaw('days in February 2020').primary).toBe('calendar'))
  it('days in Q3', () =>
    expect(classifyRaw('days in Q3').primary).toBe('calendar'))
  it('current timestamp', () =>
    expect(classifyRaw('current timestamp').primary).toBe('calendar'))

  it('time in Paris', () => {
    const c = classifyRaw('time in Paris')
    expect(c.primary).toBe('timezone')
    expect(c.timezoneOperation).toBe('display')
  })
  it('now', () => {
    const c = classifyRaw('now')
    expect(c.primary).toBe('timezone')
    expect(c.timezoneOperation).toBe('display')
  })
  it('pST time', () => {
    const c = classifyRaw('PST time')
    expect(c.primary).toBe('timezone')
    expect(c.timezoneOperation).toBe('display')
  })

  it('pST time - Berlin time', () => {
    const c = classifyRaw('PST time - Berlin time')
    expect(c.primary).toBe('timezone')
    expect(c.timezoneOperation).toBe('difference')
  })

  it('ppi = 326', () => {
    const c = classifyRaw('ppi = 326')
    expect(c.primary).toBe('assignment')
    expect(c.assignmentTarget).toBe('css')
  })
  it('em = 20px', () => {
    const c = classifyRaw('em = 20px')
    expect(c.primary).toBe('assignment')
    expect(c.assignmentTarget).toBe('css')
  })

  it('12 pt in px', () =>
    expect(classifyRaw('12 pt in px').primary).toBe('css'))

  it('x = 10', () => {
    const c = classifyRaw('x = 10')
    expect(c.primary).toBe('assignment')
    expect(c.assignmentTarget).toBe('math')
  })
  it('start = today', () => {
    const c = classifyRaw('start = today')
    expect(c.primary).toBe('assignment')
    expect(c.assignmentTarget).toBe('date')
  })

  it('today + 3 days', () =>
    expect(classifyRaw('today + 3 days').primary).toBe('date-arithmetic'))

  it('10 + 5', () => expect(classifyRaw('10 + 5').primary).toBe('math'))
  it('sqrt(16)', () => expect(classifyRaw('sqrt(16)').primary).toBe('math'))
  it('100 USD to EUR', () =>
    expect(classifyRaw('100 USD to EUR').primary).toBe('math'))
})

describe('classify — modifiers', () => {
  it('rounding: to 2 dp', () => {
    const c = classifyRaw('1/3 to 2 dp')
    expect(c.modifiers.rounding).toEqual({ type: 'dp', param: 2 })
  })
  it('rounding: rounded', () => {
    const c = classifyRaw('5.5 rounded')
    expect(c.modifiers.rounding).toEqual({ type: 'round', param: 0 })
  })
  it('rounding: to nearest 10', () => {
    const c = classifyRaw('37 to nearest 10')
    expect(c.modifiers.rounding).toEqual({ type: 'nearest', param: 10 })
  })

  it('format: in hex', () => {
    const c = classifyRaw('255 in hex')
    expect(c.modifiers.resultFormat).toBe('hex')
  })
  it('format: in sci', () => {
    const c = classifyRaw('5300 in sci')
    expect(c.modifiers.resultFormat).toBe('sci')
  })

  it('strip: as number', () => {
    const c = classifyRaw('$100 as number')
    expect(c.modifiers.stripUnit).toBe('number')
  })
  it('strip: as dec', () => {
    const c = classifyRaw('20% as dec')
    expect(c.modifiers.stripUnit).toBe('dec')
  })
  it('strip: as fraction', () => {
    const c = classifyRaw('0.5 as fraction')
    expect(c.modifiers.stripUnit).toBe('fraction')
  })
})

describe('classify — features', () => {
  it('hasCurrency for $ symbol', () => {
    expect(classifyRaw('$100 + $50').features.hasCurrency).toBe(true)
  })
  it('hasCurrency for USD code', () => {
    expect(classifyRaw('100 USD').features.hasCurrency).toBe(true)
  })
  it('does not treat pound weight as currency', () => {
    expect(classifyRaw('1 pound to lb').features.hasCurrency).toBe(false)
  })
  it('no currency for plain math', () => {
    expect(classifyRaw('10 + 5').features.hasCurrency).toBe(false)
  })
  it('hasAssignment', () => {
    expect(classifyRaw('x = 10').features.hasAssignment).toBe(true)
  })
  it('no assignment for ==', () => {
    expect(classifyRaw('5 == 5').features.hasAssignment).toBe(false)
  })
  it('hasConversion', () => {
    expect(classifyRaw('5 km to mile').features.hasConversion).toBe(true)
  })
})
