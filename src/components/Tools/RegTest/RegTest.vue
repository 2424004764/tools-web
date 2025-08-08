<script setup lang="ts">
import { reactive } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import Codemirror from "codemirror-editor-vue3";
import "codemirror/mode/javascript/javascript.js";
// import { lineNumbers } from '@codemirror/view';

const info = reactive({
  title: "正则表达式测试",
  // extensions: [lineNumbers()],
  reg: '',
  content: `一些测试实例:
邮箱1：demo@163.com
邮箱2：demo2@163.com
手机号：18899990000
url: https://tool.fologde.com、https://fologde.com
IP: 192.168.0.1
时间：2025-08-08
`,
  matchRes: '',
  matchNum: 0,
  isAll: true,
  isCase: false,
  isParseErr: false,
  parseErr: '',
  regList: [
    {
      id: 1,
      title: '匹配手机号',
      reg: '(13\\d|14[579]|15[^4\\D]|17[^49\\D]|18\\d)\\d{8}'
    },
    {
      id: 1,
      title: '严格手机号(国内)',
      reg: '^1[3-9]\\d{9}$'
    },
    {
      id: 1,
      title: '匹配网址URL',
      reg: '(http|ftp|https):\\\/\\\/[\\w\\-_]+(\\.[\\w\\-_]+)+([\\w\\-\\.,@?^=%&:/~\\+#]*[\\w\\-\\@?^=%&/~\\+#])?'
    },
    {
      id: 1,
      title: 'URL(简化, http/https)',
      reg: '^https?:\\\/\\\/[^\\s\\/$.?#].[^\\s]*$'
    },
    {
      id: 1,
      title: 'URL(可带端口)',
      reg: '^https?:\\\/\\\/[^\\s/:]+(?::\\d{2,5})?(?:\\\/[^\\s]*)?$'
    },
    {
      id: 1,
      title: '匹配Email',
      reg: `\\w[-\\w.+]*@([A-Za-z0-9][-A-Za-z0-9]+\\.)+[A-Za-z]{2,14}`
    },
    {
      id: 1,
      title: '匹配中文字符',
      reg: "[\u4e00-\u9fa5]"
    },
    {
      id: 1,
      title: '匹配双字节字符(包含汉字)',
      reg: "[^\x00-\xff]+"
    },
    {
      id: 1,
      title: '匹配18位身份证号',
      reg: "\\d{17}[0-9Xx]|\\d{15}"
    },
    {
      id: 1,
      title: '匹配整数',
      reg: "[1-9]\\d*"
    },
    {
      id: 1,
      title: '匹配IP(IPV4)',
      reg: "\\d{0,3}\\.\\d{0,3}\\.\\d{0,3}\\.\\d{0,3}"
    },
    {
      id: 1,
      title: 'IPv4(严格0-255)',
      reg: '^(?:(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)$'
    },
    {
      id: 1,
      title: 'IPv6(简单)',
      reg: '^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$'
    },
    {
      id: 1,
      title: '匹配日期(年-月-日)',
      reg: "(([0-9]{3}[1-9]|[0-9]{2}[1-9][0-9]{1}|[0-9]{1}[1-9][0-9]{2}|[1-9][0-9]{3})-(((0[13578]|1[02])-(0[1-9]|[12][0-9]|3[01]))|((0[469]|11)-(0[1-9]|[12][0-9]|30))|(02-(0[1-9]|[1][0-9]|2[0-8]))))|((([0-9]{2})(0[48]|[2468][048]|[13579][26])|((0[48]|[2468][048]|[3579][26])00))-02-29)"
    },
    {
      id: 1,
      title: '时间戳(10或13位)',
      reg: '^\\d{10}(\\d{3})?$'
    },
    {
      id: 1,
      title: '正负浮点数',
      reg: '^-?\\d+(?:\\.\\d+)?$'
    },
    {
      id: 1,
      title: '十六进制颜色',
      reg: '^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$'
    },
    {
      id: 1,
      title: '中国邮政编码',
      reg: '^[1-9]\\d{5}(?!\\d)$'
    },
    {
      id: 1,
      title: 'QQ号',
      reg: '^[1-9][0-9]{4,10}$'
    },
    {
      id: 1,
      title: '微信号',
      reg: '^[a-zA-Z][-_a-zA-Z0-9]{5,19}$'
    },
    {
      id: 1,
      title: '用户名(字母开头,6-20位,含下划线数字)',
      reg: '^[a-zA-Z]\\w{5,19}$'
    },
    {
      id: 1,
      title: '强密码(大小写+数字+特殊,>=8)',
      reg: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^\\da-zA-Z]).{8,}$'
    },
    {
      id: 1,
      title: '座机电话',
      reg: '^0\\d{2,3}-?\\d{7,8}$'
    },
    {
      id: 1,
      title: '车牌号(简化版)',
      reg: '^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领A-Z]{1}[A-Z]{1}[A-Z0-9]{4}[A-Z0-9挂学警港澳]{1}$'
    },
    {
      id: 1,
      title: '银行卡号(简单10-19位)',
      reg: '^[1-9]\\d{9,18}$'
    },
  ]
})

