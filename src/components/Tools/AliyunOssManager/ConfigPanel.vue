<script setup lang="ts">
import { reactive, ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import Connection from '~icons/ep/connection'
import QuestionFilled from '~icons/ep/questionFilled'
import ArrowDown from '~icons/ep/arrowDown'
import CircleCheck from '~icons/ep/circleCheck'
import CircleClose from '~icons/ep/circleClose'
import { ossApi, ossStsProvider, type OssConfig, type OssConfigInput } from '@/api/oss'

const props = defineProps<{
  visible: boolean
  editingId: string | null
  configs: OssConfig[]
}>()

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'saved'): void
}>()

const form = reactive<OssConfigInput>({
  name: '',
  region: '',
  bucket: '',
  endpoint: '',
  accessKeyId: '',
  accessKeySecret: '',
  roleArn: '',
  policy: '',
  durationSeconds: 3600,
  isDefault: false
})

const loading = ref(false)
const submitting = ref(false)
const showSecret = ref(false)
const showAdvanced = ref(false)  // 高级选项（duration/policy）
const testing = ref(false)        // 测试连接中
const testResult = ref<{ ok: boolean; msg: string } | null>(null)

const REGION_PRESETS = [
  'oss-cn-hangzhou', 'oss-cn-shanghai', 'oss-cn-beijing', 'oss-cn-shenzhen',
  'oss-cn-guangzhou', 'oss-cn-chengdu', 'oss-cn-hongkong', 'oss-us-west-1',
  'oss-us-east-1', 'oss-ap-southeast-1', 'oss-ap-southeast-5',
  'oss-ap-northeast-1', 'oss-eu-central-1', 'oss-eu-west-1'
]

const isEdit = computed(() => !!props.editingId)
const dialogTitle = computed(() => isEdit.value ? '编辑 OSS 配置' : '新建 OSS 配置')

const resetForm = () => {
  form.name = ''
  form.region = ''
  form.bucket = ''
  form.endpoint = ''
  form.accessKeyId = ''
  form.accessKeySecret = ''
  form.roleArn = ''
  form.policy = ''
  form.durationSeconds = 3600
  form.isDefault = false
  accessMode.value = 'sts'
  showSecret.value = false
  showAdvanced.value = false
  testResult.value = null
}

const loadEditing = async () => {
  if (!props.editingId) return
  loading.value = true
  try {
    const res: any = await ossApi.get(props.editingId)
    if (res.status === 200 && res.data?.success) {
      const c = res.data.data
      form.name = c.name
      form.region = c.region
      form.bucket = c.bucket
      form.endpoint = c.endpoint || ''
      form.roleArn = c.roleArn || ''
      form.policy = ''  // 不返回 policy 明文
      form.durationSeconds = c.durationSeconds || 3600
      form.isDefault = c.isDefault === 1
      form.accessKeyId = ''
      form.accessKeySecret = ''
      accessMode.value = c.roleArn ? 'sts' : 'direct'
      // 已有配置时默认展开高级选项，便于修改
      showAdvanced.value = !!c.policy
    } else {
      ElMessage.error(res.data?.error || '加载配置失败')
    }
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.error || '加载配置失败')
  } finally {
    loading.value = false
  }
}

watch(() => props.visible, (v) => {
  if (v) {
    resetForm()
    if (props.editingId) {
      loadEditing()
    }
  }
})

const handleClose = () => emit('update:visible', false)

// 访问模式：'sts' = 通过 RAM 角色拿临时凭证（推荐），'direct' = 直接用 AK/SK
const accessMode = ref<'sts' | 'direct'>('sts')

