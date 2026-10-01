<script setup lang="ts">
// 博客写作/编辑器：前台 /blog/write（登录用户投稿）与后台 /admin/blog/write（管理员发文/改稿）复用
// - 管理员：可存草稿 / 直接发布；可编辑已有文章（?id=xxx，含下线稿复活发布）
// - 普通用户：提交投稿 → pending，后台审核通过后展示
// 编辑器为 textarea + markdown-it 实时预览（桌面分屏、移动端切换），不引新依赖
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { submitBlogPost } from '@/api/blog'
import {
  fetchAdminBlogPost,
  createAdminBlogPost,
  updateAdminBlogPost,
  type AdminBlogPostUpdatePayload,
} from '@/api/admin/blog'
import { renderMarkdown } from './blog-markdown'
import { useUserStore } from '@/store/modules/user'
import { useToolsStore } from '@/store/modules/tools'
import type { ToolsInfo } from '@/components/Tools/tools.type'
import Edit from '~icons/ep/edit'
import View from '~icons/ep/view'
import ArrowLeft from '~icons/ep/arrow-left'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const toolsStore = useToolsStore()

const isAdmin = computed(() => userStore.getIsAdmin)
// 后台上下文（/admin/blog/write）成功后回文章管理；前台上下文回博客列表
const inAdmin = computed(() => route.path.startsWith('/admin'))
// 编辑模式：仅管理员可用（?id=）
const editingId = computed(() => (isAdmin.value ? String(route.query.id || '') : ''))

const form = reactive({
  title: '',
  summary: '',
  cover: '',
  tags: '',
  slug: '',
  content: '',
})
// 管理员引流推荐位（普通用户也可不填；后端两套接口都接受 related_tools）
const relatedTools = ref<string[]>([])
// 编辑时记住原状态：保存修改时不传 status（保持原状态），发布时才传 published
const editingStatus = ref('')

const loading = ref(false) // 编辑回填中
const submitting = ref(false)
const mobileView = ref<'edit' | 'preview'>('edit')

const previewHtml = computed(() => renderMarkdown(form.content))
const contentLen = computed(() => form.content.length)

const toolOptions = computed<ToolsInfo[]>(() => toolsStore.list || [])

const canSubmit = computed(
  () => form.title.trim().length > 0 && form.content.trim().length > 0 && !submitting.value,
)

const loadToolOptions = async () => {
  if (!isAdmin.value || toolsStore.list.length) return
  try {
    await toolsStore.loadToolsFromApi()
  } catch {
    /* store 内部有兜底 */
  }
}

// 编辑回填（仅管理员）
const loadForEdit = async () => {
  if (!editingId.value) return
  loading.value = true
  try {
    const post = await fetchAdminBlogPost(editingId.value)
    form.title = post.title || ''
    form.summary = post.summary || ''
    form.cover = post.cover || ''
    form.tags = post.tags || ''
    form.slug = post.slug || ''
    form.content = post.content || ''
    relatedTools.value = String(post.related_tools || '').split(',').map((s) => s.trim()).filter(Boolean)
    editingStatus.value = post.status || ''
  } catch (e) {
    console.error('load blog post for edit failed:', e)
    ElMessage.error('文章加载失败')
  } finally {
    loading.value = false
  }
}

const buildPayload = () => ({
  title: form.title.trim(),
  summary: form.summary.trim(),
  cover: form.cover.trim(),
  tags: form.tags.trim(),
  related_tools: relatedTools.value.join(','),
  content: form.content,
})

const afterSaved = (message: string) => {
  ElMessage.success(message)
  router.push(inAdmin.value ? '/admin/blog' : '/blog')
}

