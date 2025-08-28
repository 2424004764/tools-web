<script setup lang="ts">
import { reactive, ref, watch, nextTick } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { copy } from '@/utils/string'

type CookieRow = {
  name: string
  value: string
  domain?: string
  path?: string
  expires?: string
  maxAge?: string
  secure?: boolean
  httpOnly?: boolean
  sameSite?: 'Strict' | 'Lax' | 'None' | ''
}

const info = reactive({
  title: 'Cookie解析/构造',
})

const state = reactive({
  raw: '',
  result: '',
  viewMode: 'simple' as 'simple' | 'detailed', // 简单模式或详细模式
})

const cookies = ref<CookieRow[]>([{ name: '', value: '', domain: '', path: '', expires: '', maxAge: '', secure: false, httpOnly: false, sameSite: '' }])

// 标记是否正在更新中，防止循环更新
let isUpdating = false

// 解析Cookie字符串
const parseCookies = () => {
  if (isUpdating) return
  
  const rawCookies = state.raw.trim()
  if (!rawCookies) {
    isUpdating = true
    cookies.value = [{ name: '', value: '', domain: '', path: '', expires: '', maxAge: '', secure: false, httpOnly: false, sameSite: '' }]
    isUpdating = false
    buildCookies()
    return
  }

  const parsed: CookieRow[] = []

  // 支持两种格式：
  // 1. 请求头格式：name1=value1; name2=value2
  // 2. 响应头格式：name=value; Domain=example.com; Path=/; Expires=date; Max-Age=3600; Secure; HttpOnly; SameSite=Lax

  // 判断是否为响应头格式（包含Domain、Path等属性）
  const isSetCookieFormat = /(?:Domain|Path|Expires|Max-Age|Secure|HttpOnly|SameSite)=/i.test(rawCookies)

  if (isSetCookieFormat) {
    // 解析Set-Cookie格式（每行一个cookie）
    const lines = rawCookies.split('\n').filter(line => line.trim())
    
    lines.forEach(line => {
      const cookie: CookieRow = { name: '', value: '', domain: '', path: '', expires: '', maxAge: '', secure: false, httpOnly: false, sameSite: '' }
      const parts = line.split(';').map(part => part.trim())
      
      // 第一部分是name=value
      if (parts[0]) {
        const [name, ...valueParts] = parts[0].split('=')
        cookie.name = name.trim()
        cookie.value = valueParts.join('=') || ''
      }
      
      // 解析其他属性
      parts.slice(1).forEach(part => {
        const [key, value] = part.split('=')
        const lowerKey = key.toLowerCase()
        
        switch (lowerKey) {
          case 'domain':
            cookie.domain = value || ''
            break
          case 'path':
            cookie.path = value || ''
            break
          case 'expires':
            cookie.expires = value || ''
            break
          case 'max-age':
            cookie.maxAge = value || ''
            break
          case 'secure':
            cookie.secure = true
            break
          case 'httponly':
            cookie.httpOnly = true
            break
          case 'samesite':
            cookie.sameSite = (value as any) || ''
            break
        }
      })
      
      parsed.push(cookie)
    })
  } else {
    // 解析请求头Cookie格式：name1=value1; name2=value2
    const parts = rawCookies.split(';').map(part => part.trim()).filter(Boolean)
    
    parts.forEach(part => {
      const [name, ...valueParts] = part.split('=')
      if (name) {
        parsed.push({
          name: name.trim(),
          value: valueParts.join('=') || '',
          domain: '',
          path: '',
          expires: '',
          maxAge: '',
          secure: false,
          httpOnly: false,
          sameSite: ''
        })
      }
    })
  }

  isUpdating = true
  cookies.value = parsed.length > 0 ? parsed : [{ name: '', value: '', domain: '', path: '', expires: '', maxAge: '', secure: false, httpOnly: false, sameSite: '' }]
  isUpdating = false
  buildCookies()
}

// 构造Cookie字符串
const buildCookies = () => {
  const validCookies = cookies.value.filter(c => c.name.trim() !== '')
  
  if (validCookies.length === 0) {
    state.result = ''
    return
  }

  if (state.viewMode === 'simple') {
    // 生成请求头格式
    const parts = validCookies.map(c => `${c.name}=${c.value || ''}`)
    state.result = parts.join('; ')
  } else {
    // 生成Set-Cookie格式（每行一个）
    const lines = validCookies.map(cookie => {
      const parts = [`${cookie.name}=${cookie.value || ''}`]
      
      if (cookie.domain) parts.push(`Domain=${cookie.domain}`)
      if (cookie.path) parts.push(`Path=${cookie.path}`)
      if (cookie.expires) parts.push(`Expires=${cookie.expires}`)
      if (cookie.maxAge) parts.push(`Max-Age=${cookie.maxAge}`)
      if (cookie.secure) parts.push('Secure')
      if (cookie.httpOnly) parts.push('HttpOnly')
      if (cookie.sameSite) parts.push(`SameSite=${cookie.sameSite}`)
      
      return parts.join('; ')
    })
    state.result = lines.join('\n')
  }
}

