/**
 * Trusted host program. User source is ONLY passed to QuickJS, never host eval.
 * No host functions, module loader, filesystem or network are exposed to guests.
 * Each worker owns a fresh WASM module and is destroyed after one phase.
 */
export const scriptWorkerSource = String.raw`
const { parentPort, workerData } = require('node:worker_threads');
(async () => {
  const { getQuickJS } = require(workerData.modulePath);
  const engine = await getQuickJS();
  const runtime = engine.newRuntime();
  runtime.setMemoryLimit(16 * 1024 * 1024);
  runtime.setMaxStackSize(256 * 1024);
  const deadline = Date.now() + 500;
  let timedOut = false;
  runtime.setInterruptHandler(() => (timedOut = Date.now() > deadline));
  const context = runtime.newContext();
  let reader;
  let failure = 'exception';
  try {
    // The closure retains pristine intrinsics and the output; user code cannot
    // replace the serializer or forge results by overwriting a global variable.
    const bootstrap = context.evalCode('(' + ${JSON.stringify(String.raw`function (input) {
      const stringify = JSON.stringify.bind(JSON);
      const parse = JSON.parse.bind(JSON);
      const keys = Object.keys.bind(Object);
      const variables = Object.assign(Object.create(null), input.variables);
      const writes = Object.create(null);
      const tests = [];
      let count = 0;
      let exceeded = false;
      const checkName = name => {
        if (typeof name !== 'string' || !/^(?!__proto__$|constructor$|prototype$)[\w.-]{1,128}$/.test(name)) throw Error();
      };
      const freeze = value => {
        if (value && typeof value === 'object') {
          for (const key of keys(value)) freeze(value[key]);
          Object.freeze(value);
        }
        return value;
      };
      let responseJson;
      let responseJsonParsed = false;
      const response = input.response === null ? null : {
        ...input.response,
        json() {
          if (!input.response || input.response.truncated || input.response.bodyKind === 'binary' || typeof input.response.body !== 'string') throw Error();
          if (!responseJsonParsed) {
            responseJson = parse(input.response.body);
            responseJsonParsed = true;
          }
          return responseJson;
        },
      };
      const api = {
        request: freeze(input.request),
        response: freeze(response),
        environment: { get(name) { checkName(name); return (input.environment || {})[name]; } },
        collectionVariables: { get(name) { checkName(name); return (input.collectionVariables || {})[name]; } },
        variables: {
          get(name) { checkName(name); return variables[name]; },
          set(name, value) {
            checkName(name);
            if (typeof value !== 'string' || value.length > 16384 || ++count > 100) { exceeded = true; throw Error(); }
            writes[name] = variables[name] = value;
          },
          unset(name) {
            checkName(name);
            if (++count > 100) { exceeded = true; throw Error(); }
            delete variables[name]; writes[name] = null;
          },
        },
        test(name, callback) {
          if (typeof name !== 'string' || name.length > 128 || tests.length >= 100 || typeof callback !== 'function') { exceeded = true; throw Error(); }
          const index = tests.length;
          tests[index] = { name, ok: false };
          try { const result = callback(); tests[index].ok = !(result && typeof result.then === 'function'); } catch {}
        },
        assert(condition) { if (!condition) throw Error(); },
      };
      Object.defineProperty(globalThis, 'mc', { value: freeze(api), writable: false, configurable: false });
      return () => {
        if (exceeded) return '';
        const output = stringify({ variables: writes, tests });
        return output.length <= 65536 ? output : '';
      };
    }`)} + ')(' + workerData.input + ')');
    if (bootstrap.error) { bootstrap.error.dispose(); throw Error(); }
    reader = bootstrap.value;
    const result = context.evalCode(workerData.code, 'http-script.js', { type: 'global' });
    if (result.error) {
      // Do not dump arbitrary exception objects: getters may execute code and
      // exception messages/stacks can contain secrets.
      result.error.dispose();
      throw Error();
    }
    result.value.dispose();
    if (runtime.hasPendingJob()) throw Error(); // async jobs are not supported
    const output = context.callFunction(reader, context.undefined);
    if (output.error) { output.error.dispose(); throw Error(); }
    const text = context.getString(output.value);
    output.value.dispose();
    if (!text) { failure = 'limit'; throw Error(); }
    parentPort.postMessage({ output: text });
  } catch {
    parentPort.postMessage({ error: timedOut ? 'timeout' : failure });
  } finally {
    if (reader) reader.dispose();
    context.dispose(); runtime.dispose();
    parentPort.close();
  }
})().catch(() => { parentPort.postMessage({ error: 'limit' }); parentPort.close(); });
`
