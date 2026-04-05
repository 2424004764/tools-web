<script setup lang="ts">
import { reactive } from 'vue'

const lengthInfo: {
  [key: string]: string|number
} = reactive({
  km: 1,
  m: 1000000,
  dm: 100000000,
  cm: 10000000000,
  mm: 1000000000000,
  ha: 100,
  tradition_mu: 1500,
  tradition_fen: 15000,
  tradition_mill: 150000,
  tradition_hao: 1500000,
  eng_nmi: 0.29155335,
  eng_mi: 0.38610216,
  eng_acre: 247.10538,
  eng_rd: 39536.861,
  eng_yd: 1195990.046,
  eng_ft: 10763910.417,
  eng_in: 1550003100.006,
})

const clear = () => {
  for (let item in lengthInfo) {
    lengthInfo[item] = ''
  }
}

const onInput = (key: string) => {
  const val = parseFloat(lengthInfo[key] as string)
  if (isNaN(val)) return

  let mVal = 0
  let muVal = 0
  let engFtVal = 0

  switch (key) {
    case 'km': mVal = val * 1000000; break
    case 'm': mVal = val; break
    case 'dm': mVal = val * 0.01; break
    case 'cm': mVal = val * 0.0001; break
    case 'mm': mVal = val * 0.000001; break
    case 'ha': mVal = val * 10000; break
    case 'tradition_mu': mVal = val * 666.6666667; muVal = val; break
    case 'tradition_fen': mVal = val * 66.67; muVal = val * 0.1; break
    case 'tradition_mill': mVal = val * 6.67; muVal = val * 0.01; break
    case 'tradition_hao': mVal = val * 0.67; muVal = val * 0.001; break
    case 'eng_nmi': mVal = val * (1852 * 1852); break
    case 'eng_mi': mVal = val * 2589988.110336; engFtVal = val * 27878400; break
    case 'eng_acre': mVal = val * 4046.8564224; engFtVal = val * 43560; break
    case 'eng_rd': mVal = val * 25.2928526; engFtVal = val * 272.25; break
    case 'eng_yd': mVal = val * 0.8361274; engFtVal = val * 9; break
    case 'eng_ft': mVal = val * 0.092903; engFtVal = val; break
    case 'eng_in': mVal = val * 0.0006452; engFtVal = val * 0.0069444; break
  }

  if (!muVal) muVal = mVal * 0.0015
  if (!engFtVal) engFtVal = mVal / 0.092903

  lengthInfo.km = mVal * 0.000001
  lengthInfo.m = mVal
  lengthInfo.dm = mVal * 100
  lengthInfo.cm = mVal * 10000
  lengthInfo.mm = mVal * 1000000
  lengthInfo.ha = mVal * 0.0001
  lengthInfo.tradition_mu = muVal
  lengthInfo.tradition_fen = muVal * 10
  lengthInfo.tradition_mill = muVal * 100
  lengthInfo.tradition_hao = muVal * 1000
  lengthInfo.eng_nmi = mVal / (1852 * 1852)
  lengthInfo.eng_mi = engFtVal / 27878400
  lengthInfo.eng_acre = engFtVal / 43560
  lengthInfo.eng_rd = engFtVal / 272.25
  lengthInfo.eng_yd = engFtVal / 9
  lengthInfo.eng_ft = engFtVal
  lengthInfo.eng_in = engFtVal / 0.0069444
}
</script>

