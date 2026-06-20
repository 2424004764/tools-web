<script setup lang="ts">
import { reactive, ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Delete, ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import { useUserStore } from '@/store/modules/user'
import functionsRequest from '@/utils/functionsRequest'

const userStore = useUserStore()
const STORAGE_KEY = 'tools-web-season-scenery'
const SELECTION_KEY = 'tools-web-season-scenery-selection'

const info = reactive({
  title: "四季景色",
})

// 四季数据
const seasonsData = [
  { id: 1, name: '春天', icon: '🌸', color: '#FF9AA2', key: 'spring' },
  { id: 2, name: '夏天', icon: '☀️', color: '#FFD93D', key: 'summer' },
  { id: 3, name: '秋天', icon: '🍂', color: '#FF8C42', key: 'autumn' },
  { id: 4, name: '冬天', icon: '❄️', color: '#A8DADC', key: 'winter' }
]

// 内置地点 - 使用 seed 固定图片，确保每次刷新相同
const builtInLocations = [
  {
    id: 'builtin-1',
    name: '杭州西湖',
    desc: '「欲把西湖比西子，淡妆浓抹总相宜」',
    images: {
      spring: [
        'https://picsum.photos/seed/westlake-spring-1/800/600',
        'https://picsum.photos/seed/westlake-spring-2/800/600',
        'https://picsum.photos/seed/westlake-spring-3/800/600'
      ],
      summer: [
        'https://picsum.photos/seed/westlake-summer-1/800/600',
        'https://picsum.photos/seed/westlake-summer-2/800/600',
        'https://picsum.photos/seed/westlake-summer-3/800/600'
      ],
      autumn: [
        'https://picsum.photos/seed/westlake-autumn-1/800/600',
        'https://picsum.photos/seed/westlake-autumn-2/800/600',
        'https://picsum.photos/seed/westlake-autumn-3/800/600'
      ],
      winter: [
        'https://picsum.photos/seed/westlake-winter-1/800/600',
        'https://picsum.photos/seed/westlake-winter-2/800/600',
        'https://picsum.photos/seed/westlake-winter-3/800/600'
      ]
    }
  },
  {
    id: 'builtin-2',
    name: '北京故宫',
    desc: '紫禁城，四季皆有不同的韵味',
    images: {
      spring: [
        'https://picsum.photos/seed/forbidden-spring-1/800/600',
        'https://picsum.photos/seed/forbidden-spring-2/800/600',
        'https://picsum.photos/seed/forbidden-spring-3/800/600'
      ],
      summer: [
        'https://picsum.photos/seed/forbidden-summer-1/800/600',
        'https://picsum.photos/seed/forbidden-summer-2/800/600',
        'https://picsum.photos/seed/forbidden-summer-3/800/600'
      ],
      autumn: [
        'https://picsum.photos/seed/forbidden-autumn-1/800/600',
        'https://picsum.photos/seed/forbidden-autumn-2/800/600',
        'https://picsum.photos/seed/forbidden-autumn-3/800/600'
      ],
      winter: [
        'https://picsum.photos/seed/forbidden-winter-1/800/600',
        'https://picsum.photos/seed/forbidden-winter-2/800/600',
        'https://picsum.photos/seed/forbidden-winter-3/800/600'
      ]
    }
  },
  {
    id: 'builtin-3',
    name: '四川九寨沟',
    desc: '人间仙境，童话世界',
    images: {
      spring: [
        'https://picsum.photos/seed/jiuzhai-spring-1/800/600',
        'https://picsum.photos/seed/jiuzhai-spring-2/800/600',
        'https://picsum.photos/seed/jiuzhai-spring-3/800/600'
      ],
      summer: [
        'https://picsum.photos/seed/jiuzhai-summer-1/800/600',
        'https://picsum.photos/seed/jiuzhai-summer-2/800/600',
        'https://picsum.photos/seed/jiuzhai-summer-3/800/600'
      ],
      autumn: [
        'https://picsum.photos/seed/jiuzhai-autumn-1/800/600',
        'https://picsum.photos/seed/jiuzhai-autumn-2/800/600',
        'https://picsum.photos/seed/jiuzhai-autumn-3/800/600'
      ],
      winter: [
        'https://picsum.photos/seed/jiuzhai-winter-1/800/600',
        'https://picsum.photos/seed/jiuzhai-winter-2/800/600',
        'https://picsum.photos/seed/jiuzhai-winter-3/800/600'
      ]
    }
  },
  {
    id: 'builtin-4',
    name: '吉林雾凇',
    desc: '雾凇之都，银柳垂挂',
    images: {
      spring: [
        'https://picsum.photos/seed/jilin-spring-1/800/600',
        'https://picsum.photos/seed/jilin-spring-2/800/600',
        'https://picsum.photos/seed/jilin-spring-3/800/600'
      ],
      summer: [
        'https://picsum.photos/seed/jilin-summer-1/800/600',
        'https://picsum.photos/seed/jilin-summer-2/800/600',
        'https://picsum.photos/seed/jilin-summer-3/800/600'
      ],
      autumn: [
        'https://picsum.photos/seed/jilin-autumn-1/800/600',
        'https://picsum.photos/seed/jilin-autumn-2/800/600',
        'https://picsum.photos/seed/jilin-autumn-3/800/600'
      ],
      winter: [
        'https://picsum.photos/seed/jilin-winter-1/800/600',
        'https://picsum.photos/seed/jilin-winter-2/800/600',
        'https://picsum.photos/seed/jilin-winter-3/800/600'
      ]
    }
  },
  {
    id: 'builtin-5',
    name: '云南大理',
    desc: '风花雪月，下关风吹',
    images: {
      spring: [
        'https://picsum.photos/seed/dali-spring-1/800/600',
        'https://picsum.photos/seed/dali-spring-2/800/600',
        'https://picsum.photos/seed/dali-spring-3/800/600'
      ],
      summer: [
        'https://picsum.photos/seed/dali-summer-1/800/600',
        'https://picsum.photos/seed/dali-summer-2/800/600',
        'https://picsum.photos/seed/dali-summer-3/800/600'
      ],
      autumn: [
        'https://picsum.photos/seed/dali-autumn-1/800/600',
        'https://picsum.photos/seed/dali-autumn-2/800/600',
        'https://picsum.photos/seed/dali-autumn-3/800/600'
      ],
      winter: [
        'https://picsum.photos/seed/dali-winter-1/800/600',
        'https://picsum.photos/seed/dali-winter-2/800/600',
        'https://picsum.photos/seed/dali-winter-3/800/600'
      ]
    }
  },
  {
    id: 'builtin-6',
    name: '张家界',
    desc: '三千奇峰，八百秀水',
    images: {
      spring: [
        'https://picsum.photos/seed/zhangjiajie-spring-1/800/600',
        'https://picsum.photos/seed/zhangjiajie-spring-2/800/600',
        'https://picsum.photos/seed/zhangjiajie-spring-3/800/600'
      ],
      summer: [
        'https://picsum.photos/seed/zhangjiajie-summer-1/800/600',
        'https://picsum.photos/seed/zhangjiajie-summer-2/800/600',
        'https://picsum.photos/seed/zhangjiajie-summer-3/800/600'
      ],
      autumn: [
        'https://picsum.photos/seed/zhangjiajie-autumn-1/800/600',
        'https://picsum.photos/seed/zhangjiajie-autumn-2/800/600',
        'https://picsum.photos/seed/zhangjiajie-autumn-3/800/600'
      ],
      winter: [
        'https://picsum.photos/seed/zhangjiajie-winter-1/800/600',
        'https://picsum.photos/seed/zhangjiajie-winter-2/800/600',
        'https://picsum.photos/seed/zhangjiajie-winter-3/800/600'
      ]
    }
  }
]

interface SeasonImages {
  spring: string[]
  summer: string[]
  autumn: string[]
  winter: string[]
}

interface Location {
  id: string
  name: string
  desc: string
  images: SeasonImages
  isBuiltIn?: boolean
}

const locations = ref<Location[]>([])
const currentLocationId = ref<string>('')
const currentSeasonId = ref<number>(1)
const showAddDialog = ref(false)
const showImageDialog = ref(false)
const editingLocation = ref<Location | null>(null)
const editingSeasonKey = ref<string>('spring')

const formData = reactive({
  name: '',
  desc: '',
  springImages: [] as string[],
  summerImages: [] as string[],
  autumnImages: [] as string[],
  winterImages: [] as string[],
})

// 输入框的临时值 - 每个季节独立
const seasonInputUrls = reactive({
  spring: '',
  summer: '',
  autumn: '',
  winter: ''
})
const tempImageUrl = ref('')

// 将季节key转换为formData字段名
const getFormDataKey = (seasonKey: string): keyof typeof formData => {
  const keyMap: Record<string, keyof typeof formData> = {
    spring: 'springImages',
    summer: 'summerImages',
    autumn: 'autumnImages',
    winter: 'winterImages'
  }
  return keyMap[seasonKey] || 'springImages'
}

// 添加图片到指定季节（从添加地点表单）
const addImageToSeason = (seasonKey: string) => {
  const inputUrl = seasonInputUrls[seasonKey as keyof typeof seasonInputUrls]
  if (!inputUrl.trim()) {
    ElMessage.warning('请输入图片URL')
    return
  }
  const formDataKey = getFormDataKey(seasonKey)
  const images = formData[formDataKey] as string[]
  if (images.includes(inputUrl.trim())) {
    ElMessage.warning('该图片已添加')
    return
  }
  images.push(inputUrl.trim())
  seasonInputUrls[seasonKey as keyof typeof seasonInputUrls] = ''
  ElMessage.success('图片添加成功')
}

// 添加图片到当前地点的指定季节（从管理图片对话框）
const addImageToCurrentLocation = (seasonKey: string) => {
  if (!tempImageUrl.value.trim()) return
  if (currentLocation.value && seasonKey) {
    const images = currentLocation.value.images[seasonKey as keyof SeasonImages]
    if (images && !images.includes(tempImageUrl.value.trim())) {
      images.push(tempImageUrl.value.trim())
      saveData()
      syncToCloud()
    }
  }
  tempImageUrl.value = ''
}

// 当前选中的地点
const currentLocation = computed(() => {
  return locations.value.find(l => l.id === currentLocationId.value) || locations.value[0]
})

// 当前季节的图片列表
const currentSeasonImages = computed(() => {
  if (!currentLocation.value) return []
  const key = seasonsData[currentSeasonId.value - 1].key
  return currentLocation.value.images[key as keyof SeasonImages] || []
})

// 当前查看的图片索引
const currentImageIndex = ref(0)

// 当前显示的图片
const currentImage = computed(() => {
  return currentSeasonImages.value[currentImageIndex.value] || ''
})

// 自动轮播
const autoPlayTimer = ref<number | null>(null)
const autoPlayInterval = 3000 // 轮播间隔3秒

const startAutoPlay = () => {
  stopAutoPlay()
  // 只有多于一张图片时才轮播
  if (currentSeasonImages.value.length > 1) {
    autoPlayTimer.value = window.setInterval(() => {
      nextImage()
    }, autoPlayInterval)
  }
}

const stopAutoPlay = () => {
  if (autoPlayTimer.value !== null) {
    clearInterval(autoPlayTimer.value)
    autoPlayTimer.value = null
  }
}

// 图片列表变化时重启轮播
watch(currentSeasonImages, () => {
  currentImageIndex.value = 0
  startAutoPlay()
})

// 加载数据
const loadData = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const userLocations: Location[] = JSON.parse(stored)
      locations.value = [...builtInLocations, ...userLocations]
    } else {
      locations.value = [...builtInLocations]
    }
    if (locations.value.length > 0 && !currentLocationId.value) {
      currentLocationId.value = locations.value[0].id
    }
  } catch {
    locations.value = [...builtInLocations]
  }
  // 加载选择状态（地点和季节）
  loadSelection()
}

