

// todo: backtracking on the edge of chunk
// todo: eof as character (.end())

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

// note: entities in HTML are ASCII-case-insensitive
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

  const seq = (its_, debugName) => (ii = null) => {
    let its = [...its_]
    let p = 0
    // console.log("SEQ INIT", p, ii, debugName)
    if (Array.isArray(its[p]) && ii !== null) {

      // hm? ii or ii - 1
      const jj = ii
      its[p] = its[p][0](jj)
    }
    const eat = (c, i) => {
      // console.log("SEQ", c, i, ii, debugName, p)
      const rit = its[p]
      if (Array.isArray(rit)) {
        // const jj = i - 1
        const jj = i
        its[p] = rit[0](jj)
      }
      const it = its[p]
      const [sname, j] = it(c, i)
      if (sname === 'fail') return ['fail', j]
      if (sname === 'done') {
        p += 1
        // console.log("SEQ DONE 1", c, i, debugName, p)
        if (p >= its.length) {
          // console.log("SEQ DONE", c, i, debugName, p)
          return ['done', j]
        }
      }
      return ['pending', j]
    }
    return eat
  }

  const alt = (its_, debugName) => (ii = null) => {
    let its = [...its_]
    let p = 0
    // console.log("ALT INIT", ii, its, debugName)
    const eat = (c, i) => {
      // console.log("ALT", c, i, debugName)
      // if (ii === null) ii = i - 1
      if (ii === null) ii = i
      const rit = its[p]
      if (Array.isArray(rit)) {
        its[p] = rit[0](ii)
      }
      const it = its[p]
      // if (typeof it !== 'function') console.log(it, its, its.length, p)
      const s = it(c, i)
      const [sname, j] = s
      if (sname === 'fail') {
        p += 1
        if (p >= its.length) {
          return ['fail', j]
        }
        return ['pending', ii]
      }
      return [sname, j]
    }
    return eat
  }
  
  const zom = (itc) => (ii = null) => {
    let it = itc(ii)
    // console.log("ZOM INIT", ii)
    const eat = (c, i) => {
      // console.log("ZOM", c, i)
      if (c === undefined) {
        return ['done', i]
      }
      // if (ii === null) ii = i - 1
      if (ii === null) ii = i
      const [sname, j] = it(c, i)
      if (sname === 'fail') {
        // console.log("ZOM FAIL", c, i, ii)
        return ['done', ii]
      }
      if (sname === 'done') {
        ii = j
        // ii = j + 1
        it = itc(j)
      }
      return ['pending', j]
    }
    return eat
  }
  // note: a variant of zom -- keep in sync
  const oom = (itc, debugName) => (ii = null) => {
    // console.log("OOOM INIT", ii, debugName)
    let cnt = 0
    let it = itc(ii)
    const eat = (c, i) => {
      // console.log("OOOM", ii, c, i, debugName)
      // if (ii === -1) ii = i - 1
      if (ii === null) ii = i
      const [sname, j] = it(c, i)
      if (sname === 'fail') {
        // if (cnt === 0) return ['fail', i]
        if (cnt === 0) return ['fail', j]
        // console.log('oom done')
        return ['done', ii]
      }
      if (sname === 'done') {
        ii = j
        // ii = j + 1
        cnt += 1
        it = itc(ii)
      }
      return ['pending', j]
    }
    return eat
  }
  // note: a variant of zom -- keep in sync
  // atm important difference: zom and oom are called w X, opt is called w/ X()
  const opt = (itc) => (ii = null) => {
    // console.log("OPT INIT", ii)
    let it = itc(ii)
    const eat = (c, i) => {
      // if (ii === null) ii = i - 1
      if (ii === null) ii = i
      const [sname, j] = it(c, i)
      if (sname === 'fail') {
        // console.log("OPT ABSENT", ii)
        return ['done', ii]
      }
      if (sname === 'done') return ['done', j]
      return ['pending', j]
    }
    return eat
  }

  const charsUntilToken = (token) => (ii = null) => {
    let cend = lit(token)(ii)
    let cnt = 0
    const itc = Char
    let it = Char(ii)
    return (c, i) => {
      // if (ii === -1) ii = i - 1
      if (ii === null) ii = i

      const es = cend(c, i)
      if (es[0] === 'fail') {
        cend = lit(token)(ii)
      } else if (es[0] === 'done') {
        // console.log('DONE', es)
        // console.log("*************\n\n\n", es[1] - token.length, '\n\n\n*********')
        return [es[0], es[1] - token.length]
      }

      const [sname, j] = it(c, i)
      if (sname === 'fail') {
        // if (cnt === 0) return ['fail', i]
        if (cnt === 0) return ['fail', j]
        // console.log('oom done')
        return ['done', ii]
      }
      if (sname === 'done') {
        ii = j
        // ii = j + 1
        cnt += 1
        it = itc(ii)
      }
      return ['pending', j]
    }
  }

  const not = (chars) => ii => (c, i) => {
    if (chars.includes(c)) return ['fail', i]
    // return ['done', i]
    return ['done', i + 1]
  }

  const char = (h) => (ii) => {
    // console.log("CHAR INIT", h, ii)
    return (c, i) => {
      // console.log("CHAR", h, c, ii)
      if (h === c) return ['done', i + 1]
      return ['fail', i]
    }
  }
  const range = (a, b) => ii => (c, i) => {
    if (c >= a && c <= b) return ['done', i + 1]
    return ['fail', i]
  }
  const ranges = (...ranges) => ii => (c, i) => {
    for (const [a, b] of ranges) {
      if (c >= a && c <= b) return ['done', i + 1]
    }
    return ['fail', i]
  }
  const ranges2 = (...ranges) => ii => (c, i) => {
    for (const p of ranges) {
      if (Array.isArray(p)) {
        const [a, b] = p
        if (c >= a && c <= b) return ['done', i + 1]
      } else if (c === p) return ['done', i + 1]
    }
    return ['fail', i]
  }
  const codePointRanges = (...ranges) => ii => (c, i) => {
    const ccp = c.codePointAt(0)
    for (const p of ranges) {
      if (Array.isArray(p)) {
        const [a, b] = p
        if (ccp >= a && ccp <= b) return ['done', i + 1]
      } else if (ccp === p) return ['done', i + 1]
    }
    return ['fail', i]
  }
  const lit = (str) => ii => {
    let index = 0
    return (c, i) => {
      // console.log("LIT", i, c, str, index)
      if (str[index] === c) {
        ++index
        if (index >= str.length) return ['done', i + 1]
        // console.log(str, index, i)
        return ['pending', i + 1]
      }
      return ['fail', i]
    }
  }

  const emits = (name, fn) => ii => {
    // console.log('EMITS INIT', name, ii)
    let chunks = [getCurrentChunk()]
    const uccb = registerChunkCb((chunk) => {
      // could also emit event with partial result for each chunk rather than hold onto all chunks until complete CharData (or whatever) is parsed
      chunks.push(chunk)
    })

    const ondone = (jj) => {
      const lastChunk = chunks.at(-1)
      const lcl = lastChunk.length
      const combined = chunks.join('')
      const endi = -lcl + jj
      const slice = combined.slice(
        ii, 
        // note: endi of the very last thing will be 0 which would give the wrong result here
        // ?todo: optimize this check -- don't do it for every single emitter, just the last one (if possible)
        endi === 0? undefined: endi,
      )

      chunks = []

      // todo: if no next.emit then entire emits is pointless -- exit early/make it a noop
      next.emit?.(name, slice)
      return uccb()
    }

    let it = fn(ii)

    return (c, i) => {
      const ret = it(c, i)
      if (ret[0] === 'done') {
        const r = ondone(ret[1])
        if (r === false) throw Error('oops')
      }
      return ret
    }
  }

  ///////////
  // RULES //
  ///////////

  const todo = lit

  const S = oom(alt([
    [char('\u0020')], 
    [char('\u0009')], 
    [char('\u000D')], 
    [char('\u000A')],
  ], 'SSSSSSSSSSSs'), 'SSSSSS')
  const Eq = seq([[opt(S)], [char('=')], [opt(S)]])
  // '1.' [0-9]+
  const VersionNum = seq([
    [lit('1.')],
    [oom(range('0', '9'))],
  ])
  //  S 'version' Eq ("'" VersionNum "'" | '"' VersionNum '"')
  const VersionInfo = seq([
    [S],
    [lit('version')],
    [Eq],
    [alt([
      [seq([[char("'")], [VersionNum], [char("'")]])],
      [seq([[char('"')], [VersionNum], [char('"')]])],
    ])],
  ])
  // [A-Za-z] ([A-Za-z0-9._] | '-')*    /* Encoding name contains only Latin characters */
  const EncName = seq([
    [ranges(['A', 'Z'], ['a', 'z'])],
    [zom(alt([
      [ranges(['A', 'Z'], ['a', 'z'], ['0', '9'])],
      [char('.')],
      [char('_')],
      [char('-')],
    ], 'ENNENENNENEN'))]
  ], 'EncName')
  // S 'encoding' Eq ('"' EncName '"' | "'" EncName "'" )
  const EncodingDecl = seq([
    [S],
    [lit('encoding')],
    [Eq],
    [alt([
      [seq([[char("'")], [EncName], [char("'")]])],
      [seq([[char('"')], [EncName], [char('"')]])],
    ])]
  ])

  // S 'standalone' Eq (("'" ('yes' | 'no') "'") | ('"' ('yes' | 'no') '"'))     [VC: Standalone Document Declaration]
  const SDDecl = seq([
    [S],
    [lit('standalone')],
    [Eq],
    [alt([
      [seq([[char("'")], [alt([[lit('yes')], [lit('no')]])], [char("'")]])],
      [seq([[char('"')], [alt([[lit('yes')], [lit('no')]])], [char('"')]])],
    ])]
  ])
  const XMLDecl = seq([
    [lit('<?xml')],
    [VersionInfo],
    [opt(EncodingDecl)],
    [opt(SDDecl)],
    [opt(S)],
    [lit('?>')],
  ], 'XMLDEcl')
  // ":" | [A-Z] | "_" | [a-z] | [#xC0-#xD6] | [#xD8-#xF6] | [#xF8-#x2FF] | [#x370-#x37D] | [#x37F-#x1FFF] | [#x200C-#x200D] | [#x2070-#x218F] | [#x2C00-#x2FEF] | [#x3001-#xD7FF] | [#xF900-#xFDCF] | [#xFDF0-#xFFFD] | [#x10000-#xEFFFF]
  const NameStartChar = ranges2(":",["A","Z"],"_",["a","z"],["\u00c0","\u00d6"],["\u00d8","\u00f6"],["\u00f8","\u02ff"],["\u0370","\u037d"],["\u037f","\u1fff"],["\u200c","\u200d"],["\u2070","\u218f"],["\u2c00","\u2fef"],["\u3001","\ud7ff"],["\uf900","\ufdcf"],["\ufdf0","\ufffd"],["\ud800\udc00","\udb7f\udfff"])
  
  //ranges2(":",["A","Z"],"_",["a","z"],["À","Ö"],["Ø","ö"],["ø","˿"],["Ͱ","ͽ"],["Ϳ","῿"],["‌","‍"],["⁰","↏"],["Ⰰ","⿯"],["、","퟿"],["豈","﷏"],["ﷰ","�"],["𐀀","󯿿"])
  
  // codePointRanges(
  //   58,               [ 65, 90 ],
  //   95,               [ 97, 122 ],
  //   [ 192, 214 ],     [ 216, 246 ],
  //   [ 248, 767 ],     [ 880, 893 ],
  //   [ 895, 8191 ],    [ 8204, 8205 ],
  //   [ 8304, 8591 ],   [ 11264, 12271 ],
  //   [ 12289, 55295 ], [ 63744, 64975 ],
  //   [ 65008, 65533 ], [ 65536, 983039 ]
  // )
  
  // alt([
  //   char(':'),
  //   range('A', 'Z'),
  //   char('_'),
  //   range('a', 'z'),
  //   // todo: other ranges
  // ], ii)
  // NameStartChar | "-" | "." | [0-9] | #xB7 | [#x0300-#x036F] | [#x203F-#x2040]
  const NameChar = alt([
    [NameStartChar],
    [char('-')],
    [char('.')],
    [range('0', '9')],
    [char('\xB7')],
    [range('\u0300', '\u036F')],
    [range('\u203F', '\u2040')],
  ])
  const Name = seq([[NameStartChar], [zom(NameChar)]], 'Name')
  // SystemLiteral ::= ('"' [^"]* '"') | ("'" [^']* "'")
  const SystemLiteral = alt([
    [seq([
      [char('"')],
      [zom(not('"'))],
      [char('"')],
    ])],
    [seq([
      [char("'")],
      [zom(not("'"))],
      [char("'")],
    ])],
  ])
  // #x20 | #xD | #xA | [a-zA-Z0-9] | [-'()+,./:=?;!*#@$_%]
  const piclr = []
  const piclrstr = `-'()+,./:=?;!*#@$_%`
  for (let i = 0; i < piclrstr.length; ++i) {
    piclr.push(piclrstr.codePointAt(i))
  }
  const picaz = ['a'.codePointAt(0), 'z'.codePointAt(0)]
  const picAZ = ['A'.codePointAt(0), 'Z'.codePointAt(0)]
  const pic09 = ['0'.codePointAt(0), '9'.codePointAt(0)]
  const PubidChar = codePointRanges(0x20, 0xD, 0xA, picaz, picAZ, pic09,  ...piclrstr)
  // '"' PubidChar* '"' | "'" (PubidChar - "'")* "'"
  const PubidLiteral = alt([
    [seq([
      [char('"')],
      [zom(PubidChar)],
      [char('"')],
    ])],
    [seq([
      [char("'")],
      [zom(todo('PubidChar - "\'"'))],
      [char("'")],
    ])],
  ])
  // ExternalID ::= 'SYSTEM' S SystemLiteral | 'PUBLIC' S PubidLiteral S SystemLiteral
  const ExternalID = alt([
    [seq([
      [lit('SYSTEM')],
      [S],
      [SystemLiteral],
    ])],
    [seq([
      [lit('PUBLIC')],
      [S],
      [PubidLiteral],
      [S],
      [SystemLiteral]
    ])]
  ])
  // '(' S? '#PCDATA' (S? '|' S? Name)* S? ')*' | '(' S? '#PCDATA' S? ')'
  const Mixed = alt([
    [seq([
      [char('(')],
      [opt(S)],
      [lit('#PCDATA')],
      [zom(seq([
        [opt(S)],
        [char('|')],
        [opt(S)],
        [Name],
      ]))],
      [opt(S)],
      [lit(')*')],
    ])],
    [seq([
      [char('(')],
      [opt(S)],
      [lit('#PCDATA')],
      [opt(S)],
      [char(')')],
    ])],
  ])// note: hack
  // ?todo: rem
  const CATCHALL = seq([
    [lit('<!')],
    [zom(not('>'))],
    [char('>')],
  ])
  // (Name | choice | seq) ('?' | '*' | '+')?
  const cp = ii => seq([
    [alt([
      [Name],
      [choice],
      [Seq],
    ])],
    [opt(alt([
      [char('?')],
      [char('*')],
      [char('+')],
    ]))]
  ])(ii)
  // '(' S? cp ( S? '|' S? cp )+ S? ')'    [VC: Proper Group/PE Nesting]
  const choice = seq([
    [char('(')],
    [opt(S)],
    [cp],
    [oom(seq([
      [opt(S)],
      [char('|')],
      [opt(S)],
      [cp],
    ]))],
    [opt(S)],
    [char(')')],
  ])
  // '(' S? cp ( S? ',' S? cp )* S? ')'    [VC: Proper Group/PE Nesting]
  const Seq = seq([
    [char('(')],
    [opt(S)],
    [cp],
    [zom(seq([
      [opt(S)],
      [char(',')],
      [opt(S)],
      [cp],
    ]))],
    [opt(S)],
    [char(')')],
  ])
  // (choice | seq) ('?' | '*' | '+')?
  const children = seq([
    [alt([
      [choice],
      [Seq],
    ])],
    [opt(alt([
      [char('?')],
      [char('*')],
      [char('+')],
    ]))]
  ])
  // 'EMPTY' | 'ANY' | Mixed | children
  const contentspec = alt([
    [lit('EMPTY')],
    [lit('ANY')],
    [Mixed],
    [children],
  ])
  // '<!ELEMENT' S Name S contentspec S? '>'    [VC: Unique Element Type Declaration]
  const elementdecl = seq([
    [lit('<!ELEMENT')],
    [S],
    [Name],
    [S],
    [contentspec],
    [opt(S)],
    [char('>')],
  ])
  // '<!ATTLIST' S Name AttDef* S? '>'
  const AttlistDecl = todo('AttlistDecl')

  // '%' Name ';'   
  const PEReference = seq([
    [char('%')],
    [Name],
    [char(';')],
  ])
  const EntityRef = seq([
    [char('&')],
    [Name],
    [char(';')],
  ])
  const CharRef = alt([
    [seq([
      [lit('&#')],
      [oom(range('0', '9'))],
      [char(';')],
    ])],
    [seq([
      [lit('&#x')],
      [oom(ranges(['0', '9'], ['a', 'f'], ['A', 'F']))],
      [char(';')],
    ])]
  ])
  const Reference = emits('Reference', alt([
    [EntityRef],
    [CharRef],
  ]))
  // '"' ([^%&"] | PEReference | Reference)* '"' |  "'" ([^%&'] | PEReference | Reference)* "'"
  const EntityValue = alt([
    [seq([
      [char('"')],
      [zom(alt([
        [not('%&"')],
        [PEReference],
        [Reference],
      ], '(((((((DEBUG))))))))evn'))],
      [char('"')],
    ])],
    [seq([
      [char("'")],
      [zom(alt([
        [not("%&'")],
        [PEReference],
        [Reference],
      ], '(((((((((((((((((((('))],
      [char("'")],
    ])],
  ])
  const NDataDecl = todo('NDataDecl')
  // EntityValue | (ExternalID NDataDecl?)
  const EntityDef = alt([
    [EntityValue],
    [seq([
      [ExternalID],
      [opt(NDataDecl)],
    ])]
  ])
  // '<!ENTITY' S Name S EntityDef S? '>'
  const GEDecl = seq([
    [lit('<!ENTITY')],
    [S],
    [Name],
    [S],
    [EntityDef],
    [opt(S)],
    [char('>')],
  ])
  // EntityValue | ExternalID
  const PEDef = alt([
    [EntityValue],
    [ExternalID],
  ])
  // '<!ENTITY' S '%' S Name S PEDef S? '>'
  const PEDecl = seq([
    [lit('<!ENTITY')],
    [S],
    [char('%')],
    [S],
    [Name],
    [S],
    [PEDef],
    [opt(S)],
    [char('>')],
  ])
  // GEDecl | PEDecl
  const EntityDecl = alt([
    [GEDecl],
    [PEDecl],
  ])
  const NotationDecl = todo('NotationDecl')
  // todo: PITarget ::= Name - ( ( 'X' | 'x' ) ( 'M' | 'm' ) ( 'L' | 'l' ) )
  const PITarget = Name
  const PI = seq([
    [lit('<?')],
    [PITarget],
    [opt(seq([
      [S],
      // todo: same as comment & cdata, except should probly backtrack to before ?> after it's found
      // or is that overcomplicating it?
      // this PITarget and S create a problem here
      [charsUntilToken('?>')],
    ]))],
    [lit('?>')],
  ], 'PI')
  const Comment = emits('Comment', seq([
    [lit('<!--')],
    [charsUntilToken('-->')],
    [lit('-->')],
  ], 'COMMENT'))
  // elementdecl | AttlistDecl | EntityDecl | NotationDecl | PI | Comment     [VC: Proper Declaration/PE Nesting]
  const markupdecl = alt([
    [elementdecl],
    [AttlistDecl],
    [EntityDecl],
    [NotationDecl],
    [PI],
    [Comment],
    [CATCHALL],
  ])
  // PEReference | S     [WFC: PE Between Declarations]
  const DeclSep = alt([
    [PEReference],
    [S],
  ])
  // (markupdecl | DeclSep)*
  const intSubset = zom(alt([
    [markupdecl],
    [DeclSep],
  ], 'IIIIIIIIIIIIII'))
  const doctypedecl = seq([
    [lit('<!DOCTYPE')],
    [S],
    [Name],
    [opt(seq([[S], [ExternalID]]))],
    [opt(S)],
    [opt(seq([[char('[')], [intSubset], [char(']')], [opt(S)]]))],
    [char('>')],
  ])
  const Misc = alt([
    [Comment],
    [PI],
    [S],
  ], 'MISC')
  const prolog = seq([
    [opt(XMLDecl)],
    // opt(XMLDecl()),
    [zom(Misc)],
    [opt(seq([[doctypedecl], [zom(Misc)]]))],
  ], 'PROLOG')


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


  const QAC = emits('AttValue', zom(not('<&"')))
  const AAC = emits('AttValue', zom(not("<&'")))
  const AttValue = alt([
    [seq([[char('"')], [seq([
      [QAC],
      [zom(seq([[Reference], [QAC]]))]
    ])], [char('"')]])],
    [seq([[char("'")], [seq([
      [AAC],
      [zom(seq([[Reference], [AAC]]))]
    ])], [char("'")]])],
  ])
  const Attribute = emits('Attribute', seq([
    [emits('AttName', Name)], 
    [Eq], 
    [AttValue],
  ]))
  const STag1 = emits('STag1', seq([
    [char('<')],
    [emits('STagName', Name)],
    [zom(seq([[S], [Attribute]]))],
    [opt(S)],
  ]))

  const STagC = emits('STagC', char('>'))
  const EETagC = emits('EETagC', lit('/>'))

  const ETag = emits('ETag', seq([
    [lit('</')],
    [emits('ETagName', Name)],
    [opt(S)],
    [char('>')],
  ]))

  // todo: CharData ::= [^<&]* - ( [^<&]* ']]>' [^<&]* )
  // https://www.w3.org/TR/2008/REC-xml-20081126/#syntax
  // could parametrize charsUntilToken(end, itc = Char)
  // pass () => not('<&') as itc -- that would do it
  // this rule is for compatibility w/ SGML
  const CharData = emits('CharData', zom(not('<&')))
  // original: 
  // element ::= EmptyElemTag | STag content ETag 
  //  EmptyElemTag ::= '<' Name (S Attribute)* S? '/>'    [WFC: Unique Att Spec]
  // STag ::= '<' Name (S Attribute)* S? '>'    [WFC: Unique Att Spec]
  // ETag ::= '</' Name S? '>'

  // adjusted:
  // element ::= STag1 (EETagc | STagC content ETag)
  // the common part between STag and ETag:
  // STag1 ::= '<' Name (S Attribute)? (S Attribute)* S?
  // STagC ::= '>'
  // EETagC ::= '/>
  // const CData = (ii) => oom(Char)
  const element = ii => seq([
    [STag1], 
    [alt([
      [EETagC],
      [seq([[STagC], [content], [ETag]])],
    ])],
  ])(ii)
  const CData = emits('CData', charsUntilToken(']]>')) 
  const CDSect = seq([
    [emits('openCData', lit('<![CDATA['))], 
    [CData], 
    [emits('closeCData', lit(']]>'))],
  ])
  const content = emits('content', seq([
    [opt(CharData)],
    // opt(CharData(ii)),
    [zom(seq([
      [alt([
        [element],
        [Reference],
        [CDSect],
        [PI],
        [Comment],
      ])],
      [opt(CharData)],
    ]))],
  ]))
  const document = seq([
    // opt(ranges2('\xef\xbb\xbf', '\xfe\xff', '\xff\xfe'), 0), 
    [prolog], 
    [element], 
    [zom(Misc)],
  ], 'DOCUMNET')

  const Char = codePointRanges(0x09, 0x0A, 0x0D, [0x20, 0xD7FF], [0xE000, 0xFFFD], [0x10000, 0x10FFFF])





  // `<Name Attribute/>`



  let status, i = 0

  const start = document(0)

  return {
    chunk(str) {
      currentChunk = str
      for (const cb of ccbs) {
        cb(str)
      }
      i = 0
      for (; i < str.length; ) {
        const c = str[i]
        status = start(c, i)
        i = status[1]
        if (i < 0) throw Error(`can't backtrack to previous chunk(s)! ${i}`)
        if (status[0] !== 'pending') {
          if (status[0] === 'done' && i != str.length - 1) throw Error(`done too early ${i} ${str.slice(i)}`)
          else if (status[0] === 'fail') throw Error(`Unexpected status: ${status}`)
        }
      }
    },
    end() {
      status = start(undefined, i)
      const [sname, c] = status
      if (sname === 'done') return next.end?.()
      // todo: fix
      // if (sname === 'done' && c === undefined) return next.end()

      throw Error(`Unexpected end status: ${sname}`)
    }
  }
}

// for HTML-compat mode -- should be used in lit() and literals should be written in uppercase
export const toAsciiAzUppercase = (c) => {
  if (c >= 'a' && c <= 'z') {
    return String.fromCharCode(c.charCodeAt(0) - 0x20)
  }
  return c
}