<script setup lang="ts">
import { computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { Plus, Delete } from '@element-plus/icons-vue'

defineOptions({ name: 'FieldEditor' })

interface Field {
  id?: string
  name: string
  type: string
  required?: boolean
  min?: number | null
  max?: number | null
  prefix?: string
  options?: string[]
  children?: Field[]
  itemType?: string
  itemChildren?: Field[]
}

const FIELD_TYPES = [
  { value: 'string', label: '字符串' },
  { value: 'integer', label: '整数' },
  { value: 'float', label: '小数' },
  { value: 'boolean', label: '布尔' },
  { value: 'email', label: '邮箱' },
  { value: 'name', label: '中文姓名' },
  { value: 'phone', label: '手机号' },
  { value: 'url', label: '网址' },
  { value: 'date', label: '日期' },
  { value: 'datetime', label: '日期时间' },
  { value: 'color', label: '颜色(hex)' },
  { value: 'avatar', label: '头像URL' },
  { value: 'address', label: '地址' },
  { value: 'company', label: '公司名' },
  { value: 'lorem', label: '随机文本' },
  { value: 'id', label: 'UUID' },
  { value: 'object', label: '对象(嵌套)' },
  { value: 'array', label: '数组' }
]

const ARRAY_ITEM_TYPES = [
  { value: 'string', label: '字符串' },
  { value: 'integer', label: '整数' },
  { value: 'float', label: '小数' },
  { value: 'boolean', label: '布尔' },
  { value: 'email', label: '邮箱' },
  { value: 'name', label: '中文姓名' },
  { value: 'phone', label: '手机号' },
  { value: 'url', label: '网址' },
  { value: 'date', label: '日期' },
  { value: 'datetime', label: '日期时间' },
  { value: 'color', label: '颜色(hex)' },
  { value: 'avatar', label: '头像URL' },
  { value: 'address', label: '地址' },
  { value: 'company', label: '公司名' },
  { value: 'lorem', label: '随机文本' },
  { value: 'id', label: 'UUID' },
  { value: 'object', label: '对象' }
]

const props = withDefaults(defineProps<{
  modelValue: Field
  depth?: number
  isRoot?: boolean
}>(), { depth: 0, isRoot: false })

const emit = defineEmits<{
  'update:modelValue': [Field]
  remove: []
}>()

const isObject = computed(() => props.modelValue.type === 'object')
const isArray = computed(() => props.modelValue.type === 'array')
const isArrayOfObject = computed(() => isArray.value && props.modelValue.itemType === 'object')
const isNumeric = computed(() => ['integer', 'float'].includes(props.modelValue.type))

function update(patch: Partial<Field>) {
  emit('update:modelValue', { ...props.modelValue, ...patch })
}

function blankField(name: string): Field {
  return { id: uuidv4(), name, type: 'string' }
}

// object children
function addChild() {
  const children = [...(props.modelValue.children || []), blankField('child' + (((props.modelValue.children || []).length) + 1))]
  update({ children })
}
function updateChild(idx: number, child: Field) {
  const children = [...(props.modelValue.children || [])]
  children[idx] = child
  update({ children })
}
function removeChild(idx: number) {
  const children = [...(props.modelValue.children || [])]
  children.splice(idx, 1)
  update({ children })
}

// array item children
function addItemChild() {
  const itemChildren = [...(props.modelValue.itemChildren || []), blankField('item' + (((props.modelValue.itemChildren || []).length) + 1))]
  update({ itemChildren })
}
function updateItemChild(idx: number, child: Field) {
  const itemChildren = [...(props.modelValue.itemChildren || [])]
  itemChildren[idx] = child
  update({ itemChildren })
}
function removeItemChild(idx: number) {
  const itemChildren = [...(props.modelValue.itemChildren || [])]
  itemChildren.splice(idx, 1)
  update({ itemChildren })
}
</script>

<template>
  <div class="field-editor" :class="{ 'is-root': isRoot, 'is-nested': depth > 0 }">
    <!-- 主行：name + type + 必填 + 操作 -->
    <div class="fe-row">
      <el-input
        :model-value="modelValue.name"
        @update:model-value="(v: string) => update({ name: v })"
        :placeholder="isRoot ? '根对象字段（自动）' : '字段名（如 city）'"
        size="small"
        :disabled="isRoot"
        class="!flex-1 fe-name"
      />
      <el-select
        :model-value="modelValue.type"
        @update:model-value="(v: string) => update({ type: v })"
        size="small"
        class="fe-type"
      >
        <el-option v-for="t in FIELD_TYPES" :key="t.value" :label="t.label" :value="t.value" />
      </el-select>
      <el-checkbox
        :model-value="!!modelValue.required"
        @update:model-value="(v: any) => update({ required: v })"
        size="small"
      >必填</el-checkbox>
      <el-button
        v-if="isObject"
        size="small"
        type="primary"
        plain
        :icon="Plus"
        @click="addChild"
      >子字段</el-button>
      <el-button
        v-if="isArrayOfObject"
        size="small"
        type="primary"
        plain
        :icon="Plus"
        @click="addItemChild"
      >子字段</el-button>
      <el-button
        v-if="!isRoot"
        size="small"
        type="danger"
        plain
        :icon="Delete"
        @click="emit('remove')"
      />
    </div>

    <!-- 类型专属配置 -->
    <div v-if="isNumeric" class="fe-config">
      <span class="fe-config-label">取值范围：</span>
      <el-input-number
        :model-value="modelValue.min ?? 0"
        @update:model-value="(v: any) => update({ min: v })"
        :min="-1e9" :max="1e9"
        size="small"
        placeholder="最小"
      />
      <span class="fe-config-sep">~</span>
      <el-input-number
        :model-value="modelValue.max ?? 100"
        @update:model-value="(v: any) => update({ max: v })"
        :min="-1e9" :max="1e9"
        size="small"
        placeholder="最大"
      />
    </div>
    <div v-else-if="modelValue.type === 'string'" class="fe-config">
      <el-input
        :model-value="modelValue.prefix"
        @update:model-value="(v: string) => update({ prefix: v })"
        size="small"
        placeholder="字符串前缀（可选）"
        class="!w-40"
      />
      <el-input
        :model-value="(modelValue.options || []).join(',')"
        @update:model-value="(v: string) => update({ options: v ? v.split(/[,，\s]+/).filter(Boolean) : [] })"
        size="small"
        placeholder="枚举值：男,女（可选）"
        class="!flex-1"
      />
    </div>
    <div v-else-if="isArray" class="fe-config">
      <span class="fe-config-label">数组长度：</span>
      <el-input-number
        :model-value="modelValue.min ?? 1"
        @update:model-value="(v: any) => update({ min: v })"
        :min="0" :max="100"
        size="small"
        placeholder="最少"
      />
      <span class="fe-config-sep">~</span>
      <el-input-number
        :model-value="modelValue.max ?? 3"
        @update:model-value="(v: any) => update({ max: v })"
        :min="0" :max="100"
        size="small"
        placeholder="最多"
      />
      <span class="fe-config-label ml-2">元素类型：</span>
      <el-select
        :model-value="modelValue.itemType || 'string'"
        @update:model-value="(v: string) => update({ itemType: v })"
        size="small"
        class="!w-32"
      >
        <el-option v-for="t in ARRAY_ITEM_TYPES" :key="t.value" :label="t.label" :value="t.value" />
      </el-select>
    </div>

    <!-- object 的子字段 -->
    <div v-if="isObject" class="fe-children">
      <FieldEditor
        v-for="(child, idx) in (modelValue.children || [])"
        :key="child.id || idx"
        :model-value="child"
        :depth="depth + 1"
        @update:model-value="(v: Field) => updateChild(idx, v)"
        @remove="removeChild(idx)"
      />
    </div>

    <!-- array of object 的子字段 -->
    <div v-else-if="isArrayOfObject" class="fe-children">
      <div class="fe-children-hint">↓ 数组元素的字段（每项都按此结构生成）：</div>
      <FieldEditor
        v-for="(child, idx) in (modelValue.itemChildren || [])"
        :key="child.id || idx"
        :model-value="child"
        :depth="depth + 1"
        @update:model-value="(v: Field) => updateItemChild(idx, v)"
        @remove="removeItemChild(idx)"
      />
    </div>
  </div>
</template>

<style scoped>
.field-editor {
  background: #fafbfc;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 8px 10px;
  transition: border-color 0.15s;
}
.field-editor.is-root {
  background: transparent;
  border: none;
  padding: 0;
}
.field-editor.is-nested {
  background: #fff;
  border-color: #e5e7eb;
}
.field-editor:hover {
  border-color: #93c5fd;
}
.fe-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.fe-name {
  min-width: 140px;
}
.fe-type {
  width: 130px;
}
.fe-config {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  flex-wrap: wrap;
}
.fe-config-label {
  font-size: 12px;
  color: #6b7280;
}
.fe-config-sep {
  color: #9ca3af;
  font-size: 12px;
}
.fe-children {
  margin-top: 8px;
  margin-left: 16px;
  padding-left: 12px;
  border-left: 2px dashed #e5e7eb;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.fe-children-hint {
  font-size: 11px;
  color: #9ca3af;
  margin-bottom: 2px;
}
</style>
