<script setup lang="ts">
import { reactive } from 'vue'

const info: {
  [key: string]: string|number
} = reactive({
  wh: 1,
  mmwh: 1000,
  kwh: 0.001,
  mwh: 0.000001,
  j: 3600,
  kj: 3.6,
})

const clear = () => {
  for (let item in info) {
    info[item] = ''
  }
}

const onInput = (key: string) => {
  const val = parseFloat(info[key] as string)
  if (isNaN(val)) return

  let whVal = 0
  switch (key) {
    case 'wh': whVal = val; break
    case 'mmwh': whVal = val * 0.001; break
    case 'kwh': whVal = val * 1000; break
    case 'mwh': whVal = val * 1000000; break
    case 'j': whVal = val * 0.0002777777777777778; break
    case 'kj': whVal = val * 0.2777777777777778; break
  }

  info.wh = whVal
  info.mmwh = whVal / 0.001
  info.kwh = whVal / 1000
  info.mwh = whVal / 1000000
  info.j = whVal / 0.0002777777777777778
  info.kj = info.j / 1000
}
</script>

<template>
    <div>
      <div>
        <el-divider content-position="left">热量单位</el-divider>
        <!-- group -->
        <div class="custom-box">
          <div class="custom-box-single">
            <el-text class="custom-box-text">瓦时(Wh)</el-text>
            <el-input
              v-model="info.wh"
              placeholder=""
              class="input-with-select"
              @input="onInput('wh')"
            />
          </div>
          <div class="custom-box-single">
            <el-text class="custom-box-text">毫瓦时(mWh)</el-text>
            <el-input
              v-model="info.mmwh"
              placeholder=""
              class="input-with-select"
              @input="onInput('mmwh')"
            />
          </div>
        </div>

        <!-- group -->
        <div class="custom-box">
          <div class="custom-box-single">
            <el-text class="custom-box-text">千瓦时(kWh)</el-text>
            <el-input
              v-model="info.kwh"
              placeholder=""
              class="input-with-select"
              @input="onInput('kwh')"
            />
          </div>
          <div class="custom-box-single">
            <el-text class="custom-box-text">兆瓦时(MWh)</el-text>
            <el-input
              v-model="info.mwh"
              placeholder=""
              class="input-with-select"
              @input="onInput('mwh')"
            />
          </div>
        </div>

        <!-- group -->
        <div class="custom-box">
          <div class="custom-box-single">
            <el-text class="custom-box-text">焦(J)</el-text>
            <el-input
              v-model="info.j"
              placeholder=""
              class="input-with-select"
              @input="onInput('j')"
            />
          </div>
          <div class="custom-box-single">
            <el-text class="custom-box-text">千焦(kJ)</el-text>
            <el-input
              v-model="info.kj"
              placeholder=""
              class="input-with-select"
              @input="onInput('kj')"
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
