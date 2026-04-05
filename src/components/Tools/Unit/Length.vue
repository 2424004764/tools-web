<script setup lang="ts">
import { reactive } from 'vue'

const lengthInfo: {
  [key: string]: string|number
} = reactive({
  km: 1,
  m: 1000,
  dm: 10000,
  cm: 100000,
  mm: 1000000,
  dmm: 10000000,
  um: 1000000000,
  nm: 1000000000000,
  tradition_li: 2,
  tradition_zhang: 3000,
  tradition_chi: 3000,
  tradition_cun: 30000,
  tradition_fen: 300000,
  tradition_mill: 3000000,
  tradition_hao: 30000000,
  eng_nmi: 0.539956803,
  eng_fm: 539.9568035,
  eng_mi: 0.621371192,
  eng_fur: 4.970969538,
  eng_yd: 1093.613298,
  eng_ft: 3280.839895,
  eng_in: 39370.07874,
})

const clear = () => {
  for (let item in lengthInfo) {
    lengthInfo[item] = ''
  }
}

const onInput = (key: string) => {
  const val = parseFloat(lengthInfo[key] as string)
  if (isNaN(val)) return

  // 转换成米
  let mVal = 0
  let chiVal = 0
  let engFtVal = 0

  switch (key) {
    case 'km': mVal = val * 1000; break
    case 'm': mVal = val; break
    case 'dm': mVal = val * 0.1; break
    case 'cm': mVal = val * 0.01; break
    case 'mm': mVal = val * 0.001; break
    case 'dmm': mVal = val * 0.0001; break
    case 'um': mVal = val * 0.000001; break
    case 'nm': mVal = val * 0.000000001; break
    case 'tradition_li': mVal = val * 500; chiVal = val * 1500; break
    case 'tradition_zhang': mVal = val * 3.3333333; chiVal = val * 10; break
    case 'tradition_chi': mVal = val * 0.3; chiVal = val; break
    case 'tradition_cun': mVal = val * 0.03; chiVal = val * 0.1; break
    case 'tradition_fen': mVal = val * 0.003; chiVal = val * 0.01; break
    case 'tradition_mill': mVal = val * 0.0003; chiVal = val * 0.001; break
    case 'tradition_hao': mVal = val * 0.00003; chiVal = val * 0.0001; break
    case 'eng_nmi': mVal = val * 1852; break
    case 'eng_fm': mVal = val * 1.852; engFtVal = val * 6; break
    case 'eng_mi': mVal = val * 1609.344; engFtVal = val * 5280; break
    case 'eng_fur': mVal = val * 201.168; engFtVal = val * 660; break
    case 'eng_yd': mVal = val * 0.9144; engFtVal = val * 3; break
    case 'eng_ft': mVal = val * 0.3048; engFtVal = val; break
    case 'eng_in': mVal = val * 0.0254; break
  }

  // 中国传统单位处理
  if (!chiVal) chiVal = mVal * 3
  // 英制处理
  if (!engFtVal) engFtVal = mVal / 0.3048

  // 米转换成其他单位
  lengthInfo.km = mVal / 1000
  lengthInfo.m = mVal
  lengthInfo.dm = mVal * 10
  lengthInfo.cm = mVal * 100
  lengthInfo.mm = mVal * 1000
  lengthInfo.dmm = mVal * 10000
  lengthInfo.um = mVal * 1000000
  lengthInfo.nm = mVal * 1000000000
  lengthInfo.tradition_li = mVal / 500
  lengthInfo.tradition_chi = chiVal
  lengthInfo.tradition_zhang = chiVal / 10
  lengthInfo.tradition_cun = chiVal * 10
  lengthInfo.tradition_fen = chiVal * 100
  lengthInfo.tradition_mill = chiVal * 1000
  lengthInfo.tradition_hao = chiVal * 10000
  lengthInfo.eng_nmi = mVal / 1852
  lengthInfo.eng_ft = engFtVal
  lengthInfo.eng_fm = engFtVal / 6
  lengthInfo.eng_mi = engFtVal / 5280
  lengthInfo.eng_fur = engFtVal / 660
  lengthInfo.eng_yd = engFtVal / 3
  lengthInfo.eng_in = engFtVal * 12
}

// 移除 tran 函数，统一用 onInput
</script>

