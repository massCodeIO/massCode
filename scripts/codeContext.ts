export class CodeContext {
  private code: string
  private indentLevel: number
  constructor () {
    this.code = ''
    this.indentLevel = 0
  }

  pushCode (code: string) {
    this.code += code
  }

  newLine () {
    this.pushCode('\n' + '  '.repeat(this.indentLevel))
  }

  indent () {
    ++this.indentLevel
    this.newLine()
  }

  deindent () {
    --this.indentLevel
    this.newLine()
  }

  getCode () {
    return this.code
  }
}
