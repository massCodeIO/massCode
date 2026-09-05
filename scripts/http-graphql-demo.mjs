import { createServer } from 'node:http'
import { buildSchema, graphql, GraphQLError } from 'graphql'

// Entirely local fixture. The bearer token is public test data, not a credential.
const schema = buildSchema(`
  type User { id: ID!, name: String! }
  type Query { user(id: ID!): User!, hello: String!, broken: String, token: String! }
  type Mutation { rename(id: ID!, name: String!): User! }
`)
const users = new Map()
const rootValue = {
  hello: () => 'Hello GraphQL',
  token: () => 'graphql-demo',
  user: ({ id }) => ({ id, name: users.get(id) ?? 'Ada' }),
  broken: () => {
    throw new GraphQLError('Demonstration field error', {
      extensions: { code: 'DEMO_ERROR' },
    })
  },
  rename: ({ id, name }) => {
    users.set(id, name)
    return { id, name }
  },
}

createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/graphql-response+json')
  if (req.url !== '/graphql' || req.method !== 'POST') {
    res
      .writeHead(404)
      .end(JSON.stringify({ errors: [{ message: 'Use POST /graphql' }] }))
    return
  }
  if (req.headers.authorization !== 'Bearer graphql-demo') {
    res
      .writeHead(401)
      .end(
        JSON.stringify({
          errors: [{ message: 'Use bearer token graphql-demo' }],
        }),
      )
    return
  }
  try {
    let body = ''
    for await (const chunk of req) {
      body += chunk
      if (body.length > 1000000)
        throw new Error('Body too large')
    }
    const { query, variables, operationName } = JSON.parse(body)
    const result = await graphql({
      schema,
      source: query,
      variableValues: variables,
      operationName,
      rootValue,
    })
    res.end(JSON.stringify(result))
  }
  catch (error) {
    res
      .writeHead(400)
      .end(JSON.stringify({ errors: [{ message: error.message }] }))
  }
}).listen(4399, '127.0.0.1', () =>
  console.log(
    'GraphQL fixture: http://127.0.0.1:4399/graphql (bearer graphql-demo)',
  ))
