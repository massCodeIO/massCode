import path from 'node:path'
import process from 'node:process'
import ts from 'typescript'

const root = path.resolve(import.meta.dirname, '..')
const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile)
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root)
const files = ['types.ts', 'fixtures.ts', 'demoState.ts', 'mocks.ts'].map(file => path.join(root, 'playground/examples/ai', file))
const program = ts.createProgram(files, { ...parsed.options, noEmit: true, skipLibCheck: true })
const diagnostics = ts.getPreEmitDiagnostics(program).filter(diagnostic => !diagnostic.file || files.includes(diagnostic.file.fileName))
if (diagnostics.length) {
  process.stderr.write(ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCanonicalFileName: file => file, getCurrentDirectory: () => root, getNewLine: () => '\n' }))
  process.exitCode = 1
}
