<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { ElMessage } from 'element-plus'

// 游戏配置
const gameConfig = {
  initialAmount: 10000000000, // 100亿，可以修改为其他金额
  amountText: '100亿', // 用于显示的文字
  title: '假如你有100亿' // 页面标题
}

const info = reactive({
  title: gameConfig.title,
})

// 游戏状态
const gameState = reactive({
  balance: gameConfig.initialAmount,
  totalSpent: 0,
  cart: [] as Array<{
    id: number
    name: string
    price: number
    category: string
    desc: string
    quantity: number
  }>,
  orders: [] as Array<{
    id: string
    name: string
    price: number
    category: string
    time: string
    quantity: number
  }>
})

// 当前选择的分类
const selectedCategory = ref('all')
// 当前显示的标签页
const activeTab = ref('products')

// 商品分类
const categories = [
  { id: 'all', name: '全部' },
  { id: 'estate', name: '房产' },
  { id: 'car', name: '汽车' },
  { id: 'business', name: '产业' },
  { id: 'luxury', name: '奢侈品' },
  { id: 'tech', name: '科技' }
]

// 商品列表
const products = [
  // 房产
  { id: 1, name: '北京四合院', price: 500000000, category: 'estate', desc: '正宗老北京四合院，文化底蕴深厚' },
  { id: 2, name: '上海外滩豪宅', price: 800000000, category: 'estate', desc: '外滩一线江景豪宅，尽享都市繁华' },
  { id: 3, name: '深圳湾一号', price: 300000000, category: 'estate', desc: '深圳湾超级豪宅，海景房中的极品' },
  { id: 4, name: '纽约曼哈顿公寓', price: 400000000, category: 'estate', desc: '纽约中央公园旁的顶级公寓' },
  { id: 5, name: '香港山顶别墅', price: 600000000, category: 'estate', desc: '香港太平山顶独栋别墅，俯瞰维港' },
  { id: 26, name: '迪拜帆船酒店套房', price: 200000000, category: 'estate', desc: '迪拜标志性七星级酒店顶层套房' },
  { id: 27, name: '洛杉矶比佛利山庄', price: 350000000, category: 'estate', desc: '好莱坞明星聚集地豪宅' },
  { id: 28, name: '伦敦海德公园公寓', price: 450000000, category: 'estate', desc: '伦敦市中心顶级公寓' },
  { id: 29, name: '东京银座大厦', price: 700000000, category: 'estate', desc: '银座核心地段整栋大厦' },
  { id: 30, name: '三亚海棠湾别墅', price: 150000000, category: 'estate', desc: '海南顶级度假别墅' },
  
  // 汽车
  { id: 6, name: '劳斯莱斯幻影', price: 8000000, category: 'car', desc: '世界顶级豪华轿车，尊贵身份象征' },
  { id: 7, name: '法拉利LaFerrari', price: 15000000, category: 'car', desc: '限量版超级跑车，速度与激情' },
  { id: 8, name: '兰博基尼Veneno', price: 25000000, category: 'car', desc: '全球限量3台，收藏级超跑' },
  { id: 9, name: '布加迪Chiron', price: 20000000, category: 'car', desc: '世界最快量产车之一' },
  { id: 10, name: '迈巴赫S级', price: 3000000, category: 'car', desc: '德系豪华轿车的巅峰之作' },
  { id: 31, name: '宾利慕尚', price: 5000000, category: 'car', desc: '英伦贵族的终极选择' },
  { id: 32, name: '阿斯顿马丁DBS', price: 4500000, category: 'car', desc: '007座驾，英伦绅士的象征' },
  { id: 33, name: '帕加尼Huayra', price: 18000000, category: 'car', desc: '意大利手工艺术品级超跑' },
  { id: 34, name: '柯尼塞格Agera RS', price: 22000000, category: 'car', desc: '瑞典极速传奇' },
  { id: 35, name: '迈凯伦P1', price: 16000000, category: 'car', desc: '英国F1技术民用化巅峰' },
  { id: 36, name: '红旗L5', price: 6000000, category: 'car', desc: '中国最高端豪华轿车' },
  { id: 37, name: '特斯拉Roadster', price: 1500000, category: 'car', desc: '电动跑车的未来' },
  
  // 产业
  { id: 11, name: '五星级酒店', price: 2000000000, category: 'business', desc: '投资一家国际五星级连锁酒店' },
  { id: 12, name: '科技公司股份', price: 1500000000, category: 'business', desc: '购买知名科技公司10%股份' },
  { id: 13, name: '私人岛屿', price: 1000000000, category: 'business', desc: '马尔代夫私人岛屿，打造度假村' },
  { id: 14, name: '足球俱乐部', price: 3000000000, category: 'business', desc: '收购一支欧洲顶级足球俱乐部' },
  { id: 15, name: '航空公司', price: 5000000000, category: 'business', desc: '投资成立私人航空公司' },
  { id: 38, name: '电影制作公司', price: 800000000, category: 'business', desc: '好莱坞电影制作公司' },
  { id: 39, name: '高端餐厅连锁', price: 500000000, category: 'business', desc: '米其林三星餐厅连锁品牌' },
  { id: 40, name: '珠宝品牌', price: 600000000, category: 'business', desc: '国际知名珠宝品牌' },
  { id: 41, name: '奢侈品牌', price: 1200000000, category: 'business', desc: '收购国际奢侈品牌' },
  { id: 42, name: '房地产开发', price: 2500000000, category: 'business', desc: '一线城市地产开发项目' },
  { id: 43, name: '银行股份', price: 3500000000, category: 'business', desc: '投资银行控股权' },
  { id: 44, name: '媒体集团', price: 900000000, category: 'business', desc: '收购知名媒体集团' },
  
  // 奢侈品
  { id: 16, name: '梵高名画', price: 300000000, category: 'luxury', desc: '收藏梵高真迹《星空》' },
  { id: 17, name: '稀世钻石', price: 150000000, category: 'luxury', desc: '100克拉粉钻，世界罕见' },
  { id: 18, name: '古董手表', price: 50000000, category: 'luxury', desc: '百达翡丽古董表，传世经典' },
  { id: 19, name: '珠宝套装', price: 80000000, category: 'luxury', desc: '皇室级珠宝套装，璀璨夺目' },
  { id: 20, name: '限量名酒', price: 10000000, category: 'luxury', desc: '1945年罗曼尼康帝，酒中极品' },
  { id: 45, name: '达芬奇真迹', price: 500000000, category: 'luxury', desc: '蒙娜丽莎同期作品' },
  { id: 46, name: '爱马仕限量包', price: 5000000, category: 'luxury', desc: '鳄鱼皮限量版铂金包' },
  { id: 47, name: '劳力士彩虹迪通拿', price: 8000000, category: 'luxury', desc: '全钻石镶嵌彩虹圈' },
  { id: 48, name: '紫檀木家具套装', price: 30000000, category: 'luxury', desc: '明清古典紫檀家具全套' },
  { id: 49, name: '翡翠原石', price: 120000000, category: 'luxury', desc: '缅甸顶级帝王绿翡翠' },
  { id: 50, name: '古董瓷器', price: 60000000, category: 'luxury', desc: '清代官窑青花瓷套装' },
  { id: 51, name: '限量雕塑', price: 90000000, category: 'luxury', desc: '罗丹原作青铜雕塑' },
  
  // 科技
  { id: 21, name: '私人太空船', price: 2000000000, category: 'tech', desc: 'SpaceX私人太空旅行套装' },
  { id: 22, name: '超级游艇', price: 800000000, category: 'tech', desc: '200米超级游艇，海上宫殿' },
  { id: 23, name: '私人飞机', price: 500000000, category: 'tech', desc: '湾流G650私人飞机' },
  { id: 24, name: '机器人管家', price: 100000000, category: 'tech', desc: 'AI智能机器人管家团队' },
  { id: 25, name: '量子计算机', price: 300000000, category: 'tech', desc: '个人专属量子计算机' },
  { id: 52, name: '私人潜艇', price: 400000000, category: 'tech', desc: '深海探索用豪华潜艇' },
  { id: 53, name: '智能豪宅系统', price: 80000000, category: 'tech', desc: '全屋智能AI控制系统' },
  { id: 54, name: '超级计算机', price: 200000000, category: 'tech', desc: '个人专属超算中心' },
  { id: 55, name: '卫星通信系统', price: 150000000, category: 'tech', desc: '私人卫星通信网络' },
  { id: 56, name: '基因检测设备', price: 180000000, category: 'tech', desc: '最先进的基因分析设备' },
  { id: 57, name: 'VR体验室', price: 50000000, category: 'tech', desc: '沉浸式虚拟现实体验中心' },
  { id: 58, name: '3D打印工厂', price: 120000000, category: 'tech', desc: '工业级3D打印生产线' }
]

