'use strict'

const test = require('tape')

const isEqual = require('lodash.isequal')
const util    = require('util')
const { compile, parse, optimize } = require('./parser')
const { t, s, i, b, a }  = require('./classes')

const tests = {
  // issue 300
  'examples from issue 300': [
    {
      name     : 'the same link twice',
      input    : "[[Page 1]], [[Page 1]]",
      ast      : s(a('Page 1', t('Page 1')), t(', '), a('Page 1', t('Page 1'))),
      text     : 'Page 1, Page 1',
      html     : '<a class="link" href="./Page_1">Page 1</a>, <a class="link" href="./Page_1">Page 1</a>',
      latex    : '\\href{./Page_1}{Page 1}, \\href{./Page_1}{Page 1}',
      markdown : '[Page 1](./Page_1), [Page 1](./Page_1)',
    },
    {
      name     : 'link text several times in the text',
      input    : "Just click on here: [[Page 1|here]] or [[Page 2|here]]",
      ast      : s(t('Just click on here: '), a('Page 1', t('here')), t(' or '), a('Page 2', t('here'))),
      text     : 'Just click on here: here or here',
      html     : 'Just click on here: <a class="link" href="./Page_1">here</a> or <a class="link" href="./Page_2">here</a>',
      latex    : 'Just click on here: \\href{./Page_1}{here} or \\href{./Page_2}{here}',
      markdown : 'Just click on here: [here](./Page_1) or [here](./Page_2)',
    },
    {
      name     : 'matching text inside structure that should be removed and link text that is in another link target',
      input    : "<i>abi</i>, <b>i</b>, [[a|b]], [[b|a]]",
      ast      : s(i(t('abi')), t(', '), b(t('i')), t(', '), a('a', t('b')), t(', '), a('b', t('a'))),
      text     : 'abi, i, b, a',
      html     : '<i>abi</i>, <b>i</b>, <a class="link" href="./A">b</a>, <a class="link" href="./B">a</a>',
      latex    : '\\textit{abi}, \\textbf{i}, \\href{./A}{b}, \\href{./B}{a}',
      markdown : '*abi*, **i**, [b](./A), [a](./B)',
    },
  ],
  // issue 301
  'examples from issue 301': [
    {
      name     : 'bold inside of link',
      input    : "[[Page 1|'''link''']]",
      ast      : s(a('Page 1', b(t('link')))),
      text     : 'link',
      html     : '<a class="link" href="./Page_1"><b>link</b></a>',
      latex    : '\\href{./Page_1}{\\textbf{link}}',
      markdown : '[**link**](./Page_1)',
    },
    {
      name     : 'bold inside of link surrounded by text and another unrelated link',
      input    : "i am [[bold|'''bold''']] [[here]]",
      ast      : s(t('i am '), a('bold', b(t('bold'))), t(' '), a('here', t('here'))),
      text     : 'i am bold here',
      html     : 'i am <a class="link" href="./Bold"><b>bold</b></a> <a class="link" href="./Here">here</a>',
      latex    : 'i am \\href{./Bold}{\\textbf{bold}} \\href{./Here}{here}',
      markdown : 'i am [**bold**](./Bold) [here](./Here)',
    },
  ],
  // one node only
  'simple sentences': [
    {
      name  : 'link',
      input : "[[link]]",
      ast   : s(a('link', t('link'))),
      text  : 'link',
      html  : '<a class="link" href="./Link">link</a>',
    },
    {
      name  : 'link with custom text',
      input : "[[link|text]]",
      ast   : s(a('link', t('text'))),
      text  : 'text',
      html  : '<a class="link" href="./Link">text</a>',
    },
    {
      name  : 'link with space inside of the target',
      input : "[[link with space|text]]",
      ast   : s(a('link with space', t('text'))),
      text  : 'text',
      html  : '<a class="link" href="./Link_with_space">text</a>',
    },
    {
      name  : 'italic with quotes',
      input : "''italic''",
      ast   : s(i(t('italic'))),
      text  : 'italic',
      html  : '<i>italic</i>',
    },
    {
      name  : 'italic with tag',
      input : "<i>italic</i>",
      ast   : s(i(t('italic'))),
      text  : 'italic',
      html  : '<i>italic</i>',
    },
    {
      name  : 'bold with quotes',
      input : "'''bold'''",
      ast   : s(b(t('bold'))),
      text  : 'bold',
      html  : '<b>bold</b>',
    },
    {
      name  : 'bold with tag',
      input : "<b>bold</b>",
      ast   : s(b(t('bold'))),
      text  : 'bold',
      html  : '<b>bold</b>',
    },
    {
      name  : 'bold with quotes that contains one pair of single quotes as text',
      input : "''''bold''''",
      ast   : s(b(t("'bold'"))),
      text  : "'bold'",
      html  : "<b>'bold'</b>",
    },
  ],
  // pre & post
  'text before and after': [
    {
      name  : 'link',
      input : "pre [[link]] post",
      ast   : s(t('pre '), a('link', t('link')), t(' post')),
      text  : 'pre link post',
      html  : 'pre <a class="link" href="./Link">link</a> post',
    },
    {
      name  : 'link with custom text',
      input : "pre [[link|text]] post",
      ast   : s(t('pre '), a('link', t('text')), t(' post')),
      text  : 'pre text post',
      html  : 'pre <a class="link" href="./Link">text</a> post',
    },
    {
      name  : 'italic with quotes',
      input : "pre ''italic'' post",
      ast   : s(t('pre '), i(t('italic')), t(' post')),
      text  : 'pre italic post',
      html  : 'pre <i>italic</i> post',
    },
    {
      name  : 'italic with tag',
      input : "pre <i>italic</i> post",
      ast   : s(t('pre '), i(t('italic')), t(' post')),
      text  : 'pre italic post',
      html  : 'pre <i>italic</i> post',
    },
    {
      name  : 'bold with quotes',
      input : "pre '''bold''' post",
      ast   : s(t('pre '), b(t('bold')), t(' post')),
      text  : 'pre bold post',
      html  : 'pre <b>bold</b> post',
    },
    {
      name  : 'bold with tag',
      input : "pre <b>bold</b> post",
      ast   : s(t('pre '), b(t('bold')), t(' post')),
      text  : 'pre bold post',
      html  : 'pre <b>bold</b> post',
    },
  ],
  // optimize
  'optimize ast' : [
    {
      // TODO: unclear how to handle links inside links
      name  : 'link inside link',
      input : 'pre [[Page 1|pre [[Page 2|link²]] post]] post',
      text  : 'pre pre link² post post',
      // do nothing
      //ast      : s(t('pre '), a('Page 1', t('pre '), a('Page 2', t('link²')), t(' post')), t(' post')),
      //html     : 'pre <a class="link" href="./Page_1">pre <a class="link" href="./Page_2">link²</a> post</a> post', // invalid html, both links end after 'link²'
      //markdown : 'pre [pre [link²](./Page_2) post](./Page_1) post',
      // ignore the inner <a>
      ast      : s(t('pre '), a('Page 1', t('pre link² post')), t(' post')),
      html     : 'pre <a class="link" href="./Page_1">pre link² post</a> post',
      markdown : 'pre [pre link² post](./Page_1) post',
      // ignore the outer <a>
      //ast      : s(t('pre [[Page 1|pre '), a('Page 2', t('link²')), t(' post]] post')),
      //html     : 'pre [[Page 1|pre <a class="link" href="./Page_2">link²</a> post]] post',
      //markdown : 'pre pre [link²](./Page_2) post post',
      // wrap the <a> inside of an <object>, this is still invalid html, but does render as expected in the browser (see https://stackoverflow.com/a/41960009/2349701)
      //ast      : s(t('pre '), a('Page 1', t('pre '), a('Page 2', t('link²')), t(' post')), t(' post')),
      //html     : 'pre <a class="link" href="./Page_1">pre <object><a class="link" href="./Page_2">link²</a></object> post</a> post',
      //markdown : 'pre [pre [link²](./Page_2) post](./Page_1) post',
    },
    {
      name  : 'bold inside bold',
      input : 'pre <b>pre <b>bold²</b> post</b> post',
      ast   : s(t('pre '), b(t('pre bold² post')), t(' post')),
    },
    {
      name  : 'italic inside italic',
      input : 'pre <i>pre <i>italic²</i> post</i> post',
      ast   : s(t('pre '), i(t('pre italic² post')), t(' post')),
    },
    {
      name  : 'bold inside italic inside bold',
      input : 'pre <b>pre <i>pre <b>bold³</b> post</i> post</b> post',
      ast   : s(t('pre '), b(t('pre '), i(t('pre bold³ post')), t(' post')), t(' post')),
    },
    {
      name  : 'italic inside bold inside italic',
      input : 'pre <i>pre <b>pre <i>italic³</i> post</b> post</i> post',
      ast   : s(t('pre '), i(t('pre '), b(t('pre italic³ post')), t(' post')), t(' post')),
    },
  ],
  // nested links
  'links with other node in text': [
    {
      name  : 'italic with quotes',
      input : "[[link|''italic'']]",
      ast   : s(a('link', i(t('italic')))),
      text  : 'italic',
      html  : '<a class="link" href="./Link"><i>italic</i></a>',
    },
    {
      name  : 'italic with tag',
      input : "[[link|<i>italic</i>]]",
      ast   : s(a('link', i(t('italic')))),
      text  : 'italic',
      html  : '<a class="link" href="./Link"><i>italic</i></a>',
    },
    {
      name  : 'bold with quotes',
      input : "[[link|'''bold''']]",
      ast   : s(a('link', b(t('bold')))),
      text  : 'bold',
      html  : '<a class="link" href="./Link"><b>bold</b></a>',
    },
    {
      name  : 'bold with tag',
      input : "[[link|<b>bold</b>]]",
      ast   : s(a('link', b(t('bold')))),
      text  : 'bold',
      html  : '<a class="link" href="./Link"><b>bold</b></a>',
    },
  ],
  // nested (italic '')
  'italic quote with other node in text': [
    {
      name  : 'link',
      input : "''[[link]]''",
      ast   : s(i(a('link', t('link')))),
      text  : 'link',
      html  : '<i><a class="link" href="./Link">link</a></i>',
    },
    {
      name  : 'link with custom text',
      input : "''[[link|text]]''",
      ast   : s(i(a('link', t('text')))),
      text  : 'text',
      html  : '<i><a class="link" href="./Link">text</a></i>',
    },
    {
      name  : 'bold with tag',
      input : "''<b>both</b>''",
      ast   : s(i(b(t('both')))),
      text  : 'both',
      html  : '<i><b>both</b></i>',
    },
  ],
  // nested (italic <i>)
  'italic tag with other node in text': [
    {
      name  : 'link',
      input : "<i>[[link]]</i>",
      ast   : s(i(a('link', t('link')))),
      text  : 'link',
      html  : '<i><a class="link" href="./Link">link</a></i>',
    },
    {
      name  : 'link with custom text',
      input : "<i>[[link|text]]</i>",
      ast   : s(i(a('link', t('text')))),
      text  : 'text',
      html  : '<i><a class="link" href="./Link">text</a></i>',
    },
    {
      name  : 'bold with quotes',
      input : "<i>'''both'''</i>",
      ast   : s(i(b(t('both')))),
      text  : 'both',
      html  : '<i><b>both</b></i>',
    },
    {
      name  : 'bold with tag',
      input : "<i><b>both</b></i>",
      ast   : s(i(b(t('both')))),
      text  : 'both',
      html  : '<i><b>both</b></i>',
    },
  ],
  // nested (bold ''')
  'bold quote with other node in text': [
    {
      name  : 'link',
      input : "'''[[link]]'''",
      ast   : s(b(a('link', t('link')))),
      text  : 'link',
      html  : '<b><a class="link" href="./Link">link</a></b>',
    },
    {
      name  : 'link with custom text',
      input : "'''[[link|text]]'''",
      ast   : s(b(a('link', t('text')))),
      text  : 'text',
      html  : '<b><a class="link" href="./Link">text</a></b>',
    },
    {
      name  : 'italic with quotes (implementation specific, might fail)',
      input : "'''''both'''''",
      ast   : s(i(b(t('both')))), // implementation specific, could also be: s(b(i(t('both'))))
      text  : 'both',
      html  : '<i><b>both</b></i>', // implementation specific, could also be: '<b><i>both</i></b>'
    },
    {
      name  : 'italic with tag',
      input : "'''<i>both</i>'''",
      ast   : s(b(i(t('both')))),
      text  : 'both',
      html  : '<b><i>both</i></b>',
    },
  ],
  // nested (bold <b>)
  'bold tag with other node in text': [
    {
      name  : 'link',
      input : "<b>[[link]]</b>",
      ast   : s(b(a('link', t('link')))),
      text  : 'link',
      html  : '<b><a class="link" href="./Link">link</a></b>',
    },
    {
      name  : 'link with custom text',
      input : "<b>[[link|text]]</b>",
      ast   : s(b(a('link', t('text')))),
      text  : 'text',
      html  : '<b><a class="link" href="./Link">text</a></b>',
    },
    {
      name  : 'italic with quotes',
      input : "<b>''both''</b>",
      ast   : s(b(i(t('both')))),
      text  : 'both',
      html  : '<b><i>both</i></b>',
    },
    {
      name  : 'italic with tag',
      input : "<b><i>both</i></b>",
      ast   : s(b(i(t('both')))),
      text  : 'both',
      html  : '<b><i>both</i></b>',
    },
  ],
  // nested & pre-post (links)
  'links with other nodes in text, and text before and after': [
    {
      name  : 'italic with quotes',
      input : "pre [[link|pre ''italic'' post]] post",
      ast   : s(t('pre '), a('link', t('pre '), i(t('italic')), t(' post')), t(' post')),
      text  : 'pre pre italic post post',
      html  : 'pre <a class="link" href="./Link">pre <i>italic</i> post</a> post',
    },
    {
      name  : 'italic with tag',
      input : "pre [[link|pre <i>italic</i> post]] post",
      ast   : s(t('pre '), a('link', t('pre '), i(t('italic')), t(' post')), t(' post')),
      text  : 'pre pre italic post post',
      html  : 'pre <a class="link" href="./Link">pre <i>italic</i> post</a> post',
    },
    {
      name  : 'bold with quotes',
      input : "pre [[link|pre '''bold''' post]] post",
      ast   : s(t('pre '), a('link', t('pre '), b(t('bold')), t(' post')), t(' post')),
      text  : 'pre pre bold post post',
      html  : 'pre <a class="link" href="./Link">pre <b>bold</b> post</a> post',
    },
    {
      name  : 'bold with tag',
      input : "pre [[link|pre <b>bold</b> post]] post",
      ast   : s(t('pre '), a('link', t('pre '), b(t('bold')), t(' post')), t(' post')),
      text  : 'pre pre bold post post',
      html  : 'pre <a class="link" href="./Link">pre <b>bold</b> post</a> post',
    },
  ],
  // nested & pre-post (italic '')
  'italic quote with other nodes in text, and text before and after': [
    {
      name  : 'link',
      input : "pre ''pre [[link]] post'' post",
      ast   : s(t('pre '), i(t('pre '), a('link', t('link')), t(' post')), t(' post')),
      text  : 'pre pre link post post',
      html  : 'pre <i>pre <a class="link" href="./Link">link</a> post</i> post',
    },
    {
      name  : 'link with custom text',
      input : "pre ''pre [[link|text]] post'' post",
      ast   : s(t('pre '), i(t('pre '), a('link', t('text')), t(' post')), t(' post')),
      text  : 'pre pre text post post',
      html  : 'pre <i>pre <a class="link" href="./Link">text</a> post</i> post',
    },
    {
      name  : 'bold with quotes',
      input : "pre ''pre '''both''' post'' post",
      ast   : s(t('pre '), i(t('pre '), b(t('both')), t(' post')), t(' post')),
      text  : 'pre pre both post post',
      html  : 'pre <i>pre <b>both</b> post</i> post',
    },
    {
      name  : 'bold with tag',
      input : "pre ''pre <b>both</b> post'' post",
      ast   : s(t('pre '), i(t('pre '), b(t('both')), t(' post')), t(' post')),
      text  : 'pre pre both post post',
      html  : 'pre <i>pre <b>both</b> post</i> post',
    },
  ],
  // nested & pre-post (italic <i>)
  'italic tag with other nodes in text, and text before and after': [
    {
      name  : 'link',
      input : "pre <i>pre [[link]] post</i> post",
      ast   : s(t('pre '), i(t('pre '), a('link', t('link')), t(' post')), t(' post')),
      text  : 'pre pre link post post',
      html  : 'pre <i>pre <a class="link" href="./Link">link</a> post</i> post',
    },
    {
      name  : 'link with custom text',
      input : "pre <i>pre [[link|text]] post</i> post",
      ast   : s(t('pre '), i(t('pre '), a('link', t('text')), t(' post')), t(' post')),
      text  : 'pre pre text post post',
      html  : 'pre <i>pre <a class="link" href="./Link">text</a> post</i> post',
    },
    {
      name  : 'bold with quotes',
      input : "pre <i>pre '''both''' post</i> post",
      ast   : s(t('pre '), i(t('pre '), b(t('both')), t(' post')), t(' post')),
      text  : 'pre pre both post post',
      html  : 'pre <i>pre <b>both</b> post</i> post',
    },
    {
      name  : 'bold with tag',
      input : "pre <i>pre <b>both</b> post</i> post",
      ast   : s(t('pre '), i(t('pre '), b(t('both')), t(' post')), t(' post')),
      text  : 'pre pre both post post',
      html  : 'pre <i>pre <b>both</b> post</i> post',
    },
  ],
  // nested & pre-post (bold ''')
  'bold quote with other nodes in text, and text before and after': [
    {
      name  : 'link',
      input : "pre '''pre [[link]] post''' post",
      ast   : s(t('pre '), b(t('pre '), a('link', t('link')), t(' post')), t(' post')),
      text  : 'pre pre link post post',
      html  : 'pre <b>pre <a class="link" href="./Link">link</a> post</b> post',
    },
    {
      name  : 'link with custom text',
      input : "pre '''pre [[link|text]] post''' post",
      ast   : s(t('pre '), b(t('pre '), a('link', t('text')), t(' post')), t(' post')),
      text  : 'pre pre text post post',
      html  : 'pre <b>pre <a class="link" href="./Link">text</a> post</b> post',
    },
    {
      name  : 'italic with quotes',
      input : "pre '''pre ''both'' post''' post",
      ast   : s(t('pre '), b(t('pre '), i(t('both')), t(' post')), t(' post')),
      text  : 'pre pre both post post',
      html  : 'pre <b>pre <i>both</i> post</b> post',
    },
    {
      name  : 'italic with tag',
      input : "pre '''pre <i>both</i> post''' post",
      ast   : s(t('pre '), b(t('pre '), i(t('both')), t(' post')), t(' post')),
      text  : 'pre pre both post post',
      html  : 'pre <b>pre <i>both</i> post</b> post',
    },
  ],
  // nested & pre-post (bold <b>)
  'bold tag with other nodes in text, and text before and after': [
    {
      name  : 'link',
      input : "pre <b>pre [[link]] post</b> post",
      ast   : s(t('pre '), b(t('pre '), a('link', t('link')), t(' post')), t(' post')),
      text  : 'pre pre link post post',
      html  : 'pre <b>pre <a class="link" href="./Link">link</a> post</b> post',
    },
    {
      name  : 'link with custom text',
      input : "pre <b>pre [[link|text]] post</b> post",
      ast   : s(t('pre '), b(t('pre '), a('link', t('text')), t(' post')), t(' post')),
      text  : 'pre pre text post post',
      html  : 'pre <b>pre <a class="link" href="./Link">text</a> post</b> post',
    },
    {
      name  : 'italic with quotes',
      input : "pre <b>pre ''both'' post</b> post",
      ast   : s(t('pre '), b(t('pre '), i(t('both')), t(' post')), t(' post')),
      text  : 'pre pre both post post',
      html  : 'pre <b>pre <i>both</i> post</b> post',
    },
    {
      name  : 'italic with tag',
      input : "pre <b>pre <i>both</i> post</b> post",
      ast   : s(t('pre '), b(t('pre '), i(t('both')), t(' post')), t(' post')),
      text  : 'pre pre both post post',
      html  : 'pre <b>pre <i>both</i> post</b> post',
    },
  ],
}

