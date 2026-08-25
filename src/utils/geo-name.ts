// 国家代码 / 城市名 → 中文展示名
// 用途：后台「工具使用记录」位置列展示
//
// 设计：仅覆盖后台常见的国家/城市，避免引入过大的本地化包；
// 命中不到时回退到原文（英文/拼音），保证「有就好」。
//
// 数据源参考：Cloudflare request.cf
//   - country：ISO 3166-1 alpha-2（'CN' / 'US' / 'JP' / 'HK' / 'TW' ...）
//   - city：英文/原文（'Shenzhen' / 'Beijing' / 'Tokyo' ...）
//   - region：格式依国家而异（'Guangdong' / 'CA' / '13'），不单独展示

/** ISO 3166-1 alpha-2 国家代码 → 中文国家名（仅收录后台常见国家） */
const COUNTRY_NAME_ZH: Record<string, string> = {
  CN: '中国',
  HK: '中国香港',
  MO: '中国澳门',
  TW: '中国台湾',
  US: '美国',
  JP: '日本',
  KR: '韩国',
  SG: '新加坡',
  MY: '马来西亚',
  TH: '泰国',
  VN: '越南',
  ID: '印度尼西亚',
  PH: '菲律宾',
  IN: '印度',
  AU: '澳大利亚',
  NZ: '新西兰',
  GB: '英国',
  DE: '德国',
  FR: '法国',
  IT: '意大利',
  ES: '西班牙',
  NL: '荷兰',
  RU: '俄罗斯',
  CA: '加拿大',
  BR: '巴西',
  AR: '阿根廷',
  MX: '墨西哥',
  AE: '阿联酋',
  SA: '沙特阿拉伯',
  TR: '土耳其',
  EG: '埃及',
  ZA: '南非',
}

/** 常见中国城市英文 → 中文 */
const CN_CITY_NAME_ZH: Record<string, string> = {
  Shenzhen: '深圳',
  Beijing: '北京',
  Shanghai: '上海',
  Guangzhou: '广州',
  Dongguan: '东莞',
  Foshan: '佛山',
  Zhuhai: '珠海',
  Zhongshan: '中山',
  Huizhou: '惠州',
  'Shantou': '汕头',
  Jieyang: '揭阳',
  'Chaozhou': '潮州',
  Meizhou: '梅州',
  'Heyuan': '河源',
  'Zhanjiang': '湛江',
  'Maoming': '茂名',
  'Yangjiang': '阳江',
  'Jiangmen': '江门',
  'Zhaoqing': '肇庆',
  'Qingyuan': '清远',
  'Shaoguan': '韶关',
  Hangzhou: '杭州',
  Nanjing: '南京',
  Suzhou: '苏州',
  Wuxi: '无锡',
  'Changzhou': '常州',
  'Ningbo': '宁波',
  'Wenzhou': '温州',
  'Jiaxing': '嘉兴',
  'Huzhou': '湖州',
  'Shaoxing': '绍兴',
  'Jinhua': '金华',
  Chengdu: '成都',
  'Chongqing': '重庆',
  Wuhan: '武汉',
  Changsha: '长沙',
  'Zhengzhou': '郑州',
  'Xi\'an': '西安',
  Xian: '西安',
  'Qingdao': '青岛',
  'Jinan': '济南',
  'Yantai': '烟台',
  'Dalian': '大连',
  'Shenyang': '沈阳',
  'Harbin': '哈尔滨',
  'Changchun': '长春',
  'Kunming': '昆明',
  'Guiyang': '贵阳',
  'Nanning': '南宁',
  'Haikou': '海口',
  'Sanya': '三亚',
  'Lhasa': '拉萨',
  'Urumqi': '乌鲁木齐',
  'Lanzhou': '兰州',
  'Xining': '西宁',
  'Yinchuan': '银川',
  Hohhot: '呼和浩特',
  'Taiyuan': '太原',
  'Shijiazhuang': '石家庄',
  'Tianjin': '天津',
  'Hefei': '合肥',
  'Nanchang': '南昌',
  'Fuzhou': '福州',
  'Xiamen': '厦门',
  'Quanzhou': '泉州',
  'Liuzhou': '柳州',
  'Guilin': '桂林',
  'Taipei': '台北',
  'Kaohsiung': '高雄',
  'Taichung': '台中',
  'Tainan': '台南',
  'Hong Kong': '香港',
  'Macau': '澳门',
}

/** 其他常见海外城市英文 → 中文（少量高频，方便浏览） */
const CITY_NAME_ZH: Record<string, string> = {
  Tokyo: '东京',
  Osaka: '大阪',
  Kyoto: '京都',
  Seoul: '首尔',
  Busan: '釜山',
  Singapore: '新加坡',
  'Kuala Lumpur': '吉隆坡',
  Bangkok: '曼谷',
  'Ho Chi Minh City': '胡志明市',
  Hanoi: '河内',
  Jakarta: '雅加达',
  Manila: '马尼拉',
  'New York': '纽约',
  'Los Angeles': '洛杉矶',
  'San Francisco': '旧金山',
  Chicago: '芝加哥',
  Seattle: '西雅图',
  Boston: '波士顿',
  Washington: '华盛顿',
  Houston: '休斯顿',
  Miami: '迈阿密',
  London: '伦敦',
  Paris: '巴黎',
  Berlin: '柏林',
  Frankfurt: '法兰克福',
  Munich: '慕尼黑',
  Amsterdam: '阿姆斯特丹',
  Madrid: '马德里',
  Barcelona: '巴塞罗那',
  Rome: '罗马',
  Milan: '米兰',
  Moscow: '莫斯科',
  Sydney: '悉尼',
  Melbourne: '墨尔本',
  Toronto: '多伦多',
  Vancouver: '温哥华',
  Dubai: '迪拜',
  Istanbul: '伊斯坦布尔',
  'Mexico City': '墨西哥城',
  'Sao Paulo': '圣保罗',
}

/**
 * 国家代码 → 中文国家名；找不到返回原 code
 */
export function countryName(code: string | null | undefined): string {
  if (!code) return ''
  const upper = code.toUpperCase()
  return COUNTRY_NAME_ZH[upper] || code
}

/**
 * 城市名 → 中文城市名；优先查中国城市表，再查其他，再退回原名
 */
export function cityName(city: string | null | undefined): string {
  if (!city) return ''
  // CN_CITY / CITY 两张表都不区分大小写匹配
  const direct = CN_CITY_NAME_ZH[city] || CITY_NAME_ZH[city]
  if (direct) return direct
  // 尝试大小写不敏感
  const lower = city.toLowerCase()
  for (const [k, v] of Object.entries(CN_CITY_NAME_ZH)) {
    if (k.toLowerCase() === lower) return v
  }
  for (const [k, v] of Object.entries(CITY_NAME_ZH)) {
    if (k.toLowerCase() === lower) return v
  }
  return city
}

/**
 * 拼装「位置」展示字符串：国家 · 城市
 *   - 都没有 → '-'
 *   - 只有国家 → 国家
 *   - 只有城市 → 城市
 *   - 国家 === 'CN' 且无 city → '中国'
 */
export function formatLocation(
  country: string | null | undefined,
  city: string | null | undefined,
): string {
  const c = countryName(country)
  const ci = cityName(city)
  if (!c && !ci) return '-'
  if (c && ci) return `${c} · ${ci}`
  return c || ci
}