// 计算后的余额
const currentBalance = computed(() => gameState.balance - gameState.totalSpent)

// 过滤商品
const filteredProducts = computed(() => {
  if (selectedCategory.value === 'all') {
    return products
  }
  return products.filter(p => p.category === selectedCategory.value)
})

// 购物车总价
const cartTotal = computed(() => {
  return gameState.cart.reduce((total, item) => total + item.price * item.quantity, 0)
})

// 购物车商品总数
const cartItemCount = computed(() => {
  return gameState.cart.reduce((total, item) => total + item.quantity, 0)
})

// 格式化金额
const formatMoney = (amount: number) => {
  if (amount >= 100000000) {
    return (amount / 100000000).toFixed(1) + '亿'
  } else if (amount >= 10000) {
    return (amount / 10000).toFixed(1) + '万'
  }
  return amount.toLocaleString()
}

// 加入购物车
const addToCart = (product: any) => {
  const existingItem = gameState.cart.find(item => item.id === product.id)
  
  if (existingItem) {
    existingItem.quantity += 1
    ElMessage.success(`${product.name} 数量+1`)
  } else {
    gameState.cart.push({
      ...product,
      quantity: 1
    })
    ElMessage.success(`${product.name} 已加入购物车`)
  }
}

// 从购物车移除
const removeFromCart = (productId: number) => {
  gameState.cart = gameState.cart.filter(item => item.id !== productId)
  ElMessage.success('已从购物车移除')
}

