

// todo: backtracking on the edge of chunk
// todo: eof as character (.end())

const noop = () => {}

const replaceEntities = (str) => {
  let ret = '', mode = 'normal', ent = '', t = 0
  for (let i = 0; i < str.length; ++i) {
    const c = str[i]
    if (mode === 'normal') {
      if (c === '&') {
        ret += str.slice(t, i)
        t = i + 1
        mode = 'ent'
      }
    } else {
      if (c === ';') {
        ent = str.slice(t, i)
        ret += resolveEntity(ent)
        t = i + 1
        mode = 'normal'
      }
    }
  }
  ret += str.slice(t)
  return ret
}
const resolveEntity = (ent) => {
  if (ent === 'lt') return '<'
  if (ent === 'gt') return '>'
  if (ent === 'quot') return '"'
  if (ent === 'apos') return "'"
  if (ent === 'amp') return "&"
  throw Error(`Unknown entity: ${ent}`)
}

export const resolveEntity2 = (ent) => {
  if (ent === '&lt;') return '<'
  if (ent === '&gt;') return '>'
  if (ent === '&quot;') return '"'
  if (ent === '&apos;') return "'"
  if (ent === '&amp;') return "&"
  throw Error(`Unknown entity: ${ent}`)
}

export const fnlxml = (next) => {
  const ccbs = new Set()
  const registerChunkCb = (cb) => {
    ccbs.add(cb)
    return () => {
      return ccbs.delete(cb)
    }
  }

  let currentChunk
  const getCurrentChunk = () => {
    return currentChunk
  }

  const todo = (str) => lit(str)
  const document = (ii) => seq([[prolog], [element], zom(Misc)], ii)
  const seq = (its, ii = -1, ondone = noop, p = 0) => {
    const eat = (c, i) => {
      const rit = its[p]
      if (Array.isArray(rit)) {
        console.log("RIT", rit, ii)
        const jj = i - 1 //ii === -1? i - 1: ii
        its[p] = rit[0](jj)
      }
      const it = its[p]
      if (it === undefined) console.log(it, p, its, its.length)
      const [sname, j] = it(c, i)
      if (sname === 'fail') return ['fail', j]
      if (sname === 'done') {
        p += 1
        if (p >= its.length) {
          // console.log("DONE", p)
          // p = 0

          // todo: perhaps return result of ondone along w/ status & j
          ondone(i)
          return ['done', j]
        }
      }
      return ['pending', j]
    }
    return eat
  }

  const alt = (its, ii = -1, p = 0) => {
    const eat = (c, i) => {
      if (ii === -1) ii = i - 1
      const rit = its[p]
      if (Array.isArray(rit)) {
        console.log('ALTRIT')
        its[p] = rit[0](ii)
      }
      const it = its[p]
      const s = it(c, i)
      const [sname, j] = s
      if (sname === 'fail') {
        p += 1
        if (p >= its.length) {
          console.log('alt failing')
          return ['fail', j]
        }
        return ['pending', ii]
      }
      return [sname, j]
    }
    return eat
  }
  
  const zom = (itc, ii = -1, ondone = noop, it = itc(ii)) => {
    const eat = (c, i) => {
      // todo: fix this -- because it doesn't return i, instead of </rss> for ETag we get ""
      if (c === undefined) return ['done']
      if (ii === -1) ii = i - 1
      const [sname, j] = it(c, i)
      if (sname === 'fail') {
        console.log('zom done')
        ondone(i)
        return ['done', ii]
      }
      if (sname === 'done') {
        ii = j
        it = itc(j)
      }
      return ['pending', j]
    }
    return eat
  }
  // note: a variant of zom -- keep in sync
  const oom = (itc, it = itc(), ii = -1) => {
    let cnt = 0
    const eat = (c, i) => {
      if (ii === -1) ii = i - 1
      const [sname, j] = it(c, i)
      if (sname === 'fail') {
        if (cnt === 0) return ['fail', i]
        console.log('oom done')
        return ['done', ii]
      }
      if (sname === 'done') {
        ii = j
        cnt += 1
        it = itc()
      }
      return ['pending', j]
    }
    return eat
  }
  // note: a variant of zom -- keep in sync
  // atm important difference: zom and oom are called w X, opt is called w/ X()
  const opt = (it, ii = -1) => {
    const eat = (c, i) => {
      if (ii === -1) ii = i - 1
      const [sname, j] = it(c, i)
      if (sname === 'fail') return ['done', ii]
      if (sname === 'done') return ['done', j]
      return ['pending', j]
    }
    return eat
  }


  // todo: use shouldReplaceEntities = true where applicable
  const emits = (name, ii, fn, shouldReplaceEntities = false) => {
    let chunks = [getCurrentChunk()]
    const uccb = registerChunkCb((chunk) => {
      // could also emit event with partial result for each chunk rather than hold onto all chunks until complete CharData (or whatever) is parsed
      chunks.push(chunk)
    })

    const ondone = (jj) => {
      console.log(chunks)
      const lastChunk = chunks.at(-1)
      const lcl = lastChunk.length
      const combined = chunks.join('')
      // note: slice(_, here) off by one compared to content()
      const slice = combined.slice(ii + 1, -lcl + jj + 1)

      chunks = []

      console.log(`${name} DONE`)

      next.emit(name, shouldReplaceEntities? replaceEntities(slice): slice)
      return uccb()
    }

    return (c, i) => {
      const ret = fn(c, i)
      if (ret[0] === 'done') {
        const r = ondone(ret[1])
        if (r === false) throw Error('oops')
      }
      return ret
    }
  }

  const prolog = (ii) => seq([
    [ii => opt(XMLDecl(ii))],
    zom(Misc),
    opt(seq([doctypedecl(), zom(Misc)]))
  ], ii)

  const XMLDecl = (ii) => seq([
    lit('<?xml'),
    VersionInfo(),
    opt(EncodingDecl()),
    opt(SDDecl()),
    opt(S()),
    lit('?>'),
  ], ii)

  const VersionInfo = (ii) => seq([
    S(),
    lit('version'),
    Eq(),
    // todo: see XML grammar
    alt([
      lit("'1.0'"),
      lit('"1.0"'),
    ]),
  ], ii)

  const EncodingDecl = () => todo("EncodingDecl")
  const SDDecl = () => todo("SDDecl")

  const Misc = (ii) => alt([
    [Comment],
    PI(),
    S(),
  ], ii)

  const doctypedecl = (ii) => seq([
    lit('<!DOCTYPE'),
    S(),
    Name(),
    opt(seq([S(), ExternalID()])),
    opt(S()),
    opt(seq([char('['), intSubset(), char(']'), opt(S())])),
    char('>'),
  ], ii)

  const ExternalID = () => todo('ExternalID')
  const intSubset = () => todo('intSubset')

  const element = (ii) => {
    console.log("ELELEMENENT2")
    return seq([
      [STag1], 
      alt([
        [EETagC],
        seq([[STagC], [content], [ETag]], -1)
      ]),
    ], ii)
  }

  const STag1 = (ii) => emits('STag1', ii, seq([
    char('<'),
    [ii => emits('STagName', ii, Name(ii))],
    zom(() => seq([S(), [Attribute]])),
    opt(S()),
  ], ii))

  const STagC = (ii) => char('>')
  const EETagC = (ii) => lit('/>')

  // const element = (ii) => {
  //   console.log("ELELEMENENT")
  //   return alt([
  //     EmptyElemTag(), 
  //     seq([[STag], [content], [ETag]], -1),
  //   ], ii)
  // }

  // const EmptyElemTag = (ii) => seq([
  //   char('<'), 
  //   Name(), 
  //   zom(() => seq([S(), [Attribute]])), 
  //   opt(S()), 
  //   lit('/>'),
  // ], ii)

  // const STag = (ii) => emits('STag', ii, seq([
  //   char('<'),
  //   Name(),
  //   zom(() => seq([S(), [Attribute]])),
  //   opt(S()),
  //   char('>'),
  // ], ii))

  const ETag = (ii) => emits('ETag', ii, seq([
    lit('</'),
    [ii => emits('ETagName', ii, Name(ii))],
    opt(S()),
    char('>'),
  ], ii))

  const content = (ii) => emits('content', ii, seq([
    [ii => opt(CharData(ii))],
    // opt(CharData(ii)),
    zom(() => seq([
      alt([
        [element],
        [Reference],
        [CDSect],
        [PI],
        [Comment],
      ], -1),
      [ii => opt(CharData(ii))],
    ]))
  ], ii))
  
  // {
  //   let chunks = [getCurrentChunk()]
  //   const uccb = registerChunkCb((chunk) => {
  //     chunks.push(chunk)
  //   })

  //   const ondone = (jj) => {
  //     console.log(chunks)
  //     const lastChunk = chunks.at(-1)
  //     const lcl = lastChunk.length
  //     const combined = chunks.join('')
  //     const slice = combined.slice(ii + 1, -lcl + jj - 1)

  //     chunks = []

  //     console.log('onDONWE')

  //     next.emit('content', slice)
  //     return uccb()
  //   }
  //   return seq([
  //     // [ii => opt(CharData(ii))],
  //     opt(CharData(ii)),
  //     zom(() => seq([
  //       alt([
  //         [element],
  //         Reference(),
  //         CDSect(),
  //         PI(),
  //         Comment(),
  //       ], -1),
  //       [ii => opt(CharData(ii))],
  //     ]))
  //   ], ii, ondone)
  // }

  const Name = (ii) => seq([NameStartChar(), zom(NameChar)], ii)
  const Attribute = (ii) => emits('Attribute', ii, seq([
    [ii => emits('AttName', ii, Name(ii))], 
    Eq(), 
    [AttValue],
  ], ii))
  const Eq = (ii) => seq([opt(S()), char('='), opt(S())], ii)
  // const AttValue = (ii) => alt([
  //   seq([char('"'), [ii => emits(
  //     'AttValue', ii, zom(() => alt([
  //       not('<&"'),
  //       [Reference],
  //     ]), ii), true
  //   )], char('"')]),
  //   seq([char("'"), [ii => emits(
  //     'AttValue', ii, zom(() => alt([
  //       not("<&'"),
  //       [Reference],
  //     ]), ii), true
  //   )], char("'")]),
  // ], ii)

  const AttValue = (ii) => alt([
    seq([char('"'), seq([
      [QAC],
      zom(() => seq([[Reference], [QAC]]))
    ]), char('"')]),
    seq([char("'"), seq([
      [AAC],
      zom(() => seq([[Reference], [AAC]]))
    ]), char("'")]),
  ], ii)

  const QAC = (ii) => emits('AttValue', ii, zom(() => not('<&"'), ii))
  const AAC = (ii) => emits('AttValue', ii, zom(() => not("<&'"), ii))

  const charsUntilToken = (end) => (ii) => {
    let cend = lit(end)
    let cnt = 0
    const itc = Char
    let it = Char(ii)
    return (c, i) => {
      if (ii === -1) ii = i - 1

      const es = cend(c, i)
      if (es[0] === 'fail') {
        cend = lit(end)
      } else if (es[0] === 'done') {
        console.log('DONE', es)
        return [es[0], es[1] - end.length]
      }

      const [sname, j] = it(c, i)
      if (sname === 'fail') {
        if (cnt === 0) return ['fail', i]
        console.log('oom done')
        return ['done', ii]
      }
      if (sname === 'done') {
        ii = j
        cnt += 1
        it = itc()
      }
      return ['pending', j]
    }
  }

  // todo: CharData ::= [^<&]* - ( [^<&]* ']]>' [^<&]* )
  // https://www.w3.org/TR/2008/REC-xml-20081126/#syntax
  // could parametrize charsUntilToken(end, itc = Char)
  // pass () => not('<&') as itc -- that would do it
  // this rule is for compatibility w/ SGML
  const CharData = (ii) => emits('CharData', ii, zom(() => not('<&'), ii), true)

  const CDSect = (ii) => seq([
    [ii => emits('openCData', ii, lit('<![CDATA['))], 
    [CData], 
    [ii => emits('closeCData', ii, lit(']]>'))],
  ], ii)
  // const CData = (ii) => oom(Char)
  const CData = (ii) => emits('CData', ii, charsUntilToken(']]>')(ii)) 
  const Char = (ii) => codePointRanges(0x09, 0x0A, 0x0D, [0x20, 0xD7FF], [0xE000, 0xFFFD], [0x10000, 0x10FFFF])
  const PI = () => seq([
    lit('<?'),
    [PITarget],
    opt(seq([
      [S],
      // todo: same as comment & cdata, except should probly backtrack to before ?> after it's found
      // or is that overcomplicating it?
      // this PITarget and S create a problem here
      [charsUntilToken('?>')],
    ])),
    lit('?>'),
  ])

  // todo: PITarget ::= Name - ( ( 'X' | 'x' ) ( 'M' | 'm' ) ( 'L' | 'l' ) )
  const PITarget = Name
  const Comment = (ii) => emits('Comment', ii, seq([
    lit('<!--'),
    [charsUntilToken('-->')],
    lit('-->'),
  ], ii))

  const not = (chars) => (c, i) => {
    if (chars.includes(c)) return ['fail', i]
    return ['done', i]
  }

  const Reference = (ii) => emits('Reference', ii, alt([
    [EntityRef],
    [CharRef],
  ], ii))

  const EntityRef = (ii) => seq([
    char('&'),
    [Name],
    char(';'),
  ])
  const CharRef = (ii) => alt([
    seq([
      lit('&#'),
      oom(range('0', '9')),
      char(';')
    ]),
    seq([
      lit('&#x'),
      oom(ranges(['0', '9'], ['a', 'f'], ['A', 'F'])),
      char(';')
    ])
  ])

  const NameStartChar = (ii) => alt([
    char(':'),
    range('A', 'Z'),
    char('_'),
    range('a', 'z'),
    // todo: other ranges
  ], ii)
  const NameChar = (ii) => alt([
    NameStartChar(),
    char('-'),
    char('.'),
    range('0', '9'),
    // range('0', '9'),
    // todo: other ranges
  ], ii)

  const S = () => oom(() => alt([
    char('\u0020'), 
    char('\u0009'), 
    char('\u000D'), 
    char('\u000A'),
  ]))

  // `<Name Attribute/>`

  const char = (h) => (c, i) => {
    if (h === c) return ['done', i]
    return ['fail', i]
  }
  const range = (a, b) => (c, i) => {
    if (c >= a && c <= b) return ['done', i]
    return ['fail', i]
  }
  const ranges = (...ranges) => (c, i) => {
    for (const [a, b] of ranges) {
      if (c >= a && c <= b) return ['done', i]
    }
    return ['fail', i]
  }
  const codePointRanges = (...ranges) => (c, i) => {
    const ccp = c.codePointAt(0)
    for (const p of ranges) {
      if (Array.isArray(p)) {
        const [a, b] = p
        if (ccp >= a && ccp <= b) return ['done', i]
      } else if (ccp === p) return ['done', i]
    }
    return ['fail', i]
  }
  const lit = (str, index = 0) => (c, i) => {
    if (str[index] === c) {
      ++index
      if (index >= str.length) return ['done', i]
      console.log(str, index, i)
      return ['pending', i]
    }
    return ['fail', i]
  }



  let status

  const start = document(0, next)

  return {
    chunk(str) {
      currentChunk = str
      for (const cb of ccbs) {
        cb(str)
      }
      for (let i = 0; i < str.length; ++i) {
        const c = str[i]
        status = start(c, i)
        i = status[1]
        if (i < 0) throw Error('buffer underflow!')
        if (status[0] === 'fail') throw Error(`Unexpected status: ${status}`)
        else if (status[0] === 'done' && i != str.length - 1) throw Error(`done too early ${i} ${str.slice(i)}`)
      }
    },
    end() {
      status = start()
      const [sname, c] = status
      if (sname === 'done') return next.end()
      // todo: fix
      // if (sname === 'done' && c === undefined) return next.end()

      throw Error(`Unexpected end status: ${sname}`)
    }
  }
}