<template>
    <div>
      <div>
        <el-divider content-position="left">国际面积单位(公制)</el-divider>
        <!-- group -->
        <div class="custom-box">
          <div class="custom-box-single">
            <el-text class="custom-box-text">平方千米(km<sup>2</sup>)</el-text>
            <el-input
              v-model="lengthInfo.km"
              placeholder=""
              class="input-with-select"
              @input="onInput('km')"
            />
          </div>
          <div class="custom-box-single">
            <el-text class="custom-box-text">平方米(m<sup>2</sup>)</el-text>
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
            <el-text class="custom-box-text">平方分米(dm<sup>2</sup>)</el-text>
            <el-input
              v-model="lengthInfo.dm"
              placeholder=""
              class="input-with-select"
              @input="onInput('dm')"
            />
          </div>
          <div class="custom-box-single">
            <el-text class="custom-box-text">平方厘米(cm<sup>2</sup>)</el-text>
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
            <el-text class="custom-box-text">平方毫米(mm<sup>2</sup>)</el-text>
            <el-input
              v-model="lengthInfo.mm"
              placeholder=""
              class="input-with-select"
              @input="onInput('mm')"
            />
          </div>
          <div class="custom-box-single">
            <el-text class="custom-box-text">公顷(ha)</el-text>
            <el-input
              v-model="lengthInfo.ha"
              placeholder=""
              class="input-with-select"
              @input="onInput('ha')"
            />
          </div>
        </div>
        <el-divider content-position="left">中国传统面积单位(市制)</el-divider>
        <!-- group -->
        <div class="custom-box">
          <div class="custom-box-single">
            <el-text class="custom-box-text">亩</el-text>
            <el-input
              v-model="lengthInfo.tradition_mu"
              placeholder=""
              class="input-with-select"
              @input="onInput('tradition_mu')"
            />
          </div>
          <div class="custom-box-single">
            <el-text class="custom-box-text">分</el-text>
            <el-input
              v-model="lengthInfo.tradition_fen"
              placeholder=""
              class="input-with-select"
              @input="onInput('tradition_fen')"
            />
          </div>
        </div>
        <!-- group -->
        <div class="custom-box">
          <div class="custom-box-single">
            <el-text class="custom-box-text">厘</el-text>
            <el-input
              v-model="lengthInfo.tradition_mill"
              placeholder=""
              class="input-with-select"
              @input="onInput('tradition_mill')"
            />
          </div>
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
        <el-divider content-position="left">英制面积单位</el-divider>
        <!-- group -->
        <div class="custom-box">
          <div class="custom-box-single">
            <el-text class="custom-box-text">平方海里(nmi<sup>2</sup>)</el-text>
            <el-input
              v-model="lengthInfo.eng_nmi"
              placeholder=""
              class="input-with-select"
              @input="onInput('eng_nmi')"
            />
          </div>
          <div class="custom-box-single">
            <el-text class="custom-box-text">平方英里(mi<sup>2</sup>)</el-text>
            <el-input
              v-model="lengthInfo.eng_mi"
              placeholder=""
              class="input-with-select"
              @input="onInput('eng_mi')"
            />
          </div>
        </div>
        <!-- group -->
        <div class="custom-box">
          <div class="custom-box-single">
            <el-text class="custom-box-text">英亩(acre)</el-text>
            <el-input
              v-model="lengthInfo.eng_acre"
              placeholder=""
              class="input-with-select"
              @input="onInput('eng_acre')"
            />
          </div>
          <div class="custom-box-single">
            <el-text class="custom-box-text">平方竿(rd<sup>2</sup>)</el-text>
            <el-input
              v-model="lengthInfo.eng_rd"
              placeholder=""
              class="input-with-select"
              @input="onInput('eng_rd')"
            />
          </div>
        </div>
        <!-- group -->
        <div class="custom-box">
          <div class="custom-box-single">
            <el-text class="custom-box-text">平方码(yd<sup>2</sup>)</el-text>
            <el-input
              v-model="lengthInfo.eng_yd"
              placeholder=""
              class="input-with-select"
              @input="onInput('eng_yd')"
            />
          </div>
          <div class="custom-box-single">
            <el-text class="custom-box-text">平方英尺(ft<sup>2</sup>)</el-text>
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
            <el-text class="custom-box-text">平方英寸(in<sup>2</sup>)</el-text>
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
  width: 50%;
}
.custom-box-text{
  text-align: center;
  width: 10rem;
}
</style>
