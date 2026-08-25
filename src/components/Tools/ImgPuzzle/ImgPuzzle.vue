<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import DownloadIcon from '~icons/ep/download'
import DeleteIcon from '~icons/ep/delete'
import PlusIcon from '~icons/ep/plus'
import RefreshIcon from '~icons/ep/refresh'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import JSZip from 'jszip'

const info = reactive({ title: '图片拼图' })

// 槽位定义：每个槽位对应模板布局中的一个区域
interface Slot {
  id: string
  col: number
  row: number
  colSpan: number
  rowSpan: number
}

interface CardElement {
  /** 引用 slots 中的 slot id */
  slotId: string
  /** 画布 X 位置百分比 0-100（元素中心点 x） */
  x: number
  /** 画布 Y 位置百分比 0-100（元素中心点 y） */
  y: number
  /** 元素宽度百分比 0-100 */
  width: number
  /** 元素高度百分比 0-100 */
  height: number
  /** 旋转角度（度） */
  rotation?: number
  /** 层级，数字越大越上层 */
  zIndex?: number
  /** 边框宽度（px），用于模拟拍立得白边 */
  borderWidth?: number
  /** 边框颜色 */
  borderColor?: string
  /** 是否显示阴影 */
  shadow?: boolean
  /** 从原图裁切的源区域百分比：sx/sy/sw/sh 均为 0-100（不指定则 cover 完整图） */
  crop?: { sx: number; sy: number; sw: number; sh: number }
}

interface Template {
  key: string
  /** 模板类型：grid 网格（默认） / collage 卡片拼贴 */
  type?: 'grid' | 'collage'
  /** 画布列数 */
  gridCols: number
  /** 画布行数 */
  gridRows: number
  /** 自定义行比例（如 '4fr 6fr'），空则使用 repeat(N, 1fr) */
  rowRatio?: string
  /** 自定义列比例（如 '4fr 6fr'），空则使用 repeat(N, 1fr) */
  colRatio?: string
  /** 槽位列表（grid 用 col/row 排布；collage 仍用于上传区，slotId 与 elements 对应） */
  slots: Slot[]
  /** collage 模板专用：卡片元素列表 */
  elements?: CardElement[]
}