// 保存用户数据
const saveData = () => {
  const userLocations = locations.value.filter(l => !l.isBuiltIn && l.id !== '' && !l.id.startsWith('builtin-'))
  localStorage.setItem(STORAGE_KEY, JSON.stringify(userLocations))
}

// 同步到云端
const syncToCloud = async () => {
  if (!userStore.isLoggedIn) return
  const userLocations = locations.value.filter(l => !l.isBuiltIn && l.id !== '' && !l.id.startsWith('builtin-'))
  try {
    await functionsRequest.post('/api/user-season-scenery', {
      action: 'save',
      data: userLocations
    })
  } catch (e) {
    console.error('Sync failed:', e)
  }
}

// 从云端加载
const loadFromCloud = async () => {
  if (!userStore.isLoggedIn) return
  try {
    const res: any = await functionsRequest.get('/api/user-season-scenery')
    const cloudData = res.data?.data
    if (cloudData && Array.isArray(cloudData)) {
      const cloudLocations: Location[] = cloudData
      // 合并云端和内置数据
      const userLocations = locations.value.filter(l => !l.isBuiltIn && !l.id.startsWith('builtin-'))
      const mergedUser = [...userLocations]
      cloudLocations.forEach(cl => {
        const existing = mergedUser.find(l => l.id === cl.id)
        if (!existing) {
          mergedUser.push(cl)
        }
      })
      locations.value = [...builtInLocations, ...mergedUser]
      saveData()
    }
  } catch (e) {
    console.error('Load from cloud failed:', e)
  }
}

