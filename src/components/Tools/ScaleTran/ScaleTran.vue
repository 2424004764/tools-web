<script setup lang="ts">
import { reactive, watch, onMounted } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { ElMessage } from 'element-plus'
import { copy } from '@/utils/string'
import { isBinary, isOctal, isDecimal, isHexadecimal } from '@/utils/verify'
import { InfoFilled } from '@element-plus/icons-vue'
import { scale58ToBase, scale62ToBase, scale64ToBase, baseToScale58, baseToScale62, baseToScale64 } from '@/utils/math'

const info = reactive({
  title: "常用进制转换",
  content: '10',
  chooseTranOptions: '10',
  tranOptions: [
    {
      value: '2',
      label: '2进制',
      tranValue: '',
      desc: '',
    },
    {
      value: '8',
      label: '8进制',
      tranValue: '',
      desc: '',
    },
    {
      value: '10',
      label: '10进制',
      tranValue: '',
      desc: '',
    },
    {
      value: '16',
      label: '16进制',
      tranValue: '',
      desc: '',
    },
    {
      value: '32',
      label: '32进制',
      tranValue: '',
      desc: '数字 + 大写字母，不包含 ILOU 字符',
    },
    {
      value: '58',
      label: '58进制',
      tranValue: '',
      desc: '数字 + 大小写字母，不包含 0OlI 字符',
    },
    {
      value: '62',
      label: '62进制',
      tranValue: '',
      desc: '数字 + 大小写字母',
    },
    {
      value: '64',
      label: '64进制',
      tranValue: '',
      desc: '数字 + 大小写字母以及两个特殊字符 +/',
    },
  ]
})

//高进制转换10进制 - int
const tailScaleToBase = (content: string, scale: number): number => {
  let res = 0
  switch(scale) {
    case 58:
      res = scale58ToBase(content)
      break;
    case 62:
      res = scale62ToBase(content)
      break;
    case 64:
      res = scale64ToBase(content)
      break;
    default:
      ElMessage({
        message: "参数错误",
        type: "warning",
        duration: 1500
      })
  }
  return res
}

//10进制转换高进制
const baseToTailScale = (num: number, scale: number): string => {
  let res = ''
  switch(scale) {
    case 58:
      res = baseToScale58(num)
      break;
    case 62:
      res = baseToScale62(num)
      break;
    case 64:
      res = baseToScale64(num)
      break;
    default:
      ElMessage({
        message: "参数错误",
        type: "warning",
        duration: 1500
      })
  }
  return res
}

//转换前 - check（silent=true 时不弹提示，用于自动转换）
const tranCheck = (silent = false) => {
  if (!info.content) {
    if (!silent) ElMessage({ message: "请输入转换数值", type: "warning", duration: 1500 })
    return false
  }

  if (info.chooseTranOptions == '2' && isBinary(info.content) == false) {
    if (!silent) ElMessage({ message: "不是二进制值", type: "warning", duration: 1500 })
    return false
  }

  if (info.chooseTranOptions == '8' && isOctal(info.content) == false) {
    if (!silent) ElMessage({ message: "不是八进制值", type: "warning", duration: 1500 })
    return false
  }

  if (info.chooseTranOptions == '10' && isDecimal(info.content) == false) {
    if (!silent) ElMessage({ message: "不是十进制值", type: "warning", duration: 1500 })
    return false
  }

  if (info.chooseTranOptions == '16' && isHexadecimal(info.content) == false) {
    if (!silent) ElMessage({ message: "不是十六进制值", type: "warning", duration: 1500 })
    return false
  }

  return true
}

//转换（silent=true 时静默校验，不弹提示）
const tran = (silent = false) => {
  if (!tranCheck(silent)) {
    if (silent) info.tranOptions.forEach(item => item.tranValue = '')
    return
  }
  if (!silent) ElMessage({ message: "转换成功", type: "success", duration: 1500 })

  //当前输入的内容转换成10进制
  let tranContent
  let chooseTranInt = parseInt(info.chooseTranOptions, 10)
  if (chooseTranInt <= 36) {
    tranContent = parseInt(info.content, chooseTranInt)
  } else {
    tranContent = tailScaleToBase(info.content, chooseTranInt)
  }
  
  //用上面转换的10进制内容转换对应进制
  for (let index in info.tranOptions) {
    let valueInt = parseInt(info.tranOptions[index].value, 10)
    if (valueInt <= 36) {
      info.tranOptions[index].tranValue = tranContent.toString(valueInt)
    } else {
      info.tranOptions[index].tranValue = baseToTailScale(tranContent, valueInt)
    }
  }
}

// 输入内容或进制变化时自动转换
watch(() => [info.content, info.chooseTranOptions], () => {
  tran(true)
})

onMounted(() => {
  tran()
})