// ========== 模板生成器 ==========
// 用辅助函数批量生成各槽位数下的多种布局
const buildTemplates = (): Template[] => {
  const result: Template[] = []
  let idCounter = 0
  const s = (col: number, row: number, colSpan = 1, rowSpan = 1): Slot => ({
    id: `s${++idCounter}`, col, row, colSpan, rowSpan,
  })
  const t = (key: string, cols: number, rows: number, slots: Slot[], rowRatio?: string, colRatio?: string): Template => ({
    key, gridCols: cols, gridRows: rows, slots, rowRatio, colRatio,
  })

  // === 2 槽位 ===
  idCounter = 0
  result.push(
    t('split-h', 2, 1, [s(0, 0), s(1, 0)]),
    t('split-v', 1, 2, [s(0, 0), s(0, 1)]),
  )

  // === 3 槽位（10 种）===
  idCounter = 0
  result.push(
    t('three-strip-v', 1, 3, [s(0, 0), s(0, 1), s(0, 2)]),
    t('three-strip-h', 3, 1, [s(0, 0), s(1, 0), s(2, 0)]),
    t('three-2top-1bot', 2, 2, [s(0, 0), s(1, 0), s(0, 1, 2, 1)]),
    t('three-1top-2bot', 2, 2, [s(0, 0, 2, 1), s(0, 1), s(1, 1)]),
    t('three-large-left', 2, 2, [s(0, 0, 1, 2), s(1, 0), s(1, 1)]),
    t('three-large-right', 2, 2, [s(0, 0), s(0, 1), s(1, 0, 1, 2)]),
    t('three-ratio-46', 2, 2, [s(0, 0, 2, 1), s(0, 1), s(1, 1)], '4fr 6fr'),
    t('three-ratio-46-left', 2, 2, [s(0, 0, 1, 2), s(1, 0), s(1, 1)], undefined, '6fr 4fr'),
    t('three-ratio-46-right', 2, 2, [s(0, 0), s(0, 1), s(1, 0, 1, 2)], undefined, '4fr 6fr'),
    t('three-ratio-64', 2, 2, [s(0, 0), s(1, 0), s(0, 1, 2, 1)], '6fr 4fr'),
  )

  // === 4 槽位（11 种）===
  idCounter = 0
  result.push(
    // 等分网格
    t('four-grid-2x2', 2, 2, [s(0, 0), s(1, 0), s(0, 1), s(1, 1)]),
    t('four-strip-h', 4, 1, [s(0, 0), s(1, 0), s(2, 0), s(3, 0)]),
    t('four-strip-v', 1, 4, [s(0, 0), s(0, 1), s(0, 2), s(0, 3)]),
    // 3×2 / 2×3 等分网格
    t('four-3x2', 3, 2, [s(0, 0), s(1, 0), s(2, 0), s(0, 1), s(1, 1), s(2, 1)]),
    t('four-2x3', 2, 3, [s(0, 0), s(1, 0), s(0, 1), s(1, 1), s(0, 2), s(1, 2)]),
    // 1 大 + 3 小（2×3 / 3×2 网格）
    t('four-big-left-3right', 2, 3, [s(0, 0, 1, 3), s(1, 0), s(1, 1), s(1, 2)]),
    t('four-big-right-3left', 2, 3, [s(0, 0), s(0, 1), s(0, 2), s(1, 0, 1, 3)]),
    t('four-big-top-3bot', 3, 2, [s(0, 0, 3, 1), s(0, 1), s(1, 1), s(2, 1)]),
    t('four-3top-big-bot', 3, 2, [s(0, 0), s(1, 0), s(2, 0), s(0, 1, 3, 1)]),
  )

  // === 5 槽位（18 种）===
  idCounter = 0
  result.push(
    // 等分条
    t('five-strip-h', 5, 1, [s(0, 0), s(1, 0), s(2, 0), s(3, 0), s(4, 0)]),
    t('five-strip-v', 1, 5, [s(0, 0), s(0, 1), s(0, 2), s(0, 3), s(0, 4)]),
    // 5×1 / 1×5 已含，上面再加
    // 电影海报（保留）
    t('five-poster', 4, 4, [s(0, 0, 2, 4), s(2, 0, 2, 2), s(2, 2, 1, 2), s(3, 2), s(3, 3)]),
    // 1 大 + 4 小（横版）
    t('five-big-top-4bot', 4, 2, [s(0, 0, 4, 1), s(0, 1), s(1, 1), s(2, 1), s(3, 1)]),
    t('five-4top-big-bot', 4, 2, [s(0, 0), s(1, 0), s(2, 0), s(3, 0), s(0, 1, 4, 1)]),
    // 1 大 + 4 小（竖版）
    t('five-big-left-4right', 2, 4, [s(0, 0, 1, 4), s(1, 0), s(1, 1), s(1, 2), s(1, 3)]),
    t('five-4left-big-right', 2, 4, [s(0, 0), s(0, 1), s(0, 2), s(0, 3), s(1, 0, 1, 4)]),
    // 1 大 + 4 小（2×3）
    t('five-big-tl-2x3', 2, 3, [s(0, 0, 1, 2), s(1, 0), s(1, 1), s(0, 2), s(1, 2)]),
    t('five-big-tr-2x3', 2, 3, [s(0, 0), s(1, 0, 1, 2), s(0, 1), s(0, 2), s(1, 2)]),
  )

  // === 6 槽位（18 种）===
  idCounter = 0
  result.push(
    // 等分网格
    t('six-grid-3x2', 3, 2, Array.from({ length: 6 }, (_, i) => s(i % 3, Math.floor(i / 3)))),
    t('six-grid-2x3', 2, 3, Array.from({ length: 6 }, (_, i) => s(i % 2, Math.floor(i / 2)))),
    t('six-strip-h', 6, 1, Array.from({ length: 6 }, (_, i) => s(i, 0))),
    t('six-strip-v', 1, 6, Array.from({ length: 6 }, (_, i) => s(0, i))),
    // 1 大 + 5 小
    t('six-1big-5small-3x2', 3, 2, [s(0, 0, 1, 2), s(1, 0), s(2, 0), s(1, 1), s(2, 1)]),
    // 实际是5格，调整为6格（加1）
    t('six-1big-5small-tl', 3, 3, [s(0, 0, 2, 2), s(2, 0), s(2, 1), s(0, 2), s(1, 2), s(2, 2)]),
    // 1×6 / 6×1 变体（带分组）
    t('six-3x2-asym-1', 3, 2, [s(0, 0, 2, 1), s(2, 0), s(0, 1), s(1, 1), s(2, 1)]),
    t('six-3x2-asym-2', 3, 2, [s(0, 0), s(1, 0, 2, 1), s(0, 1), s(1, 1), s(2, 1)]),
  )

  // === 7 槽位（15 种）===
  idCounter = 0
  result.push(
    // 等分条
    t('seven-strip-h', 7, 1, Array.from({ length: 7 }, (_, i) => s(i, 0))),
    t('seven-strip-v', 1, 7, Array.from({ length: 7 }, (_, i) => s(0, i))),
    // 1 大 1×3 + 4 小
    t('seven-big-top-1x3-4bot', 3, 3, [s(0, 0, 3, 1), s(0, 1), s(1, 1), s(2, 1), s(0, 2), s(1, 2), s(2, 2)]),
    // 2 大 + 5 小
    t('seven-2big-tl-5small', 3, 3, [s(0, 0, 1, 2), s(1, 0, 1, 2), s(2, 0), s(2, 1), s(0, 2), s(1, 2), s(2, 2)]),
    // 1×4 大 + 3 小（实际是7格，大图占4格 + 3小格 = 7）
    t('seven-big-1x4-3small', 4, 2, [s(0, 0, 4, 1), s(0, 1), s(1, 1), s(2, 1), s(3, 1)]),
  )

  // === 8 槽位（15 种）===
  idCounter = 0
  result.push(
    // 等分网格
    t('eight-grid-4x2', 4, 2, Array.from({ length: 8 }, (_, i) => s(i % 4, Math.floor(i / 4)))),
    t('eight-grid-2x4', 2, 4, Array.from({ length: 8 }, (_, i) => s(i % 2, Math.floor(i / 2)))),
    t('eight-strip-h', 8, 1, Array.from({ length: 8 }, (_, i) => s(i, 0))),
    t('eight-strip-v', 1, 8, Array.from({ length: 8 }, (_, i) => s(0, i))),
    // 1 大 1×4 + 4 小
    t('eight-big-1x4-4bot', 4, 2, [s(0, 0, 4, 1), s(0, 1), s(1, 1), s(2, 1), s(3, 1)]),
    t('eight-4top-big-bot', 4, 2, [s(0, 0), s(1, 0), s(2, 0), s(3, 0), s(0, 1, 4, 1)]),
    // 大图 + 4×2 错位
    t('eight-poster-left', 4, 4, [s(0, 0, 2, 4), s(2, 0), s(3, 0), s(2, 1), s(3, 1), s(2, 2, 2, 1), s(2, 3), s(3, 3)]),
    // 1 大 1×2 + 6 小（竖版）
    t('eight-1big-1x2-6small', 4, 2, [s(0, 0, 1, 2), s(1, 0), s(2, 0), s(3, 0), s(1, 1), s(2, 1), s(3, 1)]),
    // 大图 + 6 小（横版）
    t('eight-big-left-6right', 3, 3, [s(0, 0, 1, 3), s(1, 0), s(2, 0), s(1, 1), s(2, 1), s(1, 2), s(2, 2)]),
  )

  // === 9 槽位（12 种）===
  idCounter = 0
  result.push(
    t('nine-grid-3x3', 3, 3, Array.from({ length: 9 }, (_, i) => s(i % 3, Math.floor(i / 3)))),
    // 大图 + 8 小（横版）
    t('nine-big-left-8right', 3, 3, [s(0, 0, 1, 3), s(1, 0), s(2, 0), s(1, 1), s(2, 1), s(1, 2), s(2, 2)]),
    // 大图 + 8 小（竖版）
    t('nine-big-top-8bot', 3, 3, [s(0, 0, 3, 1), s(0, 1), s(1, 1), s(2, 1), s(0, 2), s(1, 2), s(2, 2)]),
    // 大图 + 8 小（错位）
    t('nine-poster-style', 3, 4, [s(0, 0, 1, 4), s(1, 0), s(2, 0), s(1, 1, 2, 1), s(1, 2), s(2, 2), s(1, 3, 2, 1)]),
    // 朋友圈九图 + 大图
    t('nine-big-tl-8small', 3, 4, [s(0, 0, 2, 2), s(2, 0), s(0, 1), s(1, 1), s(2, 1), s(0, 2), s(1, 2), s(2, 2), s(0, 3, 3, 1)]),
    // 大图右上 + 8 小
    t('nine-big-tr-8small', 3, 4, [s(0, 0), s(1, 0, 2, 2), s(0, 1), s(0, 2), s(1, 2), s(2, 2), s(0, 3, 3, 1)]),
  )

  // === 10 槽位（9 种）===
  idCounter = 0
  result.push(
    t('ten-strip-h', 10, 1, Array.from({ length: 10 }, (_, i) => s(i, 0))),
    t('ten-strip-v', 1, 10, Array.from({ length: 10 }, (_, i) => s(0, i))),
    t('ten-grid-5x2', 5, 2, Array.from({ length: 10 }, (_, i) => s(i % 5, Math.floor(i / 5)))),
    t('ten-grid-2x5', 2, 5, Array.from({ length: 10 }, (_, i) => s(i % 2, Math.floor(i / 2)))),
    // 朋友圈 3+3+3+1
    t('ten-wechat', 3, 4, [s(0, 0), s(1, 0), s(2, 0), s(0, 1), s(1, 1), s(2, 1), s(0, 2), s(1, 2), s(2, 2), s(0, 3, 3, 1)]),
  )

  // === 11 槽位（6 种）===
  idCounter = 0
  result.push(
    t('eleven-strip-h', 11, 1, Array.from({ length: 11 }, (_, i) => s(i, 0))),
    t('eleven-big-top-10bot', 4, 3, [s(0, 0, 4, 1), s(0, 1), s(1, 1), s(2, 1), s(3, 1), s(0, 2), s(1, 2), s(2, 2), s(3, 2)]),
  )

  // === 12 槽位（6 种）===
  idCounter = 0
  result.push(
    t('twelve-grid-4x3', 4, 3, Array.from({ length: 12 }, (_, i) => s(i % 4, Math.floor(i / 4)))),
    t('twelve-grid-3x4', 3, 4, Array.from({ length: 12 }, (_, i) => s(i % 3, Math.floor(i / 3)))),
    t('twelve-strip-h', 12, 1, Array.from({ length: 12 }, (_, i) => s(i, 0))),
    t('twelve-grid-6x2', 6, 2, Array.from({ length: 12 }, (_, i) => s(i % 6, Math.floor(i / 6)))),
    t('twelve-grid-2x6', 2, 6, Array.from({ length: 12 }, (_, i) => s(i % 2, Math.floor(i / 2)))),
  )

  // === 13 槽位（5 种）===
  idCounter = 0
  result.push(
    // 等分条
    t('thirteen-strip-h', 13, 1, Array.from({ length: 13 }, (_, i) => s(i, 0))),
    t('thirteen-strip-v', 1, 13, Array.from({ length: 13 }, (_, i) => s(0, i))),
    // 大图 2×2 + 12 小（4×4 网格）
    t('thirteen-big-tl-12small', 4, 4, [
      s(0, 0, 2, 2),
      s(2, 0), s(3, 0),
      s(2, 1), s(3, 1),
      s(0, 2), s(1, 2), s(2, 2), s(3, 2),
      s(0, 3), s(1, 3), s(2, 3), s(3, 3),
    ]),
  )

  // === 14 槽位（5 种）===
  idCounter = 0
  result.push(
    // 等分条
    t('fourteen-strip-h', 14, 1, Array.from({ length: 14 }, (_, i) => s(i, 0))),
    t('fourteen-strip-v', 1, 14, Array.from({ length: 14 }, (_, i) => s(0, i))),
    // 等分网格
    t('fourteen-grid-7x2', 7, 2, Array.from({ length: 14 }, (_, i) => s(i % 7, Math.floor(i / 7)))),
    t('fourteen-grid-2x7', 2, 7, Array.from({ length: 14 }, (_, i) => s(i % 2, Math.floor(i / 2)))),
  )

  // === 15 槽位（5 种）===
  idCounter = 0
  result.push(
    // 等分条
    t('fifteen-strip-h', 15, 1, Array.from({ length: 15 }, (_, i) => s(i, 0))),
    t('fifteen-strip-v', 1, 15, Array.from({ length: 15 }, (_, i) => s(0, i))),
    // 等分网格
    t('fifteen-grid-5x3', 5, 3, Array.from({ length: 15 }, (_, i) => s(i % 5, Math.floor(i / 5)))),
    t('fifteen-grid-3x5', 3, 5, Array.from({ length: 15 }, (_, i) => s(i % 3, Math.floor(i / 3)))),
  )

  // === 16 槽位 ===
  idCounter = 0
  result.push(
    t('sixteen-grid-4x4', 4, 4, Array.from({ length: 16 }, (_, i) => s(i % 4, Math.floor(i / 4)))),
  )

  // === 拼贴卡片（旋转/叠加/边框/阴影）===
  idCounter = 0
  result.push(
    // 2 张卡片对角叠加（左上 + 右下，重心居中）
    {
      key: 'collage-2-overlap',
      type: 'collage',
      gridCols: 2,
      gridRows: 1,
      slots: [s(0, 0), s(1, 0)],
      elements: [
        { slotId: 's1', x: 30, y: 30, width: 44, height: 50, rotation: -5, zIndex: 1, borderWidth: 14, borderColor: '#ffffff', shadow: true },
        { slotId: 's2', x: 70, y: 70, width: 44, height: 50, rotation: 6, zIndex: 2, borderWidth: 14, borderColor: '#ffffff', shadow: true },
      ],
    },
    // 3 张卡片对角线错落（左上、中、右下，重心居中）
    {
      key: 'collage-3-staggered',
      type: 'collage',
      gridCols: 3,
      gridRows: 1,
      slots: [s(0, 0), s(1, 0), s(2, 0)],
      elements: [
        { slotId: 's1', x: 25, y: 25, width: 34, height: 42, rotation: -8, zIndex: 1, borderWidth: 12, borderColor: '#ffffff', shadow: true },
        { slotId: 's2', x: 50, y: 50, width: 34, height: 42, rotation: 4, zIndex: 2, borderWidth: 12, borderColor: '#ffffff', shadow: true },
        { slotId: 's3', x: 75, y: 75, width: 34, height: 42, rotation: -3, zIndex: 3, borderWidth: 12, borderColor: '#ffffff', shadow: true },
      ],
    },
    // === 参考图风格：3 张图错位叠加（顶部/中央/底部，重心居中） ===
    {
      key: 'collage-3-cascade',
      type: 'collage',
      gridCols: 3,
      gridRows: 3,
      slots: [s(0, 0), s(1, 0), s(2, 0)],
      elements: [
        // 顶部窄条：水平居中 (50, 18)，宽 56%
        { slotId: 's1', x: 50, y: 18, width: 56, height: 20, rotation: -3, zIndex: 1, shadow: true, borderWidth: 8, borderColor: '#ffffff' },
        // 中央大图：水平居中 (50, 52)，宽 50%
        { slotId: 's2', x: 50, y: 52, width: 50, height: 50, rotation: 2, zIndex: 2, shadow: true, borderWidth: 10, borderColor: '#ffffff' },
        // 底部窄条：水平居中 (50, 82)，宽 56%
        { slotId: 's3', x: 50, y: 82, width: 56, height: 20, rotation: 4, zIndex: 3, shadow: true, borderWidth: 8, borderColor: '#ffffff' },
      ],
    },
    // 4 张卡片对称四宫格（重心居中）
    {
      key: 'collage-4-waterfall',
      type: 'collage',
      gridCols: 4,
      gridRows: 4,
      slots: [s(0, 0), s(1, 0), s(2, 0), s(3, 0)],
      elements: [
        { slotId: 's1', x: 28, y: 28, width: 40, height: 36, rotation: -6, zIndex: 1, borderWidth: 10, borderColor: '#ffffff', shadow: true },
        { slotId: 's2', x: 72, y: 28, width: 40, height: 36, rotation: 6, zIndex: 2, borderWidth: 10, borderColor: '#ffffff', shadow: true },
        { slotId: 's3', x: 28, y: 72, width: 40, height: 36, rotation: 6, zIndex: 3, borderWidth: 10, borderColor: '#ffffff', shadow: true },
        { slotId: 's4', x: 72, y: 72, width: 40, height: 36, rotation: -6, zIndex: 4, borderWidth: 10, borderColor: '#ffffff', shadow: true },
      ],
    },
    // 2 张竖图对称倾斜（左/右，垂直居中）
    {
      key: 'collage-2-tilt',
      type: 'collage',
      gridCols: 2,
      gridRows: 1,
      slots: [s(0, 0), s(1, 0)],
      elements: [
        { slotId: 's1', x: 32, y: 50, width: 38, height: 60, rotation: -8, zIndex: 1, borderWidth: 12, borderColor: '#ffffff', shadow: true },
        { slotId: 's2', x: 68, y: 50, width: 38, height: 60, rotation: 8, zIndex: 2, borderWidth: 12, borderColor: '#ffffff', shadow: true },
      ],
    },
    // === 新增模板 ===
    // 杂志风：1 大图 + 3 张小图环绕（中间大、四周小）
    {
      key: 'collage-magazine-4',
      type: 'collage',
      gridCols: 4,
      gridRows: 4,
      slots: [s(0, 0), s(1, 0), s(2, 0), s(3, 0)],
      elements: [
        // 中间大图（覆盖中心区域）
        { slotId: 's1', x: 50, y: 52, width: 50, height: 50, rotation: 0, zIndex: 2, borderWidth: 10, borderColor: '#ffffff', shadow: true },
        // 左上小图
        { slotId: 's2', x: 22, y: 22, width: 28, height: 28, rotation: -6, zIndex: 1, borderWidth: 8, borderColor: '#ffffff', shadow: true },
        // 右上小图
        { slotId: 's3', x: 78, y: 22, width: 28, height: 28, rotation: 7, zIndex: 1, borderWidth: 8, borderColor: '#ffffff', shadow: true },
        // 左下小图
        { slotId: 's4', x: 22, y: 82, width: 28, height: 28, rotation: 5, zIndex: 1, borderWidth: 8, borderColor: '#ffffff', shadow: true },
      ],
    },
    // L 形：左上 1 大 + 右下堆叠 2 张
    {
      key: 'collage-l-shape',
      type: 'collage',
      gridCols: 3,
      gridRows: 3,
      slots: [s(0, 0), s(1, 0), s(2, 0)],
      elements: [
        // 左上大图（占左上 60%）
        { slotId: 's1', x: 32, y: 32, width: 50, height: 50, rotation: -3, zIndex: 1, borderWidth: 12, borderColor: '#ffffff', shadow: true },
        // 右下小图 1
        { slotId: 's2', x: 70, y: 58, width: 32, height: 32, rotation: 6, zIndex: 2, borderWidth: 10, borderColor: '#ffffff', shadow: true },
        // 右下小图 2（叠在前一个上）
        { slotId: 's3', x: 78, y: 78, width: 32, height: 32, rotation: -4, zIndex: 3, borderWidth: 10, borderColor: '#ffffff', shadow: true },
      ],
    },
    // 三角堆叠：3 张卡片呈三角形分布
    {
      key: 'collage-triangle',
      type: 'collage',
      gridCols: 3,
      gridRows: 3,
      slots: [s(0, 0), s(1, 0), s(2, 0)],
      elements: [
        // 顶部一张
        { slotId: 's1', x: 50, y: 25, width: 40, height: 36, rotation: 0, zIndex: 1, borderWidth: 10, borderColor: '#ffffff', shadow: true },
        // 左下一张
        { slotId: 's2', x: 30, y: 72, width: 40, height: 40, rotation: 5, zIndex: 2, borderWidth: 10, borderColor: '#ffffff', shadow: true },
        // 右下一张
        { slotId: 's3', x: 70, y: 72, width: 40, height: 40, rotation: -5, zIndex: 3, borderWidth: 10, borderColor: '#ffffff', shadow: true },
      ],
    },
    // 横长条 + 2 张竖图（海报风）
    {
      key: 'collage-poster-3',
      type: 'collage',
      gridCols: 3,
      gridRows: 3,
      slots: [s(0, 0), s(1, 0), s(2, 0)],
      elements: [
        // 左侧大竖图（占左半边）
        { slotId: 's1', x: 28, y: 50, width: 40, height: 70, rotation: -2, zIndex: 1, borderWidth: 12, borderColor: '#ffffff', shadow: true },
        // 右上横长条
        { slotId: 's2', x: 72, y: 28, width: 42, height: 24, rotation: 3, zIndex: 2, borderWidth: 8, borderColor: '#ffffff', shadow: true },
        // 右下横长条
        { slotId: 's3', x: 72, y: 72, width: 42, height: 24, rotation: -3, zIndex: 3, borderWidth: 8, borderColor: '#ffffff', shadow: true },
      ],
    },
    // 5 张卡片散布：左上 + 中上 + 右上 + 左下 + 右下
    {
      key: 'collage-5-scatter',
      type: 'collage',
      gridCols: 5,
      gridRows: 5,
      slots: [s(0, 0), s(1, 0), s(2, 0), s(3, 0), s(4, 0)],
      elements: [
        { slotId: 's1', x: 22, y: 22, width: 30, height: 30, rotation: -8, zIndex: 1, borderWidth: 8, borderColor: '#ffffff', shadow: true },
        { slotId: 's2', x: 50, y: 32, width: 28, height: 32, rotation: 5, zIndex: 2, borderWidth: 8, borderColor: '#ffffff', shadow: true },
        { slotId: 's3', x: 78, y: 22, width: 30, height: 30, rotation: 8, zIndex: 3, borderWidth: 8, borderColor: '#ffffff', shadow: true },
        { slotId: 's4', x: 30, y: 72, width: 32, height: 32, rotation: 6, zIndex: 4, borderWidth: 8, borderColor: '#ffffff', shadow: true },
        { slotId: 's5', x: 72, y: 72, width: 30, height: 30, rotation: -5, zIndex: 5, borderWidth: 8, borderColor: '#ffffff', shadow: true },
      ],
    },
    // 顶部窄长条 + 中部中央大图 + 底部窄长条（中心轴对称）
    {
      key: 'collage-axis-3',
      type: 'collage',
      gridCols: 3,
      gridRows: 3,
      slots: [s(0, 0), s(1, 0), s(2, 0)],
      elements: [
        { slotId: 's1', x: 50, y: 15, width: 70, height: 18, rotation: 0, zIndex: 1, borderWidth: 8, borderColor: '#ffffff', shadow: true },
        { slotId: 's2', x: 50, y: 50, width: 46, height: 46, rotation: 0, zIndex: 2, borderWidth: 10, borderColor: '#ffffff', shadow: true },
        { slotId: 's3', x: 50, y: 85, width: 70, height: 18, rotation: 0, zIndex: 3, borderWidth: 8, borderColor: '#ffffff', shadow: true },
      ],
    },
    // 2 张错位倾斜：左上倾斜 -12° 较大 + 右下倾斜 12° 较小
    {
      key: 'collage-2-tilt-big',
      type: 'collage',
      gridCols: 2,
      gridRows: 1,
      slots: [s(0, 0), s(1, 0)],
      elements: [
        { slotId: 's1', x: 32, y: 42, width: 48, height: 56, rotation: -12, zIndex: 1, borderWidth: 12, borderColor: '#ffffff', shadow: true },
        { slotId: 's2', x: 68, y: 60, width: 42, height: 50, rotation: 10, zIndex: 2, borderWidth: 12, borderColor: '#ffffff', shadow: true },
      ],
    },
    // 4 张散布：中央错位十字（X 型）
    {
      key: 'collage-x-shape',
      type: 'collage',
      gridCols: 4,
      gridRows: 4,
      slots: [s(0, 0), s(1, 0), s(2, 0), s(3, 0)],
      elements: [
        { slotId: 's1', x: 28, y: 28, width: 32, height: 32, rotation: -10, zIndex: 1, borderWidth: 10, borderColor: '#ffffff', shadow: true },
        { slotId: 's2', x: 72, y: 28, width: 32, height: 32, rotation: 10, zIndex: 2, borderWidth: 10, borderColor: '#ffffff', shadow: true },
        { slotId: 's3', x: 28, y: 72, width: 32, height: 32, rotation: 10, zIndex: 3, borderWidth: 10, borderColor: '#ffffff', shadow: true },
        { slotId: 's4', x: 72, y: 72, width: 32, height: 32, rotation: -10, zIndex: 4, borderWidth: 10, borderColor: '#ffffff', shadow: true },
      ],
    },
  )

  return result
}

