import { defineStore } from 'pinia'

export const useComponentStore = defineStore('component', {
  //用来存放变量
  state: () => ({
    leftCom: false,
    leftComDrawer: false,
    activeCategory: '', // 新增：当前活跃的分类ID
    hideAllUI: false, // 新增：隐藏所有UI元素（侧边栏、顶部搜索、底部推荐和评论）
    cateNavCollapsed: false, // 侧边栏「分类」分组折叠状态
    anchorScrollTarget: '', // 正在滚向的锚点（cate_X），滚动联动防抖用
    navClickLockUntil: 0, // 点击分类后暂停滚动联动的截止时间（ms 时间戳）
    anchorNavFromMenu: false, // 本次导航是否由侧边栏点击分类发起（区别于浏览器返回）
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
    //设置侧边栏「分类」分组折叠状态
    setCateNavCollapsed(status: boolean) {
      this.cateNavCollapsed = status
    },
    //设置正在滚向的锚点
    setAnchorScrollTarget(anchor: string) {
      this.anchorScrollTarget = anchor
    },
    //设置点击分类后的滚动联动锁定截止时间
    setNavClickLockUntil(timestamp: number) {
      this.navClickLockUntil = timestamp
    },
    //标记/清除「由侧边栏菜单发起的分类导航」
    setAnchorNavFromMenu(status: boolean) {
      this.anchorNavFromMenu = status
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