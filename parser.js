'use strict'

const { NodeWithChilds, Text, Sentence, Italic, Bold, Link } = require('./classes')


// lexical anaylsis: string => tokens
// see https://blog.mgechev.com/2017/09/16/developing-simple-interpreter-transpiler-compiler-tutorial/

const lexical = /('''''|''''|'''|''|<\/?[bi]>|\[\[|\]\]|\|)/g

function compile (input) {
  const matches = []
  let match
  while ((match = lexical.exec(input)) != null) {
    matches.push({
      type : match[0],
      text : match[0],
      pos  : match.index,
    })
  }
  const [ tokens, offset ] = matches.reduce(
    (([out, offset], match) => {
      if (match.pos > offset) {
        out.push({
          type : 'text',
          text : input.substr(offset, match.pos - offset),
          pos  : offset,
        })
      }
      out.push(match)
      return [ out, match.pos + match.text.length ]
    }),
    [ [], 0 ]
  )
  if (offset < input.length) {
    tokens.push({
      type : 'text',
      text : input.substr(offset),
      pos  : offset,
    })
  }
  return tokens
}


// syntax analysis: tokens => AST
// See: https://blog.klipse.tech/javascript/2017/02/08/tiny-compiler-parser.html

function parse(tokens) {
  let i = 0
  const peek    = () => tokens[i]
  const consume = () => tokens[i++]

  const parseToken = (token) => {
    const p = parsers[token.type] || parsers.text
    return p(token)
  }

  const until   = (end, then) => (token) => {
    let childs = []
    while (peek()) {
      const x = consume()
      if (x.type === end) { break }
      childs = [ ...childs, ...parseToken(x) ]
    }
    return ( childs.length ? then(childs) : [] )
  }

  const parsers = {
    text : (token) => [ new Text(token.text) ],
    '[[' : (token) => {
      let pipe = false
      let pre  = []
      let post = []
      while (peek()) {
        const x = consume()
        if (x.type === '|' ) { pipe = true ; continue }
        if (x.type === ']]') { break }
        const parsed = parseToken(x)
        if (pipe) { post = [ ...post, ...parsed ] }
        else      { pre  = [ ...pre,  ...parsed ] }
      }
      // link without text
      if (pipe && ! post.length) { return [] }
      // no text for link
      if (! pipe) { post = pre }
      // no link
      if (! pre.length) { return post }
      // link & text
      const link = pre.map(x => x.toText()).join('')
      return [ new Link(link, ...post) ]
    },
    '<b>'   : until('</b>',  childs => [ new Bold(...childs)   ]),
    "'''"   : until("'''",   childs => [ new Bold(...childs)   ]),
    "''''"  : until("''''",  childs => [ new Bold(new Text("'"), ...childs, new Text("'")) ]),
    "'''''" : until("'''''", childs => [ new Italic(new Bold(...childs)) ]),
    '<i>'   : until('</i>',  childs => [ new Italic(...childs) ]),
    "''"    : until("''",    childs => [ new Italic(...childs) ]),
  }

  let out = []
  while (peek()) {
    out = [ ...out, ...parseToken(consume()) ]
  }
  return new Sentence(...out)
}

// optimize ast
// remove tags inside tags and combine following texts

const optimize_conf = {
  combineTexts   : true,
  combineItalics : true,
  combineBolds   : true,
  nestedLinks    : true,
  nestedItalics  : true,
  nestedBolds    : true,
}

const _optimize_combine = (conf, ctx, classy, combine) => (out, node) => {
  // skip
  if (
       (classy === Text   && ! conf.combineTexts  )
    || (classy === Italic && ! conf.combineItalics)
    || (classy === Bold   && ! conf.combineBolds  )
  ) {
    return [ ...out, node ]
  }

  const last = out[out.length - 1]
  return (
       last instanceof classy
    && node instanceof classy
    ? [ ...out.slice(0, -1), optimize(combine(last, node), conf, ctx) ]
    : [ ...out, node ]
  )
}

function optimize(ast, config = {}, context = {}) {
  // no children
  if (! (ast instanceof NodeWithChilds)) {
    return ast
  }
  const conf = Object.assign({}, optimize_conf, config)
  // modify context
  const ctx = Object.assign({}, context)
  if (conf.nestedLinks   && ast instanceof Link)   { ctx.link   = true }
  if (conf.nestedItalics && ast instanceof Italic) { ctx.italic = true }
  if (conf.nestedBolds   && ast instanceof Bold)   { ctx.bold   = true }

  ast.childs = ast.childs
    // remove tags inside tags
    .reduce(
      (out, node) => (
           (ctx.link   && node instanceof Link) // TODO: wikipedia and markdown do ignore the outer link and not the inner link. Unsure what to do here, see tests.js for alternatives.
        || (ctx.italic && node instanceof Italic)
        || (ctx.bold   && node instanceof Bold)
        ? [ ...out, ...node.childs ]
        : [ ...out, node ]
      ),
      []
    )
    // recursive optimize
    .map(node => optimize(node, conf, ctx))
    // combine following texts
    .reduce(_optimize_combine(conf, ctx, Text,   (a, b) => new Text(a.text + b.text)), [])
    // combine following italics
    .reduce(_optimize_combine(conf, ctx, Italic, (a, b) => new Italic(...a.childs, ...b.childs)), [])
    // combine following bolds
    .reduce(_optimize_combine(conf, ctx, Bold,   (a, b) => new Bold(...a.childs, ...b.childs)), [])
  return ast
}


// exports

module.exports = { compile, parse, optimize }
