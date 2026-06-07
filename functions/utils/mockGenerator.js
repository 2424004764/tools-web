// 与前端 MockData.vue 保持一致的字段数据生成器
// 每次调用都重新生成（mock 接口通常期望每次返回新数据）

const SURNAMES = ['王', '李', '张', '刘', '陈', '杨', '黄', '赵', '吴', '周', '徐', '孙', '马', '朱', '胡', '林', '郭', '何', '高', '罗']
const GIVEN_CHARS = '伟芳娜秀英敏静丽强磊军洋勇艳杰娟涛明超秀兰霞平刚桂英文华建国家春哲志强宇浩然子轩思辰雅萱梓涵雨欣诗琪'
const COMPANIES = ['阿里巴巴', '腾讯科技', '字节跳动', '美团', '京东', '百度', '小米科技', '华为技术', '网易', '拼多多', '滴滴出行', '快手', '哔哩哔哩', '新浪', '搜狐']
const CITIES = ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '南京', '苏州', '西安', '重庆', '天津', '长沙', '青岛', '厦门', '宁波']
const PROVINCES = ['北京市', '上海市', '广东省', '江苏省', '浙江省', '四川省', '湖北省', '陕西省', '重庆市', '天津市']
const DISTRICTS = ['朝阳区', '海淀区', '浦东新区', '黄浦区', '天河区', '南山区', '西湖区', '锦江区', '武侯区', '鼓楼区']
const LOREM_WORDS = ['lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit', 'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'magna', 'aliqua']

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randFloat(min, max, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals))
}

function pick(arr) {
  return arr[randInt(0, arr.length - 1)]
}

function pad(n, len = 2) {
  return String(n).padStart(len, '0')
}

function randString(len = 6, prefix = '') {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let s = ''
  for (let i = 0; i < len; i++) s += chars[randInt(0, chars.length - 1)]
  return prefix + s
}

function randName() {
  const surname = pick(SURNAMES)
  const len = randInt(1, 2)
  let given = ''
  for (let i = 0; i < len; i++) given += pick(GIVEN_CHARS.split(''))
  return surname + given
}

function randPhone() {
  const prefixes = ['13', '15', '17', '18', '19']
  return pick(prefixes) + randInt(100000000, 999999999).toString().padStart(9, '0')
}

function randEmail() {
  return randString(randInt(5, 8)) + '@' + randString(randInt(4, 7)) + '.' + pick(['com', 'cn', 'org', 'io'])
}

function randDate() {
  const d = new Date(Date.now() - randInt(0, 365) * 86400000)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function randDatetime() {
  const d = new Date(Date.now() - randInt(0, 365) * 86400000 - randInt(0, 86400) * 1000)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}Z`
}

function randColor() {
  return '#' + randInt(0, 0xFFFFFF).toString(16).padStart(6, '0')
}

function randAvatar() {
  return `https://i.pravatar.cc/300?u=${randInt(1, 10000)}`
}

function randAddress() {
  return pick(PROVINCES) + pick(CITIES) + pick(DISTRICTS) + `${randInt(1, 200)}号`
}

function randCompany() {
  return pick(COMPANIES) + (Math.random() > 0.5 ? '有限公司' : '集团')
}

function randLorem() {
  const sentence = []
  for (let i = 0; i < randInt(4, 10); i++) sentence.push(pick(LOREM_WORDS))
  return sentence.join(' ') + '.'
}

function randUrl() {
  return `https://example.com/${randString(8)}`
}

function generatePrimitive(type, field) {
  const min = field?.min ?? 0
  const max = field?.max ?? 100
  let v
  switch (type) {
    case 'string': v = randString(randInt(4, 8), field?.prefix || ''); break
    case 'integer': v = randInt(min, max); break
    case 'float': v = randFloat(min, max); break
    case 'boolean': v = Math.random() > 0.5; break
    case 'email': v = randEmail(); break
    case 'name': v = randName(); break
    case 'phone': v = randPhone(); break
    case 'url': v = randUrl(); break
    case 'date': v = randDate(); break
    case 'datetime': v = randDatetime(); break
    case 'color': v = randColor(); break
    case 'avatar': v = randAvatar(); break
    case 'address': v = randAddress(); break
    case 'company': v = randCompany(); break
    case 'lorem': v = randLorem(); break
    case 'id': v = crypto.randomUUID(); break
    default: v = null
  }
  if (type === 'string' && Array.isArray(field?.options) && field.options.length > 0) {
    v = pick(field.options)
  }
  return v
}

function isEmpty(v) {
  if (v === '' || v === null || v === undefined) return true
  if (Array.isArray(v) && v.length === 0) return true
  if (typeof v === 'object' && v !== null && !Array.isArray(v) && Object.keys(v).length === 0) return true
  return false
}

function generateFieldValue(field) {
  if (field.type === 'object') {
    const obj = {}
    for (const child of field.children || []) {
      let v = generateFieldValue(child)
      if (child.required && isEmpty(v)) v = generateFieldValue(child)
      obj[child.name] = v
    }
    return obj
  }
  if (field.type === 'array') {
    const len = randInt(field.min ?? 1, field.max ?? 3)
    const itemType = field.itemType || 'string'
    const arr = []
    for (let i = 0; i < len; i++) {
      if (itemType === 'object') {
        const obj = {}
        for (const child of field.itemChildren || []) {
          obj[child.name] = generateFieldValue(child)
        }
        arr.push(obj)
      } else {
        arr.push(generatePrimitive(itemType, field))
      }
    }
    return arr
  }
  return generatePrimitive(field.type, field)
}

// 主入口：按 schema 数组生成单个 JSON 对象
export function generateMockData(schema) {
  const validFields = (schema || []).filter(f => f && f.name && f.name.trim())
  if (validFields.length === 0) return {}
  const obj = {}
  for (const f of validFields) {
    let v = generateFieldValue(f)
    if (f.required && isEmpty(v)) v = generateFieldValue(f)
    obj[f.name] = v
  }
  return obj
}
