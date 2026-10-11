// 头部「更多产品」下拉数据：工具站之外的兄弟产品矩阵。
// key 用于站内跳转中间页 /app-jump/:key（白名单校验用，防止开放重定向）；
// url 为产品正式域名，由中间页完成使用记录后出站跳转。
// logo 为 public/images/logo/ 下的独立 SVG，与各产品自身 favicon 保持一致。
export interface ProductInfo {
  /** 站内白名单键（小写字母数字连字符），用于 /app-jump/:key */
  key: string
  name: string
  desc: string
  url: string
  logo: string
}

/** 由 key 取规范化后的站内跳转路径（带尾斜杠，与工具路由风格一致） */
export function productJumpPath(key: string): string {
  return `/app-jump/${key}/`
}

export const PRODUCTS: ProductInfo[] = [
  {
    key: 'tiji',
    name: '题迹',
    desc: '自建题库 · 在线刷题 · 答题反馈',
    url: 'https://tiji.fologde.com',
    logo: '/images/logo/product-tiji.svg',
  },
  {
    key: 'lumen',
    name: '流明壁纸',
    desc: '高清壁纸 · 沉浸画廊 · 一键下载',
    url: 'https://lumen.fologde.com',
    logo: '/images/logo/product-lumen.svg',
  },
  {
    key: 'jiance',
    name: '简册',
    desc: '照片相册 · 时间流 · 公开分享',
    url: 'https://jiance.fologde.com',
    logo: '/images/logo/product-jiance.svg',
  },
  {
    key: 'idea-store',
    name: '灵感仓',
    desc: '文案图片 · 素材收藏 · 云端同步',
    url: 'https://idea-store.fologde.com',
    logo: '/images/logo/product-idea-store.svg',
  },
  {
    key: 'jiyibi',
    name: '记一笔',
    desc: '在线记账 · 支出统计 · 多端同步',
    url: 'https://jiyibi.fologde.com',
    logo: '/images/logo/product-jiyibi.svg',
  },
  {
    key: 'mbti',
    name: 'MBTI 人格测试',
    desc: '16 型人格 · 免费测试 · 人格配对',
    url: 'https://mbtitest.fologde.com',
    logo: '/images/logo/product-mbti.svg',
  },
]
