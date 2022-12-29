
const wrap = (str, maxbuflen = 256) => {
  const iter = str[Symbol.iterator]()
  const buf = []
  let rewindex = 0

  return {
    next() {
      if (rewindex < 0) return buf.flat(rewindex++)
      const next = iter.next()
      if (buf.length > maxbuflen) buf.shift()
      // todo: maybe push next.value ?? next.done instead
      buf.push(next)
      return next // or next.value ?? next.done
    },
    rewind(d) {
      rewindex += d
      if (buf.length + rewindex < 0) throw Error(`Can't rewind beyond buffer length (${buf.length}, max: ${maxbuflen})!`)
    }
  }
}


const t = `เจมส์`

const iter = wrap(t)
while (true) {
  const next = iter.next()
  console.log(next)
  if (next.done) break
}