// 根据cookies列表更新输入框内容
const updateRawFromCookies = () => {
  if (isUpdating) return
  
  const validCookies = cookies.value.filter(c => c.name.trim() !== '')
  
  if (validCookies.length === 0) {
    isUpdating = true
    state.raw = ''
    isUpdating = false
    return
  }

  isUpdating = true
  if (state.viewMode === 'simple') {
    // 生成请求头格式用于输入框
    const parts = validCookies.map(c => `${c.name}=${c.value || ''}`)
    state.raw = parts.join('; ')
  } else {
    // 生成Set-Cookie格式用于输入框
    const lines = validCookies.map(cookie => {
      const parts = [`${cookie.name}=${cookie.value || ''}`]
      
      if (cookie.domain) parts.push(`Domain=${cookie.domain}`)
      if (cookie.path) parts.push(`Path=${cookie.path}`)
      if (cookie.expires) parts.push(`Expires=${cookie.expires}`)
      if (cookie.maxAge) parts.push(`Max-Age=${cookie.maxAge}`)
      if (cookie.secure) parts.push('Secure')
      if (cookie.httpOnly) parts.push('HttpOnly')
      if (cookie.sameSite) parts.push(`SameSite=${cookie.sameSite}`)
      
      return parts.join('; ')
    })
    state.raw = lines.join('\n')
  }
  isUpdating = false
}

const addCookie = async () => {
  // 检查最后一个cookie是否为空
  const lastCookie = cookies.value[cookies.value.length - 1]
  const isLastCookieEmpty = !lastCookie.name.trim() && !lastCookie.value.trim()
  
  let targetIndex = cookies.value.length - 1
  
  // 如果最后一个cookie不为空，才添加新项目
  if (!isLastCookieEmpty) {
    cookies.value.push({ name: '', value: '', domain: '', path: '', expires: '', maxAge: '', secure: false, httpOnly: false, sameSite: '' })
    targetIndex = cookies.value.length - 1
  }
  
  // 等待DOM更新后滚动到目标项目并聚焦
  await nextTick()
  
  // 滚动到目标项目
  const targetElement = document.querySelector(`[data-cookie-index="${targetIndex}"]`)
  if (targetElement) {
    targetElement.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center' 
    })
    
    // 聚焦到name输入框
    const nameInput = targetElement.querySelector('input')
    if (nameInput) {
      nameInput.focus()
    }
  }
}

const removeCookie = (index: number) => {
  if (cookies.value.length > 1) {
    cookies.value.splice(index, 1)
  }
}

const clearAll = () => {
  isUpdating = true
  state.raw = ''
  state.result = ''
  cookies.value = [{ name: '', value: '', domain: '', path: '', expires: '', maxAge: '', secure: false, httpOnly: false, sameSite: '' }]
  isUpdating = false
}

const copyResult = () => copy(state.result)

const fillExample = () => {
  if (state.viewMode === 'simple') {
    state.raw = 'sessionId=abc123; userId=12345; theme=dark; language=zh-CN'
  } else {
    state.raw = `sessionId=abc123; Domain=example.com; Path=/; Expires=Wed, 09 Jun 2025 10:18:14 GMT; Secure; HttpOnly; SameSite=Lax
userId=12345; Domain=.example.com; Path=/; Max-Age=3600; SameSite=Strict`
  }
}

const toggleViewMode = () => {
  state.viewMode = state.viewMode === 'simple' ? 'detailed' : 'simple'
  updateRawFromCookies()
  buildCookies()
}

// 计算所有cookie的总字段数（name=value算作一个cookie，其他属性单独计算）
const getTotalFieldCount = () => {
  return cookies.value.reduce((total, cookie) => {
    let count = 0
    // name=value算作一个cookie条目
    if (cookie.name.trim()) count++
    // 其他属性字段
    if (cookie.domain?.trim()) count++
    if (cookie.path?.trim()) count++
    if (cookie.expires?.trim()) count++
    if (cookie.maxAge?.trim()) count++
    if (cookie.secure) count++
    if (cookie.httpOnly) count++
    if (cookie.sameSite?.trim()) count++
    return total + count
  }, 0)
}

// 监听输入框变化，自动解析
watch(() => state.raw, parseCookies)

// 监听cookies变化，自动重建result并更新输入框
watch(cookies, () => {
  buildCookies()
  updateRawFromCookies()
}, { deep: true })