// 更新购物车数量
const updateCartQuantity = (productId: number, quantity: number) => {
  const item = gameState.cart.find(item => item.id === productId)
  if (item) {
    if (quantity <= 0) {
      removeFromCart(productId)
    } else {
      item.quantity = quantity
    }
  }
}

// 一键购买购物车
const buyAllCart = () => {
  if (gameState.cart.length === 0) {
    ElMessage.warning('购物车为空')
    return
  }
  
  if (currentBalance.value < cartTotal.value) {
    ElMessage.error('余额不足，无法购买购物车中的商品')
    return
  }
  
  // 生成订单（每个商品一个订单，包含实际数量）
  gameState.cart.forEach(item => {
    const order = {
      id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
      name: item.name,
      price: item.price,
      category: item.category,
      time: new Date().toLocaleString(),
      quantity: item.quantity
    }
    gameState.orders.unshift(order)
  })
  
  gameState.totalSpent += cartTotal.value
  gameState.cart = []
  
  ElMessage.success('购买成功！已跳转到订单记录')
  // 跳转到订单记录页面
  activeTab.value = 'orders'
}

// 清空购物车
const clearCart = () => {
  gameState.cart = []
  ElMessage.success('已清空购物车')
}

// 重置游戏
const resetGame = () => {
  gameState.balance = gameConfig.initialAmount
  gameState.totalSpent = 0
  gameState.cart = []
  gameState.orders = []
  activeTab.value = 'products' // 重置后回到商品列表
  ElMessage.success(`已重置，你又有${gameConfig.amountText}了！`)
}

