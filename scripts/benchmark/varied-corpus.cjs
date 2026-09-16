const crypto = require('node:crypto')

// Synthetic, varied source examples; no user files or external downloads.
function variedDocumentFor(seed, index, space) {
  const token = crypto.createHash('sha256').update(`${seed}:${space}:${index}`).digest('hex').slice(0, 16)
  const examples = [
    ['typescript', n => `// needle Café Поиск 東京 😀 ${token}\nexport async function load_${n}(id: string): Promise<string> {\n  const key = \`${token}:\${id}\`;\n  return JSON.stringify({ key, value: ${n}, enabled: true });\n}\n`],
    ['python', n => `# needle Café Поиск 東京 😀 ${token}\ndef record_${n}(value: str) -> dict:\n    return {"key": "${token}", "value": value.strip(), "count": ${n}}\n`],
    ['sql', n => `-- needle Café Поиск 東京 😀 ${token}\nSELECT customer_id, SUM(amount) AS total_${n}\nFROM orders WHERE reference = '${token}-${n}'\nGROUP BY customer_id HAVING SUM(amount) > ${n};\n`],
    ['rust', n => `// needle Café Поиск 東京 😀 ${token}\nfn record_${n}(values: &[i32]) -> Option<i32> {\n    values.iter().copied().filter(|value| *value > ${n}).max()\n}\n`],
    ['json', n => `${JSON.stringify({ needle: 'Café Поиск 東京 😀', key: `${token}-${n}`, count: n, enabled: true, tags: ['api', 'storage', 'search'] }, null, 2)}\n`],
    ['markdown', n => `# needle Café Поиск 東京 😀 ${token}-${n}\n\nA note with **formatting**, [local reference](#section), and a code example.\n\n\`\`\`typescript\nconst value_${n} = "${token}"\n\`\`\`\n\n## Fragment: user heading\n\n- [ ] Review record ${n}\n`],
  ]
  const [language, example] = examples[index % examples.length]
  const target = index % 97 === 0 ? 131072 : [512, 4096, 32768][index % 3]
  let body = ''
  for (let block = 0; body.length < target; block++)
    body += example(index * 1000 + block)
  return { name: `bench-${space}-${String(index).padStart(6, '0')}`, body, language }
}
module.exports = { variedDocumentFor }