// 次按钮（左侧）：新建=存草稿；待审/已发布的编辑=仅保存内容保持原状态；草稿/被拒=存为草稿
const secondaryTarget = computed<'draft' | 'published' | 'keep'>(() => {
  if (!editingId.value) return 'draft'
  if (editingStatus.value === 'pending' || editingStatus.value === 'published') return 'keep'
  return 'draft'
})
const secondaryLabel = computed(() => {
  if (!editingId.value) return '存草稿'
  if (editingStatus.value === 'pending' || editingStatus.value === 'published') return '保存修改'
  return '存为草稿'
})
// 主按钮（右侧）：新建=发布；已发布编辑=保存修改；其余=保存并发布
const primaryLabel = computed(() =>
  !editingId.value ? '发布' : editingStatus.value === 'published' ? '保存修改' : '保存并发布',
)

// ---- 管理员：存草稿 / 发布 / 保存修改 ----
const saveAsAdmin = async (target: 'draft' | 'published' | 'keep') => {
  if (!canSubmit.value) return
  submitting.value = true
  try {
    if (editingId.value) {
      const payload: AdminBlogPostUpdatePayload = buildPayload()
      if (target !== 'keep') payload.status = target
      await updateAdminBlogPost(editingId.value, payload)
      afterSaved(target === 'published' ? '文章已发布' : '文章已保存')
    } else {
      // 新建场景 target 只会是 draft/published（keep 仅出现在编辑已有文章时）
      const status = target === 'published' ? 'published' : 'draft'
      await createAdminBlogPost({ ...buildPayload(), slug: form.slug.trim() || undefined, status })
      afterSaved(status === 'published' ? '文章已发布' : '草稿已保存')
    }
  } catch (e) {
    console.error('save blog post failed:', e)
  } finally {
    submitting.value = false
  }
}

// ---- 普通用户：提交投稿 ----
const submitContribution = async () => {
  if (!canSubmit.value) return
  submitting.value = true
  try {
    const res = await submitBlogPost(buildPayload())
    afterSaved(res.message)
  } catch (e) {
    console.error('submit blog post failed:', e)
  } finally {
    submitting.value = false
  }
}

// 返回列表：前台回博客列表，后台回文章管理；有未保存内容时先确认
const goBack = async () => {
  if (form.title.trim() || form.content.trim()) {
    try {
      await ElMessageBox.confirm('文章还未保存，离开后将丢失未保存的内容。', '返回列表', {
        confirmButtonText: '仍要离开',
        cancelButtonText: '继续编辑',
        type: 'warning',
      })
    } catch {
      return
    }
  }
  router.push(inAdmin.value ? '/admin/blog' : '/blog')
}