// 保存选择状态到 localStorage
const saveSelection = () => {
  localStorage.setItem(SELECTION_KEY, JSON.stringify({
    locationId: currentLocationId.value,
    seasonId: currentSeasonId.value
  }))
}

// 加载选择状态
const loadSelection = () => {
  try {
    const stored = localStorage.getItem(SELECTION_KEY)
    if (stored) {
      const { locationId, seasonId } = JSON.parse(stored)
      // 验证地点是否存在（可能在云端数据合并后需要重新校验）
      if (locationId && locations.value.some(l => l.id === locationId)) {
        currentLocationId.value = locationId
      }
      if (seasonId && seasonId >= 1 && seasonId <= 4) {
        currentSeasonId.value = seasonId
      }
    }
  } catch {
    // ignore
  }
}

// 选择地点
const selectLocation = (id: string) => {
  currentLocationId.value = id
  currentImageIndex.value = 0
  saveSelection()
}

// 选择季节
const selectSeason = (id: number) => {
  currentSeasonId.value = id
  currentImageIndex.value = 0
  saveSelection()
}

// 上一张图片
const prevImage = () => {
  if (currentImageIndex.value > 0) {
    currentImageIndex.value--
  } else {
    currentImageIndex.value = currentSeasonImages.value.length - 1
  }
}

