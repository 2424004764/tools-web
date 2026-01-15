<script setup lang="ts">
import { onMounted, reactive, computed } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { copy, genRandomStrByChars } from '@/utils/string'
import { ElMessage } from 'element-plus'
const info = reactive({
  title: "随机密码生成",
  char: '',
  pwLen: 16,
  pwNum: 5,
  resStr: '',
  autosize: {
    minRows: 5
  },
  checkedUpper: true,
  checkedLower: true,
  checkedNum: true,
  checkedSign: false,
  charNum: '0123456789',
  charUpper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  charLower: 'abcdefghijklmnopqrstuvwxyz',
  cahrSign: '~!@#$%^&*()_+',
})

// 将生成的密码分割成数组
const passwordList = computed(() => {
  if (!info.resStr) return []
  return info.resStr.split('\n').filter(p => p.trim())
})

//生成密码
const gen = () => {
  //包含字符验证
  if (info.char == '') {
    ElMessage({
      message: "包含字符不能为空",
      type: "warning",
      duration: 1500
    })
    return
  }

  //生成长度验证
  if (info.pwLen > 100) {
    ElMessage({
      message: "生成长度范围在1~100",
      type: "warning",
      duration: 1500
    })
    return
  }

  //生成数量验证
  if (info.pwNum > 100) {
    ElMessage({
      message: "生成数量范围在1~100",
      type: "warning",
      duration: 1500
    })
    return
  }

  //清空旧数据
  info.resStr = ''

  //按数量生成密码
  for (let i = 1; i <= info.pwNum; i++) {
    let ext = '\n'
    if (i == info.pwNum) {
      ext = ''
    }
    info.resStr += genRandomStrByChars(info.char, info.pwLen) + ext
  }
}

const changeCheckBox = (val: any, type: number) => {
  switch(type) {
    case 0:
      //设置数字字符
      setChar(val, /\d+/g, info.charNum)
      break;
    case 1:
      //设置小写字母字符
      setChar(val, /[a-z]/g, info.charLower)
      break;
    case 2:
      //设置大写字母字符
      setChar(val, /[A-Z]/g, info.charUpper)
      break;
    case 3:
      //设置特殊符号字符
      setChar(val, /[~!@#$%^&*()_+]/g, info.cahrSign)
      break;
    default:
      info.char = ''
      break;
  }
}

//设置字符
const setChar = (val: boolean, reg: RegExp, charType: string) => {
  if (val == true) {
      //添加
      info.char += charType
    } else {
      //清除
      info.char = info.char.replace(reg, "")
    }
}

//复制单条密码
const copySingle = async (password: string) => {
  await copy(password)
  ElMessage.success('已复制')
}

//copy
const copyRes = async (resStr: string) => {
  await copy(resStr)
  ElMessage.success('已复制全部密码')
}

const strength = computed(() => {
  const l = info.pwLen || 0
  const n = new Set(info.char.split('')).size
  if (l <= 0 || n <= 0) {
    return { entropy: 0, label: '无', color: '#909399', percent: 0 }
  }
  const entropy = l * Math.log2(n)
  let label = '弱'
  let color = '#F56C6C'
  let percent = 20
  if (entropy >= 80) {
    label = '极强'; color = '#409EFF'; percent = 100
  } else if (entropy >= 60) {
    label = '强'; color = '#67C23A'; percent = 80
  } else if (entropy >= 36) {
    label = '中等'; color = '#E6A23C'; percent = 60
  } else if (entropy >= 28) {
    label = '较弱'; color = '#E6A23C'; percent = 35
  }
  return { entropy, label, color, percent }
})

onMounted(() => {
  //设置初始字符
  changeCheckBox(info.checkedNum, 0)
  changeCheckBox(info.checkedLower, 1)
  changeCheckBox(info.checkedUpper, 2)
  changeCheckBox(info.checkedSign, 3)
  gen()
})
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white">
      <el-text>密码组合</el-text>
      <div>
        <el-checkbox v-model="info.checkedNum" label="数字(0-9)"  @change="(val: any) => (changeCheckBox(val, 0))"/>
        <el-checkbox v-model="info.checkedLower" label="小写字母(a-z)"  @change="(val: any) => (changeCheckBox(val, 1))"/>
        <el-checkbox v-model="info.checkedUpper" label="大写字母(A-Z)" @change="(val: any) => (changeCheckBox(val, 2))"/>
        <el-checkbox v-model="info.checkedSign" label="其他符号(~!@#$%^&*()-+_=,.)"  @change="(val: any) => (changeCheckBox(val, 3))"/>
      </div>
      <div>
        <el-input class="" v-model="info.char">
          <template #prepend>包含字符:</template>
        </el-input>
        <div class="mt-3">
          <el-text>生成长度: {{ info.pwLen }}</el-text>
          <el-slider v-model="info.pwLen" :min="1" :max="100" :step="1" />
        </div>
        <div class="mt-3">
          <el-text>生成数量: {{ info.pwNum }}</el-text>
          <el-slider v-model="info.pwNum" :min="1" :max="100" :step="1" />
        </div>
        <div class="mt-2">
          <el-text>密码强度: {{ strength.label }}（约 {{ strength.entropy.toFixed(1) }} bits）</el-text>
          <el-progress :percentage="strength.percent" :color="strength.color" :stroke-width="8" />
        </div>
      </div>
      <div class="mt-3 mb-3 flex flex-wrap gap-2">
        <el-button type="primary" @click="gen" class="flex-1 c-xs:w-auto">生成密码</el-button>
        <el-button
          v-if="passwordList.length > 0"
          @click="copyRes(info.resStr)"
          plain
          class="flex-1 c-xs:w-auto"
        >
          复制全部
        </el-button>
      </div>

      <!-- 密码列表 -->
      <div v-if="passwordList.length > 0" class="space-y-2">
        <div
          v-for="(password, index) in passwordList"
          :key="index"
          class="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-warm-400 hover:bg-warm-50 transition-all"
        >
          <!-- 序号和密码 -->
          <div class="flex items-center gap-3 flex-1 min-w-0">
            <span class="text-warm-700 font-semibold text-sm flex-shrink-0">{{ index + 1 }}</span>
            <el-text
              class="font-mono text-base break-all flex-1"
              style="word-break: break-all;"
            >
              {{ password }}
            </el-text>
          </div>

          <!-- 复制按钮 -->
          <el-button
            type="primary"
            size="small"
            @click="copySingle(password)"
            class="ml-2 flex-shrink-0"
          >
            复制
          </el-button>
        </div>
      </div>

      <!-- 原始结果（隐藏，用于保留功能） -->
      <el-input v-model="info.resStr" type="hidden" />
    </div>

    <!-- desc -->
    <ToolDetail title="描述">
      <el-text>
        在线生成密码支持开启或关闭大小写 、数字 、特殊符号，支持自定义字符，长度；批量生成密码
      </el-text> 
      <el-text class="block mt-2">
        bits（熵）说明：表示密码的随机信息量，值越大越难被穷举。约需要 2 的 bits 次方次尝试才能遍历所有可能；
        一般参考：≥28 为较弱、≥36 为中等、≥60 为强、≥80 为极强。
      </el-text>
    </ToolDetail>

  </div>
</template>

<style scoped>

</style>