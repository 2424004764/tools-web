/**
 * CodeMirror 5 全局默认值校准 —— 必须在所有 CM5 编辑器实例化之前生效。
 *
 * 由使用 CM5 的工具组件（JSON 格式化 / 正则测试 / Diff / JS 格式化 / 进制转换）
 * 各自 `import '@/utils/codemirror-compat'` 引入，不要在 main.ts 静态引入：
 * 否则 codemirror（~174KB）会被打进首屏 chunk，出现在每个访客的
 * modulepreload 列表里，而绝大多数页面根本没有编辑器。
 */
import CodeMirror from 'codemirror'

// fixedGutter 的横向滚动补偿依赖易失效的量测，会让不同批次渲染的行号基准
// 不一致（行号分裂成两列 / 盖住行首）。本站编辑器均为自动换行模式，
// 关闭 fixedGutter 后所有行统一以 -gutterWidth 定位，行号槽背景列永远与行号对齐。
CodeMirror.defaults.fixedGutter = false