//copy
const copyRes = async (index: any) => {
  copy(info.tranOptions[index].tranValue)
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1 ">
    <DetailHeader :title="info.title"></DetailHeader>
    <div class="p-4 rounded-2xl bg-white">
      <div class="flex">
        <div class="mr-2 w-full">
          <el-input v-model="info.content">
            <template #prepend>
              <el-select v-model="info.chooseTranOptions" placeholder="Select"  class="choosetranoptions-select">
                <el-option
                  v-for="item in info.tranOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </template>
          </el-input>
        </div>
        
        <el-button type="primary" @click="tran()">转换</el-button>
      </div>

      <div class="mt-3 min-h-md bg-gray-100 p-3 mb-3 flex flex-col">
        <el-table :data="info.tranOptions" border style="width: 100%">
          <el-table-column prop="label" label="进制" width="120">
            <template #default="scope">
              <div class="flex items-center">
                <span class="mr-1">{{ scope.row.label }}</span>
                <el-tooltip
                  v-if="scope.row.desc != ''"
                  class="box-item"
                  effect="dark"
                  :content="scope.row.desc"
                  placement="top-start"
                ><el-icon ><InfoFilled /></el-icon></el-tooltip>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="tranValue" label="结果"/>
          <el-table-column prop="" label="操作" width="60">
            <template #default="scope">
              <el-button
                link
                type="primary"
                size="small"
                @click.prevent="copyRes(scope.$index)"
              >
                复制
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>
    
    <!-- desc -->
    <ToolDetail title="使用说明">
      <el-text>
        <p>进位制是一种记数方式，也称为进位记数法/位值计数法，可以用有限的数字符号代表所有的数值。可使用数字符号的数目称为基数（radix），基数为n即称n进制。</p>

        <p class="mt-3 font-bold">常见进制说明：</p>
        <ul class="list-disc pl-6 mt-1 space-y-1">
          <li><strong>二进制（Base-2）</strong>：使用 0、1 两个数字，是计算机底层的基础，所有数据最终都以二进制形式存储和运算。</li>
          <li><strong>八进制（Base-8）</strong>：使用 0~7 共8个数字，常用于 Unix/Linux 文件权限表示，如 <code>chmod 755</code>。</li>
          <li><strong>十进制（Base-10）</strong>：使用 0~9 共10个数字，日常生活中最常用的计数方式。</li>
          <li><strong>十六进制（Base-16）</strong>：使用 0~9 和 A~F，广泛用于颜色值（如 <code>#FF5733</code>）、内存地址、MAC地址等场景。</li>
          <li><strong>三十二进制（Base-32）</strong>：使用数字 + 大写字母，去除了易混淆的 I、L、O、U 字符，常用于编码和序列号生成。</li>
          <li><strong>五十八进制（Base-58）</strong>：使用数字 + 大小写字母，去除了 0、O、l、I 等易混淆字符，广泛应用于比特币地址、IPFS 哈希等。</li>
          <li><strong>六十二进制（Base-62）</strong>：使用 0~9、a~z、A~Z 共62个字符，常用于短链接生成、唯一ID编码等场景。</li>
          <li><strong>六十四进制（Base-64）</strong>：使用数字 + 大小写字母 + <code>+/</code> 两个特殊字符，广泛用于数据编码传输，如邮件附件、图片Base64编码等。</li>
        </ul>

        <p class="mt-3 font-bold">常见转换方法：</p>
        <ul class="list-disc pl-6 mt-1 space-y-1">
          <li><strong>十进制 → 二进制</strong>：除2取余法，将十进制数不断除以2，取余数从下往上排列。例如：10 ÷ 2 = 5…0，5 ÷ 2 = 2…1，2 ÷ 2 = 1…0，1 ÷ 2 = 0…1，结果为 <code>1010</code>。</li>
          <li><strong>二进制 → 十进制</strong>：按权展开法，从右到左每一位乘以 2 的对应次方后求和。例如：<code>1010</code> = 1×2³ + 0×2² + 1×2¹ + 0×2⁰ = 8 + 0 + 2 + 0 = <code>10</code>。</li>
          <li><strong>十进制 → 十六进制</strong>：除16取余法，类似二进制转换，余数大于9时用 A~F 表示。例如：255 = <code>FF</code>。</li>
          <li><strong>二进制 → 十六进制</strong>：每4位二进制为一组，分别转换为对应的十六进制数字。例如：<code>1010 1111</code> = <code>AF</code>。</li>
          <li><strong>二进制 → 八进制</strong>：每3位二进制为一组，分别转换为对应的八进制数字。例如：<code>001 010</code> = <code>12</code>。</li>
        </ul>
      </el-text>
    </ToolDetail>

  </div>
</template>

<style scoped>
.choosetranoptions-select{
  @apply w-24
}
</style>