onMounted(() => {
  if (!userStore.getLoginStatus) {
    router.replace({ path: '/login', query: { redirect: route.fullPath } })
    return
  }
  loadToolOptions()
  loadForEdit()
})
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 pt-6 pb-2 w-full">
    <!-- 页头 -->
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-3 min-w-0">
        <button
          type="button"
          aria-label="返回文章列表"
          title="返回文章列表"
          class="w-9 h-9 rounded-full border border-border-subtle bg-white dark:bg-surface-1 text-ink-500 dark:text-ink-400 flex items-center justify-center cursor-pointer shrink-0 hover:border-accent-400 hover:text-accent-600 transition-colors"
          @click="goBack"
        >
          <ArrowLeft class="w-4 h-4" aria-hidden="true" />
        </button>
        <div class="min-w-0">
          <h1 class="text-xl font-bold text-ink-900 dark:text-ink-100 m-0">
            {{ editingId ? '编辑文章' : isAdmin ? '写文章' : '投稿' }}
          </h1>
          <p class="mt-1 text-xs text-ink-400">
            {{
              isAdmin
                ? '支持 Markdown；可存草稿或直接发布'
                : '支持 Markdown；提交后经站长审核通过即展示'
            }}
          </p>
        </div>
      </div>
      <!-- 移动端 编辑/预览 切换（桌面分屏时隐藏） -->
      <div class="flex items-center gap-1 lg:hidden">
        <button
          type="button"
          class="h-8 px-3 rounded-full text-xs border border-0 cursor-pointer inline-flex items-center gap-1 transition-colors"
          :class="
            mobileView === 'edit'
              ? 'bg-brand-gradient text-white font-medium'
              : 'bg-white dark:bg-surface-2 text-ink-600 dark:text-ink-300 border-border-subtle'
          "
          @click="mobileView = 'edit'"
        >
          <Edit class="w-3.5 h-3.5" aria-hidden="true" /> 编辑
        </button>
        <button
          type="button"
          class="h-8 px-3 rounded-full text-xs border border-0 cursor-pointer inline-flex items-center gap-1 transition-colors"
          :class="
            mobileView === 'preview'
              ? 'bg-brand-gradient text-white font-medium'
              : 'bg-white dark:bg-surface-2 text-ink-600 dark:text-ink-300 border-border-subtle'
          "
          @click="mobileView = 'preview'"
        >
          <View class="w-3.5 h-3.5" aria-hidden="true" /> 预览
        </button>
      </div>
    </div>

    <div v-loading="loading" class="mt-4">
      <!-- 基础信息 -->
      <div class="rounded-xl border border-border-subtle bg-white dark:bg-surface-1 p-4 md:p-5">
        <el-input
          v-model="form.title"
          placeholder="文章标题（必填，≤120 字）"
          maxlength="120"
          show-word-limit
          size="large"
          class="!mb-3"
        />
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <el-input v-model="form.tags" placeholder="标签，逗号分隔（如：JSON, 教程, 效率工具）" clearable />
          <el-input v-model="form.summary" placeholder="摘要（选填，列表页与 SEO 展示）" maxlength="300" clearable />
          <!-- 封面图 URL 暂时隐藏（form.cover 与提交字段保留：编辑老文章不丢封面，后端能力不动） -->
          <el-input
            v-if="isAdmin && !editingId"
            v-model="form.slug"
            placeholder="自定义链接（选填，小写字母/数字/连字符，如 json-tips）"
            clearable
          />
          <el-select
            v-if="isAdmin"
            v-model="relatedTools"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="相关工具推荐（引流位，选填，最多 10 个）"
            class="md:col-span-2"
            :loading="!toolOptions.length"
          >
            <el-option
              v-for="tool in toolOptions"
              :key="tool.url"
              :label="`${tool.title}（${tool.url}）`"
              :value="tool.url.endsWith('/') ? tool.url.slice(0, -1) : tool.url"
            />
          </el-select>
        </div>
        <!-- 封面预览随输入框一起暂时隐藏 -->
      </div>

      <!-- 正文编辑 + 预览 -->
      <div class="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div
          class="rounded-xl border border-border-subtle bg-white dark:bg-surface-1 overflow-hidden"
          :class="mobileView === 'edit' ? '' : 'hidden lg:block'"
        >
          <div class="px-4 py-2 border-b border-border-subtle text-xs text-ink-400 flex items-center justify-between">
            <span>Markdown 正文</span>
            <span>{{ contentLen }} 字符</span>
          </div>
          <textarea
            v-model="form.content"
            placeholder="# 标题&#10;&#10;正文支持 Markdown 语法：**加粗**、[链接](https://…)、`代码`、代码块、图片、表格…"
            class="blog-editor-textarea"
            spellcheck="false"
          ></textarea>
        </div>
        <div
          class="rounded-xl border border-border-subtle bg-white dark:bg-surface-1 overflow-hidden"
          :class="mobileView === 'preview' ? '' : 'hidden lg:block'"
        >
          <div class="px-4 py-2 border-b border-border-subtle text-xs text-ink-400">预览</div>
          <div class="blog-editor-preview">
            <div v-if="form.content" class="blog-markdown" v-html="previewHtml"></div>
            <div v-else class="h-full flex items-center justify-center text-sm text-ink-300">
              开始输入后这里会实时预览
            </div>
          </div>
        </div>
      </div>

      <!-- 操作区 -->
      <div class="mt-5 mb-2 flex items-center justify-end gap-3 flex-wrap">
        <template v-if="isAdmin">
          <el-button
            v-if="editingStatus !== 'published'"
            :disabled="!canSubmit"
            :loading="submitting"
            @click="saveAsAdmin(secondaryTarget)"
          >
            {{ secondaryLabel }}
          </el-button>
          <el-button
            type="primary"
            :disabled="!canSubmit"
            :loading="submitting"
            @click="saveAsAdmin(editingStatus === 'published' ? 'keep' : 'published')"
          >
            {{ primaryLabel }}
          </el-button>
        </template>
        <template v-else>
          <el-button
            type="primary"
            :disabled="!canSubmit"
            :loading="submitting"
            @click="submitContribution"
          >
            提交投稿
          </el-button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.blog-editor-textarea {
  display: block;
  width: 100%;
  min-height: 480px;
  padding: 16px;
  border: 0;
  outline: none;
  resize: vertical;
  background: transparent;
  color: rgb(var(--ink-800));
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 14px;
  line-height: 1.75;
  tab-size: 2;
}
.blog-editor-preview {
  min-height: 480px;
  max-height: 720px;
  overflow-y: auto;
  padding: 16px;
}

