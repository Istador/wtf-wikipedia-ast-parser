'use strict'

// Generator::map()
// https://stackoverflow.com/a/45984769
const Generator = Object.getPrototypeOf(function* () {})
Generator.prototype.map = function* (mapper, thisArg) {
  for (const val of this) {
    yield mapper.call(thisArg, val);
  }
}
// Generator::toArray()
Generator.prototype.toArray = function () {
  return [ ...this ]
}


class Node {
  toString()   { return 'Node()' }
  toText()     { return '' }
  toHTML()     { return '' }
  toJSON()     { return {} }
  toLatex()    { return '' }
  toMarkdown() { return '' }
}


function transform(transform, join = '') {
  return this.childs.reduce((out, child) => out + (out ? join : '') + transform(child), '')
}


function* search(filter) {
  if (filter(this)) { yield this }
  if (this instanceof NodeWithChilds) {
    for (const child of this.childs) {
      yield* search.call(child, filter)
    }
  }
}


class NodeWithChilds extends Node {
  constructor(...childs) {
    super()
    this.childs = childs
  }
  get length() { return this.childs.length }
  toString()   { return transform.call(this, child => child.toString(), ', ') }
  toText()     { return transform.call(this, child => child.toText())         }
  toHTML()     { return transform.call(this, child => child.toHTML())         }
  toJSON()     { return undefined                                             }
  toLatex()    { return transform.call(this, child => child.toLatex())        }
  toMarkdown() { return transform.call(this, child => child.toMarkdown())     }
}


class Text extends Node {
  constructor(text) {
    super()
    this.text = text
  }
  toString()   { return `Text("${ this.text }")` }
  toText()     { return this.text }
  toHTML()     { return this.text }
  toJSON()     { return this.text }
  toLatex()    { return this.text }
  toMarkdown() { return this.text }
}


class Sentence extends NodeWithChilds {
  toString() { return 'Sentence(' + super.toString() + ')' }
  toHTML() { return `<span class="sentence">${ super.toHTML() }</span>` }
  toJSON() {
    const node2json = node => node.toJSON()
    // TODO: dates
    // TODO: numbers
    const links  = search.call(this, (node) => node instanceof Link).map(node2json).toArray()
    const bold   = search.call(this, (node) => node instanceof Bold).map(node2json).toArray()
    const italic = search.call(this, (node) => node instanceof Italic).map(node2json).toArray()
    const out = {
      text: this.toText(),
    }
    if (links.length)  { out.links = links }
    if (bold.length)   { out.formatting = { bold } }
    if (italic.length) { out.formatting = { ...(out.formatting|| {}), italic } }
    return out
  }
}


class Italic extends NodeWithChilds {
  toString()   { return 'Italic(' + super.toString() + ')' }
  toHTML()     { return `<i>${ super.toHTML() }</i>`       }
  toJSON()     { return this.toText()                      }
  toLatex()    { return `\\textit{${ super.toLatex() }}`   }
  toMarkdown() { return `*${ super.toMarkdown() }*`        }
}


class Bold extends NodeWithChilds {
  toString()   { return 'Bold(' + super.toString() + ')' }
  toHTML()     { return `<b>${ super.toHTML() }</b>`     }
  toJSON()     { return this.toText()                    }
  toLatex()    { return `\\textbf{${ super.toLatex() }}` }
  toMarkdown() { return `**${ super.toMarkdown() }**`    }
}


function internalLink() {
  // TODO: interwiki linking
  // TODO: just-anchor links [[#history]] need the current Page as context, which needs to come from outside the parser
  return './'
    + this.target.substr(0, 1).toUpperCase()
    + this.target.substr(1).replace(/ /g, '_')
}


class Link extends NodeWithChilds {
  constructor(target, ...childs) {
    super(...childs)
    this.target = target
  }

  // TODO optimize by caching the result(s)
  get isExternal() { return /^[a-z]+:\/\//.test(this.target) }
  get href()   { return ( this.isExternal ? this.target : internalLink.call(this) )}
  get site()   { return ( this.isExternal ? this.target : undefined ) }
  get page()   { return ( this.isExternal ? undefined   : this.target.replace(/#[^#]*$/, '') || undefined ) }
  get anchor() {
    const tail = this.target.replace(/^[^#]+/, '')
    return ( tail ? tail.substr(1) : undefined)
  }

  toString() {
    return 'Link("' + this.target + '", ' + super.toString() + ')'
  }

  toHTML() {
    const classes = 'link' + (this.isExternal ? ' external' : '')
    return `<a class="${ classes }" href="${ this.href }">${ super.toHTML() }</a>`
  }

  toJSON() {
    const out = {
      type   : ( this.isExternal ? 'external' : 'internal' ),
      text   : this.toText(),
      site   : this.site,
      page   : this.page,
      anchor : this.anchor,
    }
    for (const key in out) {
      if (out[key] === undefined) {
        delete out[key]
      }
    }
    return out
  }

  toLatex() {
    return `\\href{${ this.href }}{${ super.toLatex() }}`
  }

  toMarkdown() {
    return `[${ super.toMarkdown() }](${ this.href })`
  }
}


const t = (text) => new Text(text)
const s = (...childs) => new Sentence(...childs)
const i = (...childs) => new Italic(...childs)
const b = (...childs) => new Bold(...childs)
const a = (target, ...childs) => new Link(target, ...childs)


module.exports = {
  Node, NodeWithChilds,
  Text, Sentence, Italic, Bold, Link,
  t, s, i, b, a,
}