// 下一张图片
const nextImage = () => {
  if (currentImageIndex.value < currentSeasonImages.value.length - 1) {
    currentImageIndex.value++
  } else {
    currentImageIndex.value = 0
  }
}

// 手动切换（重置轮播计时器，避免切换后立即跳转）
const manualPrev = () => {
  prevImage()
  startAutoPlay()
}

const manualNext = () => {
  nextImage()
  startAutoPlay()
}

// 跳转到登录页
const goToLogin = () => {
  window.location.href = '/login?redirect=/season-scenery/'
}

// 打开添加地点对话框
const openAddDialog = () => {
  if (!userStore.isLoggedIn) {
    ElMessage.warning('请先登录后再添加地点')
    goToLogin()
    return
  }
  editingLocation.value = null
  formData.name = ''
  formData.desc = ''
  formData.springImages = []
  formData.summerImages = []
  formData.autumnImages = []
  formData.winterImages = []
  showAddDialog.value = true
}

// 打开编辑对话框
const openEditDialog = (location: Location) => {
  editingLocation.value = location
  formData.name = location.name
  formData.desc = location.desc
  formData.springImages = [...location.images.spring]
  formData.summerImages = [...location.images.summer]
  formData.autumnImages = [...location.images.autumn]
  formData.winterImages = [...location.images.winter]
  showAddDialog.value = true
}

