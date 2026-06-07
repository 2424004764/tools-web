import { ApiResponse } from '../utils/db.js'

// 预置示例：4 套常用 API 响应 Schema，每个 sample 是单个 JSON 对象（API 响应根必须是对象）
const SAMPLES = {
  userInfo: {
    key: 'userInfo',
    name: '用户信息',
    description: '单个用户的 API 响应结构（基本资料 + 头像）',
    schema: [
      { name: 'code', type: 'integer', required: true, min: 0, max: 0 },
      { name: 'message', type: 'string', prefix: 'ok' },
      { name: 'data', type: 'object', required: true, children: [
        { name: 'id', type: 'integer', required: true, min: 1, max: 999999 },
        { name: 'name', type: 'name', required: true },
        { name: 'email', type: 'email', required: true },
        { name: 'age', type: 'integer', min: 18, max: 65 },
        { name: 'phone', type: 'phone' },
        { name: 'address', type: 'address' },
        { name: 'avatar', type: 'avatar' }
      ]}
    ],
    sample: {
      code: 0,
      message: 'okabc',
      data: {
        id: 1,
        name: '张三',
        email: 'zhangsan@example.com',
        age: 28,
        phone: '13800138001',
        address: '北京市朝阳区',
        avatar: 'https://i.pravatar.cc/150?u=1'
      }
    }
  },
  articleList: {
    key: 'articleList',
    name: '文章列表响应',
    description: 'API 返回文章分页列表（data 用 array of object）',
    schema: [
      { name: 'code', type: 'integer', required: true, min: 0, max: 0 },
      { name: 'total', type: 'integer', required: true, min: 100, max: 1000 },
      { name: 'data', type: 'array', required: true, min: 3, max: 5, itemType: 'object', itemChildren: [
        { name: 'id', type: 'id', required: true },
        { name: 'title', type: 'string', required: true, prefix: '文章-' },
        { name: 'author', type: 'name', required: true },
        { name: 'category', type: 'string', options: ['技术', '生活', '旅行', '美食', '体育'] },
        { name: 'views', type: 'integer', min: 100, max: 10000 },
        { name: 'likes', type: 'integer', min: 10, max: 1000 },
        { name: 'createdAt', type: 'datetime' }
      ]}
    ],
    sample: {
      code: 0,
      total: 538,
      data: [
        { id: 'a1b2c3d4', title: '文章-Vue3 组合式 API 实践', author: '张三', category: '技术', views: 3200, likes: 256, createdAt: '2025-01-15T08:30:00Z' },
        { id: 'e5f6g7h8', title: '文章-周末探店杭州西湖', author: '李四', category: '旅行', views: 1800, likes: 145, createdAt: '2025-02-03T10:15:00Z' },
        { id: 'i9j0k1l2', title: '文章-家常菜红烧肉做法', author: '王五', category: '美食', views: 5400, likes: 412, createdAt: '2025-02-20T18:00:00Z' }
      ]
    }
  },
  productDetail: {
    key: 'productDetail',
    name: '商品详情',
    description: '单个商品的 API 响应（含嵌套的规格与图片）',
    schema: [
      { name: 'code', type: 'integer', required: true, min: 0, max: 0 },
      { name: 'message', type: 'string', prefix: 'success' },
      { name: 'data', type: 'object', required: true, children: [
        { name: 'id', type: 'id', required: true },
        { name: 'name', type: 'string', required: true, prefix: '商品-' },
        { name: 'price', type: 'float', min: 1, max: 9999 },
        { name: 'stock', type: 'integer', min: 0, max: 500 },
        { name: 'image', type: 'url' },
        { name: 'category', type: 'string', options: ['电子产品', '服装', '食品', '图书', '家居'] },
        { name: 'rating', type: 'float', min: 1, max: 5 },
        { name: 'tags', type: 'array', min: 2, max: 4, itemType: 'string', options: ['新品', '热销', '推荐', '包邮', '促销'] }
      ]}
    ],
    sample: {
      code: 0,
      message: 'successxyz',
      data: {
        id: 'p001',
        name: '商品-无线蓝牙耳机',
        price: 299.0,
        stock: 120,
        image: 'https://picsum.photos/seed/p1/200/200',
        category: '电子产品',
        rating: 4.5,
        tags: ['新品', '热销', '包邮']
      }
    }
  },
  userProfile: {
    key: 'userProfile',
    name: '用户档案(嵌套)',
    description: '演示 object / array 多层嵌套：地址对象、标签数组、文章数组',
    schema: [
      { name: 'id', type: 'id', required: true },
      { name: 'name', type: 'name', required: true },
      { name: 'email', type: 'email', required: true },
      {
        name: 'address',
        type: 'object',
        required: true,
        children: [
          { name: 'province', type: 'string', prefix: '省' },
          { name: 'city', type: 'string', prefix: '市' },
          { name: 'street', type: 'string', prefix: '街道' },
          { name: 'zip', type: 'string', prefix: '邮编' }
        ]
      },
      {
        name: 'tags',
        type: 'array',
        min: 2,
        max: 4,
        itemType: 'string',
        options: ['技术', '生活', '旅行', '美食', '体育', '音乐', '电影']
      },
      {
        name: 'posts',
        type: 'array',
        min: 1,
        max: 3,
        itemType: 'object',
        itemChildren: [
          { name: 'title', type: 'string', prefix: '文章-' },
          { name: 'views', type: 'integer', min: 100, max: 5000 },
          { name: 'likes', type: 'integer', min: 10, max: 500 },
          { name: 'createdAt', type: 'datetime' }
        ]
      }
    ],
    sample: {
      id: 'u-001',
      name: '张三',
      email: 'zhangsan@example.com',
      address: { province: '省北京', city: '市北京', street: '街道中关村大街1号', zip: '邮编100000' },
      tags: ['技术', '生活', '音乐'],
      posts: [
        { title: '文章-Vue3 组合式 API 实践', views: 3200, likes: 256, createdAt: '2025-01-15T08:30:00Z' },
        { title: '文章-我的2025阅读清单', views: 850, likes: 72, createdAt: '2025-03-10T20:00:00Z' }
      ]
    }
  }
}

export async function onRequest(context) {
  const { request } = context
  const origin = request.headers.get('Origin')

  if (request.method === 'OPTIONS') {
    return ApiResponse.cors(origin)
  }

  if (request.method !== 'GET') {
    return ApiResponse.error('不支持的请求方法', origin, 405)
  }

  return ApiResponse.success({ samples: Object.values(SAMPLES) }, origin)
}

export async function onRequestOptions(context) {
  const origin = context.request.headers.get('Origin')
  return ApiResponse.cors(origin)
}