const templates: Template[] = buildTemplates()

const currentTemplate = ref<Template>(templates[0])
// 模板分类切换：'grid' 网格（默认） / 'collage' 拼贴卡片
const selectedCategory = ref<'grid' | 'collage'>('grid')
const slotImages = ref<Record<string, string>>({})
const slotPositions = ref<Record<string, { x: number; y: number }>>({})
const gap = ref(8) // 拼图块间隙
const bgColor = ref('#f5f5f7')
const filledCount = computed(() => Object.keys(slotImages.value).length)

const getSlotPosition = (slotId: string) => slotPositions.value[slotId] || { x: 50, y: 50 }

// === 上传处理：每个槽位独立 ===
const fileInputs: Record<string, HTMLInputElement | null> = {}
const handleSlotUpload = (slotId: string, e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    ElMessage.warning('请上传图片文件')
    return
  }
  if (file.size > 20 * 1024 * 1024) {
    ElMessage.warning('图片不能超过 20MB')
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    slotImages.value = { ...slotImages.value, [slotId]: reader.result as string }
  }
  reader.readAsDataURL(file)
  input.value = ''
}

const triggerUpload = (slotId: string) => {
  const input = fileInputs[slotId]
  if (input) input.click()
}

const removeSlotImage = (slotId: string) => {
  const next = { ...slotImages.value }
  const nextPos = { ...slotPositions.value }
  delete next[slotId]
  delete nextPos[slotId]
  slotImages.value = next
  slotPositions.value = nextPos
}