/* 与 BlogDetail 共用的正文排版精简版（预览用） */
.blog-markdown {
  color: rgb(var(--ink-800));
  font-size: 15px;
  line-height: 1.85;
  word-break: break-word;
}
.blog-markdown :deep(h1),
.blog-markdown :deep(h2),
.blog-markdown :deep(h3),
.blog-markdown :deep(h4) {
  color: rgb(var(--ink-900));
  font-weight: 700;
  margin: 1.4em 0 0.6em;
}
html.dark .blog-markdown :deep(h1),
html.dark .blog-markdown :deep(h2),
html.dark .blog-markdown :deep(h3),
html.dark .blog-markdown :deep(h4) {
  color: rgb(var(--ink-100));
}
.blog-markdown :deep(h1) { font-size: 1.5em; }
.blog-markdown :deep(h2) { font-size: 1.3em; }
.blog-markdown :deep(h3) { font-size: 1.15em; }
.blog-markdown :deep(p) { margin: 0.9em 0; }
.blog-markdown :deep(a) { color: rgb(var(--accent-600)); }
html.dark .blog-markdown :deep(a) { color: rgb(var(--accent-300)); }
.blog-markdown :deep(ul),
.blog-markdown :deep(ol) { padding-left: 1.5em; }
.blog-markdown :deep(ul) { list-style: disc; }
.blog-markdown :deep(ol) { list-style: decimal; }
.blog-markdown :deep(blockquote) {
  margin: 1em 0;
  padding: 0.5em 1em;
  border-left: 3px solid rgb(var(--accent-400));
  background: rgb(var(--accent-50));
  border-radius: 0 8px 8px 0;
}
html.dark .blog-markdown :deep(blockquote) { background: rgb(var(--accent-500) / 0.1); }
.blog-markdown :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.88em;
  background: rgb(var(--surface-2));
  border-radius: 5px;
  padding: 0.15em 0.4em;
}
.blog-markdown :deep(pre) {
  margin: 1em 0;
  padding: 1em;
  background: rgb(var(--surface-2));
  border-radius: 10px;
  overflow-x: auto;
}
.blog-markdown :deep(pre code) { background: transparent; padding: 0; }
.blog-markdown :deep(img) { max-width: 100%; border-radius: 10px; }
.blog-markdown :deep(table) {
  border-collapse: collapse;
  margin: 1em 0;
  display: block;
  overflow-x: auto;
}
.blog-markdown :deep(th),
.blog-markdown :deep(td) {
  border: 1px solid rgb(var(--border-subtle));
  padding: 0.4em 0.8em;
}
</style>