const validateRequired = (): string | null => {
  if (!form.name.trim()) return '请输入配置名称'
  if (!form.region.trim()) return '请输入 Region'
  if (!form.bucket.trim()) return '请输入 Bucket 名称'
  if (!isEdit.value || form.accessKeyId.trim() || form.accessKeySecret.trim()) {
    if (!form.accessKeyId.trim()) return '请输入 AccessKey ID'
    if (!form.accessKeySecret.trim()) return '请输入 AccessKey Secret'
  }
  // 仅在 STS 模式下校验 RAM 角色 ARN
  if (accessMode.value === 'sts') {
    if (!form.roleArn || !form.roleArn.trim()) return '请输入 RAM 角色 ARN（或切换到「直接 AccessKey」模式）'
    if (!/^acs:ram::\d+:role\//.test(form.roleArn.trim())) {
      return 'RAM 角色 ARN 格式不正确，应类似 acs:ram::123456789012:role/myrole'
    }
  }
  return null
}

const validateAdvanced = (): string | null => {
  const d = Number(form.durationSeconds)
  if (!Number.isFinite(d) || d < 900 || d > 3600) {
    return '凭证有效期需在 900 ~ 3600 秒之间'
  }
  if (form.policy && form.policy.trim()) {
    try {
      JSON.parse(form.policy)
    } catch {
      return '权限范围（Policy）必须是合法的 JSON 字符串'
    }
  }
  return null
}

/**
 * 测试当前表单能否成功签发 STS 临时凭证
 * - 先在前端校验必填字段
 * - 不实际保存配置，而是直接调用 STS 接口（如果配置已保存则会更新它）
 */
const handleTestConnection = async () => {
  const err = validateRequired()
  if (err) {
    ElMessage.warning(err)
    testResult.value = { ok: false, msg: err }
    return
  }
  testing.value = true
  testResult.value = null
  try {
    // 必须先保存配置才能调用 STS（后端需要从 D1 读取 AK/SK 解密）
    let savedId: string | null = props.editingId
    const payload: any = {
      name: form.name.trim(),
      region: form.region.trim(),
      bucket: form.bucket.trim(),
      endpoint: (form.endpoint || '').trim(),
      roleArn: accessMode.value === 'sts' ? (form.roleArn || '').trim() : '',
      policy: accessMode.value === 'sts' ? (form.policy || '').trim() : '',
      durationSeconds: Number(form.durationSeconds),
      isDefault: !!form.isDefault
    }
    if (!isEdit.value || form.accessKeyId.trim()) {
      payload.accessKeyId = form.accessKeyId.trim()
      payload.accessKeySecret = form.accessKeySecret.trim()
    }

    let saveRes: any
    if (isEdit.value) {
      saveRes = await ossApi.update(props.editingId!, payload)
    } else {
      saveRes = await ossApi.create(payload)
    }

    if (!saveRes.data?.success) {
      testResult.value = { ok: false, msg: saveRes.data?.error || '保存失败' }
      return
    }
    savedId = saveRes.data?.data?.id || props.editingId

    // 清掉该 id 的旧 STS 缓存，强制重新签发
    if (savedId) ossStsProvider.invalidate(savedId)

    // 签发 STS
    if (!savedId) {
      testResult.value = { ok: false, msg: '未拿到配置 ID，无法测试' }
      return
    }
    const stsRes: any = await ossApi.sts(savedId)
    if (stsRes.data?.success) {
      const exp = stsRes.data.data.expiration
      const expText = exp ? new Date(exp).toLocaleString('zh-CN') : ''
      const modeText = stsRes.data.mode === 'direct'
        ? '（直接 AccessKey 模式）'
        : `临时凭证有效期至 ${expText}`
      testResult.value = {
        ok: true,
        msg: `连接成功！${modeText}`
      }
      // 创建成功后通知父组件刷新列表
      if (!isEdit.value) emit('saved')
    } else {
      testResult.value = { ok: false, msg: stsRes.data?.error || '签发失败' }
    }
  } catch (e: any) {
    testResult.value = {
      ok: false,
      msg: e?.response?.data?.error || e?.message || '测试失败'
    }
  } finally {
    testing.value = false
  }
}