// === 拖动调整槽位图片位置 ===
const dragState = reactive({
  activeSlotId: null as string | null,
  startX: 0,
  startY: 0,
  startPosX: 50,
  startPosY: 50,
})

const onImageDragStart = (slotId: string, e: MouseEvent | TouchEvent) => {
  e.preventDefault()
  const point = 'touches' in e ? e.touches[0] : (e as MouseEvent)
  dragState.activeSlotId = slotId
  dragState.startX = point.clientX
  dragState.startY = point.clientY
  const pos = getSlotPosition(slotId)
  dragState.startPosX = pos.x
  dragState.startPosY = pos.y
}

const onImageDragMove = (e: MouseEvent | TouchEvent) => {
  if (!dragState.activeSlotId) return
  const el = document.querySelector(`[data-slot-id="${dragState.activeSlotId}"]`) as HTMLElement | null
  if (!el) return
  const rect = el.getBoundingClientRect()
  const point = 'touches' in e ? e.touches[0] : (e as MouseEvent)
  const dxPercent = ((point.clientX - dragState.startX) / rect.width) * 100
  const dyPercent = ((point.clientY - dragState.startY) / rect.height) * 100
  // 拖动方向：手指向右移动 ⇒ 图片向左移 ⇒ object-position x 减小
  let newX = dragState.startPosX - dxPercent
  let newY = dragState.startPosY - dyPercent
  newX = Math.max(0, Math.min(100, newX))
  newY = Math.max(0, Math.min(100, newY))
  slotPositions.value = {
    ...slotPositions.value,
    [dragState.activeSlotId]: { x: newX, y: newY },
  }
}

