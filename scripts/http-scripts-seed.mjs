// Run this module in the existing development renderer. Authorization remains
// in its existing main-process API bridge; no session token is read or exposed.
const { api } = await import('http://localhost:5177/services/api/index.ts')
const fixtures = await fetch('http://127.0.0.1:5189/fixtures').then(
  response => response.json(),
)
const { data: folder } = await api.httpFolders.postHttpFolders({
  name: `Demo · Scripts ${Date.now()}`,
})
const created = []
for (const [name, preRequest, postResponse, instructions] of fixtures) {
  const { data: request } = await api.httpRequests.postHttpRequests({
    name,
    folderId: Number(folder.id),
    method: 'POST',
    url: 'http://127.0.0.1:5189/echo',
  })
  const id = String(request.id)
  await api.httpRequests.patchHttpRequestsById(id, {
    bodyType: 'text',
    body: '{{demoValue}}',
    description: `# HTTP Scripts demo\n\nStart the server: node scripts/http-scripts-demo.mjs\n\nUse No environment. Review both scripts before trusting.\n\n${instructions}\n\nLocal server returns token demo-token and echoes the body. No data is stored.`,
  })
  const { data: full } = await api.httpRequests.getHttpRequestsById(id)
  await api.httpRequests.putHttpRequestsByIdRuntime(id, {
    expectedRevision: full.runtimeRevision,
    runtime: {
      version: 2,
      scripts: { preRequest, postResponse },
      extractions: [{ name: 'demoToken', source: 'json', path: '/token' }],
      assertions: [
        { name: 'HTTP 200', source: 'status', operator: 'eq', expected: 200 },
      ],
    },
  })
  created.push({ id, name })
}
const { useHttpFolders } = await import(
  'http://localhost:5177/composables/spaces/http/useHttpFolders.ts'
)
await useHttpFolders().getHttpFolders()
console.info('Created Scripts demo', {
  folderId: folder.id,
  requests: created,
})
