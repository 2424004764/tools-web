<script setup lang="ts">
import { reactive } from 'vue'

const info: {
  [key: string]: string|number
} = reactive({
  w: 1,
  mmw: 1000,
  kw: 0.001,
  mw: 0.000001,
  gw: 0.000000001,
})

const clear = () => {
  for (let item in info) {
    info[item] = ''
  }
}

const onInput = (key: string) => {
  const val = parseFloat(info[key] as string)
  if (isNaN(val)) return

  let wVal = 0
  switch (key) {
    case 'w': wVal = val; break
    case 'mmw': wVal = val * 0.001; break
    case 'kw': wVal = val * 1000; break
    case 'mw': wVal = val * 1000000; break
    case 'gw': wVal = val * 1000000000; break
  }

  info.w = wVal
  info.mmw = wVal / 0.001
  info.kw = wVal / 1000
  info.mw = wVal / 1000000
  info.gw = wVal / 1000000000
}
</script>

<template>
    <div>
      <div>
        <el-divider content-position="left">功率单位</el-divider>
        <!-- group -->
        <div class="custom-box">
          <div class="custom-box-single">
            <el-text class="custom-box-text">瓦(W)</el-text>
            <el-input
              v-model="info.w"
              placeholder=""
              class="input-with-select"
              @input="onInput('w')"
            />
          </div>
          <div class="custom-box-single">
            <el-text class="custom-box-text">毫瓦(mW)</el-text>
            <el-input
              v-model="info.mmw"
              placeholder=""
              class="input-with-select"
              @input="onInput('mmw')"
            />
          </div>
        </div>

        <!-- group -->
        <div class="custom-box">
          <div class="custom-box-single">
            <el-text class="custom-box-text">千瓦(kW)</el-text>
            <el-input
              v-model="info.kw"
              placeholder=""
              class="input-with-select"
              @input="onInput('kw')"
            />
          </div>
          <div class="custom-box-single">
            <el-text class="custom-box-text">兆瓦(MW)</el-text>
            <el-input
              v-model="info.mw"
              placeholder=""
              class="input-with-select"
              @input="onInput('mw')"
            />
          </div>
        </div>

        <!-- group -->
        <div class="custom-box">
          <div class="custom-box-single">
            <el-text class="custom-box-text">亿瓦(GW)</el-text>
            <el-input
              v-model="info.gw"
              placeholder=""
              class="input-with-select"
              @input="onInput('gw')"
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