const onImageDragEnd = () => {
  if (!dragState.activeSlotId) return
  dragState.activeSlotId = null
}

if (typeof window !== 'undefined') {
  window.addEventListener('mousemove', onImageDragMove)
  window.addEventListener('mouseup', onImageDragEnd)
  window.addEventListener('touchmove', onImageDragMove, { passive: false })
  window.addEventListener('touchend', onImageDragEnd)
}

const resetPosition = (slotId: string) => {
  const nextPos = { ...slotPositions.value }
  delete nextPos[slotId]
  slotPositions.value = nextPos
}

const resetAll = () => {
  slotImages.value = {}
}

// === 切模板时清理超出槽位 ===
watch(currentTemplate, () => {
  const validIds = new Set(currentTemplate.value.slots.map((s) => s.id))
  const next: Record<string, string> = {}
  Object.keys(slotImages.value).forEach((k) => {
    if (validIds.has(k)) next[k] = slotImages.value[k]
  })
  slotImages.value = next
})

// === 切换分类时：若当前模板不属于新分类，自动切到新分类下第一个模板 ===
watch(selectedCategory, (cat) => {
  const cur = currentTemplate.value
  const curIsCollage = cur.type === 'collage'
  const needSwitch = (cat === 'collage' && !curIsCollage) || (cat === 'grid' && curIsCollage)
  if (needSwitch) {
    const first = templates.find((t) => cat === 'collage' ? t.type === 'collage' : t.type !== 'collage')
    if (first) currentTemplate.value = first
  }
})

// === 实时合成画布到 dataURL（不依赖 previewSrc） ===
const renderToDataURL = async (): Promise<string> => {
  if (filledCount.value === 0) return ''
  const tpl = currentTemplate.value
  // 强制 1:1 正方形（与上传区一致）
  const L = 1200
  const canvas = document.createElement('canvas')
  canvas.width = L
  canvas.height = L
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = bgColor.value
  ctx.fillRect(0, 0, L, L)

  if (tpl.type === 'collage' && tpl.elements) {
    await renderCollage(ctx, tpl.elements, L)
  } else {
    await renderGrid(ctx, tpl, L)
  }
  return canvas.toDataURL('image/png')
}

// === 网格模板渲染：按 gridCols/gridRows 等分 cell ===
const renderGrid = async (ctx: CanvasRenderingContext2D, tpl: Template, L: number) => {
  const gapVal = gap.value
  const cw = (L - gapVal * Math.max(0, tpl.gridCols - 1)) / tpl.gridCols
  const ch = (L - gapVal * Math.max(0, tpl.gridRows - 1)) / tpl.gridRows
  const drawPromises: Promise<void>[] = []
  tpl.slots.forEach((slot) => {
    const dataUrl = slotImages.value[slot.id]
    if (!dataUrl) return
    drawPromises.push(
      new Promise<void>((resolve) => {
        const img = new Image()
        img.onload = () => {
          const x = slot.col * (cw + gapVal)
          const y = slot.row * (ch + gapVal)
          const w = cw * slot.colSpan + gapVal * Math.max(0, slot.colSpan - 1)
          const h = ch * slot.rowSpan + gapVal * Math.max(0, slot.rowSpan - 1)
          const pos = getSlotPosition(slot.id)
          drawImageCover(ctx, img, x, y, w, h, pos.x, pos.y)
          resolve()
        }
        img.src = dataUrl
      })
    )
  })
  await Promise.all(drawPromises)
}

