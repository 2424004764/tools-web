<script setup lang="ts">
import { reactive, computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { copy } from '@/utils/string'
import CryptoJS from 'crypto-js'
import { useUserStore } from '@/store/modules/user'
import * as passwordApi from '@/api/password'
import type { PasswordEntry, PasswordGroup } from '@/api/password'

// 密码条目接口（本地接口，用于编辑表单）

// 用户store
const userStore = useUserStore()

const info = reactive({
  title: "密码管理器",
  searchQuery: '',
  selectedGroup: 'all',
  showDialog: false,
  showGroupDialog: false,
  showImportDialog: false,
  groupDialogMode: 'add', // 'add' or 'edit'
  currentGroupId: '',
  dialogMode: 'add', // 'add' or 'edit'
  currentEntryId: '',
  isLoading: false,
  isSearching: false,
  currentPage: 1,
  pageSize: 20,
  groupsExpanded: false, // 分组是否展开
  importFile: null as File | null,
  entryForm: {
    title: '',
    username: '',
    password: '',
    url: '',
    group: '',
    notes: ''
  },
  generatedPassword: {
    length: 16,
    includeUpper: true,
    includeLower: true,
    includeNumbers: true,
    includeSymbols: true,
    result: ''
  },
  groupForm: {
    name: '',
    color: '#409EFF'
  }
})

// 数据存储
const entries = ref<PasswordEntry[]>([])
const groups = ref<PasswordGroup[]>([])
const total = ref(0)
const totalPages = ref(0)

// 加密密钥（基于用户ID生成）
const getEncryptionKey = () => {
  const uid = userStore.user?.uid || 'default'
  return CryptoJS.SHA256(uid + '-password-manager').toString()
}

// 加密数据
const encryptPassword = (password: string) => {
  const key = getEncryptionKey()
  return CryptoJS.AES.encrypt(password, key).toString()
}

// 解密数据
const decryptPassword = (encryptedPassword: string) => {
  try {
    const key = getEncryptionKey()
    const bytes = CryptoJS.AES.decrypt(encryptedPassword, key)
    return bytes.toString(CryptoJS.enc.Utf8)
  } catch (e) {
    return '***'
  }
}

// 从数据库加载数据
const loadData = async () => {
  if (!userStore.isLoggedIn) {
    ElMessage.warning('请先登录')
    return
  }

  try {
    info.isLoading = true
    // 如果有搜索关键词，设置搜索状态
    if (info.searchQuery && info.searchQuery.trim()) {
      info.isSearching = true
    }

    // 加载条目
    const result = await passwordApi.getAllEntries({
      groupId: info.selectedGroup,
      page: info.currentPage,
      pageSize: info.pageSize,
      search: info.searchQuery
    })

    console.log('✓ 从数据库加载的数据:', result)

    entries.value = result.list
    total.value = result.total
    totalPages.value = result.totalPages

    // 只在首次加载时加载分组
    if (info.currentPage === 1) {
      const groupsData = await passwordApi.getAllGroups()
      groups.value = groupsData

      // 如果没有默认分组，创建默认分组
      if (groups.value.length === 0) {
        console.log('⚠ 没有分组，创建默认分组')
        const defaultGroups = [
          { name: '社交媒体', color: '#409EFF' },
          { name: '工作', color: '#67C23A' },
          { name: '金融', color: '#E6A23C' },
          { name: '购物', color: '#F56C6C' },
          { name: '其他', color: '#909399' }
        ]

        for (const group of defaultGroups) {
          await passwordApi.createGroup(group)
        }

        // 重新加载分组
        groups.value = await passwordApi.getAllGroups()
        console.log('✓ 默认分组创建完成')
      }
    }
  } catch (e: any) {
    console.error('✗ 加载数据失败:', e)
    ElMessage.error(e.message || '加载数据失败')
  } finally {
    info.isLoading = false
    info.isSearching = false
  }
}

// 监听分组变化，重新加载数据
const handleGroupChange = async (groupId: string) => {
  info.selectedGroup = groupId
  info.currentPage = 1
  await loadData()
}

// 页码变化
const handlePageChange = async (page: number) => {
  info.currentPage = page
  await loadData()
  // 滚动到顶部
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// 过滤后的条目（搜索由后端处理）
const filteredEntries = computed(() => {
  return entries.value
})

// 按分组统计（从 groups 的 count 字段计算）
const groupStats = computed(() => {
  // 计算总数（所有分组的 count 之和）
  const total = groups.value.reduce((sum, group) => sum + (group.count || 0), 0)

  const stats: Record<string, number> = { all: total }

  // 使用后端返回的分组统计
  groups.value.forEach(group => {
    stats[group.id] = group.count || 0
  })

  return stats
})

// 显示的分组列表（折叠时只显示前5个）
const displayedGroups = computed(() => {
  const maxVisible = 5
  if (groups.value.length <= maxVisible || info.groupsExpanded) {
    return groups.value
  }
  return groups.value.slice(0, maxVisible)
})

// 是否需要显示展开/收起按钮
const needsCollapse = computed(() => {
  return groups.value.length > 5
})

// 切换分组展开/收起
const toggleGroupsExpand = () => {
  info.groupsExpanded = !info.groupsExpanded
}

// 密码强度计算
const passwordStrength = computed(() => {
  const password = info.entryForm.password
  if (!password) return 0

  let strength = 0
  if (password.length >= 8) strength += 1
  if (password.length >= 12) strength += 1
  if (/[a-z]/.test(password)) strength += 1
  if (/[A-Z]/.test(password)) strength += 1
  if (/[0-9]/.test(password)) strength += 1
  if (/[^a-zA-Z0-9]/.test(password)) strength += 1

  return Math.min(strength, 5)
})

// 密码强度文本
const strengthText = computed(() => {
  const strength = passwordStrength.value
  if (strength <= 1) return '弱'
  if (strength <= 2) return '较弱'
  if (strength <= 3) return '中等'
  if (strength <= 4) return '强'
  return '很强'
})

// 密码强度颜色
const strengthColor = computed(() => {
  const strength = passwordStrength.value
  if (strength <= 1) return '#F56C6C'
  if (strength <= 2) return '#E6A23C'
  if (strength <= 3) return '#409EFF'
  if (strength <= 4) return '#67C23A'
  return '#85CE61'
})

// 生成随机密码
const generatePassword = () => {
  let chars = ''
  if (info.generatedPassword.includeLower) chars += 'abcdefghijklmnopqrstuvwxyz'
  if (info.generatedPassword.includeUpper) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  if (info.generatedPassword.includeNumbers) chars += '0123456789'
  if (info.generatedPassword.includeSymbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?'

  if (!chars) {
    ElMessage.warning('请至少选择一种字符类型')
    return
  }

  let password = ''
  for (let i = 0; i < info.generatedPassword.length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  info.generatedPassword.result = password
  info.entryForm.password = password
}

// 打开添加对话框
const openAddDialog = () => {
  info.dialogMode = 'add'
  info.currentEntryId = ''
  // 如果当前选中的是分组（不是"全部"），则使用该分组，否则使用第一个分组
  const defaultGroup = info.selectedGroup !== 'all' ? info.selectedGroup : (groups.value[0]?.id || '')
  info.entryForm = {
    title: '',
    username: '',
    password: '',
    url: '',
    group: defaultGroup,
    notes: ''
  }
  info.generatedPassword.result = ''
  info.showDialog = true
}

// 打开编辑对话框
const openEditDialog = (entry: PasswordEntry) => {
  info.dialogMode = 'edit'
  info.currentEntryId = entry.id
  info.entryForm = {
    title: entry.title,
    username: entry.username,
    password: decryptPassword(entry.password),
    url: entry.url,
    group: entry.groupId || '',
    notes: entry.notes
  }
  info.generatedPassword.result = ''
  info.showDialog = true
}

// 保存条目
const saveEntry = async () => {
  // 验证
  if (!info.entryForm.title) {
    ElMessage.warning('请输入标题')
    return
  }
  if (!info.entryForm.password) {
    ElMessage.warning('请输入密码')
    return
  }

  try {
    // 加密密码
    const encryptedPassword = encryptPassword(info.entryForm.password)

    const data = {
      title: info.entryForm.title,
      username: info.entryForm.username,
      password: encryptedPassword,
      url: info.entryForm.url,
      groupId: info.entryForm.group || null,
      notes: info.entryForm.notes
    }

    if (info.dialogMode === 'add') {
      await passwordApi.createEntry(data)
      ElMessage.success('添加成功')
    } else {
      await passwordApi.updateEntry(info.currentEntryId, data)
      ElMessage.success('更新成功')
    }

    // 重新加载数据和统计
    await loadData()
    info.showDialog = false
  } catch (e: any) {
    console.error('保存失败:', e)
    ElMessage.error(e.message || '保存失败')
  }
}

// 删除条目
const deleteEntry = async (entry: PasswordEntry) => {
  try {
    await ElMessageBox.confirm('确定要删除这个密码吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await passwordApi.deleteEntry(entry.id)
    ElMessage.success('删除成功')

    // 重新加载数据和统计
    await loadData()
  } catch (e: any) {
    if (e !== 'cancel') {
      console.error('删除失败:', e)
      ElMessage.error(e.message || '删除失败')
    }
  }
}

// 复制密码
const copyPassword = async (encryptedPassword: string) => {
  const password = decryptPassword(encryptedPassword)
  await copy(password)
  ElMessage.success({
    message: '密码已复制到剪贴板',
    duration: 2000,
    showClose: true
  })
}

// 复制用户名
const copyUsername = async (username: string) => {
  await copy(username)
  ElMessage.success({
    message: '用户名已复制到剪贴板',
    duration: 2000,
    showClose: true
  })
}

// 清除搜索
const handleSearchClear = () => {
  info.searchQuery = ''
  info.currentPage = 1
  loadData()
}

// 格式化时间
const formatTime = (timeStr: string) => {
  if (!timeStr) return ''
  const date = new Date(timeStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 7) return `${days}天前`
  if (days < 30) return `${Math.floor(days / 7)}周前`
  if (days < 365) return `${Math.floor(days / 30)}个月前`
  return `${Math.floor(days / 365)}年前`
}

// 导出密码
const exportPasswords = async () => {
  try {
    const blob = await passwordApi.exportPasswords()

    // 创建下载链接
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `passwords_backup_${new Date().toISOString().split('T')[0]}.json`

    document.body.appendChild(link)
    link.click()

    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

    ElMessage.success('密码导出成功')
  } catch (e: any) {
    console.error('导出失败:', e)
  }
}

// 打开导入对话框
const openImportDialog = () => {
  info.importFile = null
  info.showImportDialog = true
}

// 导入密码
const importPasswords = async () => {
  if (!info.importFile) {
    ElMessage.warning('请选择要导入的文件')
    return
  }

  try {
    const result = await passwordApi.importPasswords(info.importFile)

    if (result.failed === 0) {
      ElMessage.success(`成功导入 ${result.success} 个密码`)
    } else {
      ElMessage.warning(`导入完成：成功 ${result.success} 个，失败 ${result.failed} 个`)
    }

    info.showImportDialog = false

    // 重新加载数据
    await loadData()
  } catch (e: any) {
    console.error('导入失败:', e)
  }
}

// 处理文件选择
const handleFileChange = (file: any) => {
  if (file.raw.type !== 'application/json' && !file.raw.name.endsWith('.json')) {
    ElMessage.error('请选择 JSON 格式的文件')
    return false
  }
  info.importFile = file.raw
  return false // 阻止自动上传
}

// 快捷键支持
const handleKeydown = (e: KeyboardEvent) => {
  // Ctrl/Cmd + K 聚焦搜索框
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault()
    const searchInput = document.querySelector('.search-input input') as HTMLInputElement
    searchInput?.focus()
  }

  // Alt + N 新建密码
  if (e.altKey && e.key === 'n') {
    e.preventDefault()
    openAddDialog()
  }

  // ESC 关闭对话框
  if (e.key === 'Escape') {
    if (info.showDialog) info.showDialog = false
    if (info.showGroupDialog) info.showGroupDialog = false
    if (info.showImportDialog) info.showImportDialog = false
  }
}

// 添加分组
const openGroupDialog = () => {
  info.groupDialogMode = 'add'
  info.currentGroupId = ''
  info.groupForm = {
    name: '',
    color: '#409EFF'
  }
  info.showGroupDialog = true
}

// 编辑分组
const openEditGroupDialog = (group: PasswordGroup) => {
  info.groupDialogMode = 'edit'
  info.currentGroupId = group.id
  info.groupForm = {
    name: group.name,
    color: group.color
  }
  info.showGroupDialog = true
}

// 保存分组
const saveGroup = async () => {
  if (!info.groupForm.name) {
    ElMessage.warning('请输入分组名称')
    return
  }

  try {
    if (info.groupDialogMode === 'add') {
      await passwordApi.createGroup({
        name: info.groupForm.name,
        color: info.groupForm.color
      })
      ElMessage.success('分组添加成功')
    } else {
      await passwordApi.updateGroup(info.currentGroupId, {
        name: info.groupForm.name,
        color: info.groupForm.color
      })
      ElMessage.success('分组更新成功')
    }

    info.showGroupDialog = false

    // 重新加载数据和统计
    await loadData()
  } catch (e: any) {
    console.error('保存分组失败:', e)
    ElMessage.error(e.message || '保存分组失败')
  }
}

// 删除分组
const deleteGroup = async (groupId: string) => {
  // 获取要删除的分组信息
  const group = groups.value.find(g => g.id === groupId)
  const groupName = group?.name || '该分组'
  const count = group?.count || 0

  try {
    // 如果分组有密码，显示警告提示
    if (count > 0) {
      await ElMessageBox.confirm(
        `确定要删除分组"${groupName}"吗？此操作将同时删除该分组下的 ${count} 个密码，删除后无法恢复！`,
        '警告',
        {
          confirmButtonText: '确定删除',
          cancelButtonText: '取消',
          type: 'warning',
          dangerouslyUseHTMLString: false
        }
      )
    }

    await passwordApi.deleteGroup(groupId)
    ElMessage.success(count > 0 ? '分组及其密码删除成功' : '分组删除成功')

    // 切换到全部分组
    info.selectedGroup = 'all'

    // 重新加载数据和统计
    await loadData()
  } catch (e: any) {
    if (e !== 'cancel') {
      console.error('删除分组失败:', e)
      ElMessage.error(e.message || '删除分组失败')
    }
  }
}

onMounted(() => {
  // 加载数据
  loadData()

  // 添加快捷键监听
  window.addEventListener('keydown', handleKeydown)
})

// 组件卸载时移除快捷键监听
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})

// 监听搜索关键词变化
watch(() => info.searchQuery, debounce(() => {
  info.currentPage = 1
  loadData()
}, 500))

// 防抖函数
function debounce(fn: Function, delay: number) {
  let timer: any = null
  return function(this: any, ...args: any[]) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      fn.apply(this, args)
    }, delay)
  }
}

