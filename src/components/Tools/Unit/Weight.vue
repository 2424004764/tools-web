<script setup lang="ts">
import { reactive } from 'vue'

const info: {
  [key: string]: string|number
} = reactive({
  t: 1,
  kg: 1000,
  g: 1000000,
  mg: 1000000000,
  jin: 2000,
  liang: 20000,
  qian: 200000,
  dan: 20,
  eng_lb: 2204.622622,
  eng_oz: 35273.96195,
  eng_st: 157.4730444,
  eng_cwt: 19.68413055,
  eng_dr: 564383.3912,
  eng_gr: 15432358.35,
  eng_lt: 0.984206528,
  eng_lbt: 2679.228881,
  eng_ozt: 32150.74657,
  eng_grain: 15432358.35,
  eng_dwt: 643014.9314,
})

const clear = () => {
  for (let item in info) {
    info[item] = ''
  }
}

const onInput = (key: string) => {
  const val = parseFloat(info[key] as string)
  if (isNaN(val)) return

  let gVal = 0
  let engLbVal = 0
  let engLbtVal = 0

  switch (key) {
    case 't': gVal = val * 1000000; break
    case 'kg': gVal = val * 1000; break
    case 'g': gVal = val; break
    case 'mg': gVal = val * 0.001; break
    case 'jin': gVal = val * 500; break
    case 'liang': gVal = val * 50; break
    case 'qian': gVal = val * 5; break
    case 'dan': gVal = val * 50000; break
    case 'eng_lb': gVal = val * 453.59237; engLbVal = val; break
    case 'eng_oz': gVal = val * 28.3495231; engLbVal = val * 0.0625; break
    case 'eng_st': gVal = val * 6350.29318; engLbVal = val * 14; break
    case 'eng_cwt': gVal = val * 50802.34544; engLbVal = val * 112; break
    case 'eng_dr': gVal = val * 1.7718452; engLbVal = val * 0.0039063; break
    case 'eng_gr': gVal = val * 0.0647989; engLbVal = val * 0.0001429; break
    case 'eng_lt': gVal = val * 1016046.9088; engLbVal = val * 2240; break
    case 'eng_lbt': gVal = val * 373.2417216; engLbtVal = val; break
    case 'eng_ozt': gVal = val * 31.1034768; engLbtVal = val * 0.0833333; break
    case 'eng_grain': gVal = val * 0.0647989; engLbtVal = val * 0.0001736; break
    case 'eng_dwt': gVal = val * 1.5551738; engLbtVal = val * 0.0041667; break
  }

  if (!engLbVal) engLbVal = gVal / 453.59237
  if (!engLbtVal) engLbtVal = gVal / 373.2417216

  info.t = gVal * 0.000001
  info.kg = gVal * 0.001
  info.g = gVal
  info.mg = gVal * 1000
  info.jin = gVal * 0.002
  info.liang = gVal * 0.02
  info.qian = gVal * 0.2
  info.dan = gVal * 0.00002
  info.eng_lb = engLbVal
  info.eng_oz = engLbVal * 16
  info.eng_st = engLbVal * 0.0714286
  info.eng_cwt = engLbVal * 0.0089286
  info.eng_dr = engLbVal * 256
  info.eng_gr = engLbVal * 7000
  info.eng_lt = engLbVal * 0.0004464
  info.eng_lbt = engLbtVal
  info.eng_ozt = engLbtVal * 12
  info.eng_grain = engLbtVal * 5760
  info.eng_dwt = engLbtVal * 240
}
</script>