const handleSubmit = async () => {
  const err1 = validateRequired()
  if (err1) {
    ElMessage.warning(err1)
    return
  }
  const err2 = validateAdvanced()
  if (err2) {
    ElMessage.warning(err2)
    return
  }

  // 直接保存
  submitting.value = true
  try {
    const payload: any = {
      name: form.name.trim(),
      region: form.region.trim(),
      bucket: form.bucket.trim(),
      endpoint: (form.endpoint || '').trim(),
      roleArn: accessMode.value === 'sts' ? (form.roleArn || '').trim() : '',
      policy: accessMode.value === 'sts' ? (form.policy || '').trim() : '',
      durationSeconds: Number(form.durationSeconds),
      isDefault: !!form.isDefault
    }
    if (!isEdit.value || form.accessKeyId.trim()) {
      payload.accessKeyId = form.accessKeyId.trim()
      payload.accessKeySecret = form.accessKeySecret.trim()
    }

    let res: any
    if (isEdit.value) {
      res = await ossApi.update(props.editingId!, payload)
    } else {
      res = await ossApi.create(payload)
    }

    if (res.data?.success) {
      ElMessage.success(isEdit.value ? '更新成功' : '创建成功')
      emit('saved')
    } else {
      ElMessage.error(res.data?.error || (isEdit.value ? '更新失败' : '创建失败'))
    }
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.error || '请求失败')
  } finally {
    submitting.value = false
  }
}

