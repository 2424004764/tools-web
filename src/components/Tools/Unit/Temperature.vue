<script setup lang="ts">
import { reactive } from 'vue'

const info: {
  [key: string]: string|number
} = reactive({
  c: 1,
  f: 33.8,
  k: 274.15,
  re: 0.8,
  r: 493.47,
})

const clear = () => {
  for (let item in info) {
    info[item] = ''
  }
}

const onInput = (key: string) => {
  const val = parseFloat(info[key] as string)
  if (isNaN(val)) return

  let cVal = 0
  switch (key) {
    case 'c': cVal = val; break
    case 'f': cVal = (val - 32) / 1.8; break
    case 'k': cVal = val - 273.15; break
    case 're': cVal = val * 1.25; break
    case 'r': cVal = (val - 491.67) / 1.8; break
  }

  info.c = cVal
  info.f = 32 + (cVal * 1.8)
  info.k = 273.15 + cVal
  info.re = cVal / 1.25
  info.r = (cVal + 273.15) * 1.8
}
</script>

<template>
    <div>
      <div>
        <el-divider content-position="left">国际温度单位</el-divider>
        <!-- group -->
        <div class="custom-box">
          <div class="custom-box-single">
            <el-text class="custom-box-text">摄氏度(℃)</el-text>
            <el-input
              v-model="info.c"
              placeholder=""
              class="input-with-select"
              @input="onInput('c')"
            />
          </div>
          <div class="custom-box-single">
            <el-text class="custom-box-text">华氏度(℉)</el-text>
            <el-input
              v-model="info.f"
              placeholder=""
              class="input-with-select"
              @input="onInput('f')"
            />
          </div>
        </div>

        <!-- group -->
        <div class="custom-box">
          <div class="custom-box-single">
            <el-text class="custom-box-text">开氏度(K)</el-text>
            <el-input
              v-model="info.k"
              placeholder=""
              class="input-with-select"
              @input="onInput('k')"
            />
          </div>
          <div class="custom-box-single">
            <el-text class="custom-box-text">列氏度(°Re)</el-text>
            <el-input
              v-model="info.re"
              placeholder=""
              class="input-with-select"
              @input="onInput('re')"
            />
          </div>
        </div>

        <!-- group -->
        <div class="custom-box">
          <div class="custom-box-single">
            <el-text class="custom-box-text">兰氏度(°R)</el-text>
            <el-input
              v-model="info.r"
              placeholder=""
              class="input-with-select"
              @input="onInput('r')"
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
