// ":" | [A-Z] | "_" | [a-z] | [#xC0-#xD6] | [#xD8-#xF6] | [#xF8-#x2FF] | [#x370-#x37D] | [#x37F-#x1FFF] | [#x200C-#x200D] | [#x2070-#x218F] | [#x2C00-#x2FEF] | [#x3001-#xD7FF] | [#xF900-#xFDCF] | [#xFDF0-#xFFFD] | [#x10000-#xEFFFF]

const prs = str => {
  const ret = []
  const trimmed = str.split('|').map(s => s.trim())
  for (const t of trimmed) {
    if (t.startsWith('"')) ret.push(t[1])
    else if (t.startsWith('[')) {
      const [a, b] = t.slice(1, -1).split('-')
      ret.push([prcp(a), prcp(b)])
    }
  }
  return ret
}

const prcp = str => {
  if (str.startsWith('#x')) return String.fromCodePoint(Number.parseInt(str.slice(2), 16))
  return str
}


const prs2 = str => {
  const ret = []
  const trimmed = str.split('|').map(s => s.trim())
  for (const t of trimmed) {
    if (t.startsWith('"')) ret.push(t[1].codePointAt(0))
    else if (t.startsWith('[')) {
      const [a, b] = t.slice(1, -1).split('-')
      ret.push([prcp2(a), prcp2(b)])
    }
  }
  return ret
}

const prcp2 = str => {
  if (str.startsWith('#x')) return Number.parseInt(str.slice(2), 16)
  return str.codePointAt(0)
}

function jsonEscapeUTF(s) {return s.replace(/[^\x20-\x7F]/g, x => "\\u" + ("000"+x.codePointAt(0).toString(16)).slice(-4))}

console.log(JSON.stringify(prs(`":" | [A-Z] | "_" | [a-z] | [#xC0-#xD6] | [#xD8-#xF6] | [#xF8-#x2FF] | [#x370-#x37D] | [#x37F-#x1FFF] | [#x200C-#x200D] | [#x2070-#x218F] | [#x2C00-#x2FEF] | [#x3001-#xD7FF] | [#xF900-#xFDCF] | [#xFDF0-#xFFFD] | [#x10000-#xEFFFF]`)))
console.log(jsonEscapeUTF(JSON.stringify(prs(`":" | [A-Z] | "_" | [a-z] | [#xC0-#xD6] | [#xD8-#xF6] | [#xF8-#x2FF] | [#x370-#x37D] | [#x37F-#x1FFF] | [#x200C-#x200D] | [#x2070-#x218F] | [#x2C00-#x2FEF] | [#x3001-#xD7FF] | [#xF900-#xFDCF] | [#xFDF0-#xFFFD] | [#x10000-#xEFFFF]`))))
console.log((prs2(`":" | [A-Z] | "_" | [a-z] | [#xC0-#xD6] | [#xD8-#xF6] | [#xF8-#x2FF] | [#x370-#x37D] | [#x37F-#x1FFF] | [#x200C-#x200D] | [#x2070-#x218F] | [#x2C00-#x2FEF] | [#x3001-#xD7FF] | [#xF900-#xFDCF] | [#xFDF0-#xFFFD] | [#x10000-#xEFFFF]`)))