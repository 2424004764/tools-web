// 字符集清单：编码解码类工具（字符编码/解码、Base64 等）共用。
// 「其他」分组在加载时用 iconv-lite 实测过滤，只保留真正可用的编码名。
import { Buffer } from 'buffer'
import { decode as decodeBytes, encode as encodeText } from 'iconv-lite'

export interface CharsetOption {
  label: string
  value: string
}

export const commonCharsets: CharsetOption[] = [
  { label: 'UTF-8', value: 'UTF-8' },
  { label: 'UTF-16LE', value: 'UTF-16LE' },
  { label: 'UTF-16BE', value: 'UTF-16BE' },
  { label: 'GBK（简繁体）', value: 'GBK' },
  { label: 'GB18030（中日韩）', value: 'GB18030' },
  { label: 'Big5（台湾繁体中文）', value: 'Big5' },
]

const otherCharsetNames = [
  'ASMO-708', 'CP1025', 'CP866', 'CP875', 'DOS-720', 'DOS-862', 'EUC-JP',
  'IBM-THAI', 'IBM037', 'IBM273', 'IBM277', 'IBM278', 'IBM280', 'IBM284',
  'IBM285', 'IBM290', 'IBM297', 'IBM420', 'IBM423', 'IBM424', 'IBM437',
  'IBM500', 'IBM737', 'IBM775', 'IBM850', 'IBM852', 'IBM855', 'IBM857',
  'IBM860', 'IBM861', 'IBM863', 'IBM864', 'IBM865', 'IBM869', 'IBM870',
  'IBM871', 'IBM880', 'IBM905', 'IBM1026', 'IBM00858', 'IBM00924', 'IBM01047',
  'IBM01140', 'IBM01141', 'IBM01142', 'IBM01143', 'IBM01144', 'IBM01145',
  'IBM01146', 'IBM01147', 'IBM01148', 'IBM01149', 'ISO-8859-1', 'ISO-8859-2',
  'ISO-8859-3', 'ISO-8859-4', 'ISO-8859-5', 'ISO-8859-6', 'ISO-8859-7',
  'ISO-8859-8', 'ISO-8859-9', 'ISO-8859-13', 'ISO-8859-15', 'JOHAB', 'KOI8-R',
  'KOI8-U', 'KS_C_5601-1987', 'MACINTOSH', 'SHIFT_JIS', 'US-ASCII', 'UTF-32LE',
  'UTF-32BE', 'WINDOWS-1250', 'WINDOWS-1251', 'WINDOWS-1252', 'WINDOWS-1253',
  'WINDOWS-1254', 'WINDOWS-1255', 'WINDOWS-1256', 'WINDOWS-1257', 'WINDOWS-1258',
  'WINDOWS-874', 'X-CHINESE-CNS', 'X-CHINESE-ETEN', 'X-CP20001', 'X-CP20003',
  'X-CP20004', 'X-CP20005', 'X-CP20261', 'X-CP20269', 'X-CP20936', 'X-CP20949',
  'X-EBCDIC-KOREANEXTENDED', 'X-EUROPA', 'X-IA5', 'X-IA5-GERMAN',
  'X-IA5-NORWEGIAN', 'X-IA5-SWEDISH', 'X-MAC-ARABIC', 'X-MAC-CE',
  'X-MAC-CHINESETRAD', 'X-MAC-CROATIAN', 'X-MAC-CYRILLIC', 'X-MAC-GREEK',
  'X-MAC-HEBREW', 'X-MAC-ICELANDIC', 'X-MAC-JAPANESE', 'X-MAC-ROMANIAN',
  'X-MAC-THAI', 'X-MAC-TURKISH', 'X-MAC-UKRAINIAN',
]

export const supportedOtherCharsets: CharsetOption[] = otherCharsetNames
  .map((value) => ({ label: value, value }))
  .filter(({ value }) => {
    try {
      encodeText('', value)
      decodeBytes(Buffer.from([]), value)
      return true
    } catch {
      return false
    }
  })