// === 拼贴模板渲染：按 elements 列表绘制卡片（旋转/边框/阴影/叠加） ===
const renderCollage = async (ctx: CanvasRenderingContext2D, elements: CardElement[], L: number) => {
  const sorted = [...elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
  for (const el of sorted) {
    const dataUrl = slotImages.value[el.slotId]
    if (!dataUrl) continue
    await new Promise<void>((resolve) => {
      const img = new Image()
      img.onload = () => {
        const cx = (el.x / 100) * L         // 元素中心 X（与 DOM transform-origin center center 一致）
        const cy = (el.y / 100) * L         // 元素中心 Y
        const w = (el.width / 100) * L
        const h = (el.height / 100) * L
        ctx.save()
        ctx.translate(cx, cy)
        if (el.rotation) {
          ctx.rotate((el.rotation * Math.PI) / 180)
        }
        if (el.shadow) {
          ctx.shadowColor = 'rgba(0, 0, 0, 0.25)'
          ctx.shadowBlur = 24
          ctx.shadowOffsetX = 6
          ctx.shadowOffsetY = 8
        }
        // 拍立得白边（在元素外侧画一圈）
        if (el.borderWidth && el.borderColor) {
          const bw = el.borderWidth
          ctx.fillStyle = el.borderColor
          ctx.fillRect(-w / 2 - bw, -h / 2 - bw, w + 2 * bw, h + 2 * bw)
        }
        // 重置阴影（图片本身不带阴影）
        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = 0
        const pos = getSlotPosition(el.slotId)
        drawImageCover(ctx, img, -w / 2, -h / 2, w, h, pos.x, pos.y, el.crop)
        ctx.restore()
        resolve()
      }
      img.src = dataUrl
    })
  }
}

// === 保持比例的 cover 绘制（支持 object-position 偏移与可选 crop 源区域） ===
const drawImageCover = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  offsetX: number = 50,
  offsetY: number = 50,
  crop?: { sx: number; sy: number; sw: number; sh: number }
) => {
  let sx = 0
  let sy = 0
  let sw = img.width
  let sh = img.height
  if (crop) {
    // 从原图指定区域取（百分比）
    sx = (crop.sx / 100) * img.width
    sy = (crop.sy / 100) * img.height
    sw = (crop.sw / 100) * img.width
    sh = (crop.sh / 100) * img.height
  } else {
    // cover 模式：按比例缩放到刚好填满盒子，多余方向裁掉
    const imgRatio = img.width / img.height
    const boxRatio = w / h
    if (imgRatio > boxRatio) {
      sw = img.height * boxRatio
      const maxSx = img.width - sw
      sx = (offsetX / 100) * maxSx
    } else {
      sh = img.width / boxRatio
      const maxSy = img.height - sh
      sy = (offsetY / 100) * maxSy
    }
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
}

// 生成文件名时间戳：yyyyMMdd_HHmmss，避免重复下载时文件名冲突
const fileTimestamp = (): string => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

// === 下载合并图 ===
const downloadMerged = async () => {
  const dataUrl = await renderToDataURL()
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = `puzzle_${currentTemplate.value.key}_${fileTimestamp()}.png`
  link.click()
}

// === 打包下载每张 ===
const downloadZip = async () => {
  if (filledCount.value === 0) {
    ElMessage.warning('请先上传图片')
    return
  }
  const zip = new JSZip()
  const tpl = currentTemplate.value
  const ts = fileTimestamp()
  // 合并图（实时合成，不依赖 previewSrc）
  const mergedDataUrl = await renderToDataURL()
  const base64 = mergedDataUrl.split(',')[1]
  zip.file(`puzzle_${tpl.key}_merged_${ts}.png`, base64, { base64: true })
  // 单图
  const folder = zip.folder('images')
  if (folder) {
    Object.keys(slotImages.value).forEach((slotId, idx) => {
      const data = slotImages.value[slotId].split(',')[1]
      folder.file(`slot_${idx + 1}_${slotId}.png`, data, { base64: true })
    })
  }
  const content = await zip.generateAsync({ type: 'blob' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(content)
  link.download = `puzzle_${tpl.key}_${ts}.zip`
  link.click()
  URL.revokeObjectURL(link.href)
}

// === 按 key 前缀分组（保证分组数 = 该前缀的 push 数）===
// 之前按 t.slots.length 分组，导致 four-3x2/four-2x3 这种 push 在 4 段但 slots=6
// 的跑到 6 组，six-* 段和 seven-* 段里也有类似误分类的模板，造成显示数 ≠ push 数。
// collage 类型独立成组，标签显示为"拼贴"。
const KEY_PREFIX_TO_COUNT: Record<string, number> = {
  split: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
}

const groupedTemplates = computed(() => {
  const map = new Map<string, Template[]>()
  const cat = selectedCategory.value
  templates.forEach((t) => {
    if (cat === 'grid') {
      // 网格分类：只看非 collage 模板
      if (t.type === 'collage') return
      const prefix = t.key.split('-')[0]
      const count = KEY_PREFIX_TO_COUNT[prefix]
      if (count === undefined) return
      const key = String(count)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(t)
    } else {
      // 拼贴分类：只看 collage 模板
      if (t.type !== 'collage') return
      if (!map.has('collage')) map.set('collage', [])
      map.get('collage')!.push(t)
    }
  })
  return Array.from(map.entries())
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([key, list]) => ({
      count: key === 'collage' ? '拼贴' : Number(key),
      list,
    }))
})
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white">
      <!-- 顶部工具条 -->
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <el-button type="warning" plain size="small" @click="resetAll" :disabled="filledCount === 0">
          <el-icon class="mr-1"><RefreshIcon /></el-icon>
          清空全部
        </el-button>
        <div class="flex items-center gap-2 ml-auto">
          <span class="text-xs text-gray-500">背景</span>
          <input type="color" v-model="bgColor" class="w-8 h-8 rounded cursor-pointer" />
        </div>
      </div>

      <!-- 左右分栏 -->
      <div class="flex flex-col lg:flex-row gap-4">
        <!-- 左侧：模板列表（按槽位数量分组） -->
        <div class="lg:w-72 lg:flex-shrink-0">
          <div class="flex items-center justify-between mb-2">
            <div class="text-sm font-medium text-gray-700">选择模板</div>
            <div class="flex gap-1 text-xs">
              <button
                type="button"
                @click="selectedCategory = 'grid'"
                :class="selectedCategory === 'grid'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
                class="px-2.5 py-0.5 rounded transition"
              >网格</button>
              <button
                type="button"
                @click="selectedCategory = 'collage'"
                :class="selectedCategory === 'collage'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
                class="px-2.5 py-0.5 rounded transition"
              >拼贴</button>
            </div>
          </div>
          <div class="overflow-y-auto pr-1" style="max-height: 70vh;">
            <div
              v-for="group in groupedTemplates"
              :key="group.count"
              class="mb-4"
            >
              <div class="text-base font-semibold text-gray-800 mb-2 px-1">
                {{ group.count }}
              </div>
              <div
                class="grid gap-3 pl-3"
                style="grid-template-columns: repeat(3, minmax(0, 1fr));"
              >
                <div
                  v-for="t in group.list"
                  :key="t.key"
                  class="border rounded-lg p-1.5 cursor-pointer transition-all hover:shadow-md"
                  :class="currentTemplate.key === t.key
                    ? 'border-blue-500 bg-blue-50 shadow-md ring-1 ring-blue-500'
                    : 'border-gray-200 hover:border-blue-300'"
                  @click="currentTemplate = t"
                >
                  <!-- 网格模板：按 grid 布局显示方块 -->
                  <div
                    v-if="t.type !== 'collage'"
                    class="w-full bg-gray-100 rounded overflow-hidden grid gap-[2px]"
                    style="aspect-ratio: 1 / 1;"
                    :style="{
                      gridTemplateColumns: t.colRatio || `repeat(${t.gridCols}, 1fr)`,
                      gridTemplateRows: t.rowRatio || `repeat(${t.gridRows}, 1fr)`,
                    }"
                  >
                    <!-- 按 slot 渲染：一个 slot 一个方块，跨格的 slot 显示为完整方块 -->
                    <div
                      v-for="slot in t.slots"
                      :key="slot.id"
                      class="rounded-sm bg-gray-300"
                      :style="{
                        gridColumn: `${slot.col + 1} / span ${slot.colSpan}`,
                        gridRow: `${slot.row + 1} / span ${slot.rowSpan}`,
                      }"
                    ></div>
                  </div>
                  <!-- 拼贴模板：按 elements 绝对定位，旋转/边框/阴影，允许溢出 -->
                  <div
                    v-else
                    class="relative w-full bg-gray-100 rounded overflow-hidden"
                    style="aspect-ratio: 1 / 1;"
                  >
                    <div
                      v-for="(el, idx) in (t.elements || [])"
                      :key="el.slotId"
                      class="absolute bg-gray-300 rounded-sm"
                      :style="{
                        left: `calc(${el.x}% - ${el.width / 2}%)`,
                        top: `calc(${el.y}% - ${el.height / 2}%)`,
                        width: `${el.width}%`,
                        height: `${el.height}%`,
                        transform: el.rotation ? `rotate(${el.rotation}deg)` : 'none',
                        transformOrigin: 'center center',
                        zIndex: el.zIndex ?? idx,
                        boxShadow: el.shadow ? '0 4px 8px rgba(0,0,0,0.18)' : 'none',
                        outline: (el.borderWidth && el.borderColor) ? `${Math.max(1, el.borderWidth / 6)}px solid ${el.borderColor}` : 'none',
                        outlineOffset: el.borderWidth ? `-${Math.max(1, el.borderWidth / 6)}px` : '0',
                      }"
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 右侧：模板对应的上传区 + 预览 -->
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium mb-2 text-gray-700 flex items-center justify-between gap-2 flex-wrap">
            <div class="flex items-center gap-3">
              <span>
                当前模板（{{ currentTemplate.slots.length }} 个槽位）
              </span>
              <span class="text-xs text-gray-500">
                已上传 {{ filledCount }} / {{ currentTemplate.slots.length }}
              </span>
            </div>
            <div v-if="filledCount > 0" class="flex gap-2">
              <el-button type="primary" size="small" @click="downloadMerged">
                <el-icon class="mr-1"><DownloadIcon /></el-icon>
                下载合并图
              </el-button>
              <el-button type="success" size="small" @click="downloadZip">
                <el-icon class="mr-1"><DownloadIcon /></el-icon>
                打包 ZIP 下载
              </el-button>
            </div>
          </div>

          <!-- 槽位上传区：每个槽位一个独立上传位 -->
          <div
            class="rounded-xl p-3 flex justify-center items-center self-stretch transition-colors"
            :style="{ backgroundColor: bgColor }"
          >
            <!-- 网格模板：按 grid 等分排版 -->
            <div
              v-if="currentTemplate.type !== 'collage'"
              class="slot-grid grid gap-2"
              :style="{
                gridTemplateColumns: currentTemplate.colRatio || `repeat(${currentTemplate.gridCols}, minmax(0, 1fr))`,
                gridTemplateRows: currentTemplate.rowRatio || `repeat(${currentTemplate.gridRows}, minmax(0, 1fr))`,
                gap: gap + 'px',
                aspectRatio: '1 / 1',
                width: 'min(100%, calc(100vh - 280px))',
              }"
            >
              <div
                v-for="slot in currentTemplate.slots"
                :key="slot.id"
                :data-slot-id="slot.id"
                class="relative group rounded-lg overflow-hidden border-2 border-dashed border-gray-300 hover:border-blue-400 transition bg-white flex items-center justify-center"
                :class="slotImages[slot.id] ? 'cursor-move' : ''"
                :style="{
                  gridColumn: `${slot.col + 1} / span ${slot.colSpan}`,
                  gridRow: `${slot.row + 1} / span ${slot.rowSpan}`,
                }"
                @mousedown="slotImages[slot.id] && onImageDragStart(slot.id, $event)"
                @touchstart="slotImages[slot.id] && onImageDragStart(slot.id, $event)"
              >
                <template v-if="slotImages[slot.id]">
                  <img
                    :src="slotImages[slot.id]"
                    :alt="`槽位 ${slot.id}`"
                    class="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
                    :style="{
                      objectPosition: `${getSlotPosition(slot.id).x}% ${getSlotPosition(slot.id).y}%`,
                      cursor: dragState.activeSlotId === slot.id ? 'grabbing' : 'move',
                    }"
                    draggable="false"
                  />
                  <div class="absolute top-1 left-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded pointer-events-none">
                    {{ slot.id.replace('s', '') }}
                  </div>
                  <div
                    v-if="dragState.activeSlotId === slot.id"
                    class="absolute top-1 right-1 bg-blue-500/80 text-white text-[10px] px-1.5 py-0.5 rounded pointer-events-none"
                  >
                    {{ Math.round(getSlotPosition(slot.id).x) }}% · {{ Math.round(getSlotPosition(slot.id).y) }}%
                  </div>
                  <div class="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    <el-tooltip content="重置位置" placement="top">
                      <el-button size="small" type="warning" @click.stop="resetPosition(slot.id)" circle>
                        <el-icon><RefreshIcon /></el-icon>
                      </el-button>
                    </el-tooltip>
                    <el-tooltip content="替换图片" placement="top">
                      <el-button size="small" type="primary" @click.stop="triggerUpload(slot.id)" circle>
                        <el-icon><PlusIcon /></el-icon>
                      </el-button>
                    </el-tooltip>
                    <el-tooltip content="删除" placement="top">
                      <el-button size="small" type="danger" @click.stop="removeSlotImage(slot.id)" circle>
                        <el-icon><DeleteIcon /></el-icon>
                      </el-button>
                    </el-tooltip>
                  </div>
                </template>
                <template v-else>
                  <button
                    type="button"
                    class="w-full h-full flex flex-col items-center justify-center text-gray-400 hover:text-blue-500 transition"
                    @click="triggerUpload(slot.id)"
                  >
                    <el-icon class="text-2xl mb-1"><PlusIcon /></el-icon>
                    <span class="text-xs">点击上传</span>
                    <span class="text-[10px] mt-0.5 text-gray-400">槽位 {{ slot.id.replace('s', '') }}</span>
                  </button>
                  <input
                    type="file"
                    :ref="(el) => (fileInputs[slot.id] = el as HTMLInputElement)"
                    accept="image/*"
                    class="hidden"
                    @change="(e) => handleSlotUpload(slot.id, e)"
                  />
                </template>
              </div>
            </div>
            <!-- 拼贴模板：按 elements 自由排版（允许旋转/溢出） -->
            <div
              v-else
              class="slot-canvas relative"
              :style="{
                aspectRatio: '1 / 1',
                width: 'min(100%, calc(100vh - 280px))',
                alignSelf: 'center',
              }"
            >
              <div
                v-for="(el, idx) in (currentTemplate.elements || [])"
                :key="el.slotId"
                :data-slot-id="el.slotId"
                class="absolute group rounded-lg overflow-hidden bg-white flex items-center justify-center"
                :class="slotImages[el.slotId] ? 'cursor-move' : ''"
                :style="{
                  left: `calc(${el.x}% - ${el.width / 2}%)`,
                  top: `calc(${el.y}% - ${el.height / 2}%)`,
                  width: `${el.width}%`,
                  height: `${el.height}%`,
                  transform: el.rotation ? `rotate(${el.rotation}deg)` : 'none',
                  transformOrigin: 'center center',
                  zIndex: el.zIndex ?? idx,
                  boxShadow: [
                    el.borderWidth && el.borderColor ? `0 0 0 ${el.borderWidth / 12}% ${el.borderColor}` : '',
                    el.shadow ? '0 4px 12px rgba(0, 0, 0, 0.2)' : '',
                  ].filter(Boolean).join(', ') || 'none',
                  backgroundColor: '#ffffff',
                }"
                @mousedown="slotImages[el.slotId] && onImageDragStart(el.slotId, $event)"
                @touchstart="slotImages[el.slotId] && onImageDragStart(el.slotId, $event)"
              >
                <template v-if="slotImages[el.slotId]">
                  <img
                    :src="slotImages[el.slotId]"
                    :alt="`槽位 ${el.slotId}`"
                    class="w-full h-full object-cover pointer-events-none select-none"
                    :style="{
                      objectPosition: `${getSlotPosition(el.slotId).x}% ${getSlotPosition(el.slotId).y}%`,
                      cursor: dragState.activeSlotId === el.slotId ? 'grabbing' : 'move',
                    }"
                    draggable="false"
                  />
                  <div class="absolute top-1 left-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded pointer-events-none">
                    {{ el.slotId.replace('s', '') }}
                  </div>
                  <div
                    v-if="dragState.activeSlotId === el.slotId"
                    class="absolute top-1 right-1 bg-blue-500/80 text-white text-[10px] px-1.5 py-0.5 rounded pointer-events-none"
                  >
                    {{ Math.round(getSlotPosition(el.slotId).x) }}% · {{ Math.round(getSlotPosition(el.slotId).y) }}%
                  </div>
                </template>
                <template v-else>
                  <button
                    type="button"
                    class="w-full h-full flex flex-col items-center justify-center text-gray-400 hover:text-blue-500 transition"
                    @click="triggerUpload(el.slotId)"
                  >
                    <el-icon class="text-2xl mb-1"><PlusIcon /></el-icon>
                    <span class="text-xs">点击上传</span>
                    <span class="text-[10px] mt-0.5 text-gray-400">槽位 {{ el.slotId.replace('s', '') }}</span>
                  </button>
                  <input
                    type="file"
                    :ref="(elRef) => (fileInputs[el.slotId] = elRef as HTMLInputElement)"
                    accept="image/*"
                    class="hidden"
                    @change="(e) => handleSlotUpload(el.slotId, e)"
                  />
                </template>
              </div>
            </div>
          </div>

          <!-- 拼贴模板专用：独立的槽位操作面板（避免被叠加的卡片遮挡 hover 按钮） -->
          <div
            v-if="currentTemplate.type === 'collage' && currentTemplate.elements"
            class="mt-3 bg-white border rounded-xl p-3"
          >
            <div class="text-xs text-gray-500 mb-2">各槽位操作（画布外的独立面板，不受叠加影响）</div>
            <div class="flex flex-wrap gap-2">
              <div
                v-for="el in currentTemplate.elements"
                :key="el.slotId"
                class="flex items-center gap-2 px-2 py-1.5 border rounded-lg bg-gray-50"
              >
                <span class="text-xs font-medium text-gray-700">
                  槽位{{ el.slotId.replace('s', '') }}
                </span>
                <template v-if="slotImages[el.slotId]">
                  <img
                    :src="slotImages[el.slotId]"
                    :alt="`槽位 ${el.slotId}`"
                    class="w-8 h-8 object-cover rounded border"
                    :style="{ objectPosition: `${getSlotPosition(el.slotId).x}% ${getSlotPosition(el.slotId).y}%` }"
                  />
                </template>
                <template v-else>
                  <span class="w-8 h-8 rounded border border-dashed border-gray-300 flex items-center justify-center text-gray-400">
                    <el-icon><PlusIcon /></el-icon>
                  </span>
                </template>
                <el-tooltip content="替换图片" placement="top">
                  <el-button size="small" type="primary" @click="triggerUpload(el.slotId)" circle>
                    <el-icon><PlusIcon /></el-icon>
                  </el-button>
                </el-tooltip>
                <el-tooltip content="删除" placement="top">
                  <el-button
                    size="small"
                    type="danger"
                    @click="removeSlotImage(el.slotId)"
                    :disabled="!slotImages[el.slotId]"
                    circle
                  >
                    <el-icon><DeleteIcon /></el-icon>
                  </el-button>
                </el-tooltip>
                <el-tooltip content="重置位置" placement="top">
                  <el-button
                    size="small"
                    type="warning"
                    @click="resetPosition(el.slotId)"
                    :disabled="!slotImages[el.slotId]"
                    circle
                  >
                    <el-icon><RefreshIcon /></el-icon>
                  </el-button>
                </el-tooltip>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <ToolDetail title="使用说明">
      <el-text>
        <strong>图片拼图工具</strong>采用左右分栏设计：左侧选择模板，右侧给每个槽位独立上传图片，最终合成一张大图。<br /><br />
        <strong>使用方法：</strong><br />
        1. 在左侧选择一种拼图模板（如四宫格、朋友圈九宫格、电影海报等）<br />
        2. 在右侧的每个槽位依次上传对应的图片（每张图片会被自动 cover 填充到槽位，<b>所见即所得</b>）<br />
        3. 上传后<b>可拖动图片调整显示位置</b>；拼贴模式下用下方独立的槽位操作面板进行替换/删除/重置<br />
        4. 点击「下载合并图」一键下载大图，或「打包 ZIP 下载」包含原图<br /><br />
        <strong>模板说明：</strong><br />
        提供两种风格：<b>网格模板</b>（整齐的等分排版，槽位数从 2 到 16 全覆盖，包含双图/三图/四图横竖排、方形网格、大图+小图、电影海报、朋友圈长图等数十种布局）和<b>拼贴卡片</b>（错位叠加、旋转角度、拍立得白边、阴影，部分元素可溢出画布边缘，类似参考图的「不规则排版」效果）。<br /><br />
        <strong>纯前端处理：</strong>所有图片处理在浏览器本地完成，不会上传到服务器，保护你的隐私。<br /><br />
        <strong>完全免费：</strong>本工具完全免费使用，导出图片不会带任何水印。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
.hidden {
  display: none;
}
</style>