<script setup lang="ts">
import { reactive, ref, onMounted, computed } from 'vue'
import axios from 'axios'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'

interface Note {
  id: string
  title: string
  content: string
  createTime: string
  updateTime: string
}

const info = reactive({
  title: "笔记备忘录",
})

const notes = ref<Note[]>([])
const currentNote = ref<Note | null>(null)
const isEditing = ref(false)
const showForm = ref(false)

const formData = reactive({
  title: '',
  content: ''
})

const proxyUrl = ref(import.meta.env.VITE_SITE_URL)
// const proxyUrl = ref('http://127.0.0.1:8788')

// 获取笔记列表
const fetchNotes = async () => {
  try {
    const response = await axios.get(`${proxyUrl.value}/api/notes`)
    if (response.status === 200) {
      const data = response.data
      notes.value = data.notes || []
    }
  } catch (error) {
    console.error('获取笔记失败:', error)
    ElMessage.error('获取笔记失败')
  }
}

// 创建笔记
const createNote = async () => {
  if (!formData.title.trim() || !formData.content.trim()) {
    ElMessage.warning('标题和内容不能为空')
    return
  }

  try {
    const response = await axios.post(`${proxyUrl.value}/api/notes`, {
      title: formData.title.trim(),
      content: formData.content.trim()
    })

    if (response.status === 201) {
      ElMessage.success('创建成功')
      showForm.value = false
      resetForm()
      await fetchNotes()
    } else {
      ElMessage.error('创建失败')
    }
  } catch (error) {
    console.error('创建笔记失败:', error)
    ElMessage.error('创建笔记失败')
  }
}

// 更新笔记
const updateNote = async () => {
  if (!currentNote.value || !formData.title.trim() || !formData.content.trim()) {
    ElMessage.warning('标题和内容不能为空')
    return
  }

  try {
    const response = await axios.put(`${proxyUrl.value}/api/notes/${currentNote.value.id}`, {
      title: formData.title.trim(),
      content: formData.content.trim()
    })

    if (response.status === 200) {
      ElMessage.success('更新成功')
      showForm.value = false
      isEditing.value = false
      currentNote.value = null
      resetForm()
      await fetchNotes()
    } else {
      ElMessage.error('更新失败')
    }
  } catch (error) {
    console.error('更新笔记失败:', error)
    ElMessage.error('更新笔记失败')
  }
}

// 删除笔记
const deleteNote = async (note: Note) => {
  try {
    await ElMessageBox.confirm('确定要删除这条笔记吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })

    const response = await axios.delete(`${proxyUrl.value}/api/notes/${note.id}`)

    if (response.status === 200) {
      ElMessage.success('删除成功')
      if (currentNote.value?.id === note.id) {
        currentNote.value = null
      }
      await fetchNotes()
    } else {
      ElMessage.error('删除失败')
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除笔记失败:', error)
      ElMessage.error('删除笔记失败')
    }
  }
}

// 编辑笔记
const editNote = (note: Note) => {
  currentNote.value = note
  formData.title = note.title
  formData.content = note.content
  isEditing.value = true
  showForm.value = true
}

// 查看笔记
const viewNote = (note: Note) => {
  currentNote.value = note
  showForm.value = false
}

// 新建笔记
const newNote = () => {
  currentNote.value = null
  isEditing.value = false
  resetForm()
  showForm.value = true
}

// 重置表单
const resetForm = () => {
  formData.title = ''
  formData.content = ''
}

// 格式化时间
const formatTime = (timeStr: string) => {
  return new Date(timeStr).toLocaleString('zh-CN')
}

// 添加计算属性
const showNoteDetail = computed(() => currentNote.value !== null && !showForm.value && !isEditing.value)

onMounted(() => {
  fetchNotes()
})
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white">
      <!-- 操作按钮 -->
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-semibold text-gray-800">我的笔记</h3>
        <el-button type="primary" @click="newNote" :icon="Plus">
          新建笔记
        </el-button>
      </div>

      <!-- 笔记列表 -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div
          v-for="note in notes"
          :key="note.id"
          class="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
          :class="{ 'border-blue-500 bg-blue-50': currentNote?.id === note.id }"
          @click="viewNote(note)"
        >
          <div class="flex justify-between items-start mb-2">
            <h4 class="font-medium text-gray-800 truncate flex-1">{{ note.title }}</h4>
            <div class="flex space-x-2 ml-2">
              <el-button size="small" type="primary" @click.stop="editNote(note)">
                编辑
              </el-button>
              <el-button size="small" type="danger" @click.stop="deleteNote(note)">
                删除
              </el-button>
            </div>
          </div>
          <p class="text-gray-600 text-sm line-clamp-3 mb-2">{{ note.content }}</p>
          <div class="text-xs text-gray-400">
            <div>创建: {{ formatTime(note.createTime) }}</div>
            <div>更新: {{ formatTime(note.updateTime) }}</div>
          </div>
        </div>
      </div>

      <!-- 笔记表单 -->
      <el-dialog
        v-model="showForm"
        :title="isEditing ? '编辑笔记' : '新建笔记'"
        width="80%"
        :close-on-click-modal="false"
        @close="isEditing = false"
      >
        <el-form :model="formData" label-width="80px">
          <el-form-item label="标题" required>
            <el-input v-model="formData.title" placeholder="请输入笔记标题" />
          </el-form-item>
          <el-form-item label="内容" required>
            <el-input
              v-model="formData.content"
              type="textarea"
              :rows="8"
              placeholder="请输入笔记内容"
            />
          </el-form-item>
        </el-form>
        <template #footer>
          <span class="dialog-footer">
            <el-button @click="showForm = false; isEditing = false">取消</el-button>
            <el-button type="primary" @click="isEditing ? updateNote() : createNote()">
              {{ isEditing ? '更新' : '创建' }}
            </el-button>
          </span>
        </template>
      </el-dialog>

      <!-- 笔记详情 -->
      <el-dialog
        v-model="showNoteDetail"
        title="笔记详情"
        width="80%"
        :close-on-click-modal="false"
      >
        <div v-if="currentNote" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">标题</label>
            <div class="p-3 bg-gray-50 rounded border">{{ currentNote.title }}</div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">内容</label>
            <div class="p-3 bg-gray-50 rounded border whitespace-pre-wrap">{{ currentNote.content }}</div>
          </div>
          <div class="grid grid-cols-2 gap-4 text-sm text-gray-500">
            <div>创建时间: {{ formatTime(currentNote.createTime) }}</div>
            <div>更新时间: {{ formatTime(currentNote.updateTime) }}</div>
          </div>
        </div>
        <template #footer>
          <span class="dialog-footer">
            <el-button @click="currentNote = null">关闭</el-button>
            <el-button type="primary" @click="editNote(currentNote!)">编辑</el-button>
          </span>
        </template>
      </el-dialog>
    </div>

    <!-- desc -->
    <ToolDetail title="描述">
      <el-text>
        在线笔记记录工具，支持创建、编辑、删除笔记，数据安全存储在云端。您可以随时记录想法、待办事项、学习笔记等，支持富文本编辑，数据实时同步。
      </el-text> 
    </ToolDetail>
  </div>
</template>

<style scoped>
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.whitespace-pre-wrap {
  white-space: pre-wrap;
}
</style>
