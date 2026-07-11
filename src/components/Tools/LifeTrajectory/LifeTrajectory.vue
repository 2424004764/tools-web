<script setup lang="ts">
import { reactive, ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import functionsRequest from '@/utils/functionsRequest'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Promotion, EditPen, Delete, User, ChatLineRound } from '@element-plus/icons-vue'
import { useUserStore } from '@/store/modules/user'

interface Trajectory {
  id: string
  uid: string
  content: string
  mood: string
  createTime: string
}

interface Pagination {
  total: number
  page: number
  pageSize: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

const router = useRouter()
const userStore = useUserStore()

const info = reactive({ title: '人生轨迹' })

const items = ref<Trajectory[]>([])
const pagination = ref<Pagination>({
  total: 0,
  page: 1,
  pageSize: 20,
  totalPages: 0,
  hasNext: false,
  hasPrev: false,
})

const loading = ref(false)
const sending = ref(false)
const showCompose = ref(false)

// 仅保留文字 + 单个 emoji，避免引入富文本带来的存储/展示复杂度
const MOOD_OPTIONS = ['🌱', '🌸', '☀️', '🌧️', '🌈', '🔥', '🌙', '⭐', '🍀', '☕', '📚', '🎵']

const form = reactive({
  content: '',
  mood: '🌱',
})

// 已登录用户可发布/删除自己的轨迹
const isLoggedIn = computed(() => userStore.getLoginStatus)
const myUid = computed(() => userStore.getUserInfo?.uid || '')

const goToLogin = () => {
  router.push(`/login?redirect=${encodeURIComponent('/life-trajectory/')}`)
}

const fetchList = async (page = 1) => {
  loading.value = true
  try {
    const res = await functionsRequest.get('/api/life-trajectories', {
      params: { page, pageSize: pagination.value.pageSize },
    })
    if (res.status === 200) {
      const data = res.data || {}
      items.value = data.data || []
      if (data.pagination) pagination.value = data.pagination
    }
  } catch (err) {
    // 401 在响应拦截器里已经处理，这里只静默
  } finally {
    loading.value = false
  }
}

const refresh = () => fetchList(pagination.value.page)

const openCompose = () => {
  if (!isLoggedIn.value) {
    goToLogin()
    return
  }
  form.content = ''
  form.mood = '🌱'
  showCompose.value = true
}

const submit = async () => {
  const content = form.content.trim()
  if (!content) {
    ElMessage.warning('请写下点什么～')
    return
  }
  if (content.length > 500) {
    ElMessage.warning('内容最多 500 字')
    return
  }
  sending.value = true
  try {
    const res = await functionsRequest.post('/api/life-trajectories', {
      content,
      mood: form.mood,
    })
    if (res.status === 201) {
      ElMessage.success('已记下这一刻 ✨')
      showCompose.value = false
      // 重新拉第一页，让新发布的轨迹出现在最上面
      await fetchList(1)
    }
  } catch (err) {
    // 401 等错误由拦截器统一处理
  } finally {
    sending.value = false
  }
}

const confirmDelete = async (item: Trajectory) => {
  try {
    await ElMessageBox.confirm('确定要删除这条轨迹吗？', '删除轨迹', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return // 取消
  }
  try {
    const res = await functionsRequest.delete(`/api/life-trajectories/${item.id}`)
    if (res.status === 200) {
      ElMessage.success('已删除')
      // 当前页空了且不是第一页 → 回退到上一页
      if (items.value.length === 1 && pagination.value.page > 1) {
        await fetchList(pagination.value.page - 1)
      } else {
        await fetchList(pagination.value.page)
      }
    }
  } catch (err) {
    /* ignore */
  }
}

const formatTime = (iso: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  // 1 分钟内：刚刚
  if (diff < 60_000) return '刚刚'
  // 同一天：HH:MM
  if (d.toDateString() === now.toDateString()) {
    return `今天 ${d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
  }
  // 昨天：昨天 HH:MM
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) {
    return `昨天 ${d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
  }
  // 本年内：MM-DD
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
  }
  // 跨年：YYYY-MM-DD
  return d.toLocaleDateString('zh-CN')
}

const isMine = (item: Trajectory) => isLoggedIn.value && item.uid === myUid.value

// 字符计数
const charCount = computed(() => form.content.length)

onMounted(() => {
  userStore.initUserState()
  fetchList(1)
})
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="lx-container">
      <!-- 顶部栏 -->
      <div class="lx-header">
        <div class="lx-header-left">
          <div class="lx-icon">
            <el-icon><ChatLineRound /></el-icon>
          </div>
          <div>
            <h3 class="lx-title">最近的人生轨迹</h3>
            <p class="lx-subtitle">共 {{ pagination.total }} 条记录</p>
          </div>
        </div>
        <div class="lx-header-actions">
          <el-button class="lx-btn-refresh" :icon="Refresh" circle @click="refresh" :loading="loading" />
          <el-button
            v-if="!isLoggedIn"
            class="lx-btn-login"
            :icon="User"
            plain
            @click="goToLogin"
          >
            登录
          </el-button>
          <el-button class="lx-btn-post" type="primary" :icon="EditPen" @click="openCompose">
            记一笔
          </el-button>
        </div>
      </div>

      <!-- 轨迹流 -->
      <div v-loading="loading" class="lx-feed">
        <div v-if="items.length === 0 && !loading" class="lx-empty">
          <el-icon class="lx-empty-icon"><ChatLineRound /></el-icon>
          <h3 class="lx-empty-title">还没有任何轨迹</h3>
          <p class="lx-empty-desc">登录后写下人生的第一笔吧</p>
          <el-button v-if="!isLoggedIn" type="primary" @click="goToLogin">
            立即登录
          </el-button>
          <el-button v-else type="primary" :icon="EditPen" @click="openCompose">
            记一笔
          </el-button>
        </div>

        <!-- 时间线外层容器：负责画竖线 + 节点圆 -->
        <ul v-else class="lx-timeline">
          <li
            v-for="item in items"
            :key="item.id"
            class="lx-timeline-item fade-in"
          >
            <!-- 左侧时间线轴 -->
            <div class="lx-axis">
              <div class="lx-axis-dot">{{ item.mood || '🌱' }}</div>
            </div>
            <!-- 右侧卡片 -->
            <div class="lx-card">
              <p class="lx-card-content">{{ item.content }}</p>
              <div class="lx-card-foot">
                <span class="lx-card-time">{{ formatTime(item.createTime) }}</span>
                <el-button
                  v-if="isMine(item)"
                  class="lx-card-delete"
                  size="small"
                  type="danger"
                  :icon="Delete"
                  plain
                  circle
                  @click="confirmDelete(item)"
                />
              </div>
            </div>
          </li>
        </ul>
      </div>

      <!-- 分页 -->
      <div v-if="pagination.total > pagination.pageSize" class="lx-pager">
        <el-pagination
          v-model:current-page="pagination.page"
          :page-size="pagination.pageSize"
          :total="pagination.total"
          layout="prev, pager, next"
          background
          @current-change="(p: number) => fetchList(p)"
        />
      </div>

      <!-- 未登录提示条 -->
      <div v-if="!isLoggedIn && items.length > 0" class="lx-tip">
        <el-icon><Promotion /></el-icon>
        <span>登录后即可发布自己的轨迹 ✨</span>
        <el-button size="small" type="primary" link @click="goToLogin">去登录</el-button>
      </div>
    </div>

    <!-- 发布弹窗 -->
    <el-dialog
      v-model="showCompose"
      title="记一笔"
      width="92%"
      max-width="520px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <div class="space-y-4">
        <div>
          <label class="lx-form-label">当下心情</label>
          <div class="lx-mood-picker">
            <button
              v-for="m in MOOD_OPTIONS"
              :key="m"
              type="button"
              class="lx-mood-btn"
              :class="{ selected: form.mood === m }"
              @click="form.mood = m"
            >
              {{ m }}
            </button>
          </div>
        </div>
        <div>
          <label class="lx-form-label">这一刻</label>
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="5"
            placeholder="记录此刻的想法、心情或小确幸…"
            maxlength="500"
            show-word-limit
          />
        </div>
        <p class="lx-form-tip">⚠️ 只能发布文字和表情，不支持图片/链接/HTML</p>
      </div>
      <template #footer>
        <el-button @click="showCompose = false">取消</el-button>
        <el-button
          type="primary"
          :loading="sending"
          :disabled="!form.content.trim() || sending || charCount > 500"
          @click="submit"
        >
          发布
        </el-button>
      </template>
    </el-dialog>

    <!-- SEO 描述 -->
    <ToolDetail title="关于人生轨迹">
      <el-text>
        人生轨迹是一个轻量的「生活记录」工具：登录后写下这一瞬间的文字 + 一个表情，所有用户都能看到彼此的最新轨迹。
        <br /><br />
        <strong>特色：</strong>
        <br />• <strong>极简输入</strong>：只能发文字 + 单个表情 emoji，没有富文本、没有图片、没有链接，专注于「这一刻」
        <br />• <strong>最新优先</strong>：列表按发布时间倒序，新发布的轨迹永远在最上面
        <br />• <strong>公开可见</strong>：所有人可浏览所有轨迹，无需登录也能围观
        <br />• <strong>权限隔离</strong>：必须登录才能发布；只能删除自己的轨迹（其他用户的轨迹看不到删除按钮）
        <br />• <strong>云端存储</strong>：数据持久化在 Cloudflare D1 数据库，跨设备同步
        <br /><br />
        <strong>使用场景：</strong>
        <br />1. 早上醒来，记录今天的目标与心情 ☀️
        <br />2. 夜里复盘，写下今天的小确幸或感悟 🌙
        <br />3. 旅途中打卡一个 emoji + 一句话，留下足迹 🌱
        <br />4. 情绪上头又不想发朋友圈？来这里匿名（虽然已登录）地写下你的心 ⭐
        <br /><br />
        <strong>使用步骤：</strong>
        <br />1. 点击右上角「记一笔」（未登录会跳转到登录页）
        <br />2. 选择一个心情 emoji（12 选 1）
        <br />3. 在文本框写下这一刻的想法（最多 500 字）
        <br />4. 点击发布，新轨迹就会出现在列表最上方
        <br />5. 想删除自己发布的轨迹？鼠标移到卡片右下角，点击红色删除按钮
        <br /><br />
        <strong>技术实现：</strong>
        <br />• <strong>后端</strong>：Cloudflare Pages Functions + D1 数据库
        <br />• <strong>表结构</strong>：life_trajectories（id / uid / content / mood / create_time）
        <br />• <strong>鉴权</strong>：复用项目自身的 JWT（Bearer Token）机制，与其他用户态工具保持一致
        <br />• <strong>权限</strong>：删除时双重校验 id + uid，确保只能删自己的记录
        <br />• <strong>建表 SQL</strong>：见项目根目录 <code class="bg-gray-200 px-1 rounded">migrations/create_life_trajectories_table.sql</code>
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
/* 容器：渐变 + 毛玻璃 + 圆角 */
.lx-container {
  background: linear-gradient(135deg, #f6d365 0%, #fda085 100%);
  border-radius: 24px;
  padding: 28px;
  position: relative;
  overflow: hidden;
  min-height: 400px;
}

.lx-container::before {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  z-index: 0;
}

.lx-container > * {
  position: relative;
  z-index: 1;
}

/* 顶部栏 */
.lx-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  padding: 20px 24px;
  border-radius: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.lx-header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.lx-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: linear-gradient(135deg, #f6d365, #fda085);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  box-shadow: 0 6px 18px rgba(253, 160, 133, 0.4);
}

.lx-icon .el-icon {
  font-size: 24px;
}

.lx-title {
  font-size: 22px;
  font-weight: 700;
  margin: 0;
  background: linear-gradient(135deg, #f6d365, #fda085);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.lx-subtitle {
  font-size: 13px;
  color: #718096;
  margin: 4px 0 0 0;
}

.lx-header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.lx-btn-refresh,
.lx-btn-login,
.lx-btn-post {
  transition: all 0.25s ease;
}

.lx-btn-refresh:hover,
.lx-btn-login:hover {
  transform: translateY(-2px);
}

.lx-btn-post {
  background: linear-gradient(135deg, #f6d365, #fda085);
  border: none;
  padding: 10px 22px;
  font-weight: 600;
}

.lx-btn-post:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(253, 160, 133, 0.45);
}

/* 列表 */
.lx-feed {
  display: flex;
  flex-direction: column;
}

/* 空状态 */
.lx-empty {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 20px;
  padding: 60px 20px;
  text-align: center;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
}

.lx-empty-icon {
  font-size: 56px;
  color: #fda085;
  margin-bottom: 16px;
}

.lx-empty-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: #2d3748;
}

.lx-empty-desc {
  font-size: 14px;
  color: #718096;
  margin: 0 0 24px 0;
}

/* ===== 时间线 ===== */
.lx-timeline {
  list-style: none;
  padding: 0;
  margin: 0;
}

.lx-timeline-item {
  display: flex;
  gap: 14px;
  position: relative;
}

/* 左侧轴 */
.lx-axis {
  position: relative;
  flex-shrink: 0;
  width: 36px;
  display: flex;
  justify-content: center;
  /* 节点圆 + 上下两段虚线 */
}

/* 节点圆：emoji + 白底圆 + 渐变描边 */
.lx-axis-dot {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid #fda085;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  line-height: 1;
  box-shadow: 0 2px 8px rgba(253, 160, 133, 0.35);
  z-index: 1;
  transition: transform 0.2s ease;
}

.lx-timeline-item:hover .lx-axis-dot {
  transform: scale(1.1);
}

/* 上下虚线：仅在节点内上下两半画线，最后一项/首项的相应半边不画 */
.lx-axis::before,
.lx-axis::after {
  content: '';
  position: absolute;
  left: 50%;
  width: 2px;
  transform: translateX(-50%);
  background: repeating-linear-gradient(
    to bottom,
    #f6d365 0,
    #f6d365 6px,
    transparent 6px,
    transparent 12px
  );
}

/* 上半段线（在节点顶部之上） */
.lx-axis::before {
  top: 0;
  height: calc(50% - 20px);
}

/* 下半段线（在节点底部之下） */
.lx-axis::after {
  bottom: 0;
  height: calc(50% - 20px);
}

/* 第一个节点：不画上半段（避免线穿出列表顶部） */
.lx-timeline-item:first-child .lx-axis::before {
  display: none;
}

/* 最后一个节点：不画下半段（避免线穿出列表底部） */
.lx-timeline-item:last-child .lx-axis::after {
  display: none;
}

/* ===== 卡片 ===== */
.lx-card {
  flex: 1;
  min-width: 0;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(20px);
  border-radius: 18px;
  padding: 16px 20px;
  margin-bottom: 18px;
  box-shadow: 0 6px 22px rgba(0, 0, 0, 0.07);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  position: relative;
}

.lx-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #f6d365, #fda085);
  border-radius: 18px 18px 0 0;
  opacity: 0.7;
}

/* 卡片左侧冒出的小三角箭头，对应节点 */
.lx-card::after {
  content: '';
  position: absolute;
  left: -8px;
  top: 14px;
  width: 0;
  height: 0;
  border-top: 8px solid transparent;
  border-bottom: 8px solid transparent;
  border-right: 8px solid rgba(255, 255, 255, 0.96);
}

.lx-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.1);
}

