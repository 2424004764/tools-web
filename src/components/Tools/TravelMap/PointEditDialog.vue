<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { POINT_CATEGORIES } from './constants'
import type { MapPoint, PointCategory, TravelMapDay } from './types'

const props = defineProps<{
  modelValue: boolean
  /** 编辑已有点位时传入；新建时为 null */
  point: MapPoint | null
  /** 新建点位的坐标 */
  lng: number
  lat: number
  days: TravelMapDay[]
  activeDayId: string
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'submit', payload: Omit<MapPoint, 'id'> & { id?: string }): void
  (e: 'delete', id: string): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const form = ref({
  name: '',
  category: 'camp' as PointCategory,
  elevation: '' as string,
  note: '',
  dayId: '',
  stayMinutes: '0' as string,
})

const isEdit = computed(() => Boolean(props.point))

// 打开时把 props 灌进本地表单，关闭不清空（避免关闭动画期间闪烁）
watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    if (props.point) {
      form.value = {
        name: props.point.name,
        category: props.point.category,
        elevation: props.point.elevation === null ? '' : String(props.point.elevation),
        note: props.point.note,
        dayId: props.point.dayId || '',
        stayMinutes: String(props.point.stayMinutes || 0),
      }
    } else {
      form.value = { name: '', category: 'camp', elevation: '', note: '', dayId: props.activeDayId, stayMinutes: '0' }
    }
  }
)

const coord = computed(() => {
  const lng = props.point ? props.point.lng : props.lng
  const lat = props.point ? props.point.lat : props.lat
  return `${lng.toFixed(6)}, ${lat.toFixed(6)}`
})

const handleSubmit = () => {
  const name = form.value.name.trim()
  if (!name) {
    ElMessage.warning('请填写点位名称')
    return
  }

  let elevation: number | null = null
  const raw = form.value.elevation.trim()
  if (raw) {
    const n = Number(raw)
    if (!Number.isFinite(n)) {
      ElMessage.warning('海拔请填写数字（单位：米）')
      return
    }
    elevation = n
  }

  const stayMinutes = Math.max(0, Math.min(1440, Math.round(Number(form.value.stayMinutes) || 0)))
  emit('submit', {
    id: props.point?.id,
    name,
    category: form.value.category,
    elevation,
    note: form.value.note.trim(),
    dayId: form.value.dayId,
    stayMinutes,
    lng: props.point ? props.point.lng : props.lng,
    lat: props.point ? props.point.lat : props.lat,
  })
  visible.value = false
}

const handleDelete = () => {
  if (!props.point) return
  emit('delete', props.point.id)
  visible.value = false
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="isEdit ? '编辑点位' : '新增点位'"
    width="440px"
    append-to-body
    :lock-scroll="false"
  >
    <div class="space-y-4">
      <div>
        <label class="block text-body-sm font-medium text-gray-700 mb-1.5">名称</label>
        <el-input
          v-model="form.name"
          maxlength="60"
          show-word-limit
          placeholder="例如：老虎嘴营地"
          @keyup.enter="handleSubmit"
        />
      </div>

      <div>
        <label class="block text-body-sm font-medium text-gray-700 mb-1.5">分类</label>
        <el-select v-model="form.category" class="w-full">
          <el-option
            v-for="c in POINT_CATEGORIES"
            :key="c.value"
            :value="c.value"
            :label="`${c.emoji} ${c.label}`"
          />
        </el-select>
      </div>

      <div>
        <label class="block text-body-sm font-medium text-gray-700 mb-1.5">所属日程</label>
        <el-select v-model="form.dayId" class="w-full">
          <el-option v-for="day in days" :key="day.id" :value="day.id" :label="day.title" />
        </el-select>
      </div>

      <div>
        <label class="block text-body-sm font-medium text-gray-700 mb-1.5">
          海拔（米） <span class="font-normal text-ink-500">选填</span>
        </label>
        <el-input v-model="form.elevation" placeholder="例如：1580" />
        <p class="mt-1 text-xs text-ink-500">
          天地图未提供经纬度查海拔的接口，这里请手动填写（可参考户外 App 或等高线）。
        </p>
      </div>

      <div>
        <label class="block text-body-sm font-medium text-gray-700 mb-1.5">停留时间（分钟）</label>
        <el-input v-model="form.stayMinutes" type="number" min="0" max="1440" placeholder="例如：90" />
      </div>

      <div>
        <label class="block text-body-sm font-medium text-gray-700 mb-1.5">
          备注 <span class="font-normal text-ink-500">选填</span>
        </label>
        <el-input
          v-model="form.note"
          type="textarea"
          :rows="3"
          maxlength="500"
          show-word-limit
          placeholder="补给情况、水源是否可用、扎营空间大小…"
        />
      </div>

      <div class="text-xs text-ink-500">坐标：{{ coord }}</div>
    </div>

    <template #footer>
      <div class="flex items-center justify-between">
        <el-button v-if="isEdit" type="danger" plain @click="handleDelete">删除点位</el-button>
        <span v-else></span>
        <div class="flex gap-2">
          <el-button @click="visible = false">取消</el-button>
          <el-button type="primary" @click="handleSubmit">确定</el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>