<template>
    <div>
      <div>
        <el-divider content-position="left">国际重量单位(公制)</el-divider>
        <!-- group -->
        <div class="custom-box">
          <div class="custom-box-single">
            <el-text class="custom-box-text">吨(t)</el-text>
            <el-input
              v-model="info.t"
              placeholder=""
              class="input-with-select"
              @input="onInput('t')"
            />
          </div>
          <div class="custom-box-single">
            <el-text class="custom-box-text">千克/公斤(kg)</el-text>
            <el-input
              v-model="info.kg"
              placeholder=""
              class="input-with-select"
              @input="onInput('kg')"
            />
          </div>
        </div>
        <!-- group -->
        <div class="custom-box">
          <div class="custom-box-single">
            <el-text class="custom-box-text">克(g)</el-text>
            <el-input
              v-model="info.g"
              placeholder=""
              class="input-with-select"
              @input="onInput('g')"
            />
          </div>
          <div class="custom-box-single">
            <el-text class="custom-box-text">毫克(mg)</el-text>
            <el-input
              v-model="info.mg"
              placeholder=""
              class="input-with-select"
              @input="onInput('mg')"
            />
          </div>
        </div>

        <!-- ----- -->
        <el-divider content-position="left">中国传统重量单位(市制)</el-divider>
        <!-- group -->
        <div class="custom-box">
          <div class="custom-box-single">
            <el-text class="custom-box-text">斤</el-text>
            <el-input
              v-model="info.jin"
              placeholder=""
              class="input-with-select"
              @input="onInput('jin')"
            />
          </div>
          <div class="custom-box-single">
            <el-text class="custom-box-text">两</el-text>
            <el-input
              v-model="info.liang"
              placeholder=""
              class="input-with-select"
              @input="onInput('liang')"
            />
          </div>
        </div>
        <!-- group -->
        <div class="custom-box">
          <div class="custom-box-single">
            <el-text class="custom-box-text">钱</el-text>
            <el-input
              v-model="info.qian"
              placeholder=""
              class="input-with-select"
              @input="onInput('qian')"
            />
          </div>
          <div class="custom-box-single">
            <el-text class="custom-box-text">担</el-text>
            <el-input
              v-model="info.dan"
              placeholder=""
              class="input-with-select"
              @input="onInput('dan')"
            />
          </div>
        </div>

        <el-divider content-position="left">英制重量单位(常衡制)</el-divider>
        <!-- group -->
        <div class="custom-box">
          <div class="custom-box-single">
            <el-text class="custom-box-text">磅(lb)</el-text>
            <el-input
              v-model="info.eng_lb"
              placeholder=""
              class="input-with-select"
              @input="onInput('eng_lb')"
            />
          </div>
          <div class="custom-box-single">
            <el-text class="custom-box-text">盎司(oz)</el-text>
            <el-input
              v-model="info.eng_oz"
              placeholder=""
              class="input-with-select"
              @input="onInput('eng_oz')"
            />
          </div>
        </div>
        <!-- group -->
        <div class="custom-box">
          <div class="custom-box-single">
            <el-text class="custom-box-text">英石(st)</el-text>
            <el-input
              v-model="info.eng_st"
              placeholder=""
              class="input-with-select"
              @input="onInput('eng_st')"
            />
          </div>
          <div class="custom-box-single">
            <el-text class="custom-box-text">英担(cwt)</el-text>
            <el-input
              v-model="info.eng_cwt"
              placeholder=""
              class="input-with-select"
              @input="onInput('eng_cwt')"
            />
          </div>
        </div>
        <!-- group -->
        <div class="custom-box">
          <div class="custom-box-single">
            <el-text class="custom-box-text">打兰(dr)</el-text>
            <el-input
              v-model="info.eng_dr"
              placeholder=""
              class="input-with-select"
              @input="onInput('eng_dr')"
            />
          </div>
          <div class="custom-box-single">
            <el-text class="custom-box-text">格令(gr)</el-text>
            <el-input
              v-model="info.eng_gr"
              placeholder=""
              class="input-with-select"
              @input="onInput('eng_gr')"
            />
          </div>
        </div>
        <!-- group -->
        <div class="custom-box">
          <div class="custom-box-single">
            <el-text class="custom-box-text">长吨(lt)</el-text>
            <el-input
              v-model="info.eng_lt"
              placeholder=""
              class="input-with-select"
              @input="onInput('eng_lt')"
            />
          </div>
        </div>

        <el-divider content-position="left">英制重量单位(金衡制)</el-divider>
        <!-- group -->
        <div class="custom-box">
          <div class="custom-box-single">
            <el-text class="custom-box-text">磅(lbt)</el-text>
            <el-input
              v-model="info.eng_lbt"
              placeholder=""
              class="input-with-select"
              @input="onInput('eng_lbt')"
            />
          </div>
          <div class="custom-box-single">
            <el-text class="custom-box-text">盎司(ozt)</el-text>
            <el-input
              v-model="info.eng_ozt"
              placeholder=""
              class="input-with-select"
              @input="onInput('eng_ozt')"
            />
          </div>
        </div>
        <!-- group -->
        <div class="custom-box">
          <div class="custom-box-single">
            <el-text class="custom-box-text">格令</el-text>
            <el-input
              v-model="info.eng_grain"
              placeholder=""
              class="input-with-select"
              @input="onInput('eng_grain')"
            />
          </div>
          <div class="custom-box-single">
            <el-text class="custom-box-text">英钱(dwt)</el-text>
            <el-input
              v-model="info.eng_dwt"
              placeholder=""
              class="input-with-select"
              @input="onInput('eng_dwt')"
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
