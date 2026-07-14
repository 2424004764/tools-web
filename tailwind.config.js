/** @type {import('tailwindcss').Config} */
const defaultTheme = require('tailwindcss/defaultTheme')

/**
 * tools-web Tailwind 配置
 *
 * 设计 token 体系（Phase 1 引入）：
 *   ink        — 文本 / 强对比 neutral 阶梯
 *   surface    — 卡片 / 容器底色（白 → 浅灰）
 *   border     — 描边 / 分隔线
 *   accent     — 品牌主色 = 暖橙（当前 orange 阶梯的语义化重命名）
 *   danger     — 语义红色阶梯
 *   success / warning / info — Element Plus 原生语义色阶梯
 *
 * 旧阶梯 `warm` / `orange` / `amber` 标记 @deprecated，Phase 4 收尾后由 v2 删除。
 * `tile-*`（2048 游戏色）保持不变 —— 属于游戏素材，不归 token 管。
 */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ─── 2048 游戏方块色（保留） ────────────────────────────
        'tile-2': '#EEE4DA',
        'tile-4': '#EDE0C8',
        'tile-8': '#F2B179',
        'tile-16': '#F59563',
        'tile-32': '#F67C5F',
        'tile-64': '#F65E3B',
        'tile-128': '#EDCF72',
        'tile-256': '#EDCC61',
        'tile-512': '#EDC850',
        'tile-1024': '#EDC53F',
        'tile-2048': '#EDC22E',
        'tile-dark': '#3C3A32',
        'tile-text-dark': '#776E65',
        'tile-text-light': '#F9F6F2',

        // ─── @deprecated 旧 token（Phase 4 收尾后由 v2 删除） ────
        // @deprecated — use `accent` instead. 保留至 Phase 4 收尾以避免破坏外部缓存与第三方库引用。
        'warm': {
          50: '#fefcf9',
          100: '#fef7ed',
          200: '#fdead5',
          300: '#fbd9b3',
          400: '#f8c287',
          500: '#f4a261',
          600: '#e76f51',
          700: '#d35400',
          800: '#a04000',
          900: '#6b2c00',
        },
        // @deprecated — use `accent` instead.
        'orange': {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        // @deprecated — use `accent` instead.
        'amber': {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },

        // ─── 新 token 系统（Phase 1 起生效） ─────────────────────

        // ink — 文本与强对比 neutral 阶梯（替代 Tailwind 默认 gray/slate）
        // values resolve to CSS vars defined in src/styles/tailwind.css :root
        ink: {
          50:  'rgb(var(--ink-50)  / <alpha-value>)',
          100: 'rgb(var(--ink-100) / <alpha-value>)',
          200: 'rgb(var(--ink-200) / <alpha-value>)',
          300: 'rgb(var(--ink-300) / <alpha-value>)',
          400: 'rgb(var(--ink-400) / <alpha-value>)',
          500: 'rgb(var(--ink-500) / <alpha-value>)',
          600: 'rgb(var(--ink-600) / <alpha-value>)',
          700: 'rgb(var(--ink-700) / <alpha-value>)',
          800: 'rgb(var(--ink-800) / <alpha-value>)',
          900: 'rgb(var(--ink-900) / <alpha-value>)',
          950: 'rgb(var(--ink-950) / <alpha-value>)',
        },

        // surface — 卡片 / 容器底色（白 → 浅灰）
        surface: {
          0: 'rgb(var(--surface-0) / <alpha-value>)',  // 纯白 canvas
          1: 'rgb(var(--surface-1) / <alpha-value>)',  // 微妙 card
          2: 'rgb(var(--surface-2) / <alpha-value>)',  // raised / hover
          3: 'rgb(var(--surface-3) / <alpha-value>)',  // selected / 较深灰
        },

        // border — 描边 / 分隔线
        border: {
          subtle:  'rgb(var(--border-subtle)  / <alpha-value>)',
          DEFAULT: 'rgb(var(--border-default) / <alpha-value>)',
          strong:  'rgb(var(--border-strong)  / <alpha-value>)',
        },

        // accent — 品牌主色 = 暖橙（替代 orange 阶梯的语义化重命名）
        accent: {
          50:  'rgb(var(--accent-50)  / <alpha-value>)',
          100: 'rgb(var(--accent-100) / <alpha-value>)',
          200: 'rgb(var(--accent-200) / <alpha-value>)',
          300: 'rgb(var(--accent-300) / <alpha-value>)',
          400: 'rgb(var(--accent-400) / <alpha-value>)',
          500: 'rgb(var(--accent-500) / <alpha-value>)',
          600: 'rgb(var(--accent-600) / <alpha-value>)',
          700: 'rgb(var(--accent-700) / <alpha-value>)',
          800: 'rgb(var(--accent-800) / <alpha-value>)',
          900: 'rgb(var(--accent-900) / <alpha-value>)',
          950: 'rgb(var(--accent-950) / <alpha-value>)',
        },

        // danger — 语义红色阶梯（用于错误 / 删除按钮 / 失败状态）
        danger: {
          50:  'rgb(var(--danger-50)  / <alpha-value>)',
          100: 'rgb(var(--danger-100) / <alpha-value>)',
          200: 'rgb(var(--danger-200) / <alpha-value>)',
          300: 'rgb(var(--danger-300) / <alpha-value>)',
          400: 'rgb(var(--danger-400) / <alpha-value>)',
          500: 'rgb(var(--danger-500) / <alpha-value>)',
          600: 'rgb(var(--danger-600) / <alpha-value>)',
          700: 'rgb(var(--danger-700) / <alpha-value>)',
          800: 'rgb(var(--danger-800) / <alpha-value>)',
          900: 'rgb(var(--danger-900) / <alpha-value>)',
          950: 'rgb(var(--danger-950) / <alpha-value>)',
        },

        // success / warning / info — Element Plus 原生语义色阶梯
        success: {
          50:  'rgb(var(--success-50)  / <alpha-value>)',
          100: 'rgb(var(--success-100) / <alpha-value>)',
          200: 'rgb(var(--success-200) / <alpha-value>)',
          300: 'rgb(var(--success-300) / <alpha-value>)',
          400: 'rgb(var(--success-400) / <alpha-value>)',
          500: 'rgb(var(--success-500) / <alpha-value>)',
          600: 'rgb(var(--success-600) / <alpha-value>)',
          700: 'rgb(var(--success-700) / <alpha-value>)',
          800: 'rgb(var(--success-800) / <alpha-value>)',
          900: 'rgb(var(--success-900) / <alpha-value>)',
          950: 'rgb(var(--success-950) / <alpha-value>)',
        },
        warning: {
          50:  'rgb(var(--warning-50)  / <alpha-value>)',
          100: 'rgb(var(--warning-100) / <alpha-value>)',
          200: 'rgb(var(--warning-200) / <alpha-value>)',
          300: 'rgb(var(--warning-300) / <alpha-value>)',
          400: 'rgb(var(--warning-400) / <alpha-value>)',
          500: 'rgb(var(--warning-500) / <alpha-value>)',
          600: 'rgb(var(--warning-600) / <alpha-value>)',
          700: 'rgb(var(--warning-700) / <alpha-value>)',
          800: 'rgb(var(--warning-800) / <alpha-value>)',
          900: 'rgb(var(--warning-900) / <alpha-value>)',
          950: 'rgb(var(--warning-950) / <alpha-value>)',
        },
        info: {
          50:  'rgb(var(--info-50)  / <alpha-value>)',
          100: 'rgb(var(--info-100) / <alpha-value>)',
          200: 'rgb(var(--info-200) / <alpha-value>)',
          300: 'rgb(var(--info-300) / <alpha-value>)',
          400: 'rgb(var(--info-400) / <alpha-value>)',
          500: 'rgb(var(--info-500) / <alpha-value>)',
          600: 'rgb(var(--info-600) / <alpha-value>)',
          700: 'rgb(var(--info-700) / <alpha-value>)',
          800: 'rgb(var(--info-800) / <alpha-value>)',
          900: 'rgb(var(--info-900) / <alpha-value>)',
          950: 'rgb(var(--info-950) / <alpha-value>)',
        },

        // 语义别名（仅文本颜色，Phase 2 起使用）
        // 注意：Tailwind 的 `text-*` 会先尝试匹配 key；同名冲突时把 token 写更具体
        'text-primary':   'rgb(var(--ink-900) / <alpha-value>)',
        'text-secondary': 'rgb(var(--ink-700) / <alpha-value>)',
        'text-muted':     'rgb(var(--ink-500) / <alpha-value>)',
        'text-link':      'rgb(var(--accent-600) / <alpha-value>)',
        'bg-canvas':      'rgb(var(--surface-0) / <alpha-value>)',
      },

      fontFamily: {
        // Inter Variable 由 @fontsource-variable/inter 提供 woff2（main.ts 导入触发 Vite 打包）
        // 中文走系统 PingFang / Microsoft YaHei / Noto Sans CJK SC 兜底
        display: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          '"Noto Sans CJK SC"',
          'sans-serif',
        ],
        body: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          '"Noto Sans CJK SC"',
          'sans-serif',
        ],
        mono: [
          '"JetBrains Mono"',
          '"SF Mono"',
          '"Cascadia Code"',
          'Menlo',
          'Monaco',
          'Consolas',
          '"Courier New"',
          'monospace',
        ],
      },

      // ─── Phase 3a：Typography scale ──────────────────────────────
      // 语义化字号阶梯。视觉尺寸与 Tailwind 默认 text-{xs..3xl} 1:1 对齐，
      // 唯一差异是 line-height：caption 1.5 / body-sm 1.55 / body 1.6 / body-lg 1.6 / h3 1.4 / h2 1.35 / h1 1.3。
      // 替换映射：text-xs→caption, text-sm→body-sm, text-base→body, text-lg→body-lg,
      //          text-xl→h3, text-2xl→h2, text-3xl→h1
      // 白名单不替换：Common/ChatMessage.vue、Tools/WeChatFormat/、所有 game 组件
      fontSize: {
        'display-1': ['3.5rem',    { lineHeight: '1.1',  letterSpacing: '-0.02em', fontWeight: '600' }],
        'display-2': ['2.75rem',   { lineHeight: '1.15', letterSpacing: '-0.02em', fontWeight: '600' }],
        'display-3': ['2.25rem',   { lineHeight: '1.2',  letterSpacing: '-0.01em', fontWeight: '600' }],
        'h1':        ['1.875rem',  { lineHeight: '1.3',  fontWeight: '600' }],
        'h2':        ['1.5rem',    { lineHeight: '1.35', fontWeight: '600' }],
        'h3':        ['1.25rem',   { lineHeight: '1.4',  fontWeight: '500' }],
        'body-lg':   ['1.125rem',  { lineHeight: '1.6',  fontWeight: '400' }],
        'body':      ['1rem',      { lineHeight: '1.6',  fontWeight: '400' }],
        'body-sm':   ['0.875rem',  { lineHeight: '1.55', fontWeight: '400' }],
        'caption':   ['0.75rem',   { lineHeight: '1.5',  letterSpacing: '0.02em', fontWeight: '400' }],
      },
    },
    screens: {
      // 自定义响应式尺寸
      'c-xs': {'max': '768px'},
      'c-sm': {'min': '768px'}, // 相当于默认的 md
      'c-md': {'min': '992px'},
      'c-lg': {'min': '1200px'},
      ...defaultTheme.screens,
    },
    animation: {
      fold: 'fold 1s infinite'
    },
    keyframes: {
      fold: {
        '0%, 100%': {
          opacity: 0
        },
        '50%': {
          opacity: 1
        }
      }
    }
  },
  plugins: [],
}