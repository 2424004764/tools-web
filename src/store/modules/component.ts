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
    commandPaletteVisible: false, // 命令面板（Ctrl+K）显示状态
    commandPaletteQuery: '', // 打开命令面板时预填的搜索词
    commandPaletteMode: 'tools' as 'tools' | 'ai', // 命令面板初始模式：tools 关键词 / ai 自然语言找工具
    feedbackDialogVisible: false, // 意见反馈弹窗显示状态
  }),
  //方法
  actions: {
    //打开命令面板（可指定初始模式与预填搜索词，如从顶部搜索框的「AI 帮我找工具」入口进入）
    openCommandPalette(payload?: { mode?: 'tools' | 'ai'; query?: string }) {
      this.commandPaletteMode = payload?.mode || 'tools'
      this.commandPaletteQuery = payload?.query || ''
      this.commandPaletteVisible = true
    },
    closeCommandPalette() {
      this.commandPaletteVisible = false
    },
    //打开/关闭意见反馈弹窗（页脚「反馈建议」与命令面板共用）
    setFeedbackDialogVisible(status: boolean) {
      this.feedbackDialogVisible = status
    },
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