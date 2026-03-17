/**
 * 字数统计增强
 */
import { computed, Ref } from 'vue'

export interface WordCountStats {
  characters: number // 字符数
  charactersNoSpaces: number // 不含空格字符数
  words: number // 词数（中文按字算）
  paragraphs: number // 段落数
  lines: number // 行数
  headings: number // 标题数
  readingTime: number // 预估阅读时间（分钟）
  wechatReadingTime: number // 公众号建议阅读时长（分钟）
}

export function useWordCount(content: Ref<string>) {
  const stats = computed((): WordCountStats => {
    const text = content.value

    // 字符数
    const characters = text.length
    const charactersNoSpaces = text.replace(/\s/g, '').length

    // 词数统计（中文字符 + 英文单词）
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length
    const words = chineseChars + englishWords

    // 段落数（非空行）
    const paragraphs = text.split('\n').filter(line => line.trim()).length

    // 行数
    const lines = text.split('\n').length

    // 标题数
    const headings = (text.match(/^#{1,3}\s+/gm) || []).length

    // 预估阅读时间（中文：400字/分钟，英文：200词/分钟）
    const readingTime = Math.ceil(chineseChars / 400 + englishWords / 200)

    // 公众号建议阅读时长（公众号按字符数计算，约250字/分钟）
    const wechatReadingTime = Math.ceil(characters / 250)

    return {
      characters,
      charactersNoSpaces,
      words,
      paragraphs,
      lines,
      headings,
      readingTime: Math.max(1, readingTime),
      wechatReadingTime: Math.max(1, wechatReadingTime),
    }
  })

  const formatReadingTime = (minutes: number): string => {
    if (minutes < 1) return '少于1分钟'
    if (minutes < 60) return `${minutes}分钟`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`
  }

  return {
    stats,
    formatReadingTime,
  }
}
