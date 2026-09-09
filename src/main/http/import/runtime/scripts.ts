import type { AnyNode } from 'acorn'
import { parse } from 'acorn'

export type ScriptDialect = 'postman' | 'bruno'
export interface ImportedScript {
  source: string
  phase: 'preRequest' | 'postResponse'
  code: string
  invalid?: boolean
}

function unsupported(): never {
  throw new Error('unsupported')
}

function property(node: AnyNode): string | undefined {
  if (node.type !== 'MemberExpression' || node.optional)
    return undefined
  if (!node.computed && node.property.type === 'Identifier')
    return node.property.name
  if (node.computed && node.property.type === 'Literal') {
    if (
      typeof node.property.value === 'string'
      || typeof node.property.value === 'number'
    ) {
      return String(node.property.value)
    }
  }
}

function memberPath(node: AnyNode): string | undefined {
  if (node.type === 'Identifier')
    return node.name
  if (node.type === 'MemberExpression') {
    const parent = memberPath(node.object)
    const key = property(node)
    if (parent && key && !key.includes('.'))
      return `${parent}.${key}`
  }
}

/** Parse and generate only the explicitly supported language. Never evaluate source. */
export function translateScript(
  code: string,
  dialect: ScriptDialect,
  phase: ImportedScript['phase'],
) {
  if (code.length > 48_000)
    unsupported()
  const tree = parse(code, { ecmaVersion: 2022, sourceType: 'script' })
  let nodes = 0
  let usesVariables = false
  const reserved = new Set([
    'mc',
    'pm',
    'bru',
    'res',
    'req',
    'test',
    'expect',
    'JSON',
    'String',
    'undefined',
    '__mcImportBody',
    '__mcImportJson',
  ])
  const forbidden = new Set(['__proto__', 'constructor', 'prototype'])
  const expectName = dialect === 'postman' ? 'pm.expect' : 'expect'
  const testName = dialect === 'postman' ? 'pm.test' : 'test'
  const variableNames
    = dialect === 'postman'
      ? {
          'pm.variables.get': 'get',
          'pm.variables.set': 'set',
          'pm.variables.unset': 'unset',
        }
      : { 'bru.getVar': 'get', 'bru.setVar': 'set', 'bru.deleteVar': 'unset' }

  function expr(
    node: AnyNode,
    locals: Set<string>,
    depth = 0,
    allowWrite = false,
  ): string {
    if (++nodes > 4000 || depth > 64)
      unsupported()
    if (node.type === 'Literal' && !('regex' in node) && !('bigint' in node)) {
      if (typeof node.value === 'number' && !Number.isFinite(node.value))
        unsupported()
      return JSON.stringify(node.value)
    }
    if (
      node.type === 'Identifier'
      && (locals.has(node.name) || node.name === 'undefined')
    ) {
      return node.name
    }
    const path = memberPath(node)
    if (phase === 'postResponse') {
      if (path === (dialect === 'postman' ? 'pm.response.code' : 'res.status'))
        return 'mc.response.status'
      if (
        path
        === (dialect === 'postman'
          ? 'pm.response.responseTime'
          : 'res.responseTime')
      ) {
        return 'mc.response.durationMs'
      }
      if (dialect === 'bruno' && path === 'res.body') {
        return 'mc.response.json()'
      }
    }
    if (node.type === 'MemberExpression') {
      const key = property(node)
      if (key === undefined || forbidden.has(key))
        unsupported()
      // Reading JSON data or local values only; API objects are never values.
      return `${expr(node.object, locals, depth + 1)}[${JSON.stringify(key)}]`
    }
    if (
      node.type === 'BinaryExpression'
      && [
        '===',
        '!==',
        '==',
        '!=',
        '<',
        '<=',
        '>',
        '>=',
        '+',
        '-',
        '*',
        '/',
        '%',
      ].includes(node.operator)
    ) {
      return `(${expr(node.left, locals, depth + 1)} ${node.operator} ${expr(node.right, locals, depth + 1)})`
    }
    if (
      node.type === 'LogicalExpression'
      && ['&&', '||', '??'].includes(node.operator)
    ) {
      return `(${expr(node.left, locals, depth + 1)} ${node.operator} ${expr(node.right, locals, depth + 1)})`
    }
    if (
      node.type === 'UnaryExpression'
      && ['!', '-', '+', 'typeof'].includes(node.operator)
    ) {
      return `(${node.operator} ${expr(node.argument, locals, depth + 1)})`
    }
    if (node.type === 'CallExpression' && !node.optional) {
      const name = memberPath(node.callee)
      const args = node.arguments
      if (
        dialect === 'postman'
        && (name === 'pm.environment.get'
          || name === 'pm.collectionVariables.get')
        && args.length === 1
        && args[0].type === 'Literal'
        && typeof args[0].value === 'string'
      ) {
        usesVariables = true
        return `mc.${name === 'pm.environment.get' ? 'environment' : 'collectionVariables'}.get(${JSON.stringify(args[0].value)})`
      }
      if (name === 'String' && args.length === 1)
        return `String(${expr(args[0], locals, depth + 1)})`
      if (
        phase === 'postResponse'
        && dialect === 'postman'
        && args.length === 0
      ) {
        if (name === 'pm.response.json') {
          return 'mc.response.json()'
        }
        if (name === 'pm.response.text')
          return 'mc.response.body'
      }
      const operation
        = name && Object.hasOwn(variableNames, name)
          ? variableNames[name as keyof typeof variableNames]
          : undefined
      if (operation) {
        if (operation !== 'get' && !allowWrite)
          unsupported()
        const key = args[0]
        if (
          !key
          || key.type !== 'Literal'
          || typeof key.value !== 'string'
          || !/^(?!__proto__$|constructor$|prototype$)[\w.-]{1,128}$/u.test(
            key.value,
          )
        ) {
          unsupported()
        }
        if (args.length !== (operation === 'set' ? 2 : 1))
          unsupported()
        usesVariables = true
        return `mc.variables.${operation}(${args.map(arg => expr(arg, locals, depth + 1)).join(', ')})`
      }
    }
    return unsupported()
  }

  function assertion(node: AnyNode, locals: Set<string>): string {
    if (
      dialect === 'postman'
      && phase === 'postResponse'
      && node.type === 'CallExpression'
      && memberPath(node.callee) === 'pm.response.to.have.status'
      && node.arguments.length === 1
    ) {
      return `mc.assert(mc.response.status === ${expr(node.arguments[0], locals, 1)});`
    }
    const args = node.type === 'CallExpression' ? node.arguments : []
    let base = node.type === 'CallExpression' ? node.callee : node
    const chain: string[] = []
    while (base.type === 'MemberExpression') {
      const key = property(base)
      if (!key)
        unsupported()
      chain.unshift(key)
      base = base.object
    }
    if (
      base.type !== 'CallExpression'
      || memberPath(base.callee) !== expectName
      || base.arguments.length !== 1
    ) {
      unsupported()
    }
    const actual = expr(base.arguments[0], locals)
    const operation = chain.pop()
    if (
      chain.some(key => !['to', 'be', 'have', 'not'].includes(key))
      || chain.filter(key => key === 'not').length > 1
    ) {
      unsupported()
    }
    const negate = chain.includes('not')
    let condition: string
    if (
      ['equal', 'equals', 'eq'].includes(operation ?? '')
      && args.length === 1
    ) {
      condition = `${actual} === ${expr(args[0], locals)}`
    }
    else if (
      ['true', 'false', 'null', 'undefined'].includes(operation ?? '')
      && args.length === 0
      && node.type !== 'CallExpression'
    ) {
      condition = `${actual} === ${operation}`
    }
    else if (
      ['above', 'greaterThan', 'below', 'lessThan', 'least', 'most'].includes(
        operation ?? '',
      )
      && args.length === 1
    ) {
      const operator = (
        {
          above: '>',
          greaterThan: '>',
          below: '<',
          lessThan: '<',
          least: '>=',
          most: '<=',
        } as Record<string, string>
      )[operation!]
      const expected = expr(args[0], locals)
      // Chai rejects non-numeric operands; don't introduce JavaScript coercion.
      condition = `typeof ${actual} === "number" && typeof ${expected} === "number" && ${actual} ${operator} ${expected}`
      if (negate)
        unsupported()
    }
    else {
      unsupported()
    }
    return `mc.assert(${negate ? `!(${condition})` : condition});`
  }

  function statements(
    body: AnyNode[],
    outer: Set<string>,
    inTest = false,
  ): string {
    const locals = new Set(outer)
    return body
      .map((node) => {
        if (++nodes > 4000)
          unsupported()
        if (node.type === 'EmptyStatement')
          return ''
        if (node.type === 'VariableDeclaration' && node.kind === 'const') {
          return node.declarations
            .map((declaration) => {
              if (
                declaration.id.type !== 'Identifier'
                || !declaration.init
                || reserved.has(declaration.id.name)
                || locals.has(declaration.id.name)
              ) {
                unsupported()
              }
              const value = expr(declaration.init, locals)
              locals.add(declaration.id.name)
              return `const ${declaration.id.name} = ${value};`
            })
            .join('\n')
        }
        if (node.type !== 'ExpressionStatement')
          unsupported()
        const expression = node.expression
        if (
          expression.type === 'CallExpression'
          && memberPath(expression.callee) === testName
        ) {
          if (inTest || expression.arguments.length !== 2)
            unsupported()
          const [name, callback] = expression.arguments
          if (
            name.type !== 'Literal'
            || typeof name.value !== 'string'
            || name.value.length > 128
            || !['FunctionExpression', 'ArrowFunctionExpression'].includes(
              callback.type,
            )
          ) {
            unsupported()
          }
          if (
            callback.type !== 'FunctionExpression'
            && callback.type !== 'ArrowFunctionExpression'
          ) {
            unsupported()
          }
          if (
            callback.async
            || callback.generator
            || callback.params.length
            || callback.body.type !== 'BlockStatement'
          ) {
            unsupported()
          }
          return `mc.test(${JSON.stringify(name.value)}, () => {\n${statements(
            callback.body.body,
            locals,
            true,
          )
            .split('\n')
            .map(line => `  ${line}`)
            .join('\n')}\n});`
        }
        if (expression.type === 'CallExpression') {
          const name = memberPath(expression.callee)
          if (name && Object.hasOwn(variableNames, name))
            return `${expr(expression, locals, 0, true)};`
        }
        return assertion(expression, locals)
      })
      .join('\n')
  }
  const translated = statements(tree.body, new Set())
  return { code: translated, usesVariables }
}