.lx-card-content {
  font-size: 15px;
  line-height: 1.7;
  color: #2d3748;
  margin: 0 0 10px 0;
  word-break: break-word;
  white-space: pre-wrap;
}

.lx-card-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  padding-top: 8px;
}

.lx-card-time {
  font-size: 12px;
  color: #a0aec0;
}

.lx-card-delete {
  width: 28px;
  height: 28px;
  opacity: 0;
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.lx-card:hover .lx-card-delete {
  opacity: 1;
}

.lx-card-delete:hover {
  transform: scale(1.1);
}

/* 淡入动画 */
@keyframes fade-in-anim {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fade-in {
  animation: fade-in-anim 0.45s ease-out both;
}

/* 分页 */
.lx-pager {
  margin-top: 24px;
  display: flex;
  justify-content: center;
}

:deep(.lx-pager .el-pager li) {
  background: rgba(255, 255, 255, 0.85);
  border-radius: 10px;
  margin: 0 3px;
  border: none;
  color: #b7791f;
}

:deep(.lx-pager .el-pager li.is-active) {
  background: linear-gradient(135deg, #f6d365, #fda085);
  color: white;
}

:deep(.lx-pager .btn-prev),
:deep(.lx-pager .btn-next) {
  background: rgba(255, 255, 255, 0.85);
  border-radius: 10px;
  border: none;
  color: #b7791f;
}

/* 顶部未登录提示 */
.lx-tip {
  margin-top: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 14px;
  font-size: 13px;
  color: #b7791f;
}

/* 弹窗表单 */
.lx-form-label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 8px;
}

.lx-mood-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.lx-mood-btn {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: 2px solid transparent;
  background: #f7fafc;
  font-size: 22px;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lx-mood-btn:hover {
  background: #fff5e6;
  transform: scale(1.08);
}

.lx-mood-btn.selected {
  border-color: #fda085;
  background: #fff5e6;
  transform: scale(1.05);
}

.lx-form-tip {
  font-size: 12px;
  color: #a0aec0;
  margin: 0;
}

/* 移动端 */
@media (max-width: 640px) {
  .lx-container {
    padding: 16px;
  }
  .lx-header {
    flex-direction: column;
    align-items: stretch;
    padding: 16px;
  }
  .lx-header-left {
    justify-content: center;
  }
  .lx-header-actions {
    justify-content: center;
  }
  .lx-icon {
    width: 44px;
    height: 44px;
    font-size: 20px;
  }
  .lx-title {
    font-size: 18px;
  }
  .lx-card {
    padding: 12px 14px;
    margin-bottom: 14px;
  }
  .lx-card-content {
    font-size: 14px;
  }
  /* 移动端左侧轴更紧凑 */
  .lx-axis,
  .lx-axis-dot {
    width: 30px;
    height: 30px;
  }
  .lx-axis-dot {
    font-size: 15px;
  }
  .lx-timeline-item {
    gap: 10px;
  }
  .lx-card::after {
    left: -6px;
    border-top: 6px solid transparent;
    border-bottom: 6px solid transparent;
    border-right: 6px solid rgba(255, 255, 255, 0.96);
    top: 12px;
  }
  /* 移动端始终显示删除按钮（避免 hover 不生效） */
  .lx-card-delete {
    opacity: 1;
  }
}
</style>
