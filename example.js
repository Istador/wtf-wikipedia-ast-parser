const { compile, parse } = require('./parser')

const input  = "pre [[link|pre ''italic'' post]] post"
const tokens = compile(input)
const ast    = parse(tokens)

console.log(tokens)
console.log(ast)
console.log(ast.toString())
console.log(ast.toText())
console.log(ast.toHTML())
console.log(ast.toMarkdown())
