import { beforeEach, describe, expect, it } from 'vitest'
import {
  evalLine,
  evalLines,
  expectNumericClose,
  expectValue,
  setFormatSettings,
  setupCurrencyRates,
} from './mathEngineTestUtils'

beforeEach(() => {
  setupCurrencyRates()
  setFormatSettings('en-US', 6, 'numeric')
})

describe('variables', () => {
  it('assignment and reuse', () => {
    const results = evalLines('v = 20\nv * 7')
    expect(results[0].value).toBe('20')
    expect(results[0].type).toBe('assignment')
    expect(results[1].value).toBe('140')
  })

  it('multiple variables', () => {
    const results = evalLines('a = 10\nb = 20\na + b')
    expect(results[2].value).toBe('30')
  })

  it('variable with word operator', () => {
    const results = evalLines('v = 20\nv times 7')
    expect(results[1].value).toBe('140')
  })

  it('variable reassignment', () => {
    const results = evalLines('x = 5\nx = 10\nx + 1')
    expect(results[2].value).toBe('11')
  })
})

describe('labels', () => {
  it('strip label and evaluate', () => {
    expectNumericClose('Price: 11 + 34.45', 45.45)
  })

  it('label with currency', () => {
    const result = evalLine('Total: $100')
    expect(result.type).toBe('unit')
  })

  it('label with multi-word', () => {
    expectNumericClose('Monthly cost: 1200 / 12', 100)
  })

  it('no label — colon in time is not a label', () => {
    const result = evalLine('10 + 5')
    expect(result.value).toBe('15')
  })
})

describe('quoted text', () => {
  it('ignores inline quoted fragments', () => {
    const result = evalLine('$275 for the "Model 227"')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('USD')
    expectNumericClose('$275 for the "Model 227"', 275)
  })
})

describe('prev', () => {
  it('references previous line result', () => {
    const results = evalLines('10 + 5\nprev * 2')
    expect(results[0].value).toBe('15')
    expect(results[1].value).toBe('30')
  })

  it('chain prev across multiple lines', () => {
    const results = evalLines('10\nprev + 5\nprev * 2')
    expect(results[0].value).toBe('10')
    expect(results[1].value).toBe('15')
    expect(results[2].value).toBe('30')
  })

  it('prev resets after empty line', () => {
    const results = evalLines('10\n\nprev + 5')
    expect(results[0].value).toBe('10')
    expect(results[1].type).toBe('empty')
    expect(results[2].error).not.toBeNull()
  })

  it('prev - 10', () => {
    const results = evalLines('75\nprev - 10')
    expect(results[1].value).toBe('65')
  })

  it('date prev + 1 day', () => {
    const results = evalLines('fromunix(1446587186)\nprev + 1 day')
    expect(results[1].type).toBe('date')
    expect(results[1].value).toContain(
      new Date((1446587186 + 86400) * 1000).toLocaleDateString('en-US'),
    )
  })
})

describe('comments', () => {
  it('// comment', () => {
    const result = evalLine('// This is a comment')
    expect(result.type).toBe('comment')
    expect(result.value).toBeNull()
  })

  it('# comment', () => {
    const result = evalLine('# This is a header')
    expect(result.type).toBe('comment')
    expect(result.value).toBeNull()
  })

  it('comment does not break prev', () => {
    const results = evalLines('10\n// comment\nprev + 5')
    expect(results[0].value).toBe('10')
    expect(results[1].type).toBe('comment')
    expect(results[2].value).toBe('15')
  })

  it('comment does not affect sum', () => {
    const results = evalLines('10\n// comment\n20\nsum')
    expect(results[3].value).toBe('30')
  })
})

describe('comments extensions', () => {
  it('parenthesis comment', () => {
    const result = evalLine('$999 (for iPhone 16)')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('999')
  })

  it('end-of-line // comment', () => {
    expectValue('$128 + $45 // on 10-02-2019', '173 USD')
  })

  it('parenthesis with just numbers is NOT stripped', () => {
    expectValue('6(3)', '18')
  })
})

describe('empty lines', () => {
  it('empty line produces empty result', () => {
    const result = evalLine('')
    expect(result.type).toBe('empty')
    expect(result.value).toBeNull()
  })

  it('whitespace-only line is empty', () => {
    const result = evalLine('   ')
    expect(result.type).toBe('empty')
    expect(result.value).toBeNull()
  })
})

