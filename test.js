import {fnlxml, resolveEntity2} from './fnlxml.js'

// todo: find an xml test suite

const m = new Map()
const stream = fnlxml({
  end() {
    console.log('done')
    console.log(m)
    // console.log(m.get('CData')[0])
  },
  emit(...args) {
    if (m.has(args[0])) m.get(args[0]).push(args[1])
    else m.set(args[0], [args[1]])
    console.log('EMIT', args, `|${args[1].at(-1)}|`)
  }
})

// stream.chunk(`prolog()st()cont()...()zom(misc)`)
// stream.chunk(`prolog()eet()zom(misc)`)
// stream.chunk(`prolog()<zazam-zam bum = 'value' />zom(misc)`)
// stream.chunk(`prolog()<div bum = 'value'>something</div>zom(misc)`)
stream.chunk(`<?xml version="1.0"?>
<rss version="2.0">
<channel>
<title>Jevko updates</title>
<description>Latest official &quot;updates&quot; on the Jevko syntax</description>
<link>https://jevko.org</link>

<?app directions?>
<item t='u&amp;me'>
  <title>Sun, 20 Nov 2022 01:30:00 +0000</title>
  <!-- my comment here -->
  <link>https://github.com/jevko/jevkoml</link>
  <pubDate>Sun, 20 Nov 2022 01:30:00 +0000</pubDate>
  <description><![CDATA[<p>Created <a href="https://github.com/jevko/community">https://github.com/jevko/community</a> -- a place to feature various Jevko-related things (including Jevko parsers in different languages) created by various authors. Contributions welcome!</p>
  <p>#jevko #syntax #community #contributions</p>]]></description>
</item>
</channel>
</rss>`)

stream.end()
import {escape} from 'https://cdn.jsdelivr.net/gh/jevko/jevko.js@v0.1.5/mod.js'

const expected = `\\rss [version=[2.0]
\\channel [
\\title [Jevko updates]
\\description [Latest official "updates" on the Jevko syntax]
\\link [https://jevko.org]
\\esc [\`[\`\`\`]]


\\item [t=[u&me]
  \\title [Sun, 20 Nov 2022 01:30:00 +0000]
  
  \\link [https://github.com/jevko/jevkoml]
  \\pubDate [Sun, 20 Nov 2022 01:30:00 +0000]
  \\description [<p>Created <a href="https://github.com/jevko/community">https://github.com/jevko/community</a> -- a place to feature various Jevko-related things (including Jevko parsers in different languages) created by various authors. Contributions welcome!</p>
  <p>#jevko #syntax #community #contributions</p>]
]
]
]`

let ret = ''
let hasAttrs = false
const stream2 = fnlxml({
  end() {
    console.log('done')
    console.log(ret)
    console.assert(ret === expected)
  },
  emit(name, str_) {
    const str = escape(str_)
    if (name === 'STagName') ret += `\\${str} [`
    else if (name === 'AttValue') ret += str
    else if (name === 'Reference') ret += resolveEntity2(str)
    else if (name === 'Attribute') ret += `]`
    else if (name === 'ETagName') ret += `]`
    else if (name === 'CData') ret += str
    else if (name === 'CharData') ret += str

    else if (name === 'AttName') ret += `${str}=[`

    // else if (name === 'AttName') {
    //   if (hasAttrs === false) {
    //     hasAttrs = true
    //     ret += '['
    //   }
    //   ret += `${str} [`
    // }
    // else if (name === 'STagC' || name === 'EETagC') {
    //   if (hasAttrs) {
    //     ret += ']'
    //     hasAttrs = false
    //   }
    // }
    // else throw Error('oops' + name)
  }
})
stream2.chunk(`<?xml version="1.0"?>
<rss version="2.0">
<channel>
<title>Jevko updates</title>
<description>Latest official &quot;updates&quot; on the Jevko syntax</description>
<link>https://jevko.org</link>
<esc>[\`]</esc>

<?app directions?>
<item t='u&amp;me'>
  <title>Sun, 20 Nov 2022 01:30:00 +0000</title>
  <!-- my comment here -->
  <link>https://github.com/jevko/jevkoml</link>
  <pubDate>Sun, 20 Nov 2022 01:30:00 +0000</pubDate>
  <description><![CDATA[<p>Created <a href="https://github.com/jevko/community">https://github.com/jevko/community</a> -- a place to feature various Jevko-related things (including Jevko parsers in different languages) created by various authors. Contributions welcome!</p>
  <p>#jevko #syntax #community #contributions</p>]]></description>
</item>
</channel>
</rss>`)
stream2.end()