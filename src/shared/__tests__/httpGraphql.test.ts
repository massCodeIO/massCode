import { describe, expect, it } from 'vitest'
import {
  buildGraphqlBody,
  graphqlOperations,
  graphqlResponseState,
  readGraphqlDraft,
} from '../httpGraphql'

function body(query: string, variables = '{}', operationName = '') {
  return JSON.stringify({ query, variables, operationName })
}

describe('graphQL HTTP bodies', () => {
  it('encodes variables after interpolation and preserves document newlines', () => {
    const query = 'query User($id: ID!) {\n user(id: $id) { name }\n}'
    expect(
      JSON.parse(
        buildGraphqlBody(body(query, '{"id":"{{id}}"}'), { id: '42' }),
      ),
    ).toEqual({ query, variables: { id: '42' } })
  })
  it('supports mutation and explicit operation selection', () => {
    const query = 'query A { a } mutation B { b }'
    expect(() => buildGraphqlBody(body(query))).toThrow('GRAPHQL_OPERATION')
    expect(
      JSON.parse(buildGraphqlBody(body(query, '{}', 'B'))).operationName,
    ).toBe('B')
    expect(() => buildGraphqlBody(body(query, '{}', 'Missing'))).toThrow(
      'GRAPHQL_OPERATION',
    )
  })
  it.each(['[1]', 'null', '42', '"x"', '{bad'])(
    'rejects non-object or invalid variables %s',
    (variables) => {
      expect(() => buildGraphqlBody(body('{ a }', variables))).toThrow(
        'GRAPHQL_VARIABLES',
      )
    },
  )
  it('preserves incomplete variables in persisted drafts', () => {
    expect(readGraphqlDraft(body('{ a }', '{bad')).variables).toBe('{bad')
  })
  it.each([
    'query {',
    'query A { a } query A { b }',
    '{ a } query B { b }',
    'type User { name: String }',
    'fragment A on User { name }',
  ])('rejects invalid executable document %s', (query) => {
    expect(() => buildGraphqlBody(body(query))).toThrow()
  })
  it('rejects subscriptions but permits an explicitly selected query in the same document', () => {
    const query = 'subscription S { update } query Q { a }'
    expect(() => buildGraphqlBody(body(query, '{}', 'S'))).toThrow(
      'GRAPHQL_SUBSCRIPTION',
    )
    expect(() => buildGraphqlBody(body(query, '{}', 'Q'))).not.toThrow()
  })
  it('does not mistake comments, strings or fragments for operations', () => {
    expect(
      graphqlOperations(
        '# mutation Fake { x }\nquery A { a(s: "query B { x }") } fragment F on User { name }',
      ),
    ).toHaveLength(1)
  })
  it('keeps GraphQL outcome independent of HTTP status', () => {
    expect(graphqlResponseState('{"data":{"ok":1}}')).toBe('success')
    expect(
      graphqlResponseState(
        '{"data":{"ok":1},"errors":[{"message":"partial","path":["name"]}]}',
      ),
    ).toBe('errors')
    expect(graphqlResponseState('{"errors":[{"message":"denied"}]}')).toBe(
      'errors',
    )
  })
  it.each([
    '{}',
    '[]',
    'null',
    'oops',
    '{"errors":[]}',
    '{"data":1}',
    '{"errors":[1]}',
  ])('rejects invalid response %s', (value) => {
    expect(graphqlResponseState(value)).toBe('invalid')
  })
  it('never treats a truncated response as GraphQL success', () => {
    expect(graphqlResponseState('{"data":{}}', true)).toBe('invalid')
  })
})
