# LED 显示屏工具 — 设计文档

**日期：** 2026-06-22
**状态：** 已批准，进入实施规划阶段
**分类：** 趣味互动（cateId=11）

## 目标

新增一个工具页面，实现 LED 走马灯效果：

- 单段文字在 LED 屏幕上从右向左无限循环滚动
- URL 参数控制文字内容与样式（颜色、字号、粗体、速度、边框、发光、点阵）
- 页面内提供配置面板，所见即所得，修改后实时同步到 URL
- 支持全屏播放
- 兼容 PC 与 H5

## 用户故事

- **用户 A（演示者）**：希望快速生成一个 LED 走马灯 URL 发给别人，只需设置文字和颜色就够。
- **用户 B（设计师）**：需要调节字体、发光、点阵等细节做出"真实 LED 屏"的视觉效果。
- **用户 C（活动现场）**：需要全屏播放隐藏所有 UI。

## URL 参数规范

| 参数 | 类型 | 默认值 | 范围 | 说明 |
|---|---|---|---|---|
| `text` | string | `欢迎使用 LED 显示屏` | — | 要播放的文字（需 URL 编码） |
| `color` | string (hex) | `#ff0000` | 合法 hex | 文字颜色 |
| `bg` | string (hex) | `#000000` | 合法 hex | 背景颜色 |
| `size` | number | `120` | 20-300 | 字号（px） |
| `bold` | `0` / `1` | `1` | — | 是否粗体 |
| `speed` | number | `20` | 5-60 | 滚动一个完整周期所需秒数（越大越慢） |
| `border` | `0` / `1` | `1` | — | 是否显示 LED 屏幕边框 |
| `glow` | `0` / `1` | `1` | — | 是否显示文字发光（text-shadow） |
| `dot` | `0` / `1` | `0` | — | 是否显示 LED 点阵背景 |

**示例 URL：**

```
/led-display/?text=欢迎光临&color=%23ff0000&bg=%23000000&size=120&speed=15&glow=1
```

颜色中的 `#` 必须 URL 编码为 `%23`，UI 上需提示用户。

## 架构

### 文件结构

```
src/components/Tools/LedDisplay/
└── LedDisplay.vue          # 主组件
```

无新增 utils、无第三方依赖。

### 路由

`/led-display/` → `LedDisplay.vue`（懒加载，与现有工具一致）。

### 注册

按项目规范需更新 5 处：

1. `src/components/Tools/tools.ts` 的 `getToolsCate()` 中添加工具元数据（cateId=11，趣味互动）
2. `src/router/router.ts` 添加路由
3. 创建 `src/components/Tools/LedDisplay/LedDisplay.vue`
4. `sitemap.xml` 注册新页面
5. `README.md` 更新功能日志和工具列表

`logo` 字段如暂无可用图片，先省略或用占位图，由后续决定。

## 组件设计

### 布局（PC + H5 响应式）

```
┌─────────────────────────────────────┐
│ DetailHeader: LED 显示屏             │
├─────────────────────────────────────┤
│                                     │
│   ┌─────────────────────────────┐   │  ← LED 屏幕区（全宽）
│   │ → HELLO WORLD (滚动)        │   │     高度视口 30%-50%
│   └─────────────────────────────┘   │
│                                     │
│   ▾ 配置面板（折叠/可隐藏）          │
│   - 文字输入框                       │
│   - 颜色选择器（文字 / 背景）        │
│   - 字号滑块 / 速度滑块              │
│   - 复选框：粗体 / 边框 / 发光 / 点阵│
│   - [复制 URL] [全屏播放]            │
│                                     │
├─────────────────────────────────────┤
│ ToolDetail: 使用说明                 │
└─────────────────────────────────────┘
```

### 状态模型

所有样式由 URL 参数派生，**不**用本地 ref 单独存储。换句话说组件是 URL → 视图的单向数据流，本地状态仅用于配置面板的折叠状态。

```ts
const params = computed(() => parseUrlParams())  // 解析后的参数对象
const cssVars = computed(() => ({
  '--color': params.color,
  '--bg': params.bg,
  '--size': params.size + 'px',
  '--speed': params.speed + 's',
  '--font-weight': params.bold ? 'bold' : 'normal',
}))
```

### 交互