<template>
    <div>
      <div>
        <el-divider content-position="left">国际长度单位(公制)</el-divider>
        <!-- group -->
        <div class="custom-box">
          <div class="custom-box-single">
            <el-text class="custom-box-text">公里(km)</el-text>
            <el-input
              v-model="lengthInfo.km"
              placeholder=""
              class="input-with-select"
              @input="onInput('km')"
            />
          </div>
          <div class="custom-box-single">
            <el-text class="custom-box-text">米(m)</el-text>
            <el-input
              v-model="lengthInfo.m"
              placeholder=""
              class="input-with-select"
              @input="onInput('m')"
            />
          </div>
        </div>
        <!-- group -->
        <div class="custom-box">
          <div class="custom-box-single">
            <el-text class="custom-box-text">分米(dm)</el-text>
            <el-input
              v-model="lengthInfo.dm"
              placeholder=""
              class="input-with-select"
              @input="onInput('dm')"
            />
          </div>
          <div class="custom-box-single">
            <el-text class="custom-box-text">厘米(cm)</el-text>
            <el-input
              v-model="lengthInfo.cm"
              placeholder=""
              class="input-with-select"
              @input="onInput('cm')"
            />
          </div>
        </div>
        <!-- group -->
        <div class="custom-box">
          <div class="custom-box-single">
            <el-text class="custom-box-text">毫米(mm)</el-text>
            <el-input
              v-model="lengthInfo.mm"
              placeholder=""
              class="input-with-select"
              @input="onInput('mm')"
            />
          </div>
          <div class="custom-box-single">
            <el-text class="custom-box-text">丝(dmm)</el-text>
            <el-input
              v-model="lengthInfo.dmm"
              placeholder=""
              class="input-with-select"
              @input="onInput('dmm')"
            />
          </div>
        </div>
        <!-- group -->
        <div class="custom-box">
          <div class="custom-box-single">
            <el-text class="custom-box-text">微米(um)</el-text>
            <el-input
              v-model="lengthInfo.um"
              placeholder=""
              class="input-with-select"
              @input="onInput('um')"
            />
          </div>
          <div class="custom-box-single">
            <el-text class="custom-box-text">纳米(nm)</el-text>
            <el-input
              v-model="lengthInfo.nm"
              placeholder=""
              class="input-with-select"
              @input="onInput('nm')"
            />
          </div>
        </div>
        <el-divider content-position="left">中国传统长度单位(市制)</el-divider>
        <!-- group -->
        <div class="custom-box">
          <div class="custom-box-single">
            <el-text class="custom-box-text">里</el-text>
            <el-input
              v-model="lengthInfo.tradition_li"
              placeholder=""
              class="input-with-select"
              @input="onInput('tradition_li')"
            />
          </div>
          <div class="custom-box-single">
            <el-text class="custom-box-text">丈</el-text>
            <el-input
              v-model="lengthInfo.tradition_zhang"
              placeholder=""
              class="input-with-select"
              @input="onInput('tradition_zhang')"
            />
          </div>
        </div>
        <!-- group -->
        <div class="custom-box">
          <div class="custom-box-single">
            <el-text class="custom-box-text">尺</el-text>
            <el-input
              v-model="lengthInfo.tradition_chi"
              placeholder=""
              class="input-with-select"
              @input="onInput('tradition_chi')"
            />
          </div>
          <div class="custom-box-single">
            <el-text class="custom-box-text">寸</el-text>
            <el-input
              v-model="lengthInfo.tradition_cun"
              placeholder=""
              class="input-with-select"
              @input="onInput('tradition_cun')"
            />
          </div>
        </div>
        <!-- group -->
        <div class="custom-box">
          <div class="custom-box-single">
            <el-text class="custom-box-text">分</el-text>
            <el-input
              v-model="lengthInfo.tradition_fen"
              placeholder=""
              class="input-with-select"
              @input="onInput('tradition_fen')"
            />
          </div>
          <div class="custom-box-single">
            <el-text class="custom-box-text">厘</el-text>
            <el-input
              v-model="lengthInfo.tradition_mill"
              placeholder=""
              class="input-with-select"
              @input="onInput('tradition_mill')"
            />
          </div>
        </div>
        <!-- group -->
        <div class="custom-box">
          <div class="custom-box-single">
            <el-text class="custom-box-text">毫</el-text>
            <el-input
              v-model="lengthInfo.tradition_hao"
              placeholder=""
              class="input-with-select"
              @input="onInput('tradition_hao')"
            />
          </div>
        </div>
        <el-divider content-position="left">英制长度单位</el-divider>
        <!-- group -->
        <div class="custom-box">
          <div class="custom-box-single">
            <el-text class="custom-box-text">海里(nmi)</el-text>
            <el-input
              v-model="lengthInfo.eng_nmi"
              placeholder=""
              class="input-with-select"
              @input="onInput('eng_nmi')"
            />
          </div>
          <div class="custom-box-single">
            <el-text class="custom-box-text">英寻(fm)</el-text>
            <el-input
              v-model="lengthInfo.eng_fm"
              placeholder=""
              class="input-with-select"
              @input="onInput('eng_fm')"
            />
          </div>
        </div>
        <!-- group -->
        <div class="custom-box">
          <div class="custom-box-single">
            <el-text class="custom-box-text">英里(mi)</el-text>
            <el-input
              v-model="lengthInfo.eng_mi"
              placeholder=""
              class="input-with-select"
              @input="onInput('eng_mi')"
            />
          </div>
          <div class="custom-box-single">
            <el-text class="custom-box-text">弗隆(fur)</el-text>
            <el-input
              v-model="lengthInfo.eng_fur"
              placeholder=""
              class="input-with-select"
              @input="onInput('eng_fur')"
            />
          </div>
        </div>
        <!-- group -->
        <div class="custom-box">
          <div class="custom-box-single">
            <el-text class="custom-box-text">码(yd)</el-text>
            <el-input
              v-model="lengthInfo.eng_yd"
              placeholder=""
              class="input-with-select"
              @input="onInput('eng_yd')"
            />
          </div>
          <div class="custom-box-single">
            <el-text class="custom-box-text">英尺(ft)</el-text>
            <el-input
              v-model="lengthInfo.eng_ft"
              placeholder=""
              class="input-with-select"
              @input="onInput('eng_ft')"
            />
          </div>
        </div>
        <!-- group -->
        <div class="custom-box">
          <div class="custom-box-single">
            <el-text class="custom-box-text">英寸(in)</el-text>
            <el-input
              v-model="lengthInfo.eng_in"
              placeholder=""
              class="input-with-select"
              @input="onInput('eng_in')"
            />
          </div>
        </div>
      </div>

      <div class="w-full text-center">
        <el-button type="primary" @click="clear">清除全部</el-button>
      </div>
    </div>
</template>

<style scoped>
.custom-box{
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.75rem/* 12px */;
}
.custom-box-single{
  display: flex;
  width: 45%;
}
.custom-box-text{
  text-align: center;
  width: 5rem/* 80px */;
}
</style>