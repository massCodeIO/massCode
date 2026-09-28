// Local development only. Start: pnpm http:server
// In the running dev app console, import its /services/api/index.ts API and this
// module through /@fs/<absolute-repository-path>/scripts/http-graphql-fixtures.mjs,
// then call seedGraphqlDemo(api). Reload the HTTP folder list afterward.
// Creates a new folder only. Runner with Continue on failure: 6 pass, 3 deliberate failures.
export const demos = [
  [
    '01 Query variables',
    'query User($id: ID!) { user(id: $id) { id name } }',
    '{"id":"1"}',
    'User',
    'Send: expect data.user = {id: "1", name: "Ada"}. Edit variables and Send without saving; then Save, select another request and reopen. Duplicate this request via context menu and verify both editors.',
  ],
  [
    '02 Mutation',
    'mutation Rename($id: ID!, $name: String!) { rename(id: $id, name: $name) { id name } }',
    '{"id":"1","name":"Grace"}',
    'Rename',
    'Send: changes only the local in-memory fixture. Re-send 01: name is now Grace. Restart the fixture to reset.',
  ],
  [
    '03 Multiple operations',
    'query First { hello }\nquery Second { user(id: "1") { name } }',
    '{}',
    'Second',
    'Choose First / Second in the operation selector. Each returns different data. Automatic must fail because the document has two operations.',
  ],
  [
    '04 Invalid variables',
    '{ hello }',
    '{bad',
    '',
    'Send: JSON validation fails locally; no network request. Save and reopen: the incomplete text must survive. Replace with {} to send successfully.',
  ],
  [
    '05 Invalid GraphQL',
    'query Broken {',
    '{}',
    '',
    'Send: syntax error and no request to the fixture. Replace with { hello } to recover.',
  ],
  [
    '06 Partial data and errors',
    '{ hello broken }',
    '{}',
    '',
    'Send: HTTP 200 with data.hello and errors. GraphQL outcome must show errors and retain the full body. Runner must fail this step even with no assertions.',
  ],
  [
    '07 Authorization',
    '{ hello }',
    '{}',
    '',
    'Auth uses public demo token graphql-demo. Send succeeds. Change token to wrong: HTTP 401 with GraphQL errors. Restore graphql-demo and Save.',
  ],
  [
    '08 Session extraction',
    '{ token }',
    '{}',
    '',
    'Tests extracts /data/token into Session graphqlDemoToken. Send, then send 09. Runner can execute 08 then 09 using its isolated variables.',
  ],
  [
    '09 Session variables',
    'query User($id: ID!) { user(id: $id) { id name } }',
    '{"id":"{{graphqlDemoToken}}"}',
    'User',
    'Send 08 first. Expect data.user.id = graphql-demo. Clear Session and verify unresolved value behavior. Code preview substitutes environment values only, as with other HTTP requests; it does not expose Session values.',
  ],
]

export async function seedGraphqlDemo(client) {
  const api = async (path, method, value) => {
    const response = await client.request({
      path,
      method,
      body: value,
      type: 'application/json',
      format: 'json',
    })
    return response.data
  }
  const folder = await api('/http-folders/', 'POST', {
    name: `GraphQL Demo ${new Date().toISOString().replaceAll(':', '-')}`,
  })

  for (const [name, query, variables, operationName, instructions] of demos) {
    const request = await api('/http-requests', 'POST', {
      name,
      folderId: folder.id,
      method: 'POST',
      url: 'http://127.0.0.1:4399/graphql',
    })
    await api(`/http-requests/${request.id}`, 'PATCH', {
      bodyType: 'graphql',
      body: JSON.stringify({ query, variables, operationName }),
      auth: { type: 'bearer', token: 'graphql-demo' },
      description: `# Local GraphQL demo\n\nStart: pnpm http:server\n\n${instructions}\n\nFetch / axios / curl preview should contain a JSON envelope with query, variables and operationName. No schema requests are sent automatically.`,
    })
    if (name.startsWith('08')) {
      const saved = await api(`/http-requests/${request.id}`, 'GET')
      await api(`/http-requests/${request.id}/runtime`, 'PUT', {
        expectedRevision: saved.runtimeRevision,
        runtime: {
          version: 1,
          assertions: [
            {
              name: 'Token returned',
              source: 'json',
              path: '/data/token',
              operator: 'eq',
              expected: 'graphql-demo',
            },
          ],
          extractions: [
            { name: 'graphqlDemoToken', source: 'json', path: '/data/token' },
          ],
        },
      })
    }
  }
  return folder.id
}