for (const context in tests) {
  for (const index in tests[context]) {
    let { name, input, ast, text, html, json, latex, markdown } = tests[context][index]

    test(context, t => {
      const minify = context === 'optimize ast'
      const _ast = optimize(parse(compile(input)), { nestedLinks: minify, nestedBolds: minify, nestedItalics: minify })
      const _name = (err) => `[${index}] ${context} - ${name} - ${err}`

      if (ast !== undefined) {
        //t.deepEqual(_ast, ast, _name('ast mismatch')) // deepEqual is not working correctly with classes
        t.equal(isEqual(_ast, ast), true, _name('ast mismatch'))
      }

      if (text !== undefined) {
        t.equal(_ast.toText(), text, _name('text mismatch'))
      }

      if (html !== undefined) {
        html = '<span class="sentence">' + html + '</span>'
        t.equal(_ast.toHTML(), html, _name('html mismatch'))
      }

      if (json !== undefined) {
        t.equal(_ast.toJSON(), json, _name('json mismatch'))
      }

      if (latex !== undefined) {
        t.equal(_ast.toLatex(), latex, _name('latex mismatch'))
      }

      if (markdown !== undefined) {
        t.equal(_ast.toMarkdown(), markdown, _name('markdown mismatch'))
      }

      t.end()
    })

  }
}