// 删除地点
const deleteLocation = async (location: Location) => {
  if (location.isBuiltIn) {
    ElMessage.warning('内置地点不能删除')
    return
  }
  try {
    await ElMessageBox.confirm('确定要删除这个地点吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    locations.value = locations.value.filter(l => l.id !== location.id)
    if (currentLocationId.value === location.id) {
      currentLocationId.value = locations.value[0]?.id || ''
    }
    saveData()
    syncToCloud()
    ElMessage.success('删除成功')
  } catch {
    // 用户取消
  }
}

// 保存地点
const saveLocation = () => {
  if (!formData.name.trim()) {
    ElMessage.warning('请输入地点名称')
    return
  }

  const trimmedName = formData.name.trim()

  // 检查地点名称是否重复（排除正在编辑的当前地点）
  const isDuplicate = locations.value.some(l =>
    l.name === trimmedName && l.id !== editingLocation.value?.id
  )
  if (isDuplicate) {
    ElMessage.warning('该地点名称已存在，请勿重复添加')
    return
  }

  const location: Location = {
    id: editingLocation.value?.id || `user-${Date.now()}`,
    name: trimmedName,
    desc: formData.desc.trim(),
    images: {
      spring: formData.springImages.filter(u => u),
      summer: formData.summerImages.filter(u => u),
      autumn: formData.autumnImages.filter(u => u),
      winter: formData.winterImages.filter(u => u),
    }
  }

  if (editingLocation.value) {
    const index = locations.value.findIndex(l => l.id === editingLocation.value!.id)
    if (index !== -1) {
      locations.value[index] = location
    }
  } else {
    locations.value.push(location)
  }

  currentLocationId.value = location.id
  showAddDialog.value = false
  saveData()
  syncToCloud()
  ElMessage.success(editingLocation.value ? '修改成功' : '添加成功')
}

// 打开图片管理对话框
const openImageDialog = (seasonKey: string) => {
  if (!userStore.isLoggedIn) {
    ElMessage.warning('请先登录后再管理图片')
    goToLogin()
    return
  }
  editingSeasonKey.value = seasonKey
  showImageDialog.value = true
}

// 删除图片
const removeImage = (seasonKey: string, index: number) => {
  const formDataKey = getFormDataKey(seasonKey)
  const images = formData[formDataKey] as string[]
  images.splice(index, 1)
}

onMounted(() => {
  loadData()
  if (userStore.isLoggedIn) {
    loadFromCloud()
  }
  startAutoPlay()
})

onBeforeUnmount(() => {
  stopAutoPlay()
})

watch(() => userStore.isLoggedIn, (loggedIn) => {
  if (loggedIn) {
    loadFromCloud()
  }
})
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <!-- 添加地点按钮 -->
    <div class="px-4">
      <el-button type="primary" :icon="userStore.isLoggedIn ? Plus : undefined" @click="userStore.isLoggedIn ? openAddDialog() : goToLogin()">
        {{ userStore.isLoggedIn ? '添加地点' : '登录后添加地点' }}
      </el-button>
    </div>

    <!-- 季节选择 -->
    <div class="p-4 rounded-2xl bg-white mt-3">
      <div class="flex items-center justify-between mb-3">
        <span class="text-lg font-medium text-gray-700">选择季节</span>
      </div>
      <div class="grid grid-cols-4 gap-3">
        <div
          v-for="season in seasonsData"
          :key="season.id"
          @click="selectSeason(season.id)"
          class="cursor-pointer rounded-xl p-4 text-center transition-all duration-300 hover:scale-105 border-2"
          :style="{
            backgroundColor: currentSeasonId === season.id ? season.color + '30' : '#f9fafb',
            borderColor: currentSeasonId === season.id ? season.color : 'transparent'
          }"
        >
          <div class="text-3xl mb-1">{{ season.icon }}</div>
          <div class="font-medium text-gray-800">{{ season.name }}</div>
        </div>
      </div>
    </div>

    <!-- 地点选择 -->
    <div class="p-4 rounded-2xl bg-white mt-3">
      <div class="flex items-center justify-between mb-3">
        <span class="text-lg font-medium text-gray-700">选择地点</span>
        <span class="text-sm text-gray-500">{{ currentLocation?.name }}</span>
      </div>
      <div class="flex flex-wrap gap-2">
        <el-tag
          v-for="location in locations"
          :key="location.id"
          @click="selectLocation(location.id)"
          :type="currentLocationId === location.id ? 'primary' : 'info'"
          class="cursor-pointer text-base px-4 py-2"
          effect="light"
          :closable="!location.isBuiltIn && !location.id.startsWith('builtin-')"
          @close="deleteLocation(location)"
        >
          {{ location.name }}
        </el-tag>
      </div>
      <div v-if="currentLocation && !currentLocation.isBuiltIn && !currentLocation.id.startsWith('builtin-')" class="mt-3">
        <el-button size="small" @click="openEditDialog(currentLocation!)">编辑地点</el-button>
      </div>
    </div>

    <!-- 图片展示 -->
    <div class="p-4 rounded-2xl bg-white mt-3">
      <div class="flex items-center justify-between mb-3">
        <span class="text-lg font-medium text-gray-700">
          {{ currentLocation?.name }} - {{ seasonsData[currentSeasonId - 1]?.name }}
          <span class="text-sm text-gray-500 ml-2">({{ currentSeasonImages.length }}张)</span>
        </span>
        <div class="flex items-center gap-2">
          <span class="text-2xl">{{ seasonsData[currentSeasonId - 1]?.icon }}</span>
          <el-button size="small" @click="openImageDialog(seasonsData[currentSeasonId - 1]?.key)" type="primary">
            管理图片
          </el-button>
        </div>
      </div>

      <div
        v-if="currentSeasonImages.length > 0"
        class="relative rounded-xl overflow-hidden"
        @mouseenter="stopAutoPlay"
        @mouseleave="startAutoPlay"
      >
        <img
          :src="currentImage"
          :alt="currentLocation?.name"
          class="w-full h-[400px] object-cover transition-all duration-500"
        />

        <!-- 图片导航 -->
        <div v-if="currentSeasonImages.length > 1" class="absolute inset-0 flex items-center justify-between px-4">
          <el-button circle size="large" @click="manualPrev" class="bg-white/80">
            <el-icon><ArrowLeft /></el-icon>
          </el-button>
          <el-button circle size="large" @click="manualNext" class="bg-white/80">
            <el-icon><ArrowRight /></el-icon>
          </el-button>
        </div>

        <!-- 自动播放指示器 -->
        <div v-if="autoPlayTimer !== null" class="absolute top-4 right-4 bg-black/60 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
          <span class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
          自动轮播
        </div>

        <!-- 图片计数器 -->
        <div v-if="currentSeasonImages.length > 1" class="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-3 py-1 rounded-full text-sm">
          {{ currentImageIndex + 1 }} / {{ currentSeasonImages.length }}
        </div>

        <!-- 底部描述 -->
        <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
          <p class="text-white text-sm">{{ currentLocation?.desc }}</p>
        </div>
      </div>

      <div v-else class="w-full h-[400px] flex items-center justify-center bg-gray-100 rounded-xl">
        <el-empty description="暂无图片，请添加">
          <el-button type="primary" @click="openImageDialog(seasonsData[currentSeasonId - 1]?.key)">
            添加图片
          </el-button>
        </el-empty>
      </div>
    </div>

    <!-- 四季对比图 -->
    <div v-if="currentLocation" class="p-4 rounded-2xl bg-white mt-3">
      <div class="flex items-center justify-between mb-3">
        <span class="text-lg font-medium text-gray-700">{{ currentLocation.name }} 四季对比</span>
      </div>
      <div class="grid grid-cols-4 gap-2">
        <div
          v-for="season in seasonsData"
          :key="season.id"
          @click="selectSeason(season.id)"
          class="cursor-pointer rounded-lg overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-lg border-2"
          :style="{ borderColor: currentSeasonId === season.id ? season.color : 'transparent' }"
        >
          <img
            v-if="currentLocation.images[season.key as keyof SeasonImages]?.length"
            :src="currentLocation.images[season.key as keyof SeasonImages][0]"
            :alt="season.name"
            class="w-full h-32 object-cover"
          />
          <div v-else class="w-full h-32 bg-gray-200 flex items-center justify-center text-gray-400">
            暂无图片
          </div>
          <div class="text-center py-2 bg-gray-50">
            <span class="text-sm">{{ season.icon }} {{ season.name }}</span>
            <span class="text-xs text-gray-400 ml-1">({{ currentLocation.images[season.key as keyof SeasonImages]?.length || 0 }})</span>
          </div>
        </div>
      </div>
    </div>

    <!-- desc -->
    <ToolDetail title="描述">
      <el-text>
        展示不同地方一年四季的变化。支持添加自定义地点，每个季节可上传多张图片进行对比。内置杭州西湖、北京故宫、四川九寨沟等多个著名景点的四季照片。登录后可同步数据到云端。
      </el-text>
    </ToolDetail>

    <!-- 添加/编辑地点对话框 -->
    <el-dialog
      v-model="showAddDialog"
      :title="editingLocation ? '编辑地点' : '添加地点'"
      width="600px"
    >
      <el-form label-width="80px">
        <el-form-item label="地点名称">
          <el-input v-model="formData.name" placeholder="请输入地点名称" />
        </el-form-item>
        <el-form-item label="地点描述">
          <el-input v-model="formData.desc" placeholder="请输入地点描述" />
        </el-form-item>

        <el-divider>四季图片（每季至少添加一张）</el-divider>

        <el-form-item v-for="season in seasonsData" :key="season.id" :label="`${season.icon} ${season.name}`">
          <div class="w-full">
            <div v-if="(formData[getFormDataKey(season.key)] as string[]).length" class="flex flex-wrap gap-2 mb-2">
              <div
                v-for="(img, index) in (formData[getFormDataKey(season.key)] as string[])"
                :key="index"
                class="relative w-20 h-20 group"
              >
                <img
                  :src="img"
                  class="w-full h-full object-cover rounded border border-gray-200"
                  @error="(e) => ((e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22%3E%3Crect width=%2280%22 height=%2280%22 fill=%22%23f3f4f6%22/%3E%3Ctext x=%2240%22 y=%2245%22 font-size=%2210%22 fill=%22%239ca3af%22 text-anchor=%22middle%22%3E加载失败%3C/text%3E%3C/svg%3E')"
                />
                <div
                  class="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center cursor-pointer text-xs hover:bg-red-600"
                  @click="removeImage(season.key, index)"
                >
                  ×
                </div>
              </div>
            </div>
            <div class="flex gap-2">
              <el-input
                v-model="seasonInputUrls[season.key]"
                :placeholder="`输入 ${season.name} 图片URL后回车添加`"
                @keyup.enter="addImageToSeason(season.key)"
                class="flex-1"
              />
              <el-button @click="addImageToSeason(season.key)">添加</el-button>
            </div>
          </div>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" @click="saveLocation">保存</el-button>
      </template>
    </el-dialog>

    <!-- 管理单季图片对话框 -->
    <el-dialog
      v-model="showImageDialog"
      :title="`管理 ${seasonsData.find(s => s.key === editingSeasonKey)?.name} 图片`"
      width="600px"
    >
      <div class="mb-4">
        <el-input
          v-model="tempImageUrl"
          placeholder="输入图片URL后按回车添加"
          @keyup.enter="addImageToCurrentLocation(editingSeasonKey)"
        />
      </div>

      <div class="flex flex-wrap gap-2">
        <div v-for="(img, index) in currentLocation?.images[editingSeasonKey as keyof SeasonImages]" :key="index" class="relative w-32 h-32">
          <img :src="img" class="w-full h-full object-cover rounded" />
          <el-button
            circle
            size="small"
            type="danger"
            class="absolute -top-2 -right-2"
            @click="() => {
              if (currentLocation && editingSeasonKey) {
                currentLocation.images[editingSeasonKey as keyof SeasonImages].splice(index, 1)
                saveData()
                syncToCloud()
              }
            }"
          >
            <el-icon><Delete /></el-icon>
          </el-button>
        </div>
      </div>

      <template #footer>
        <el-button @click="showImageDialog = false">关闭</el-button>
        <el-button type="primary" @click="() => { showImageDialog = false; saveData(); syncToCloud() }">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>

</style>