const openRamConsole = () => {
  window.open('https://ram.console.aliyun.com/roles', '_blank')
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    :title="dialogTitle"
    width="680px"
    class="oss-config-dialog"
    @close="handleClose"
    destroy-on-close
  >
    <div v-loading="loading" class="form-wrap">
      <!-- 顶部引导卡片 -->
      <div class="guide-card">
        <div class="guide-icon">
          <el-icon :size="20"><Connection /></el-icon>
        </div>
        <div class="guide-content">
          <div class="guide-title">如何安全地让工具访问你的 OSS？</div>
          <div class="guide-desc">
            工具提供两种<strong>访问模式</strong>（下方可切换）：
            <ol>
              <li><strong>临时凭证（推荐）</strong>：在 RAM 控制台创建一个 RAM 角色并授予 OSS 权限，工具用你的 AK/SK 扮演该角色拿到<strong>临时凭证</strong>，默认 1 小时内自动失效，到期前工具会<strong>自动重新签发</strong>。</li>
              <li><strong>直接 AccessKey</strong>：直接用你的 AK/SK 访问 OSS（要求 AK 本身具有 OSS 权限）。配置简单，无需创建 RAM 角色，但凭证长期有效。</li>
            </ol>
            两种模式都会把 AK/SK 加密保存在 Cloudflare D1 数据库中。
          </div>
          <el-button link type="primary" @click="openRamConsole">
            前往 RAM 控制台创建角色 →
          </el-button>
        </div>
      </div>

      <el-form :model="form" label-position="top" class="config-form">
        <!-- 基础信息 -->
        <div class="form-section">
          <div class="section-title">基础信息</div>
          <el-form-item label="配置名称（仅用于区分多个 Bucket）">
            <el-input v-model="form.name" placeholder="例如：生产图片Bucket" maxlength="50" />
          </el-form-item>
        </div>

        <!-- Bucket 信息 -->
        <div class="form-section">
          <div class="section-title">Bucket 信息</div>
          <el-form-item label="Region（地域）">
            <el-select
              v-model="form.region"
              filterable
              allow-create
              default-first-option
              placeholder="选择或输入 Region"
              class="region-select"
            >
              <el-option v-for="r in REGION_PRESETS" :key="r" :value="r" :label="r" />
            </el-select>
          </el-form-item>
          <el-form-item label="Bucket 名称">
            <el-input v-model="form.bucket" placeholder="例如：my-prod-images" />
          </el-form-item>
          <el-form-item label="自定义 Endpoint（可选）">
            <el-input v-model="form.endpoint" placeholder="留空将使用默认公网 Endpoint" />
            <div class="form-hint">一般留空即可，例如 oss-cn-hangzhou.aliyuncs.com</div>
          </el-form-item>
        </div>

        <!-- 授权信息（合并 AK + RoleArn，对用户屏蔽 STS 概念） -->
        <div class="form-section">
          <div class="section-title">授权信息</div>
          <el-form-item>
            <template #label>
              <span>
                AccessKey ID
                <el-tooltip
                  content="在阿里云「访问控制」→「用户」→「创建AccessKey」生成。需要拥有 sts:AssumeRole 权限。"
                  placement="top"
                >
                  <el-icon class="hint-icon"><QuestionFilled /></el-icon>
                </el-tooltip>
              </span>
            </template>
            <el-input
              v-model="form.accessKeyId"
              :placeholder="isEdit ? '留空表示不修改' : '阿里云 AccessKey ID'"
              autocomplete="off"
            />
          </el-form-item>
          <el-form-item>
            <template #label>
              <span>
                AccessKey Secret
                <el-tooltip
                  content="加密保存在 Cloudflare D1 数据库中，前端只在签发 STS 临时凭证时短暂使用。"
                  placement="top"
                >
                  <el-icon class="hint-icon"><QuestionFilled /></el-icon>
                </el-tooltip>
              </span>
            </template>
            <el-input
              v-model="form.accessKeySecret"
              :type="showSecret ? 'text' : 'password'"
              :placeholder="isEdit ? '留空表示不修改' : '阿里云 AccessKey Secret'"
              autocomplete="off"
            >
              <template #append>
                <el-button @click="showSecret = !showSecret">{{ showSecret ? '隐藏' : '显示' }}</el-button>
              </template>
            </el-input>
          </el-form-item>
          <el-form-item>
            <template #label>
              <span>访问模式</span>
            </template>
            <el-radio-group v-model="accessMode" class="mode-radio">
              <el-radio-button value="sts">🛡️ 临时凭证（推荐）</el-radio-button>
              <el-radio-button value="direct">🔑 直接 AccessKey</el-radio-button>
            </el-radio-group>
            <div class="form-hint mode-hint">
              <template v-if="accessMode === 'sts'">
                用 RAM 角色拿临时凭证，AK/SK 不会直接出现在 OSS 请求中，凭证 1 小时自动失效
              </template>
              <template v-else>
                直接用 AK/SK 调用 OSS（要求 AK 本身有 OSS 读写权限），无需创建 RAM 角色
              </template>
            </div>
          </el-form-item>

          <el-form-item v-if="accessMode === 'sts'">
            <template #label>
              <span>
                RAM 角色 ARN
                <el-tooltip
                  content="格式：acs:ram::123456789012:role/角色名。在 RAM 控制台创建角色时，系统会自动生成 ARN。"
                  placement="top"
                >
                  <el-icon class="hint-icon"><QuestionFilled /></el-icon>
                </el-tooltip>
              </span>
            </template>
            <el-input v-model="form.roleArn" placeholder="acs:ram::123456789012:role/myrole" />
            <div class="form-hint">
              工具会用上面的 AK/SK 扮演这个角色去访问 OSS，临时凭证默认 1 小时有效，到期自动续签
              <a class="link" @click="openRamConsole">点此打开 RAM 控制台</a>
            </div>
          </el-form-item>

          <!-- 高级选项（折叠） -->
          <div class="advanced-toggle" @click="showAdvanced = !showAdvanced">
            <el-icon class="toggle-icon" :class="{ rotated: showAdvanced }">
              <ArrowDown />
            </el-icon>
            <span>高级选项（凭证有效期 / 自定义权限范围）</span>
          </div>
          <div v-if="showAdvanced" class="advanced-content">
            <el-form-item label="凭证有效期（秒）">
              <el-input-number v-model="form.durationSeconds" :min="900" :max="3600" :step="300" />
              <span class="form-hint">900 ~ 3600 秒，默认 1 小时</span>
            </el-form-item>
            <el-form-item label="自定义权限范围（可选）">
              <el-input
                v-model="form.policy"
                type="textarea"
                :rows="3"
                placeholder='留空使用 RAM 角色自身权限。例如：&#10;{"Version":"1","Statement":[{"Effect":"Allow","Action":["oss:GetObject","oss:PutObject"],"Resource":["acs:oss:*:*:my-bucket/*"]}]}'
              />
              <div class="form-hint">
                可进一步限制临时凭证能访问的 Bucket 和操作，做到最小权限
              </div>
            </el-form-item>
          </div>
        </div>

        <!-- 测试结果展示 -->
        <div v-if="testResult" class="test-result" :class="testResult.ok ? 'ok' : 'fail'">
          <el-icon :size="18">
            <component :is="testResult.ok ? CircleCheck : CircleClose" />
          </el-icon>
          <span>{{ testResult.msg }}</span>
        </div>
      </el-form>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose" :disabled="submitting || testing">取消</el-button>
        <el-button :loading="testing" :disabled="submitting" @click="handleTestConnection">
          {{ isEdit ? '测试连接' : '保存并测试' }}
        </el-button>
        <el-button type="primary" :loading="submitting" :disabled="testing" @click="handleSubmit">
          {{ isEdit ? '保存修改' : '保存配置' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.form-wrap {
  padding: 4px 0;
}

/* 顶部引导卡片 */
.guide-card {
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  background: linear-gradient(135deg, #fff7ed, #fed7aa);
  border: 1px solid #fdba74;
  border-radius: 12px;
  margin-bottom: 16px;
}

.guide-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: #fff;
  color: #ea580c;
  display: flex;
  align-items: center;
  justify-content: center;
}

.guide-content {
  flex: 1;
  font-size: 12px;
  line-height: 1.6;
  color: #7c2d12;
}

.guide-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 4px;
  color: #7c2d12;
}

.guide-desc ol {
  margin: 4px 0 6px 18px;
  padding: 0;
}

.guide-desc ol li {
  margin-bottom: 2px;
}

.form-section {
  margin-bottom: 14px;
  padding: 14px 16px;
  background: #fffbeb;
  border-radius: 10px;
  border: 1px solid #fdead5;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #7c2d12;
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px dashed #fdead5;
}

.form-hint {
  display: block;
  font-size: 12px;
  color: #b45309;
  margin-top: 4px;
}

.hint-icon {
  color: #fdba74;
  cursor: help;
  margin-left: 4px;
  vertical-align: middle;
}

.link {
  color: #ea580c;
  margin-left: 6px;
  cursor: pointer;
  text-decoration: underline;
}

.link:hover {
  color: #f97316;
}

.mode-radio {
  display: flex;
  gap: 8px;
}

.mode-radio :deep(.el-radio-button__inner) {
  border: 1px solid #fdba74 !important;
  background: #fff !important;
  color: #7c2d12 !important;
}

.mode-radio :deep(.el-radio-button.is-active .el-radio-button__inner) {
  background: linear-gradient(135deg, #f97316, #ea580c) !important;
  border-color: #ea580c !important;
  color: #fff !important;
  box-shadow: none !important;
}

.mode-hint {
  margin-top: 8px;
  padding: 6px 10px;
  background: rgba(254, 215, 170, 0.4);
  border-radius: 6px;
  border-left: 3px solid #f97316;
}

.region-select {
  width: 100%;
}

/* 高级选项 */
.advanced-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #b45309;
  cursor: pointer;
  padding: 4px 0;
  margin-top: 4px;
  user-select: none;
}

.advanced-toggle:hover {
  color: #ea580c;
}

.toggle-icon {
  transition: transform 0.2s ease;
}

.toggle-icon.rotated {
  transform: rotate(180deg);
}

.advanced-content {
  padding: 8px 0 0;
  margin-top: 4px;
  border-top: 1px dashed #fdead5;
}

/* 测试结果 */
.test-result {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
}

.test-result.ok {
  background: #ecfdf5;
  color: #065f46;
  border: 1px solid #6ee7b7;
}

.test-result.fail {
  background: #fef2f2;
  color: #991b1b;
  border: 1px solid #fca5a5;
}

:deep(.el-form-item__label) {
  font-weight: 500;
  color: #1f2937;
}

:deep(.el-input__wrapper),
:deep(.el-textarea__inner) {
  background: #fff;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>