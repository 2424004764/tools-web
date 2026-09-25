// 分类标题 → 图标组件映射（侧边栏 / 分类页共用）。
// unplugin-icons 静态导入，名称均已在 @iconify-json/ep 中确认存在。
import IconCpu from '~icons/ep/cpu'
import IconDocument from '~icons/ep/document'
import IconReading from '~icons/ep/reading'
import IconPicture from '~icons/ep/picture'
import IconCoffee from '~icons/ep/coffee'
import IconTrendCharts from '~icons/ep/trend-charts'
import IconMagicStick from '~icons/ep/magic-stick'
import IconStar from '~icons/ep/star'
import IconCollection from '~icons/ep/collection'
import IconFilm from '~icons/ep/film'
import IconManagement from '~icons/ep/management'
import IconDataAnalysis from '~icons/ep/data-analysis'
import IconCompass from '~icons/ep/compass'
import IconMemo from '~icons/ep/memo'
import IconBox from '~icons/ep/box'
import type { Component } from 'vue'

interface CateIconRule {
  match: string[]
  icon: Component
}

// 按「分类标题包含关键词」匹配，先命中先用；都不中回退罗盘（泛导航含义）
const CATE_ICON_RULES: CateIconRule[] = [
  { match: ['开发', '运维', '代码'], icon: IconCpu },
  { match: ['文本', '文字'], icon: IconDocument },
  { match: ['教育', '学术'], icon: IconReading },
  { match: ['图片', '图像'], icon: IconPicture },
  { match: ['生活'], icon: IconCoffee },
  { match: ['数据'], icon: IconDataAnalysis },
  { match: ['图表', '可视化'], icon: IconTrendCharts },
  { match: ['趣味', '互动', '游戏', '随机'], icon: IconMagicStick },
  { match: ['AI'], icon: IconMagicStick },
  { match: ['好物', '网站'], icon: IconStar },
  { match: ['收藏', '稍后读'], icon: IconCollection },
  { match: ['媒体', '娱乐'], icon: IconFilm },
  { match: ['陪伴', '关怀'], icon: IconMemo },
  { match: ['内容', '管理'], icon: IconManagement },
]

export function getCateIcon(title: string): Component {
  for (const rule of CATE_ICON_RULES) {
    if (rule.match.some((k) => title.includes(k))) return rule.icon
  }
  return IconCompass
}

export { IconBox as DefaultCateIcon }
