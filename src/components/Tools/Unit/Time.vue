<script setup lang="ts">
import { reactive } from 'vue'

const info: {
  [key: string]: string|number
} = reactive({
  year: 1,
  month: 12,
  d: 365,
  h: 8760,
  min: 525600,
  s: 31536000,
  ms: 31536000000,
  week: 52.14285714,
})

const clear = () => {
  for (let item in info) {
    info[item] = ''
  }
}

const onInput = (key: string) => {
  const val = parseFloat(info[key] as string)
  if (isNaN(val)) return

  let sVal = 0
  switch (key) {
    case 'year': sVal = val * 31536000; break
    case 'month': sVal = val * 2629800; break
    case 'd': sVal = val * 86400; break
    case 'h': sVal = val * 3600; break
    case 'min': sVal = val * 60; break
    case 's': sVal = val; break
    case 'ms': sVal = val * 0.001; break
    case 'week': sVal = val * 604800; break
  }

  info.year = sVal / 31536000
  info.month = info.year * 12
  info.d = sVal / 86400
  info.h = sVal / 3600
  info.min = sVal / 60
  info.s = sVal
  info.ms = sVal / 0.001
  info.week = sVal / 604800
}
</script>

<template>
    <div>
      <div>
        <el-divider content-position="left">国际时间单位</el-divider>
        <!-- group -->
        <div class="custom-box">
          <div class="custom-box-single">
            <el-text class="custom-box-text">年(year)</el-text>
            <el-input
              v-model="info.year"
              placeholder=""
              class="input-with-select"
              @input="onInput('year')"
            />
          </div>
          <div class="custom-box-single">
            <el-text class="custom-box-text">月(month)</el-text>
            <el-input
              v-model="info.month"
              placeholder=""
              class="input-with-select"
              @input="onInput('month')"
            />
          </div>
        </div>

        <!-- group -->
        <div class="custom-box">
          <div class="custom-box-single">
            <el-text class="custom-box-text">日(d)</el-text>
            <el-input
              v-model="info.d"
              placeholder=""
              class="input-with-select"
              @input="onInput('d')"
            />
          </div>
          <div class="custom-box-single">
            <el-text class="custom-box-text">时(h)</el-text>
            <el-input
              v-model="info.h"
              placeholder=""
              class="input-with-select"
              @input="onInput('h')"
            />
          </div>
        </div>

        <!-- group -->
        <div class="custom-box">
          <div class="custom-box-single">
            <el-text class="custom-box-text">分(min)</el-text>
            <el-input
              v-model="info.min"
              placeholder=""
              class="input-with-select"
              @input="onInput('min')"
            />
          </div>
          <div class="custom-box-single">
            <el-text class="custom-box-text">秒(s)</el-text>
            <el-input
              v-model="info.s"
              placeholder=""
              class="input-with-select"
              @input="onInput('s')"
            />
          </div>
        </div>

        <!-- group -->
        <div class="custom-box">
          <div class="custom-box-single">
            <el-text class="custom-box-text">毫秒(ms)</el-text>
            <el-input
              v-model="info.ms"
              placeholder=""
              class="input-with-select"
              @input="onInput('ms')"
            />
          </div>
          <div class="custom-box-single">
            <el-text class="custom-box-text">周(week)</el-text>
            <el-input
              v-model="info.week"
              placeholder=""
              class="input-with-select"
              @input="onInput('week')"
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