// 暴露给模板的函数（消除 TypeScript 未使用变量警告）
defineExpose({ formatTime, exportPasswords, openImportDialog })
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <!-- 未登录状态 -->
    <div v-if="!userStore.isLoggedIn" class="p-4">
      <div class="max-w-md mx-auto bg-white rounded-2xl p-8 shadow-lg text-center">
        <div class="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
          </svg>
        </div>
        <h2 class="text-2xl font-bold text-gray-800 mb-2">密码管理器</h2>
        <p class="text-gray-600 mb-4">请先登录以使用密码管理器</p>
        <el-button type="primary" @click="userStore.logout">前往登录</el-button>
      </div>
    </div>

    <!-- 已登录状态 -->
    <div v-else class="p-4 space-y-4">
      <!-- 加载状态 -->
      <div v-if="info.isLoading" class="text-center py-12">
        <el-icon class="is-loading text-4xl text-blue-500">
          <svg class="animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </el-icon>
        <p class="text-gray-500 mt-4">加载中...</p>
      </div>

      <!-- 主内容 -->
      <template v-else>
        <!-- 顶部操作栏 -->
        <div class="bg-white rounded-2xl p-4 shadow-sm">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
              <el-button type="primary" @click="openAddDialog">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                </svg>
                添加密码
              </el-button>
              <el-button @click="openGroupDialog">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>
                </svg>
                添加分组
              </el-button>
            </div>

            <!-- <div class="flex items-center gap-3">
              <el-button @click="openImportDialog">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>
                </svg>
                导入
              </el-button>
              <el-button @click="exportPasswords">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                </svg>
                导出
              </el-button>
            </div> -->

            <div class="flex items-center gap-2">
              <el-input
                v-model="info.searchQuery"
                placeholder="搜索密码... (Ctrl+K)"
                prefix-icon="Search"
                clearable
                style="width: 280px"
                class="search-input"
                @clear="handleSearchClear"
              />
              <el-tag v-if="info.isSearching" type="info" effect="plain" size="small">
                搜索中
              </el-tag>
            </div>
          </div>

          <!-- 分组筛选 -->
          <div class="flex items-center gap-2 flex-wrap">
            <el-tag
              :type="info.selectedGroup === 'all' ? 'primary' : 'info'"
              effect="plain"
              size="large"
              @click="handleGroupChange('all')"
              class="cursor-pointer"
            >
              全部 ({{ groupStats.all || 0 }})
            </el-tag>
            <el-tag
              v-for="group in displayedGroups"
              :key="group.id"
              :type="info.selectedGroup === group.id ? 'primary' : 'info'"
              effect="plain"
              size="large"
              @click="handleGroupChange(group.id)"
              class="cursor-pointer"
              closable
              @close="deleteGroup(group.id)"
            >
              {{ group.name }} ({{ groupStats[group.id] || 0 }})
              <el-icon class="ml-2 edit-icon" @click.stop="openEditGroupDialog(group)">
                <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="14" height="14"><path fill="currentColor" d="M853.333333 682.666667v149.333333a53.393333 53.393333 0 0 1-53.333333 53.333333H224a53.393333 53.393333 0 0 1-53.333333-53.333333V224a53.393333 53.393333 0 0 1 53.333333-53.333333h576a53.393333 53.393333 0 0 1 53.333333 53.333333v149.333333h-64V234.666667H234.666667v554.666666h554.666666v-106.666666h64zM732.522667 352.554667l45.269333 45.248-277.333333 277.333333-45.269334-45.269333 277.333334-277.312z m62.165333-16.64l-22.613333-22.613334a42.666667 42.666667 0 0 0-60.330667 0l-22.613333 22.613334 45.269333 45.269333 60.288-60.288z"/></svg>
              </el-icon>
            </el-tag>

            <!-- 展开/收起按钮 -->
            <el-button
              v-if="needsCollapse"
              type="primary"
              link
              size="small"
              @click="toggleGroupsExpand"
            >
              {{ info.groupsExpanded ? '收起' : `展开 (${groups.length - 5})` }}
              <el-icon class="ml-1" :class="{ 'rotate-180': info.groupsExpanded }">
                <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="14" height="14"><path fill="currentColor" d="M831.872 340.864l-45.248-45.248L512 569.856 237.376 295.232l-45.248 45.248L512 660.368z"/></svg>
              </el-icon>
            </el-button>
          </div>
        </div>

        <!-- 密码列表 -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          <div
            v-for="entry in filteredEntries"
            :key="entry.id"
            class="password-card bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all border-l-4"
            :style="{ '--border-color': groups.find(g => g.id === entry.groupId)?.color || '#909399' }"
          >
            <div class="flex items-start justify-between mb-3">
              <div class="flex-1 min-w-0">
                <h3 class="text-lg font-bold text-gray-800 truncate">{{ entry.title }}</h3>
                <div v-if="entry.notes" class="text-sm text-gray-600 line-clamp-2 mt-1">{{ entry.notes }}</div>
                <p class="text-sm text-gray-500 truncate mt-1">{{ entry.username }}</p>
                <!-- <p class="text-xs text-gray-400 mt-1">更新于 {{ formatTime(entry.updateTime) }}</p> -->
              </div>
              <div class="flex gap-1 ml-2">
                <el-button size="small" @click="openEditDialog(entry)">编辑</el-button>
                <el-button size="small" type="danger" @click="deleteEntry(entry)">删除</el-button>
              </div>
            </div>

            <div class="space-y-2 text-sm">
              <div v-if="entry.url" class="flex items-center gap-2">
                <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path>
                </svg>
                <a :href="entry.url" target="_blank" class="text-blue-600 hover:underline truncate">{{ entry.url }}</a>
              </div>
            </div>

            <div class="flex gap-2 mt-3">
              <el-button size="small" @click="copyUsername(entry.username)">
                复制账号
              </el-button>
              <el-button size="small" type="primary" @click="copyPassword(entry.password)">
                复制密码
              </el-button>
            </div>
          </div>
        </div>

        <!-- 加载更多按钮 -->
        <div v-if="totalPages > 1 && filteredEntries.length > 0" class="flex justify-center mt-6">
          <el-pagination
            :current-page="info.currentPage"
            :page-size="info.pageSize"
            :total="total"
            :page-count="totalPages"
            layout="total, prev, pager, next, jumper"
            @current-change="handlePageChange"
            :background="true"
          />
        </div>

        <!-- 数据为空提示 -->
        <div v-else-if="total === 0" class="text-center py-12">
          <svg class="w-24 h-24 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
          </svg>
          <p class="text-gray-500 text-lg">
            {{ info.searchQuery ? '没有找到匹配的密码' : '暂无密码记录' }}
          </p>
          <el-button type="primary" class="mt-4" @click="info.searchQuery ? handleSearchClear() : openAddDialog()">
            {{ info.searchQuery ? '清除搜索' : '添加第一个密码' }}
          </el-button>
        </div>
      </template>
    </div>

    <!-- 添加/编辑密码对话框 -->
    <el-dialog
      v-model="info.showDialog"
      :title="info.dialogMode === 'add' ? '添加密码' : '编辑密码'"
      width="600px"
    >
      <el-form :model="info.entryForm" label-width="80px" class="mt-4">
        <el-form-item label="标题" required>
          <el-input v-model="info.entryForm.title" placeholder="如：Google账号" />
        </el-form-item>

        <el-form-item label="用户名">
          <el-input v-model="info.entryForm.username" placeholder="请输入用户名或邮箱" />
        </el-form-item>

        <el-form-item label="密码" required>
          <div class="w-full space-y-2">
            <el-input
              v-model="info.entryForm.password"
              type="password"
              placeholder="请输入密码"
              show-password
            />

            <!-- 密码强度指示器 -->
            <div v-if="info.entryForm.password" class="flex items-center gap-2">
              <div class="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  class="h-full transition-all duration-300"
                  :style="{ width: (passwordStrength / 5 * 100) + '%', backgroundColor: strengthColor }"
                ></div>
              </div>
              <span class="text-sm" :style="{ color: strengthColor }">{{ strengthText }}</span>
            </div>

            <!-- 密码生成器 -->
            <div class="bg-gray-50 rounded-lg p-3 mt-2">
              <div class="text-sm font-medium text-gray-700 mb-2">密码生成器</div>
              <div class="flex items-center gap-2 mb-2">
                <el-input-number
                  v-model="info.generatedPassword.length"
                  :min="8"
                  :max="32"
                  size="small"
                  style="width: 120px"
                />
                <span class="text-sm text-gray-600">位</span>
              </div>
              <div class="flex flex-wrap gap-2 mb-2">
                <el-checkbox v-model="info.generatedPassword.includeLower">小写</el-checkbox>
                <el-checkbox v-model="info.generatedPassword.includeUpper">大写</el-checkbox>
                <el-checkbox v-model="info.generatedPassword.includeNumbers">数字</el-checkbox>
                <el-checkbox v-model="info.generatedPassword.includeSymbols">符号</el-checkbox>
              </div>
              <el-button size="small" type="primary" @click="generatePassword">生成密码</el-button>
            </div>
          </div>
        </el-form-item>

        <el-form-item label="网站URL">
          <el-input v-model="info.entryForm.url" placeholder="https://example.com" />
        </el-form-item>

        <el-form-item label="分组">
          <el-select v-model="info.entryForm.group" placeholder="选择分组" class="w-full">
            <el-option
              v-for="group in groups"
              :key="group.id"
              :label="group.name"
              :value="group.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="备注">
          <el-input
            v-model="info.entryForm.notes"
            type="textarea"
            :rows="3"
            placeholder="添加备注信息..."
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="info.showDialog = false">取消</el-button>
        <el-button type="primary" @click="saveEntry">保存</el-button>
      </template>
    </el-dialog>

    <!-- 添加/编辑分组对话框 -->
    <el-dialog v-model="info.showGroupDialog" :title="info.groupDialogMode === 'add' ? '添加分组' : '编辑分组'" width="400px">
      <el-form :model="info.groupForm" label-width="80px">
        <el-form-item label="分组名" required>
          <el-input v-model="info.groupForm.name" placeholder="如：社交媒体" maxlength="50" show-word-limit />
        </el-form-item>

        <!-- 颜色选择器已隐藏 -->
        <!-- <el-form-item label="颜色">
          <el-color-picker v-model="info.groupForm.color" />
        </el-form-item> -->
      </el-form>

      <template #footer>
        <el-button @click="info.showGroupDialog = false">取消</el-button>
        <el-button type="primary" @click="saveGroup">保存</el-button>
      </template>
    </el-dialog>

    <!-- 导入对话框 -->
    <el-dialog v-model="info.showImportDialog" title="导入密码" width="500px">
      <div class="space-y-4">
        <el-alert type="info" :closable="false">
          <p>请选择之前导出的 JSON 文件进行导入</p>
          <p class="text-sm mt-2">注意：导入将添加到现有密码中，不会覆盖</p>
        </el-alert>

        <el-upload
          drag
          :auto-upload="false"
          :on-change="handleFileChange"
          :show-file-list="false"
          accept=".json"
          class="w-full"
        >
          <svg class="w-16 h-16 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
          </svg>
          <p class="text-gray-600 mt-2">点击或拖拽文件到此处</p>
          <p class="text-gray-400 text-sm">仅支持 JSON 格式</p>
        </el-upload>

        <div v-if="info.importFile" class="text-center text-sm text-gray-600">
          已选择: {{ info.importFile.name }}
        </div>
      </div>

      <template #footer>
        <el-button @click="info.showImportDialog = false">取消</el-button>
        <el-button type="primary" @click="importPasswords" :disabled="!info.importFile">开始导入</el-button>
      </template>
    </el-dialog>

    <!-- 使用说明 -->
    <ToolDetail title="使用说明">
      <div class="space-y-4">
        <div>
          <h4 class="font-bold text-gray-800 mb-2">功能介绍</h4>
          <ul class="space-y-1 text-sm text-gray-600">
            <li>• 安全存储：所有密码使用AES加密存储在数据库中</li>
            <li>• 分组管理：支持自定义分组，方便分类管理不同类型的账号</li>
            <li>• 备注功能：为每个密码添加详细备注，记录重要信息</li>
            <li>• 密码生成：内置密码生成器，创建强密码保护账号安全</li>
            <li>• 快速搜索：支持按标题、用户名、URL、备注快速查找</li>
            <li>• 云端同步：登录后数据自动同步到云端，多设备访问</li>
          </ul>
        </div>

        <div>
          <h4 class="font-bold text-gray-800 mb-2">安全提示</h4>
          <ul class="space-y-1 text-sm text-gray-600">
            <li>• 所有密码在服务器端加密存储，只有您可以解密查看</li>
            <li>• 建议使用密码生成器创建强密码，保护账号安全</li>
            <li>• 请勿在公共电脑上使用或记得及时退出登录</li>
            <li>• 定期更新重要密码，提高账号安全性</li>
          </ul>
        </div>

        <div>
          <h4 class="font-bold text-gray-800 mb-2">使用方法</h4>
          <ol class="space-y-1 text-sm text-gray-600 list-decimal list-inside">
            <li>首次使用请先登录账号</li>
            <li>点击"添加密码"保存您的账号信息（快捷键 Alt+N）</li>
            <li>可以创建自定义分组来分类管理</li>
            <li>点击"复制密码"快速复制密码到剪贴板</li>
            <li>使用搜索框快速查找密码（快捷键 Ctrl+K）</li>
            <li>支持导入导出功能，方便备份和迁移数据</li>
            <li>数据自动保存到云端，无需手动备份</li>
          </ol>
        </div>

        <div>
          <h4 class="font-bold text-gray-800 mb-2">快捷键</h4>
          <ul class="space-y-1 text-sm text-gray-600">
            <li><kbd class="px-2 py-1 bg-gray-100 rounded text-xs">Ctrl</kbd> + <kbd class="px-2 py-1 bg-gray-100 rounded text-xs">K</kbd> : 聚焦搜索框</li>
            <li><kbd class="px-2 py-1 bg-gray-100 rounded text-xs">Alt</kbd> + <kbd class="px-2 py-1 bg-gray-100 rounded text-xs">N</kbd> : 新建密码</li>
            <li><kbd class="px-2 py-1 bg-gray-100 rounded text-xs">Esc</kbd> : 关闭对话框</li>
          </ul>
        </div>
      </div>
    </ToolDetail>
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.password-card {
  border-left-color: var(--border-color);
  transition: all 0.3s ease;
}

.password-card:hover {
  border-left-color: #FF6B35;
  transform: translateY(-2px);
}

.edit-icon {
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.2s;
}

.edit-icon:hover {
  opacity: 1 !important;
}

.rotate-180 {
  transform: rotate(180deg);
  transition: transform 0.3s;
}

.el-icon {
  transition: transform 0.3s;
}
</style>
