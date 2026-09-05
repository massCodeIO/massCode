import { Kind, parse } from 'graphql/language'
import { interpolateHttpVariables } from './httpVariables'

// Variables remain text in the vault so even an incomplete JSON draft survives reload.
export interface GraphqlDraft {
  query: string
  variables: string
  operationName: string
}

export function readGraphqlDraft(body: string | null): GraphqlDraft {
  if (!body)
    return { query: '', variables: '{}', operationName: '' }
  const value = JSON.parse(body)
  if (
    !value
    || typeof value.query !== 'string'
    || typeof value.variables !== 'string'
    || typeof value.operationName !== 'string'
  ) {
    throw new Error('GRAPHQL_DRAFT')
  }
  return value
}

export function graphqlOperations(query: string) {
  const document = parse(query, { maxTokens: 50000 })
  if (
    document.definitions.some(
      definition =>
        definition.kind !== Kind.OPERATION_DEFINITION
        && definition.kind !== Kind.FRAGMENT_DEFINITION,
    )
  ) {
    throw new Error('GRAPHQL_DOCUMENT')
  }
  const operations = document.definitions.filter(
    definition => definition.kind === Kind.OPERATION_DEFINITION,
  )
  if (!operations.length)
    throw new Error('GRAPHQL_OPERATION')
  const names = operations.map(operation => operation.name?.value ?? '')
  if (
    new Set(names).size !== names.length
      || (operations.length > 1 && names.includes(''))
  ) {
    throw new Error('GRAPHQL_OPERATION')
  }
  return operations
}

export function buildGraphqlBody(
  body: string | null,
  variables: Record<string, string> = {},
): string {
  const draft = readGraphqlDraft(body)
  const query = interpolateHttpVariables(draft.query, variables)
  const operationName = draft.operationName.trim()
  const operations = graphqlOperations(query)
  const operation = operationName
    ? operations.find(operation => operation.name?.value === operationName)
    : operations.length === 1
      ? operations[0]
      : undefined
  if (!operation)
    throw new Error('GRAPHQL_OPERATION')
  if (operation.operation === 'subscription')
    throw new Error('GRAPHQL_SUBSCRIPTION')
  let parsed: unknown
  try {
    parsed = JSON.parse(
      interpolateHttpVariables(draft.variables, variables) || '{}',
    )
  }
  catch {
    throw new Error('GRAPHQL_VARIABLES')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new Error('GRAPHQL_VARIABLES')
  return JSON.stringify({
    query,
    variables: parsed,
    ...(operationName ? { operationName } : {}),
  })
}

export type GraphqlResponseState = 'success' | 'errors' | 'invalid'

export function graphqlResponseState(
  body: string,
  truncated = false,
): GraphqlResponseState {
  if (truncated)
    return 'invalid'
  try {
    const value = JSON.parse(body)
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return 'invalid'
    if ('errors' in value) {
      if (
        !Array.isArray(value.errors)
        || !value.errors.length
        || value.errors.some(
          (error: unknown) =>
            !error
            || typeof error !== 'object'
            || !('message' in error)
            || typeof error.message !== 'string',
        )
      ) {
        return 'invalid'
      }
      return 'errors'
    }
    return 'data' in value
      && (value.data === null
        || (typeof value.data === 'object' && !Array.isArray(value.data)))
      ? 'success'
      : 'invalid'
  }
  catch {
    return 'invalid'
  }
}
