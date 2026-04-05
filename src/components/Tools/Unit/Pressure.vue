<script setup lang="ts">
import { reactive } from 'vue'

const info: {
  [key: string]: string|number
} = reactive({
  pa: 1,
  hpa: 0.01,
  kpa: 0.001,
  mpa: 0.000001,
  bar: 0.00001,
  torr: 0.00750062,
  psi: 0.00014504,
})

const clear = () => {
  for (let item in info) {
    info[item] = ''
  }
}

const onInput = (key: string) => {
  const val = parseFloat(info[key] as string)
  if (isNaN(val)) return

  let paVal = 0
  switch (key) {
    case 'pa': paVal = val; break
    case 'hpa': paVal = val * 100; break
    case 'kpa': paVal = val * 1000; break
    case 'mpa': paVal = val * 1000000; break
    case 'bar': paVal = val * 100000; break
    case 'torr': paVal = val * 133.322368; break
    case 'psi': paVal = val * 6894.76; break
  }

  info.pa = paVal
  info.hpa = paVal / 100
  info.kpa = paVal / 1000
  info.mpa = paVal / 1000000
  info.bar = paVal / 100000
  info.torr = paVal / 133.322368
  info.psi = paVal / 6894.76
}
</script>

<template>
    <div>
      <div>
        <el-divider content-position="left">压力单位</el-divider>
        <!-- group -->
        <div class="custom-box">
          <div class="custom-box-single">
            <el-text class="custom-box-text">帕(Pa)</el-text>
            <el-input
              v-model="info.pa"
              placeholder=""
              class="input-with-select"
              @input="onInput('pa')"
            />
          </div>
          <div class="custom-box-single">
            <el-text class="custom-box-text">百帕(hPa)</el-text>
            <el-input
              v-model="info.hpa"
              placeholder=""
              class="input-with-select"
              @input="onInput('hpa')"
            />
          </div>
        </div>

        <!-- group -->
        <div class="custom-box">
          <div class="custom-box-single">
            <el-text class="custom-box-text">千帕(kPa)</el-text>
            <el-input
              v-model="info.kpa"
              placeholder=""
              class="input-with-select"
              @input="onInput('kpa')"
            />
          </div>
          <div class="custom-box-single">
            <el-text class="custom-box-text">兆帕(MPa)</el-text>
            <el-input
              v-model="info.mpa"
              placeholder=""
              class="input-with-select"
              @input="onInput('mpa')"
            />
          </div>
        </div>

        <!-- group -->
        <div class="custom-box">
          <div class="custom-box-single">
            <el-text class="custom-box-text">巴(bar)</el-text>
            <el-input
              v-model="info.bar"
              placeholder=""
              class="input-with-select"
              @input="onInput('bar')"
            />
          </div>
          <div class="custom-box-single">
            <el-text class="custom-box-text">托(torr)</el-text>
            <el-input
              v-model="info.torr"
              placeholder=""
              class="input-with-select"
              @input="onInput('torr')"
            />
          </div>
        </div>

        <!-- group -->
        <div class="custom-box">
          <div class="custom-box-single">
            <el-text class="custom-box-text" style="font-size: 0.8rem;;">磅力/平方英寸(psi)</el-text>
            <el-input
              v-model="info.psi"
              placeholder=""
              class="input-with-select"
              @input="onInput('psi')"
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
