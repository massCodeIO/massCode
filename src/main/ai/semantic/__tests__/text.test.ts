import { describe, expect, it } from 'vitest'
import {
  decodeVector,
  dot,
  encodeVector,
  formatDocument,
  formatQuery,
  httpSearchPath,
  normalize,
} from '../text'

describe('semantic text', () => {
  it('keeps only the path of an HTTP url, without host, variables or query', () => {
    expect(
      httpSearchPath('https://api.example.test/orders/{{id}}?token=secret#x'),
    ).toBe('/orders/{{id}}')
    expect(httpSearchPath('{{baseUrl}}/users')).toBe('/users')
  })
  it('applies EmbeddingGemma task prompts and leaves other models plain', () => {
    expect(formatQuery('embeddinggemma:latest', 'orders')).toBe(
      'task: search result | query: orders',
    )
    expect(formatDocument('EmbeddingGemma', '', 'body')).toBe(
      'title: none | text: body',
    )
    expect(formatDocument('embeddinggemma', 'Name', 'body')).toBe(
      'title: Name | text: body',
    )
    expect(formatQuery('nomic-embed-text', 'orders')).toBe('orders')
    expect(formatDocument('nomic-embed-text', 'Name', 'body')).toBe(
      'Name\nbody',
    )
  })
  it('normalizes vectors and keeps zero vectors finite', () => {
    const vector = normalize([3, 4])
    expect([...vector]).toEqual([expect.closeTo(0.6), expect.closeTo(0.8)])
    expect(dot(vector, vector)).toBeCloseTo(1)
    expect([...normalize([0, 0])]).toEqual([0, 0])
  })
  it('round-trips vectors through base64', () => {
    const vector = normalize([1, -2, 3, 0.5])
    expect(decodeVector(encodeVector(vector))).toEqual(vector)
    expect(decodeVector(encodeVector(vector.subarray(1)))).toEqual(
      vector.subarray(1),
    )
  })
})
