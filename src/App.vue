<script setup lang="ts">
import { computed } from 'vue'
import Header from "@/components/Layout/Header/Header.vue";
import Left from "@/components/Layout/Left/Left.vue";
import Floor from "@/components/Layout/Floor/Floor.vue";
// import Right from '@/components/Layout/Right/Right.vue'
import { useComponentStore } from "@/store/modules/component";
import SimilarRecommend from "@/components/Layout/SimilarRecommend/SimilarRecommend.vue";
import Comments from "@/components/Layout/Comments/Comments.vue";
import { useRoute } from 'vue-router';
//store
const componentStore = useComponentStore();
const route = useRoute();

// 判断是否为QA查看页面
const isQAViewPage = computed(() => {
  return route.name === 'qa-view';
});

// 判断是否为首页
const isHomePage = computed(() => {
  return route.name === 'home' || route.path === '/';
});

</script>

<template>
  <el-container>
    <!-- left -->
    <el-aside
      v-if="!isQAViewPage"
      class="fixed top-0 left-0 h-full z-10 c-md:block c-sm:hidden c-xs:hidden"
      width="240px"
      v-show="!componentStore.leftCom"
    >
      <Left></Left>
    </el-aside>
    <el-drawer
      v-if="!isQAViewPage"
      show-close
      size="240px"
      :with-header="false"
      v-model="componentStore.leftComDrawer"
      direction="ltr"
      :lock-scroll="false"
    >
      <Left></Left>
    </el-drawer>

    <!-- right -->
    <el-container :class="!componentStore.leftCom && !isQAViewPage ? 'c-md:ml-[240px]' : ''">
      <el-header v-if="!isQAViewPage">
        <Header />
      </el-header>
      <el-main class="c-xs:pt-16">
        <router-view v-slot="{ Component, route }">
          <transition name="fade" mode="out-in">
            <component :is="Component" :key="route.path"></component>
          </transition>
        </router-view>
        <SimilarRecommend v-if="!isQAViewPage" />
        <Comments v-if="!isQAViewPage && !isHomePage" />
      </el-main>
      <el-footer v-if="!isQAViewPage" class="md:mb-6 mt-12 c-xs:mb-12">
        <Floor />
      </el-footer>
    </el-container>
  </el-container>
</template>

<style scoped>
/* 更轻量的淡入淡出动画 */
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-enter-to,
.fade-leave-from {
  opacity: 1;
}

.fade-enter-active {
  transition: opacity 0.15s ease-out;
}

.fade-leave-active {
  transition: opacity 0.1s ease-in;
}

/* 手机端header固定后，el-header不占据空间 */
@media (max-width: 640px) {
  .el-container > .el-header {
    display: contents;
  }

  /* 给el-main添加顶部padding，避免被固定的header遮挡 */
  .el-container > .el-main {
    padding-top: 64px !important;
  }
}
</style>