describe('sum and total', () => {
  it('sum of lines above', () => {
    const results = evalLines('10 + 5\n20 * 3\nsum')
    expect(results[0].value).toBe('15')
    expect(results[1].value).toBe('60')
    expect(results[2].value).toBe('75')
    expect(results[2].type).toBe('aggregate')
  })

  it('total is alias for sum', () => {
    const results = evalLines('10\n20\n30\ntotal')
    expect(results[3].value).toBe('60')
  })

  it('sum resets after empty line', () => {
    const results = evalLines('10\n20\n\n5\n15\nsum')
    expect(results[5].value).toBe('20')
  })

  it('sum of zero lines', () => {
    const results = evalLines('\nsum')
    expect(results[1].value).toBe('0')
  })

  it('case insensitive', () => {
    const results = evalLines('10\n20\nSUM')
    expect(results[2].value).toBe('30')
  })

  it('sum of currency values', () => {
    const results = evalLines('$100\n$200\n$50\nsum')
    expect(results[3].type).toBe('aggregate')
    expect(results[3].value).toContain('350')
    expect(results[3].value).toContain('USD')
  })

  it('total of currency values', () => {
    const results = evalLines('$2k\n$3M\ntotal')
    expect(results[2].type).toBe('aggregate')
    expect(results[2].value).toContain('USD')
  })
})

describe('average and avg', () => {
  it('average of lines above', () => {
    const results = evalLines('10\n20\n30\naverage')
    expect(results[3].value).toBe('20')
    expect(results[3].type).toBe('aggregate')
  })

  it('avg is alias', () => {
    const results = evalLines('10\n20\n30\navg')
    expect(results[3].value).toBe('20')
  })

  it('average resets after empty line', () => {
    const results = evalLines('10\n20\n\n100\naverage')
    expect(results[4].value).toBe('100')
  })

  it('case insensitive', () => {
    const results = evalLines('10\n30\nAVERAGE')
    expect(results[2].value).toBe('20')
  })
})

describe('median', () => {
  it('median of odd count', () => {
    const results = evalLines('10\n20\n30\nmedian')
    expect(results[3].value).toBe('20')
    expect(results[3].type).toBe('aggregate')
  })

  it('median of even count', () => {
    const results = evalLines('10\n20\n30\n40\nmedian')
    expect(results[4].value).toBe('25')
  })

  it('median resets after empty line', () => {
    const results = evalLines('10\n20\n\n100\nmedian')
    expect(results[4].value).toBe('100')
  })
})

describe('count', () => {
  it('count of lines above', () => {
    const results = evalLines('10\n20\n30\ncount')
    expect(results[3].value).toBe('3')
    expect(results[3].type).toBe('aggregate')
  })

  it('count resets after empty line', () => {
    const results = evalLines('10\n20\n\n5\ncount')
    expect(results[4].value).toBe('1')
  })
})

describe('inline aggregates', () => {
  it('total of list', () => expectValue('total of 3, 4, 7 and 9', '23'))
  it('average of list', () =>
    expectNumericClose('average of 36, 42, 19 and 81', 44.5))
  it('count of list', () => expectValue('count of 1, 2, 3, 4, 5', '5'))
  it('median of list', () => expectValue('median of 10, 20 and 30', '20'))
  it('sum of list', () => expectValue('sum of 10, 20, 30', '60'))
})

describe('adjacent digit concatenation', () => {
  it('concatenates space-separated digits', () => {
    expectValue('1 1 2', '112')
  })

  it('works with operators before grouped digits', () => {
    expectValue('1 + 1 + 1 1 2', '114')
  })

  it('concatenates two digit groups', () => {
    expectValue('1 0 + 2 0', '30')
  })

  it('does not break thousands grouping', () => {
    expectValue('4 500', '4,500')
  })

  it('does not break stacked units', () => {
    const result = evalLine('1 meter 20 cm')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('1.2')
  })
})

