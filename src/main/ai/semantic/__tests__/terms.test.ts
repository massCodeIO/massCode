import { describe, expect, it } from 'vitest'
import {
  isLookup,
  queryTerms,
  queryWords,
  stem,
  tokenize,
  wordSpans,
} from '../terms'

describe('tokenize', () => {
  it('normalizes, drops stop words and short tokens, keeps identifiers', () => {
    expect(
      tokenize('How to retry the FETCH? ERR_PAYMENT_DECLINED v2 a'),
    ).toEqual(['retry', 'fetch', 'err_payment_declined', 'v2'])
  })
  it('folds ё, drops stop words written with ё and splits paths', () => {
    expect(tokenize('Всё её свёкла /api/v2/payments')).toEqual([
      'свекл',
      'api',
      'v2',
      'payment',
    ])
  })
  it('segments chinese and japanese words', () => {
    expect(tokenize('在服务器上部署应用程序')).toContain('部署')
    expect(queryTerms('部署')).toEqual(['部署'])
  })
  it('keeps combining marks inside words', () => {
    const nfd = 'Мой café ёлка настройка'.normalize('NFD')
    expect(
      [...wordSpans(nfd)].map(span => span.text.normalize('NFC')),
    ).toEqual(['Мой', 'café', 'ёлка', 'настройка'])
    expect(tokenize(nfd)).toEqual(tokenize('Мой café ёлка настройка'))
    expect(tokenize('ข้อมูลฐาน')).toContain('ข้อมูล')
  })
  it('keeps unique query terms', () => {
    expect(queryTerms('retry retry backoff')).toEqual(['retry', 'backoff'])
  })
})

describe('stem', () => {
  it('strips russian endings but keeps a 3-letter stem', () => {
    expect(stem('борща')).toBe('борщ')
    expect(stem('борщ')).toBe('борщ')
    expect(stem('базами')).toBe('баз')
    expect(stem('кот')).toBe('кот')
    expect(stem('резервные')).toBe(stem('резервная'))
    expect(stem('новых')).toBe(stem('новым'))
  })
  it('brings english base forms and -s/-es/-ed/-ing forms to one stem', () => {
    for (const forms of [
      ['note', 'notes'],
      ['file', 'files'],
      ['create', 'created', 'creating'],
      ['name', 'names'],
      ['image', 'images'],
      ['string', 'strings'],
      ['setting', 'settings'],
      ['embed', 'embeds'],
      ['box', 'boxes'],
      ['match', 'matches'],
    ]) {
      expect(new Set(forms.map(form => stem(form))).size).toBe(1)
    }
    expect(stem('process')).toBe('process')
  })
  it('reaches a fixed point for russian forms', () => {
    expect(stem('копии')).toBe(stem('копия'))
  })
  it('leaves identifiers alone', () => {
    expect(stem('class')).toBe('class')
    expect(stem('e4012s')).toBe('e4012s')
  })
})

describe('isLookup', () => {
  it('detects codes, ids and paths', () => {
    for (const query of [
      'ERR_PAYMENT_DECLINED',
      'E4012',
      'FF-2291',
      '/api/v2/payments',
      '1205',
      'OKR-7 INC-4471',
    ])
      expect(isLookup(query)).toBe(true)
  })
  it('rejects words and short numbers', () => {
    for (const query of [
      'retry with jitter',
      'nginx',
      '42',
      'ENOSPC',
      'error E4012',
    ])
      expect(isLookup(query)).toBe(false)
  })
})

describe('isLookup on the original query text', () => {
  it('recognizes error codes and paths', () => {
    expect(isLookup('ERR_CONNECTION_REFUSED')).toBe(true)
    expect(isLookup('/api/users')).toBe(true)
    expect(isLookup('err connection refused')).toBe(false)
  })
})

describe('queryWords', () => {
  it('keeps the last word raw as a prefix unless it is a stop word', () => {
    expect(queryWords('rebalancing kafka consumers', true)).toEqual({
      terms: ['rebalanc', 'kafka'],
      prefix: 'consumers',
    })
    expect(queryWords('rebalancing kafka consumers', false)).toEqual({
      terms: ['rebalanc', 'kafka', 'consumer'],
      prefix: undefined,
    })
    expect(queryWords('retry with', true)).toEqual({
      terms: ['retry'],
      prefix: undefined,
    })
    expect(queryWords('retry s', true)).toEqual({
      terms: ['retry'],
      prefix: undefined,
    })
  })
})
