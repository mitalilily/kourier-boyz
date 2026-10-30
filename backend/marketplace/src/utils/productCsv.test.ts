import assert from 'node:assert/strict'
import { CsvParseError, csvBoolean, csvList, csvRowToRecord, parseCsv } from './productCsv'

const rows = parseCsv(
  '\uFEFFname,description,images\r\n"Desk, oak","A desk with a ""quoted"" note\nand two lines","https://example.test/a.jpg|https://example.test/b.jpg"\r\n',
)

assert.equal(rows.length, 2)
assert.deepEqual(rows[0], ['name', 'description', 'images'])
assert.deepEqual(rows[1], [
  'Desk, oak',
  'A desk with a "quoted" note\nand two lines',
  'https://example.test/a.jpg|https://example.test/b.jpg',
])
assert.deepEqual(csvRowToRecord(rows[0], rows[1]), {
  name: 'Desk, oak',
  description: 'A desk with a "quoted" note\nand two lines',
  images: 'https://example.test/a.jpg|https://example.test/b.jpg',
})
assert.deepEqual(csvList(rows[1][2]), ['https://example.test/a.jpg', 'https://example.test/b.jpg'])
assert.equal(csvBoolean('YES'), true)
assert.equal(csvBoolean('0'), false)
assert.equal(csvBoolean('not-a-boolean'), undefined)
assert.throws(() => parseCsv('name\n"unclosed'), CsvParseError)

console.log('productCsv tests passed')