1. **打开页面**：自动读取 URL 参数应用样式，无需点按钮
2. **修改配置**：用户改任何项 → 立即生效 + `history.replaceState` 更新 URL（不刷新、不留历史记录）
3. **复制 URL**：复制当前完整 URL（含参数）到剪贴板，按钮短暂显示「已复制 ✓」
4. **全屏播放**：调用 `requestFullscreen()`，隐藏配置面板和详情，仅保留 LED 屏幕；ESC 退出全屏时自动恢复
5. **移动端适配**：H5 下配置面板默认折叠，减少占用

## 核心动画实现

### 走马灯滚动

```css
@keyframes led-scroll {
  0%   { transform: translateX(100vw); }
  100% { transform: translateX(-100%); }
}

.led-text {
  animation: led-scroll var(--speed) linear infinite;
  white-space: nowrap;
  display: inline-block;
  will-change: transform;
}
```

- `translateX(100vw)` 让文字从屏幕右侧外开始
- `translateX(-100%)` 让文字完全滑到屏幕左侧外（`100%` 是文字自身宽度）
- `linear` 缓动保证匀速
- `will-change` 提示 GPU 合成
- 无缝循环：动画 100% 时文字已在屏幕外，下一帧立刻从 0% 重新开始，视觉上无跳跃

### LED 风格

```css
.led-screen {
  background-color: var(--bg);
  border: 4px solid #333;
  box-shadow:
    0 0 30px var(--color),
    inset 0 0 30px rgba(0, 0, 0, 0.5);
}

.led-text {
  color: var(--color);
  text-shadow: 0 0 10px var(--color), 0 0 20px var(--color);
}

.led-screen.dot::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle, #222 1px, transparent 1px);
  background-size: 8px 8px;
  opacity: 0.5;
  pointer-events: none;
}
```

`border` / `glow` / `dot` 通过添加/移除 CSS class 控制。

## 工具函数

新增一个工具函数 `parseStyleParams()`（放在 `LedDisplay.vue` 内即可，无需单独的 utils 文件），负责：

1. 从 `window.location.search` 读取参数
2. 应用默认值
3. 校验范围（size 20-300，speed 5-60）
4. 校验 hex 颜色格式（`/^#[0-9a-fA-F]{6}$/`）
5. 返回强类型对象

不做 `text` 的特殊处理——空字符串也允许，UI 上显示「（空内容）」占位。

## 错误处理

| 场景 | 处理 |
|---|---|
| URL 无 `text` 参数 | 使用默认文字「欢迎使用 LED 显示屏」 |
| `text` 为空字符串 | 显示「（空内容）」占位文字（不滚动） |
| 颜色非合法 hex | 退回到默认颜色 |
| `size` 超出 20-300 | 夹到边界值 |
| `speed` 超出 5-60 | 夹到边界值 |
| `bold` / `border` 等非 0/1 | 非 0 都视为 1 |
| 浏览器不支持 Fullscreen API | 「全屏播放」按钮隐藏，不报错 |

不做 i18n，文本为中文即可（与项目其他工具一致）。

## 响应式

- **PC（≥768px）**：配置面板默认展开，与 LED 屏幕并排（屏幕在上、面板在下）
- **H5（<768px）**：配置面板默认折叠为一个按钮，点击展开；字号默认 60px（在合理范围）
- 全屏播放时屏幕占满 100vw / 100vh，文字自适应屏幕宽度（虽然滚动但字号固定）

## SEO

- **路由 meta**：
  - `title`: LED 显示屏 - 在线 LED 走马灯文字工具
  - `keywords`: LED显示屏,LED走马灯,滚动文字,在线LED,文字滚动
  - `description`: 在线 LED 显示屏工具，支持自定义文字内容、颜色、字号、滚动速度、发光效果和点阵背景，一键生成可分享的 LED 走马灯 URL。
- **ToolDetail**：底部详细说明使用方法、URL 参数含义、典型示例

## 测试

本项目无单元测试约定（参考仓库结构），故不强制单元测试。验收方式：

1. 打开默认页面，看到默认文字横向滚动
2. 修改各配置项，LED 屏幕实时变化
3. 刷新页面，配置从 URL 正确恢复
4. 复制 URL 在新窗口打开，配置一致
5. 全屏播放正常，ESC 退出
6. 移动端访问，配置面板可折叠，文字清晰
7. 输入非法值（颜色错误、size 超出范围），页面不崩、退回默认值
8. sitemap.xml 中存在新 URL

## 范围之外（YAGNI）

- ❌ 多段文字轮播
- ❌ 垂直滚动 / 从左向右滚动
- ❌ 图片/表情符号
- ❌ 背景音乐
- ❌ 自定义字体上传
- ❌ 保存/分享预设（除了 URL 本身）
- ❌ 国际化