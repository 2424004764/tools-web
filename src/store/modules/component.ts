import { defineStore } from 'pinia'

export const useComponentStore = defineStore('component', {
  //用来存放变量
  state: () => ({
    leftCom: false,
    leftComDrawer: false,
    activeCategory: '', // 新增：当前活跃的分类ID
    hideAllUI: false, // 新增：隐藏所有UI元素（侧边栏、顶部搜索、底部推荐和评论）
  }),
  //方法
  actions: {
    //设置左侧组件状态
    setLeftComStatus(status: boolean) {
      // console.log(1)
      this.leftCom = status
    },
    //设置左侧组件状态(小屏)
    setleftComDrawerStatus(status: boolean) {
      // console.log(2)
      this.leftComDrawer = status
    },
    //设置当前活跃的分类
    setActiveCategory(categoryId: string) {
      this.activeCategory = categoryId
    },
    //设置隐藏所有UI状态
    setHideAllUI(status: boolean) {
      this.hideAllUI = status
      // 打开专注模式时关闭侧边栏
      if (status) {
        this.leftCom = true
        this.leftComDrawer = false
      } else {
        // 关闭专注模式时恢复侧边栏
        this.leftCom = false
      }
    }
  }
})