// 监听视图模式变化
watch(() => state.viewMode, () => {
  updateRawFromCookies()
  buildCookies()
})
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title" />

    <div class="p-4 rounded-2xl bg-white">
      <div class="mb-2 text-sm text-gray-500">
        支持解析请求头Cookie（name1=value1; name2=value2）和响应头Set-Cookie格式，输入内容后自动解析，编辑Cookie列表后自动同步。
        <el-link class="ml-2" type="primary" @click="fillExample">填充示例</el-link>
      </div>
      
      <el-input
        type="textarea"
        :rows="4"
        v-model="state.raw"
        :placeholder="state.viewMode === 'simple' ? 
          '输入Cookie字符串，如：name1=value1; name2=value2（自动解析）' : 
          '输入Set-Cookie格式，如：name=value; Domain=example.com; Path=/; Secure（自动解析）'"
      />

      <div class="mt-3 flex flex-wrap items-center gap-2 button-container">
        <el-button @click="toggleViewMode">
          切换到{{ state.viewMode === 'simple' ? '详细' : '简单' }}模式
        </el-button>
        <el-button type="danger" @click="clearAll">清空</el-button>
      </div>

      <div class="mt-4">
        <div class="flex items-center justify-between mb-2">
          <div class="text-sm text-gray-600">
            Cookie列表（实时同步）- 总计{{ getTotalFieldCount() }}个字段
            <el-tag size="small" class="ml-2">{{ state.viewMode === 'simple' ? '简单模式' : '详细模式' }}</el-tag>
          </div>
          <el-button size="small" @click="addCookie">添加Cookie</el-button>
        </div>

        <div class="space-y-2">
          <div 
            v-for="(cookie, idx) in cookies" 
            :key="idx" 
            :data-cookie-index="idx"
            class="border rounded-md p-2 bg-gray-50 transition-colors duration-300"
            :class="{ 'ring-2 ring-blue-300': idx === cookies.length - 1 && cookies.length > 1 }"
          >
            <!-- 基本信息 -->
            <div class="flex gap-2 items-center mb-1">
              <div class="w-8 flex-shrink-0 text-center">
                <span class="text-xs text-gray-500 font-mono">{{ idx + 1 }}</span>
              </div>
              <div class="basis-[35%]">
                <el-input v-model="cookie.name" placeholder="Cookie名称" size="small">
                  <template #suffix>
                    <span class="text-xs text-gray-400">{{ cookie.name.length }}</span>
                  </template>
                </el-input>
              </div>
              <div class="basis-[50%]">
                <el-input v-model="cookie.value" placeholder="Cookie值" size="small">
                  <template #suffix>
                    <span class="text-xs text-gray-400">{{ cookie.value.length }}</span>
                  </template>
                </el-input>
              </div>
              <el-button type="danger" link @click="removeCookie(idx)" size="small">删除</el-button>
            </div>

            <!-- 详细模式的额外属性 -->
            <div v-if="state.viewMode === 'detailed'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-1 mt-1 ml-10">
              <el-input v-model="cookie.domain" placeholder="Domain" size="small" />
              <el-input v-model="cookie.path" placeholder="Path" size="small" />
              <el-input v-model="cookie.expires" placeholder="Expires" size="small" />
              <el-input v-model="cookie.maxAge" placeholder="Max-Age" size="small" />
              <div class="flex items-center gap-2 text-sm">
                <el-checkbox v-model="cookie.secure" size="small">Secure</el-checkbox>
                <el-checkbox v-model="cookie.httpOnly" size="small">HttpOnly</el-checkbox>
              </div>
              <el-select v-model="cookie.sameSite" placeholder="SameSite" size="small" clearable>
                <el-option label="Strict" value="Strict" />
                <el-option label="Lax" value="Lax" />
                <el-option label="None" value="None" />
              </el-select>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-4">
        <div class="text-sm text-gray-600 mb-1">
          生成结果（{{ state.viewMode === 'simple' ? '请求头Cookie格式' : 'Set-Cookie格式' }}）：
        </div>
        <el-input 
          type="textarea" 
          :rows="state.viewMode === 'simple' ? 2 : 4"
          v-model="state.result" 
          readonly 
        />
        <div class="mt-2">
          <el-button type="primary" @click="copyResult">复制结果</el-button>
        </div>
      </div>
    </div>

    <ToolDetail title="功能说明">
      <div class="space-y-2">
        <p><strong>简单模式：</strong>适用于解析和构造请求头中的Cookie字符串（name1=value1; name2=value2）</p>
        <p><strong>详细模式：</strong>适用于解析和构造响应头中的Set-Cookie字符串，包含Domain、Path、Expires、Max-Age、Secure、HttpOnly、SameSite等属性</p>
        <p><strong>支持功能：</strong></p>
        <ul class="list-disc list-inside ml-4 space-y-1">
          <li>输入内容后自动解析，无需点击按钮</li>
          <li>编辑Cookie列表后自动同步到输入框</li>
          <li>自动识别Cookie格式（请求头或响应头）</li>
          <li>添加/删除Cookie条目</li>
          <li>在简单模式和详细模式间切换</li>
          <li>一键复制生成结果</li>
        </ul>
      </div>
    </ToolDetail>
  </div>
</template>

<style scoped>
.button-container .el-button {
  margin-right: 12px;
  margin-left: 0px;
}
</style>