<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { functionsRequest } from '@/utils/functionsRequest'
import { isIp } from '@/utils/verify'
import { ElMessage } from 'element-plus'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'

const info = reactive({
  title: "IP查询",
})

// 原 /v1/openapi/ip（fork 上游后端）本站从未部署，页面一直查不到数据；
// 现改走本站自建 /api/ip：不传参查访客自己（CF 边缘注入，含运营商），传参查指定 IP
const ipInput = ref('')
const loading = ref(false)
const ipData = ref<{
  ip: string
  isp: string
  country: string
  region: string
  city: string
  timezone: string
  colo: string
} | null>(null)

const search = async (type: string) => {
  if (type == 'click') {
    if (!isIp(ipInput.value)) {
      ElMessage({
        message: "无效的ip地址",
        type: "warning",
        duration: 1500
      })
      return
    }
  }
  loading.value = true
  try {
    const res = await functionsRequest.get('/api/ip', {
      params: ipInput.value ? { ip: ipInput.value } : {}
    })
    ipData.value = res.data.data
  } catch {
    // 错误提示由 functionsRequest 拦截器统一处理
  } finally {
    loading.value = false
  }
}

const pos = () => {
  if (!ipData.value) return ''
  return [ipData.value.country, ipData.value.region, ipData.value.city]
    .filter(Boolean)
    .join(' ')
}

onMounted(() => {
  search('')
})
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white">
      <div class="flex">
        <div class="mr-2 w-60">
          <el-input v-model="ipInput" placeholder="留空查本机 IP，或输入要查询的 IP"></el-input>
        </div>

        <el-button type="primary" :loading="loading" @click="search('click')">查询</el-button>
      </div>
      <div class="mt-3 min-h-md bg-gray-100 p-3 mb-3 flex flex-col" v-loading="loading">
        <div class="bg-white p-2 font-bold text-h3">您的IP信息</div>
        <div class="bg-white p-2 flex">
          <div class="mr-1">IP 地址: </div>
          <div>{{ ipData?.ip || '-' }}</div>
        </div>
        <div class="bg-white p-2 flex">
          <div class="mr-1">运营商: </div>
          <div>{{ ipData?.isp || '-' }}</div>
        </div>
        <div class="bg-white p-2 flex">
          <div class="mr-1">所在地理位置: </div>
          <div>{{ pos() || '-' }}</div>
        </div>
        <div class="bg-white p-2 flex text-gray-400 text-sm">
          <div class="mr-1">时区 / 接入点: </div>
          <div>{{ [ipData?.timezone, ipData?.colo].filter(Boolean).join(' · ') || '-' }}</div>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
