// 用户自定义 HTML 的统一消毒入口（QA 自定义头尾内容等不可信富文本）
// 背景与 blog-markdown.ts 同源：凡是要进 v-html 的用户内容必须先过这里。
// DOMPurify 默认白名单会剥掉 script/iframe/meta/link/object/embed、
// on* 事件属性与 javascript:/data: 危险 URL —— meta refresh 跳转劫持即被切断。
import DOMPurify from 'dompurify'

export function sanitizeCustomHtml(html: string): string {
  if (!html) return ''
  return DOMPurify.sanitize(html, {
    // 禁 <style> 元素：CSS 是全局作用域，允许会波及整站样式/外链数据回传；
    // 行内 style 属性保留，正常"自定内容"排版不受影响
    FORBID_TAGS: ['style'],
  })
}