// 获取分类名称
const getCategoryName = (categoryId: string) => {
  return categories.find(c => c.id === categoryId)?.name || categoryId
}

// 导出订单图片
const exportOrderImage = async () => {
  if (gameState.orders.length === 0) {
    ElMessage.warning('没有订单记录可导出')
    return
  }

  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    
    // 设置canvas尺寸（增加宽度）
    canvas.width = 1000
    const orderHeight = 80
    const headerHeight = 160
    const footerHeight = 80
    canvas.height = headerHeight + gameState.orders.length * orderHeight + footerHeight
    
    // 设置字体
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    // 绘制头部背景
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, headerHeight)
    gradient.addColorStop(0, '#fef3c7')
    gradient.addColorStop(1, '#fed7aa')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, headerHeight)
    
    // 绘制标题（使用配置变量）
    ctx.fillStyle = '#1f2937'
    ctx.font = 'bold 28px Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`💰 ${gameConfig.title} - 订单记录`, canvas.width / 2, 50)
    
    // 绘制总消费信息
    ctx.font = 'bold 22px Arial, sans-serif'
    ctx.fillStyle = '#16a34a'
    ctx.fillText(`总消费：¥${formatMoney(gameState.totalSpent)}`, canvas.width / 2, 85)
    
    ctx.font = '16px Arial, sans-serif'
    ctx.fillStyle = '#6b7280'
    ctx.fillText(`剩余余额：¥${formatMoney(currentBalance.value)}`, canvas.width / 2, 115)
    
    // 文字截断函数
    const truncateText = (text: string, maxWidth: number, fontSize: string) => {
      ctx.font = fontSize
      if (ctx.measureText(text).width <= maxWidth) {
        return text
      }
      
      let truncated = text
      while (ctx.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
        truncated = truncated.slice(0, -1)
      }
      return truncated + '...'
    }
    
    // 绘制订单列表
    gameState.orders.forEach((order, index) => {
      const y = headerHeight + index * orderHeight
      
      // 绘制订单背景（交替颜色）
      ctx.fillStyle = index % 2 === 0 ? '#f9fafb' : '#ffffff'
      ctx.fillRect(0, y, canvas.width, orderHeight)
      
      // 绘制订单边框
      ctx.strokeStyle = '#e5e7eb'
      ctx.lineWidth = 1
      ctx.strokeRect(0, y, canvas.width, orderHeight)
      
      // 绘制商品名称和数量（每次都重置对齐方式）
      ctx.textAlign = 'left'  // 明确重置
      ctx.fillStyle = '#1f2937'
      ctx.font = 'bold 16px Arial, sans-serif'
      const productName = order.quantity > 1 ? `${order.name} × ${order.quantity}` : order.name
      const maxNameWidth = canvas.width - 300 // 为价格预留空间
      const displayName = truncateText(productName, maxNameWidth, 'bold 16px Arial, sans-serif')
      ctx.fillText(displayName, 30, y + 30)
      
      // 绘制总价
      ctx.textAlign = 'right'  // 明确设置
      ctx.fillStyle = '#ef4444'
      ctx.font = 'bold 16px Arial, sans-serif'
      const totalPrice = order.price * order.quantity
      ctx.fillText(`¥${formatMoney(totalPrice)}`, canvas.width - 30, y + 30)
      
      // 绘制分类
      ctx.textAlign = 'left'  // 明确重置
      ctx.fillStyle = '#6b7280'
      ctx.font = '12px Arial, sans-serif'
      ctx.fillText(`[${getCategoryName(order.category)}]`, 30, y + 55)
      
      // 绘制单价（如果数量>1）
      if (order.quantity > 1) {
        ctx.textAlign = 'center'  // 明确设置
        ctx.fillText(`单价 ¥${formatMoney(order.price)}`, canvas.width / 2, y + 55)
      }
      
      // 绘制时间
      ctx.textAlign = 'right'  // 明确设置
      ctx.fillText(order.time, canvas.width - 30, y + 55)
    })
    
    // 绘制底部信息
    const footerY = headerHeight + gameState.orders.length * orderHeight
    ctx.fillStyle = '#f3f4f6'
    ctx.fillRect(0, footerY, canvas.width, footerHeight)
    
    ctx.fillStyle = '#6b7280'
    ctx.font = '14px Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`生成时间：${new Date().toLocaleString()}`, canvas.width / 2, footerY + 35)
    ctx.fillText(`共 ${gameState.orders.length} 笔订单`, canvas.width / 2, footerY + 60)
    
    // 下载图片（文件名也使用配置变量）
    const link = document.createElement('a')
    link.download = `${gameConfig.title}-订单记录-${new Date().toISOString().slice(0, 10)}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
    
    ElMessage.success('订单图片导出成功！')
  } catch (error) {
    console.error('导出图片失败:', error)
    ElMessage.error('导出图片失败，请重试')
  }
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white mb-4">
      <!-- 余额显示 -->
      <div class="text-center mb-6 p-6 bg-gradient-to-r from-yellow-100 to-orange-100 rounded-xl">
        <h2 class="text-h2 font-bold text-gray-800 mb-2">💰 您的余额</h2>
        <div class="text-4xl font-bold text-green-600 mb-2">
          ¥{{ formatMoney(currentBalance) }}
        </div>
        <div class="text-body-sm text-gray-500">
          已消费：¥{{ formatMoney(gameState.totalSpent) }}
        </div>
        <div class="flex justify-center gap-3 mt-3">
          <el-button @click="resetGame" type="primary">
            重新开始
          </el-button>
          <el-button 
            @click="activeTab = 'cart'" 
            type="success"
          >
            🛒 购物车 ({{ cartItemCount }})
            <span v-if="cartTotal > 0" class="ml-2 text-caption">
              ¥{{ formatMoney(cartTotal) }}
            </span>
          </el-button>
        </div>
      </div>

      <!-- 标签页切换 -->
      <el-tabs v-model="activeTab" class="mb-4">
        <el-tab-pane label="商品列表" name="products">
          <!-- 分类筛选 -->
          <div class="mb-6">
            <div class="flex flex-wrap gap-2">
              <el-button
                v-for="category in categories"
                :key="category.id"
                :type="selectedCategory === category.id ? 'primary' : 'default'"
                @click="selectedCategory = category.id"
                size="small"
              >
                {{ category.name }}
              </el-button>
            </div>
          </div>

          <!-- 商品列表 -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              v-for="product in filteredProducts"
              :key="product.id"
              class="border rounded-lg p-4 hover:shadow-lg transition-shadow"
            >
              <h3 class="font-bold text-body-lg mb-2">{{ product.name }}</h3>
              <p class="text-gray-600 text-body-sm mb-3">{{ product.desc }}</p>
              <div class="flex justify-between items-center">
                <span class="text-red-500 font-bold">¥{{ formatMoney(product.price) }}</span>
                <el-button
                  @click="addToCart(product)"
                  type="success"
                  size="small"
                >
                  加入购物车
                </el-button>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="购物车" name="cart">
          <div v-if="gameState.cart.length === 0" class="text-center py-12 text-gray-500">
            <div class="text-6xl mb-4">🛒</div>
            <div class="text-h3">购物车空空如也</div>
            <div class="text-body-sm mt-2">去挑选一些心仪的商品吧！</div>
            <el-button @click="activeTab = 'products'" type="primary" class="mt-4">
              去购物
            </el-button>
          </div>

          <div v-else>
            <!-- 购物车操作栏 -->
            <div class="mb-4 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
              <div class="text-center mb-3">
                <div class="text-h2 font-bold text-blue-800 mb-1">
                  购物车总价：¥{{ formatMoney(cartTotal) }}
                </div>
                <div class="text-body-sm text-gray-500">共 {{ cartItemCount }} 件商品</div>
              </div>
              <div class="flex justify-center gap-2">
                <el-button @click="clearCart" size="small">清空购物车</el-button>
                <el-button 
                  @click="buyAllCart" 
                  type="primary" 
                  size="large"
                  :disabled="currentBalance < cartTotal"
                >
                  {{ currentBalance < cartTotal ? '余额不足' : `一键购买 ¥${formatMoney(cartTotal)}` }}
                </el-button>
              </div>
            </div>

            <!-- 购物车商品列表 -->
            <div class="space-y-4">
              <div
                v-for="item in gameState.cart"
                :key="item.id"
                class="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div class="flex justify-between items-start mb-2">
                  <div class="flex-1">
                    <h4 class="font-bold text-body-lg">{{ item.name }}</h4>
                    <p class="text-gray-600 text-body-sm">{{ item.desc }}</p>
                    <div class="flex items-center gap-4 mt-2">
                      <span class="text-red-500 font-bold">单价：¥{{ formatMoney(item.price) }}</span>
                      <span class="text-blue-600 font-bold">小计：¥{{ formatMoney(item.price * item.quantity) }}</span>
                      <span class="text-gray-500 text-body-sm">[{{ getCategoryName(item.category) }}]</span>
                    </div>
                  </div>
                </div>
                <div class="flex justify-between items-center">
                  <div class="flex items-center gap-2">
                    <span class="text-body-sm text-gray-600">数量：</span>
                    <el-button
                      @click="updateCartQuantity(item.id, item.quantity - 1)"
                      size="small"
                      :disabled="item.quantity <= 1"
                    >
                      -
                    </el-button>
                    <span class="px-3 py-1 bg-gray-100 rounded font-bold">{{ item.quantity }}</span>
                    <el-button
                      @click="updateCartQuantity(item.id, item.quantity + 1)"
                      size="small"
                    >
                      +
                    </el-button>
                  </div>
                  <el-button
                    @click="removeFromCart(item.id)"
                    type="danger"
                    size="small"
                  >
                    删除
                  </el-button>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="订单记录" name="orders">
          <div v-if="gameState.orders.length === 0" class="text-center py-12 text-gray-500">
            <div class="text-6xl mb-4">📋</div>
            <div class="text-h3">还没有购买记录</div>
            <div class="text-body-sm mt-2">快去购买一些商品吧！</div>
          </div>

          <div v-else>
            <div class="mb-4 p-4 bg-gray-50 rounded-lg">
              <div class="text-center">
                <span class="text-body-lg font-bold">总消费：¥{{ formatMoney(gameState.totalSpent) }}</span>
                <div class="mt-2">
                  <el-button @click="exportOrderImage" type="primary" size="small">
                    📸 导出订单图片
                  </el-button>
                </div>
              </div>
            </div>

            <!-- 订单记录列表 -->
            <div class="space-y-2">
              <div
                v-for="order in gameState.orders"
                :key="order.id"
                class="border rounded-lg p-3 hover:bg-gray-50"
              >
                <div class="flex items-center gap-4 mb-1">
                  <span class="font-medium text-body-lg">
                    {{ order.name }}
                    <span v-if="order.quantity > 1" class="text-blue-600">× {{ order.quantity }}</span>
                  </span>
                  <span class="text-red-500 font-bold text-body-lg">
                    ¥{{ formatMoney(order.price * order.quantity) }}
                  </span>
                </div>
                <div class="flex items-center gap-2 text-body-sm text-gray-500">
                  <span>[{{ getCategoryName(order.category) }}]</span>
                  <span>•</span>
                  <span>{{ order.time }}</span>
                  <span v-if="order.quantity > 1">•</span>
                  <span v-if="order.quantity > 1">单价 ¥{{ formatMoney(order.price) }}</span>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- 说明 -->
    <ToolDetail title="游戏说明">
      <el-text>
        🎮 这是一个有趣的财富模拟器！<br/>
        💰 假设你拥有{{ gameConfig.amountText }}人民币，可以购买各种昂贵的商品<br/>
        🏠 商品分为房产、汽车、产业、奢侈品、科技等多个分类<br/>
        🛒 先加入购物车，再一键购买，支持数量调整<br/>
        📋 查看购买记录和消费统计<br/>
        🔄 可以随时重置重新体验<br/>
        📱 支持PC和移动端，体验富翁的购物乐趣！
      </el-text> 
    </ToolDetail>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
}

@media (max-width: 768px) {
  .grid-cols-1 {
    grid-template-columns: repeat(1, minmax(0, 1fr));
  }
}

@media (min-width: 768px) {
  .md\:grid-cols-2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .lg\:grid-cols-3 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.gap-2 { gap: 0.5rem; }
.gap-3 { gap: 0.75rem; }
.gap-4 { gap: 1rem; }
.mb-2 { margin-bottom: 0.5rem; }
.mb-3 { margin-bottom: 0.75rem; }
.mb-4 { margin-bottom: 1rem; }
.mb-6 { margin-bottom: 1.5rem; }
.mt-2 { margin-top: 0.5rem; }
.mt-3 { margin-top: 0.75rem; }
.mt-4 { margin-top: 1rem; }
.mt-6 { margin-top: 1.5rem; }
.p-3 { padding: 0.75rem; }
.p-4 { padding: 1rem; }
.p-6 { padding: 1.5rem; }
.px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
.py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
.py-12 { padding-top: 3rem; padding-bottom: 3rem; }
.ml-2 { margin-left: 0.5rem; }
.ml-4 { margin-left: 1rem; }

.text-center { text-align: center; }
.text-body-sm { font-size: 0.875rem; }
.text-caption { font-size: 0.75rem; }
.text-body-lg { font-size: 1.125rem; }
.text-h3 { font-size: 1.25rem; }
.text-h2 { font-size: 1.5rem; }
.text-4xl { font-size: 2.25rem; }
.text-6xl { font-size: 3.75rem; }

.font-medium { font-weight: 500; }
.font-bold { font-weight: 700; }

.text-gray-400 { color: #9ca3af; }
.text-gray-500 { color: #6b7280; }
.text-gray-600 { color: #4b5563; }
.text-gray-800 { color: #1f2937; }
.text-red-500 { color: #ef4444; }
.text-green-600 { color: #16a34a; }

.bg-white { background-color: #ffffff; }
.bg-gray-50 { background-color: #f9fafb; }
.bg-gray-100 { background-color: #f3f4f6; }
.bg-blue-50 { background-color: #eff6ff; }
.bg-gradient-to-r { background-image: linear-gradient(to right, var(--tw-gradient-stops)); }
.from-yellow-100 { --tw-gradient-from: #fef3c7; }
.to-orange-100 { --tw-gradient-to: #fed7aa; }

.rounded { border-radius: 0.25rem; }
.rounded-lg { border-radius: 0.5rem; }
.rounded-xl { border-radius: 0.75rem; }

.border { border-width: 1px; border-color: #e5e7eb; }

.hover\:shadow-lg:hover { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
.hover\:bg-gray-50:hover { background-color: #f9fafb; }
.transition-shadow { transition-property: box-shadow; transition-duration: 150ms; }

.max-h-64 { max-height: 16rem; }
.overflow-y-auto { overflow-y: auto; }
.space-y-2 > * + * { margin-top: 0.5rem; }
.space-y-4 > * + * { margin-top: 1rem; }

.flex { display: flex; }
.flex-1 { flex: 1 1 0%; }
.flex-wrap { flex-wrap: wrap; }
.justify-center { justify-content: center; }
.justify-between { justify-content: space-between; }
.items-center { align-items: center; }
.flex-col { flex-direction: column; }

.bg-orange-50 { background-color: #fff7ed; }
.text-orange-600 { color: #ea580c; }
.text-orange-700 { color: #c2410c; }
.text-orange-800 { color: #9a3412; }
.text-blue-600 { color: #2563eb; }
.text-blue-800 { color: #1e40af; }
.border-orange-200 { border-color: #fed7aa; }
.border-blue-200 { border-color: #bfdbfe; }
.border-2 { border-width: 2px; }
.transition-colors { transition-property: color, background-color, border-color; transition-duration: 150ms; }
</style>