// src/components/Tools/RegTest/RegTest.vue （在 info 定义后增加）
const cmOptions = {
  mode: "text/plain",
  lineNumbers: true,
  theme: "default",
  indentUnit: 2,
  tabSize: 2,
  lineWrapping: true,
  foldGutter: true,
  gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"]
}

//使用正则
const useReg = (reg: string) => {
  info.reg = reg
}

const clearOldRes = () => {
  info.matchNum = 0
  info.matchRes = ''
}

//测试匹配(执行匹配)
const execMatch = () => {
  //清除旧结果
  clearOldRes()
  //check
  if (info.reg == '') {
    return
  }
  
  let rule = ''
  //是否全局
  rule = info.isAll === true ? 'g' : ''
  //是否区分大小写
  rule += info.isCase === true ? 'i' : ''

  let pattern = new RegExp(info.reg, rule);
  let matchArr = info.content.match(pattern)
  
  if (info.isAll === true) {
    if (matchArr?.length) {
      info.matchNum = matchArr?.length
      for (let index in matchArr) {
        info.matchRes += matchArr[index] + `\n`
      }
    }
  } else {
    if (matchArr?.[0]) {
      info.matchRes = matchArr[0]
      info.matchNum = 1
    }
  }
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white ">
      <div>
        <Codemirror
          v-model:value="info.content"
          :options="cmOptions"
          border
          height="300"
          width="100%"
          placeholder="这里输入要匹配的文本..."
        />
      </div>

      <div class="mt-4">
        <el-text class="font-bold">常用正则：</el-text>
        <ul class="flex flex-wrap">
          <li v-for="(item, index) in info.regList" :key="index">
            <el-button link type="primary" @click="useReg(item.reg)" class="mr-2 mt-2">{{ item.title }}</el-button>
          </li>
        </ul>
        <div class="flex items-center mt-4">
          <el-input v-model="info.reg" class="mr-2" placeholder="正则表达式"></el-input>
          
          <div class="mr-2">
            <el-checkbox v-model="info.isAll" label="全局搜索" size="large"/>
          </div>
          <div class="mr-2">
            <el-checkbox v-model="info.isCase" label="忽略大小写" size="large" /> 
          </div>

          <el-button type="primary" @click="execMatch">测试匹配</el-button>
        </div>
      </div>

      <div class="mt-3 min-h-md bg-gray-100 p-3 mb-3">
        <el-text>共找到 {{ info.matchNum }} 处匹配结果</el-text>
        <el-input type="textarea" :rows="4" readonly v-model="info.matchRes"></el-input>
      </div>
    </div>

    <!-- desc -->
    <ToolDetail title="描述">
      <div class="text-sm leading-7">
        <p class="font-bold">使用方式</p>
        <p>1) 在上方输入“待匹配文本”和“正则表达式”，可勾选“全局搜索(g)”与“忽略大小写(i)”。</p>
        <p>2) 点击“测试匹配”后，匹配到的结果与次数会显示在下方。</p>
        <p>3) 也可点击“常用正则”快速填充示例。</p>
        <br>
        <p class="font-bold">语法速查</p>
        <ul class="list-disc ml-5">
          <li>元字符：<code>.</code> 任意字符，<code>\\d</code> 数字，<code>\\w</code> 字母数字下划线，<code>\\s</code> 空白</li>
          <li>边界：<code>^</code> 开头，<code>$</code> 结尾，<code>\\b</code> 单词边界</li>
          <li>量词：<code>*</code> 0+，<code>+</code> 1+，<code>?</code> 0/1，<code>{m,n}</code> 区间（加 <code>?</code> 为惰性）</li>
          <li>分组与引用：<code>(...)</code> 捕获组，<code>(?:...)</code> 非捕获组，<code>\\1</code> 反向引用</li>
          <li>命名捕获：<code>(?&lt;name&gt;...)</code>，前瞻/否定：<code>(?=...)</code>/<code>(?!...)</code>，后顾/否定：<code>(?&lt;=...)</code>/<code>(?&lt;!...)</code></li>
          <li>标志位：<code>g</code> 全局，<code>i</code> 忽略大小写，<code>m</code> 多行，<code>s</code> 点号匹配换行，<code>u</code> Unicode，<code>y</code> 粘连</li>
        </ul>
        <br>
        <p class="font-bold">JS 常用用法</p>
        <ul class="list-disc ml-5">
          <li><code>const re = /pattern/gi</code> 或 <code>new RegExp('pattern','gi')</code></li>
          <li><code>re.test(str)</code>、<code>str.match(re)</code>、<code>[...str.matchAll(re)]</code></li>
          <li><code>str.replace(re, replacer)</code>、<code>str.split(re)</code></li>
        </ul>
      </div>
    </ToolDetail>

  </div>
</template>

<style scoped>
</style>