describe('mixed currency and plain number', () => {
  it('adds plain number to currency in addition', () => {
    const result = evalLine('$100 + 10')
    expect(result.value).toContain('110')
    expect(result.type).toBe('unit')
  })

  it('adds plain number to currency with multiple terms', () => {
    const result = evalLine('$100 + $200 + 10')
    expect(result.value).toContain('310')
    expect(result.type).toBe('unit')
  })

  it('adds plain number before currency', () => {
    const result = evalLine('10 + $100')
    expect(result.value).toContain('110')
    expect(result.type).toBe('unit')
  })

  it('subtracts plain number from currency', () => {
    const result = evalLine('$100 - 10')
    expect(result.value).toContain('90')
    expect(result.type).toBe('unit')
  })

  it('does not modify multiplication with plain number', () => {
    const result = evalLine('$100 * 2')
    expect(result.value).toContain('200')
    expect(result.type).toBe('unit')
  })

  it('does not modify division with plain number', () => {
    const result = evalLine('$100 / 4')
    expect(result.value).toContain('25')
    expect(result.type).toBe('unit')
  })

  it('does not modify expression without currency', () => {
    expectValue('10 + 20', '30')
  })

  it('works with word operator plus', () => {
    const result = evalLine('$100 plus 10')
    expect(result.value).toContain('110')
    expect(result.type).toBe('unit')
  })

  it('works with word operator minus', () => {
    const result = evalLine('$100 minus 10')
    expect(result.value).toContain('90')
    expect(result.type).toBe('unit')
  })

  it('keeps trailing conversion on the whole inferred expression', () => {
    const result = evalLine('10 USD + 1 in RUB')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('RUB')
    expectNumericClose('10 USD + 1 in RUB', 990, 2)
  })
})

describe('mixed unit and plain number', () => {
  it('adds plain number to day unit', () => {
    const result = evalLine('10 day + 34')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('day')
    expectNumericClose('10 day + 34', 44, 2)
  })

  it('adds plain number before day unit', () => {
    const result = evalLine('34 + 10 day')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('day')
    expectNumericClose('34 + 10 day', 44, 2)
  })

  it('adds plain number after adjacent digit concatenation with unit', () => {
    const result = evalLine('1 0 day + 34')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('day')
    expectNumericClose('1 0 day + 34', 44, 2)
  })
})

describe('error handling', () => {
  it('invalid expression returns error', () => {
    const result = evalLine('hello world')
    expect(result.error).not.toBeNull()
    expect(result.type).toBe('empty')
  })

  it('division by zero', () => {
    const result = evalLine('1 / 0')
    expect(result.value).not.toBeNull()
  })

  it('undefined variable', () => {
    const result = evalLine('unknownVar + 1')
    expect(result.error).not.toBeNull()
  })
})

describe('full document integration', () => {
  it('full document', () => {
    const doc = [
      '8 times 9',
      '$2k',
      'Price: $11 + $34.45',
      'v = 20',
      'v times 7',
      '100 + 15%',
      '5% on 200',
      '5% off 200',
      '50 as a % of 100',
      '5% of what is 6',
      '// This is comment',
      '# Header',
      '',
      '10 + 5',
      '20 * 3',
      'sum',
      'prev - 10',
      '0xFF in hex',
      '5300 in sci',
      'sqrt(16)',
    ].join('\n')

    const results = evalLines(doc)

    expect(results[0].value).toBe('72')
    expect(results[1].type).toBe('unit')
    expect(results[2].type).toBe('unit')
    expect(results[3].type).toBe('assignment')
    expect(results[3].value).toBe('20')
    expect(results[4].value).toBe('140')
    expectCloseInResults(results[5], 115)
    expectCloseInResults(results[6], 210)
    expectCloseInResults(results[7], 190)
    expectCloseInResults(results[8], 50)
    expectCloseInResults(results[9], 120)
    expect(results[10].type).toBe('comment')
    expect(results[10].value).toBeNull()
    expect(results[11].type).toBe('comment')
    expect(results[11].value).toBeNull()
    expect(results[12].type).toBe('empty')
    expect(results[13].value).toBe('15')
    expect(results[14].value).toBe('60')
    expect(results[15].value).toBe('75')
    expect(results[16].value).toBe('65')
    expect(results[17].value).toBe('0xFF')
    expect(results[18].value).toBe('5.3e+3')
    expect(results[19].value).toBe('4')
  })
})

function expectCloseInResults(
  result: ReturnType<typeof evalLine>,
  expected: number,
) {
  const num = Number.parseFloat(result.value!.replace(/,/g, ''))
  expect(num).toBeCloseTo(expected, 1)
}
