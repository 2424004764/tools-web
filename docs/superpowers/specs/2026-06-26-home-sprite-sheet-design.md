# 首页精灵图 (Sprite Sheet) 设计

**日期**：2026-06-26
**目标**：将首页 131 个工具 logo 合并到单张透明 PNG，通过 CSS background-position 引用，把首页 logo HTTP 请求从 131 降到 1。

## 已确认决策

| 项 | 决定 |
|----|------|
| 目的 | 减少 HTTP 请求、提升性能 |
| 渲染方式 | CSS background-position（经典精灵图） |
| 生成方式 | 构建脚本自动生成（`scripts/build-sprite.mjs`） |
| 格子像素 | 80×80（CSS 仍以 40×40 显示，Retina @2x 清晰） |
| 混合格式处理 | SVG / JPG / PNG 全部栅格化为 PNG，统一进 sprite |
| 失败处理 | 单 logo 失败 → 跳过 + warn；总失败率 > 5% → 进程非零退出 |
| a11y | div 加 `role="img"` + `aria-label={{tool.title}}` |
| 范围 | 仅首页（Home.vue） |

## 架构

### 构建期产物
- `public/sprites/tools.png`：精灵图（透明，约 672×1428 px，按 8 列 × 17 行）
- `src/components/Tools/sprite-coords.json`：映射表 `{ "<toolId>": { x, y, w: 80, h: 80 } }`

### 运行期
- `src/components/Tools/useSpriteLogo.ts`：组合式函数，输入 `tool`，输出 `{ style, title }`
- `src/components/Home/Home.vue`：第 238 行 `<img>` → `<div :style="…">`

## 关键参数

```
CELL  = 80         // 每个 logo 实际像素（Retina 下显示 40×40）
PAD   = 4          // 格子间透明 padding
STRIDE = 84        // CELL + PAD
COLS  = 8          // 131 → 17 行（末行 3 个 + 5 空）
```

## 算法

1. 用正则从 `src/components/Tools/tools.ts` 提取 `(id, logo URL)` 列表
2. **按 logo URL 去重**：相同 logo 共享同一 sprite 格子（节省 sprite 体积）
3. 并行处理每个唯一 logo：sharp 加载 → `fit: 'contain'` 缩放到 80×80 → 透明背景 → 输出 RGBA buffer
4. 创建 672×1428 透明画布，`composite()` 拼图，按索引计算 `x = col*STRIDE, y = row*STRIDE`
5. 输出 PNG + 坐标 JSON

## SVG / JPG 特殊处理

- **PNG**：直接 sharp resize
- **JPG**：sharp 自动作为不透明图读取，contain 到透明画布
- **SVG**：`sharp(input, { density: 300 })` 高分辨率栅格化后 resize，避免小图标边缘锯齿

## 坐标 JSON 结构

```json
{
  "1":   { "x": 0,   "y": 0,   "w": 80, "h": 80 },
  "23":  { "x": 84,  "y": 0,   "w": 80, "h": 80 },
  ...
}
```

工具 id（number）以 string 形式作为 key，方便运行时查找。

## 集成

- `package.json` 增加 `"sprite:build": "node scripts/build-sprite.mjs"`
- `package.json` 增加 `"prebuild": "pnpm sprite:build"`，确保生产构建前生成最新 sprite
- `prebuild:pro` 同理

## 风险与限制

- **logo 损坏**：个别 logo 解码失败会被跳过，首页该工具无图标（可后续加 fallback）
- **tools.ts 中 id 重复**：数据质量问题，本设计按 logo URL 去重，不影响渲染
- **未来加新工具**：往 tools.ts 加条目后跑一次 `pnpm sprite:build` 即可，无需手动排版
- **sprite 体积**：透明 PNG 压缩率高，预估 < 200 KB（具体看首次跑的结果）

## 不在范围

- 其它页面（如侧边栏、详情页）继续用原 `<img :src="item.logo">`，本次不动
- 缩放比例变化（首页 w-10 = 40px 显示）保持不变
- logo 视觉风格统一（本次仅做打包，不重设计）