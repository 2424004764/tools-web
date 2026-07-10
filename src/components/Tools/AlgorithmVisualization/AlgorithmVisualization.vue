<script setup lang="ts">
import { reactive, ref, onMounted, nextTick, computed, onUnmounted } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const info = reactive({
  title: "算法可视化",
})

// 算法类型 - 添加新的排序算法
const algorithmTypes = [
  { label: '冒泡排序', value: 'bubbleSort' },
  { label: '选择排序', value: 'selectionSort' },
  { label: '插入排序', value: 'insertionSort' },
  { label: '快速排序', value: 'quickSort' },
  { label: '归并排序', value: 'mergeSort' },
  { label: '堆排序', value: 'heapSort' },
  { label: '希尔排序', value: 'shellSort' },
  { label: '计数排序', value: 'countingSort' },
  { label: '基数排序', value: 'radixSort' }
]

// 状态管理 - 移除搜索相关状态
const state = reactive({
  selectedAlgorithm: 'bubbleSort',
  arraySize: 25,
  animationSpeed: 100,
  isRunning: false,
  isPaused: false,
  isCompleted: false,
  currentStep: 0,
  totalSteps: 0,
  // 移除 searchTarget
  // 新增统计信息
  startTime: 0,
  elapsedTime: 0,
  currentRound: 0,
  totalRounds: 0,
  comparisons: 0,
  swaps: 0,
  pausedTime: 0,
  pauseStartTime: 0
})

// 时间更新定时器
let timeUpdateInterval: ReturnType<typeof setInterval> | null = null

// 时间格式化
const formatTime = (milliseconds: number) => {
  const seconds = Math.floor(milliseconds / 1000)
  const ms = Math.floor((milliseconds % 1000) / 10) // 显示到百分之一秒
  return `${seconds}.${ms.toString().padStart(2, '0')}s`
}

// 实时更新时间的函数
const updateElapsedTime = () => {
  if (state.isRunning && !state.isPaused) {
    state.elapsedTime = Date.now() - state.startTime - state.pausedTime
  }
}

// 开始时间更新定时器
const startTimeUpdate = () => {
  if (timeUpdateInterval) {
    clearInterval(timeUpdateInterval)
  }
  timeUpdateInterval = setInterval(updateElapsedTime, 50) // 每50ms更新一次，更流畅
}

// 停止时间更新定时器
const stopTimeUpdate = () => {
  if (timeUpdateInterval) {
    clearInterval(timeUpdateInterval)
    timeUpdateInterval = null
  }
}

// 数组数据
const arrayData = ref<number[]>([])
const arrayStates = ref<string[]>([]) // 'normal', 'comparing', 'swapping', 'sorted', 'found'
const animationSteps = ref<any[]>([])

// 添加响应式计算属性
const isMobile = computed(() => {
  return window.innerWidth < 768
})

const maxArraySizeForMobile = computed(() => {
  return isMobile.value ? 15 : 50
})

const barWidth = computed(() => {
  const screenWidth = window.innerWidth
  if (screenWidth < 640) { // sm
    return Math.max(12, Math.floor((screenWidth - 80) / state.arraySize))
  } else if (screenWidth < 768) { // md
    return Math.max(16, Math.floor((screenWidth - 100) / state.arraySize))
  } else {
    return 32 // 默认宽度
  }
})

// 修改生成随机数组函数，限制手机端数组大小
const generateRandomArray = () => {
  const maxSize = isMobile.value ? 15 : 50
  if (state.arraySize > maxSize) {
    state.arraySize = maxSize
  }
  
  arrayData.value = Array.from({ length: state.arraySize }, () => Math.floor(Math.random() * 100) + 1)
  arrayStates.value = Array(state.arraySize).fill('normal')
  state.currentStep = 0
  state.totalSteps = 0
  state.isCompleted = false
  state.elapsedTime = 0
  state.currentRound = 0
  state.totalRounds = 0
  state.comparisons = 0
  state.swaps = 0
  state.pausedTime = 0
  state.pauseStartTime = 0
  animationSteps.value = []
}

// 重置状态 - 确保统计重置
const resetVisualization = () => {
  stopTimeUpdate()
  state.isRunning = false
  state.isPaused = false
  state.isCompleted = false
  state.currentStep = 0
  state.elapsedTime = 0
  state.currentRound = 0
  state.comparisons = 0  // 重置比较次数
  state.swaps = 0        // 重置交换次数
  state.pausedTime = 0
  state.pauseStartTime = 0
  arrayStates.value = Array(arrayData.value.length).fill('normal')
}

// 计算算法轮数 - 移除搜索算法
const calculateRounds = (algorithm: string, arraySize: number) => {
  switch (algorithm) {
    case 'bubbleSort':
      return arraySize - 1
    case 'selectionSort':
      return arraySize - 1
    case 'insertionSort':
      return arraySize - 1
    case 'quickSort':
      return Math.ceil(Math.log2(arraySize)) // 平均情况
    case 'mergeSort':
      return Math.ceil(Math.log2(arraySize))
    case 'heapSort':
      return Math.ceil(Math.log2(arraySize))
    default:
      return 0
  }
}

// 冒泡排序算法 - 修复完成状态
const bubbleSort = (arr: number[]) => {
  const steps: any[] = []
  const n = arr.length
  const sortedArray = [...arr]
  let roundCount = 0
  
  for (let i = 0; i < n - 1; i++) {
    roundCount++
    steps.push({
      type: 'round',
      round: roundCount,
      description: `第 ${roundCount} 轮冒泡排序开始`
    })
    
    for (let j = 0; j < n - i - 1; j++) {
      // 比较步骤 - 确保每次比较都生成步骤
      steps.push({
        type: 'compare',
        indices: [j, j + 1],
        description: `比较 ${sortedArray[j]} 和 ${sortedArray[j + 1]}`
      })
      
      if (sortedArray[j] > sortedArray[j + 1]) {
        // 交换步骤 - 确保每次交换都生成步骤
        steps.push({
          type: 'swap',
          indices: [j, j + 1],
          description: `交换 ${sortedArray[j]} 和 ${sortedArray[j + 1]}`
        })
        
        // 执行交换
        const temp = sortedArray[j]
        sortedArray[j] = sortedArray[j + 1]
        sortedArray[j + 1] = temp
      }
    }
    
    // 标记已排序
    steps.push({
      type: 'sorted',
      indices: [n - i - 1],
      description: `位置 ${n - i - 1} 已排序完成`
    })
  }
  
  // 最后标记所有元素为已排序
  steps.push({
    type: 'complete',
    indices: Array.from({ length: n }, (_, i) => i),
    description: '冒泡排序完成'
  })
  
  console.log('冒泡排序生成的步骤数:', steps.length)
  console.log('比较步骤数:', steps.filter(s => s.type === 'compare').length)
  console.log('交换步骤数:', steps.filter(s => s.type === 'swap').length)
  
  return steps
}

// 快速排序算法 - 修复排序状态标记
const quickSort = (arr: number[], low = 0, high = arr.length - 1, steps: any[] = [], depth = 0) => {
  if (low < high) {
    steps.push({
      type: 'round',
      round: depth + 1,
      description: `第 ${depth + 1} 层递归：处理区间 [${low}, ${high}]`
    })
    
    const pi = partition(arr, low, high, steps)
    
    // 标记基准值已排序
    steps.push({
      type: 'sorted',
      indices: [pi],
      description: `基准值 ${arr[pi]} 已放到正确位置 ${pi}`
    })
    
    quickSort(arr, low, pi - 1, steps, depth + 1)
    quickSort(arr, pi + 1, high, steps, depth + 1)
    
    // 当子数组完成排序后，标记整个区间为已排序
    if (low < pi - 1) {
      // 左子数组已排序
      steps.push({
        type: 'subsorted',
        indices: Array.from({ length: pi - low }, (_, i) => low + i),
        description: `左子数组 [${low}, ${pi - 1}] 排序完成`
      })
    } else if (low === pi - 1) {
      // 只有一个元素的左子数组
      steps.push({
        type: 'sorted',
        indices: [low],
        description: `元素 ${arr[low]} 已排序`
      })
    }
    
    if (pi + 1 < high) {
      // 右子数组已排序
      steps.push({
        type: 'subsorted',
        indices: Array.from({ length: high - pi }, (_, i) => pi + 1 + i),
        description: `右子数组 [${pi + 1}, ${high}] 排序完成`
      })
    } else if (pi + 1 === high) {
      // 只有一个元素的右子数组
      steps.push({
        type: 'sorted',
        indices: [high],
        description: `元素 ${arr[high]} 已排序`
      })
    }
  } else if (low === high) {
    // 单个元素自然已排序
    steps.push({
      type: 'sorted',
      indices: [low],
      description: `单个元素 ${arr[low]} 已排序`
    })
  }
  
  // 如果是最外层递归完成，标记整个数组已排序
  if (depth === 0) {
    steps.push({
      type: 'complete',
      indices: Array.from({ length: arr.length }, (_, i) => i),
      description: '快速排序完成'
    })
  }
  
  return steps
}

const partition = (arr: number[], low: number, high: number, steps: any[]) => {
  const pivot = arr[high]
  let i = low - 1
  
  steps.push({
    type: 'pivot',
    indices: [high],
    description: `选择 ${pivot} 作为基准值`
  })
  
  for (let j = low; j < high; j++) {
    steps.push({
      type: 'compare',
      indices: [j, high],
      description: `比较 ${arr[j]} 和基准值 ${pivot}`
    })
    
    if (arr[j] < pivot) {
      i++
      if (i !== j) {
        steps.push({
          type: 'swap',
          indices: [i, j],
          description: `交换 ${arr[i]} 和 ${arr[j]}`
        })
        
        const temp = arr[i]
        arr[i] = arr[j]
        arr[j] = temp
      }
    }
  }
  
  steps.push({
    type: 'swap',
    indices: [i + 1, high],
    description: `将基准值 ${pivot} 放到正确位置 ${i + 1}`
  })
  
  const temp = arr[i + 1]
  arr[i + 1] = arr[high]
  arr[high] = temp
  
  return i + 1
}

// 选择排序算法
const selectionSort = (arr: number[]) => {
  const steps: any[] = []
  const n = arr.length
  const sortedArray = [...arr]
  let roundCount = 0
  
  for (let i = 0; i < n - 1; i++) {
    roundCount++
    steps.push({
      type: 'round',
      round: roundCount,
      description: `第 ${roundCount} 轮选择排序开始`
    })
    
    let minIndex = i
    
    steps.push({
      type: 'current',
      indices: [i],
      description: `开始处理位置 ${i}`
    })
    
    // 寻找最小值
    for (let j = i + 1; j < n; j++) {
      steps.push({
        type: 'compare',
        indices: [minIndex, j],
        description: `比较 ${sortedArray[minIndex]} 和 ${sortedArray[j]}`
      })
      
      if (sortedArray[j] < sortedArray[minIndex]) {
        minIndex = j
        steps.push({
          type: 'newmin',
          indices: [minIndex],
          description: `找到新的最小值 ${sortedArray[minIndex]} 在位置 ${minIndex}`
        })
      }
    }
    
    // 如果找到更小的值，进行交换
    if (minIndex !== i) {
      steps.push({
        type: 'swap',
        indices: [i, minIndex],
        description: `交换 ${sortedArray[i]} 和 ${sortedArray[minIndex]}`
      })
      
      const temp = sortedArray[i]
      sortedArray[i] = sortedArray[minIndex]
      sortedArray[minIndex] = temp
    }
    
    steps.push({
      type: 'sorted',
      indices: [i],
      description: `位置 ${i} 已排序完成`
    })
  }
  
  // 最后一个元素也已排序
  steps.push({
    type: 'sorted',
    indices: [n - 1],
    description: '排序完成'
  })
  
  return steps
}

// 插入排序算法 - 修复实现
const insertionSort = (arr: number[]) => {
  const steps: any[] = []
  const n = arr.length
  const sortedArray = [...arr]
  let roundCount = 0
  
  for (let i = 1; i < n; i++) {
    roundCount++
    steps.push({
      type: 'round',
      round: roundCount,
      description: `第 ${roundCount} 轮插入排序开始`
    })
    
    const key = sortedArray[i]
    let j = i - 1
    
    steps.push({
      type: 'current',
      indices: [i],
      description: `处理元素 ${key} 在位置 ${i}`
    })
    
    // 向前比较并移动
    while (j >= 0 && sortedArray[j] > key) {
      steps.push({
        type: 'compare',
        indices: [j, i],
        description: `比较 ${sortedArray[j]} 和 ${key}`
      })
      
      // 使用swap操作来移动元素，这样executeStep可以正确处理
      steps.push({
        type: 'swap',
        indices: [j, j + 1],
        description: `将 ${sortedArray[j]} 向右移动到位置 ${j + 1}`
      })
      
      // 在算法内部也执行移动
      sortedArray[j + 1] = sortedArray[j]
      j--
    }
    
    // 插入元素到正确位置
    sortedArray[j + 1] = key
    steps.push({
      type: 'insert',
      indices: [j + 1],
      value: key,
      description: `将 ${key} 插入到位置 ${j + 1}`
    })
  }
  
  steps.push({
    type: 'complete',
    indices: Array.from({ length: n }, (_, i) => i),
    description: '插入排序完成'
  })
  
  console.log('插入排序生成的步骤数:', steps.length)
  console.log('比较步骤数:', steps.filter(s => s.type === 'compare').length)
  console.log('交换步骤数:', steps.filter(s => s.type === 'swap').length)
  
  return steps
}

// 归并排序算法 - 完全重写
const mergeSort = (arr: number[], left = 0, right = arr.length - 1, steps: any[] = [], depth = 0) => {
  if (left < right) {
    const mid = Math.floor((left + right) / 2)
    
    steps.push({
      type: 'round',
      round: depth + 1,
      description: `第 ${depth + 1} 层递归：分割 [${left}, ${right}]`
    })
    
    steps.push({
      type: 'divide',
      indices: Array.from({ length: right - left + 1 }, (_, i) => left + i),
      description: `分割数组 [${left}, ${right}] 为 [${left}, ${mid}] 和 [${mid + 1}, ${right}]`
    })
    
    mergeSort(arr, left, mid, steps, depth + 1)
    mergeSort(arr, mid + 1, right, steps, depth + 1)
    merge(arr, left, mid, right, steps)
  } else {
    // 单个元素自然已排序
    steps.push({
      type: 'sorted',
      indices: [left],
      description: `单个元素 ${arr[left]} 已排序`
    })
  }
  
  // 如果是最外层递归完成，标记整个数组已排序
  if (depth === 0) {
    steps.push({
      type: 'complete',
      indices: Array.from({ length: arr.length }, (_, i) => i),
      description: '归并排序完成'
    })
  }
  
  return steps
}

const merge = (arr: number[], left: number, mid: number, right: number, steps: any[]) => {
  const leftArr = arr.slice(left, mid + 1)
  const rightArr = arr.slice(mid + 1, right + 1)
  
  steps.push({
    type: 'merge',
    indices: Array.from({ length: right - left + 1 }, (_, i) => left + i),
    description: `开始合并 [${left}, ${mid}] 和 [${mid + 1}, ${right}]`
  })
  
  let i = 0, j = 0, k = left
  
  // 合并两个已排序的子数组
  while (i < leftArr.length && j < rightArr.length) {
    // 添加比较步骤
    steps.push({
      type: 'compare',
      indices: [k], // 显示当前要放置的位置
      leftValue: leftArr[i],
      rightValue: rightArr[j],
      description: `比较 ${leftArr[i]} 和 ${rightArr[j]}`
    })
    
    if (leftArr[i] <= rightArr[j]) {
      arr[k] = leftArr[i]
      steps.push({
        type: 'place',
        indices: [k],
        value: leftArr[i],
        description: `将 ${leftArr[i]} 放置到位置 ${k}`
      })
      i++
    } else {
      arr[k] = rightArr[j]
      steps.push({
        type: 'place',
        indices: [k],
        value: rightArr[j],
        description: `将 ${rightArr[j]} 放置到位置 ${k}`
      })
      j++
    }
    k++
  }
  
  // 处理左子数组剩余元素
  while (i < leftArr.length) {
    arr[k] = leftArr[i]
    steps.push({
      type: 'place',
      indices: [k],
      value: leftArr[i],
      description: `将剩余元素 ${leftArr[i]} 放置到位置 ${k}`
    })
    i++
    k++
  }
  
  // 处理右子数组剩余元素
  while (j < rightArr.length) {
    arr[k] = rightArr[j]
    steps.push({
      type: 'place',
      indices: [k],
      value: rightArr[j],
      description: `将剩余元素 ${rightArr[j]} 放置到位置 ${k}`
    })
    j++
    k++
  }
  
  // 标记合并完成的区间为已排序
  steps.push({
    type: 'subsorted',
    indices: Array.from({ length: right - left + 1 }, (_, i) => left + i),
    description: `区间 [${left}, ${right}] 合并完成`
  })
}

// 线性查找算法 - 移除
// const linearSearch = (arr: number[], target: number) => {
//   const steps: any[] = []
  
//   steps.push({
//     type: 'init',
//     indices: [],
//     description: `在数组中线性查找 ${target}`
//   })
  
//   for (let i = 0; i < arr.length; i++) {
//     steps.push({
//       type: 'compare',
//       indices: [i],
//       description: `检查位置 ${i}，值为 ${arr[i]}`
//     })
    
//     if (arr[i] === target) {
//       steps.push({
//         type: 'found',
//         indices: [i],
//         description: `找到目标值 ${target} 在位置 ${i}`
//       })
//       return steps
//     }
//   }
  
//   steps.push({
//     type: 'notfound',
//     indices: [],
//     description: `未找到目标值 ${target}`
//   })
  
//   return steps
// }

// 堆排序算法
const heapSort = (arr: number[]) => {
  const steps: any[] = []
  const n = arr.length
  const sortedArray = [...arr]
  let roundCount = 0
  
  // 构建最大堆
  steps.push({
    type: 'round',
    round: ++roundCount,
    description: '开始构建最大堆'
  })
  
  // 从最后一个非叶子节点开始向上构建堆
  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
    heapify(sortedArray, n, i, steps)
  }
  
  steps.push({
    type: 'heap_built',
    indices: Array.from({ length: n }, (_, i) => i),
    description: '最大堆构建完成'
  })
  
  // 一个个从堆顶取出元素
  for (let i = n - 1; i > 0; i--) {
    steps.push({
      type: 'round',
      round: ++roundCount,
      description: `第 ${roundCount - 1} 轮：提取堆顶元素`
    })
    
    // 将当前堆顶（最大值）移到数组末尾
    steps.push({
      type: 'swap',
      indices: [0, i],
      description: `将堆顶最大值 ${sortedArray[0]} 移到位置 ${i}`
    })
    
    const temp = sortedArray[0]
    sortedArray[0] = sortedArray[i]
    sortedArray[i] = temp
    
    // 标记已排序
    steps.push({
      type: 'sorted',
      indices: [i],
      description: `位置 ${i} 已排序完成`
    })
    
    // 重新调整剩余元素为堆
    heapify(sortedArray, i, 0, steps)
  }
  
  // 标记第一个元素也已排序
  steps.push({
    type: 'sorted',
    indices: [0],
    description: '最后一个元素已排序'
  })
  
  // 完成
  steps.push({
    type: 'complete',
    indices: Array.from({ length: n }, (_, i) => i),
    description: '堆排序完成'
  })
  
  console.log('堆排序生成的步骤数:', steps.length)
  console.log('比较步骤数:', steps.filter(s => s.type === 'compare').length)
  console.log('交换步骤数:', steps.filter(s => s.type === 'swap').length)
  
  return steps
}

// 堆化函数
const heapify = (arr: number[], n: number, i: number, steps: any[]) => {
  let largest = i // 初始化最大值为根节点
  const left = 2 * i + 1 // 左子节点
  const right = 2 * i + 2 // 右子节点
  
  steps.push({
    type: 'current',
    indices: [i],
    description: `调整以位置 ${i} 为根的子堆`
  })
  
  // 如果左子节点存在且大于根节点
  if (left < n) {
    steps.push({
      type: 'compare',
      indices: [left, largest],
      description: `比较左子节点 ${arr[left]} 和当前最大值 ${arr[largest]}`
    })
    
    if (arr[left] > arr[largest]) {
      largest = left
      steps.push({
        type: 'newmax',
        indices: [largest],
        description: `左子节点 ${arr[left]} 成为新的最大值`
      })
    }
  }
  
  // 如果右子节点存在且大于当前最大值
  if (right < n) {
    steps.push({
      type: 'compare',
      indices: [right, largest],
      description: `比较右子节点 ${arr[right]} 和当前最大值 ${arr[largest]}`
    })
    
    if (arr[right] > arr[largest]) {
      largest = right
      steps.push({
        type: 'newmax',
        indices: [largest],
        description: `右子节点 ${arr[right]} 成为新的最大值`
      })
    }
  }
  
  // 如果最大值不是根节点，则交换并继续堆化
  if (largest !== i) {
    steps.push({
      type: 'swap',
      indices: [i, largest],
      description: `交换 ${arr[i]} 和 ${arr[largest]} 以维持堆性质`
    })
    
    const temp = arr[i]
    arr[i] = arr[largest]
    arr[largest] = temp
    
    // 递归地堆化受影响的子树
    heapify(arr, n, largest, steps)
  }
}

// 希尔排序算法
const shellSort = (arr: number[]) => {
  const steps: any[] = []
  const n = arr.length
  const sortedArray = [...arr]
  let roundCount = 0
  
  // 生成间隔序列（使用Knuth序列）
  for (let gap = Math.floor(n / 2); gap > 0; gap = Math.floor(gap / 2)) {
    roundCount++
    steps.push({
      type: 'round',
      round: roundCount,
      description: `第 ${roundCount} 轮：间隔为 ${gap}`
    })
    
    steps.push({
      type: 'gap_highlight',
      gap: gap,
      description: `当前间隔: ${gap}`
    })
    
    // 对每个间隔进行插入排序
    for (let i = gap; i < n; i++) {
      const temp = sortedArray[i]
      let j = i
      
      steps.push({
        type: 'current',
        indices: [i],
        description: `处理元素 ${temp} 在位置 ${i}`
      })
      
      while (j >= gap && sortedArray[j - gap] > temp) {
        steps.push({
          type: 'compare',
          indices: [j - gap, j],
          gap: gap,
          description: `比较间隔为${gap}的元素: ${sortedArray[j - gap]} 和 ${temp}`
        })
        
        steps.push({
          type: 'swap',
          indices: [j - gap, j],
          description: `移动 ${sortedArray[j - gap]} 到位置 ${j}`
        })
        
        sortedArray[j] = sortedArray[j - gap]
        j -= gap
      }
      
      sortedArray[j] = temp
      if (j !== i) {
        steps.push({
          type: 'insert',
          indices: [j],
          value: temp,
          description: `将 ${temp} 插入到位置 ${j}`
        })
      }
    }
  }
  
  steps.push({
    type: 'complete',
    indices: Array.from({ length: n }, (_, i) => i),
    description: '希尔排序完成'
  })
  
  return steps
}

// 计数排序算法 - 修复步骤
const countingSort = (arr: number[]) => {
  const steps: any[] = []
  const n = arr.length
  const sortedArray = [...arr]
  
  // 找到最大值
  const max = Math.max(...sortedArray)
  const min = Math.min(...sortedArray)
  const range = max - min + 1
  
  steps.push({
    type: 'round',
    round: 1,
    description: `第 1 阶段：统计每个元素出现次数`
  })
  
  steps.push({
    type: 'find_range',
    indices: Array.from({ length: n }, (_, i) => i),
    description: `数组范围: ${min} ~ ${max}，需要 ${range} 个计数桶`
  })
  
  // 创建计数数组
  const count = new Array(range).fill(0)
  
  // 统计每个元素出现的次数
  for (let i = 0; i < n; i++) {
    steps.push({
      type: 'counting',
      indices: [i],
      value: sortedArray[i],
      countIndex: sortedArray[i] - min,
      description: `统计元素 ${sortedArray[i]}，计数桶[${sortedArray[i] - min}] += 1`
    })
    count[sortedArray[i] - min]++
  }
  
  steps.push({
    type: 'count_complete',
    indices: [], // 提供空数组而不是undefined
    countArray: [...count],
    description: '统计完成，开始重建数组'
  })
  
  steps.push({
    type: 'round',
    round: 2,
    description: `第 2 阶段：根据计数重建有序数组`
  })
  
  // 重建数组
  let index = 0
  for (let i = 0; i < range; i++) {
    while (count[i] > 0) {
      steps.push({
        type: 'rebuild',
        indices: [index],
        value: i + min,
        countIndex: i,
        description: `从计数桶[${i}]取出 ${i + min} 放到位置 ${index}`
      })
      
      sortedArray[index] = i + min
      count[i]--
      index++
    }
  }
  
  steps.push({
    type: 'complete',
    indices: Array.from({ length: n }, (_, i) => i),
    description: '计数排序完成'
  })
  
  return steps
}

// 基数排序算法
const radixSort = (arr: number[]) => {
  const steps: any[] = []
  const n = arr.length
  const sortedArray = [...arr]
  
  // 找到最大值以确定位数
  const max = Math.max(...sortedArray)
  const maxDigits = max.toString().length
  
  steps.push({
    type: 'find_digits',
    indices: Array.from({ length: n }, (_, i) => i),
    description: `最大值 ${max} 有 ${maxDigits} 位，需要进行 ${maxDigits} 轮排序`
  })
  
  // 对每一位进行计数排序
  for (let digit = 0; digit < maxDigits; digit++) {
    const digitPosition = Math.pow(10, digit)
    
    steps.push({
      type: 'round',
      round: digit + 1,
      description: `第 ${digit + 1} 轮：按第 ${digit + 1} 位（${digit === 0 ? '个' : digit === 1 ? '十' : digit === 2 ? '百' : digit + 1}位）排序`
    })
    
    // 显示当前位的值
    for (let i = 0; i < n; i++) {
      const currentDigit = Math.floor(sortedArray[i] / digitPosition) % 10
      steps.push({
        type: 'show_digit',
        indices: [i],
        digit: currentDigit,
        digitPosition: digit + 1,
        description: `${sortedArray[i]} 的第 ${digit + 1} 位是 ${currentDigit}`
      })
    }
    
    // 创建桶（0-9）
    const buckets: number[][] = Array.from({ length: 10 }, () => [])
    
    // 将元素分配到桶中
    for (let i = 0; i < n; i++) {
      const currentDigit = Math.floor(sortedArray[i] / digitPosition) % 10
      buckets[currentDigit].push(sortedArray[i])
      
      steps.push({
        type: 'bucket_assign',
        indices: [i],
        value: sortedArray[i],
        bucket: currentDigit,
        description: `将 ${sortedArray[i]} 放入桶 ${currentDigit}`
      })
    }
    
    // 从桶中收集元素
    let index = 0
    for (let bucket = 0; bucket < 10; bucket++) {
      for (let i = 0; i < buckets[bucket].length; i++) {
        steps.push({
          type: 'bucket_collect',
          indices: [index],
          value: buckets[bucket][i],
          bucket: bucket,
          description: `从桶 ${bucket} 收集 ${buckets[bucket][i]} 到位置 ${index}`
        })
        
        sortedArray[index] = buckets[bucket][i]
        index++
      }
    }
    
    steps.push({
      type: 'digit_complete',
      indices: Array.from({ length: n }, (_, i) => i),
      description: `第 ${digit + 1} 位排序完成`
    })
  }
  
  steps.push({
    type: 'complete',
    indices: Array.from({ length: n }, (_, i) => i),
    description: '基数排序完成'
  })
  
  return steps
}

// 获取算法步骤 - 添加新算法
const getAlgorithmSteps = () => {
  const arr = [...arrayData.value]
  
  switch (state.selectedAlgorithm) {
    case 'bubbleSort':
      return bubbleSort(arr)
    case 'selectionSort':
      return selectionSort(arr)
    case 'insertionSort':
      return insertionSort(arr)
    case 'quickSort':
      return quickSort([...arr])
    case 'mergeSort':
      return mergeSort([...arr])
    case 'heapSort':
      return heapSort(arr)
    case 'shellSort':
      return shellSort(arr)
    case 'countingSort':
      return countingSort(arr)
    case 'radixSort':
      return radixSort(arr)
    default:
      return []
  }
}

// 执行动画步骤 - 修复forEach错误
const executeStep = (step: any) => {
  // 统计操作次数 - 在处理步骤前统计
  switch (step.type) {
    case 'compare':
      state.comparisons++
      break
    case 'swap':
      state.swaps++
      break
    case 'move':
    case 'rebuild':
    case 'bucket_assign':
    case 'bucket_collect':
      state.swaps++
      break
    case 'place':
      state.swaps++
      break
    case 'round':
      state.currentRound = step.round || state.currentRound
      break
  }
  
  // 保存当前已排序的元素状态
  const currentSortedIndices = arrayStates.value
    .map((state, index) => state === 'sorted' ? index : -1)
    .filter(index => index !== -1)
  
  // 重置所有状态
  arrayStates.value = Array(arrayData.value.length).fill('normal')
  
  // 恢复已排序元素的状态
  currentSortedIndices.forEach(index => {
    arrayStates.value[index] = 'sorted'
  })
  
  // 确保indices存在且是数组
  const indices = step.indices || []
  
  switch (step.type) {
    case 'compare':
      indices.forEach((index: number) => {
        if (arrayStates.value[index] !== 'sorted') {
          arrayStates.value[index] = 'comparing'
        }
      })
      break
    case 'swap':
      indices.forEach((index: number) => {
        if (arrayStates.value[index] !== 'sorted') {
          arrayStates.value[index] = 'swapping'
        }
      })
      // 执行实际交换
      if (indices.length === 2) {
        const [i, j] = indices
        const temp = arrayData.value[i]
        arrayData.value[i] = arrayData.value[j]
        arrayData.value[j] = temp
      }
      break
    case 'gap_highlight':
      // 希尔排序：高亮显示间隔
      if (step.gap) {
        for (let i = 0; i < arrayData.value.length; i += step.gap) {
          if (arrayStates.value[i] !== 'sorted') {
            arrayStates.value[i] = 'gap_highlight'
          }
        }
      }
      break
    case 'find_range':
    case 'find_digits':
      indices.forEach((index: number) => {
        if (arrayStates.value[index] !== 'sorted') {
          arrayStates.value[index] = 'analyzing'
        }
      })
      break
    case 'counting':
      indices.forEach((index: number) => {
        arrayStates.value[index] = 'counting'
      })
      break
    case 'count_complete':
      // 计数完成，显示所有元素为统计状态
      arrayStates.value.fill('analyzing')
      break
    case 'rebuild':
      indices.forEach((index: number) => {
        arrayStates.value[index] = 'rebuilding'
      })
      // 执行实际重建
      if (step.value !== undefined && indices.length === 1) {
        arrayData.value[indices[0]] = step.value
      }
      break
    case 'show_digit':
      indices.forEach((index: number) => {
        if (arrayStates.value[index] !== 'sorted') {
          arrayStates.value[index] = 'digit_highlight'
        }
      })
      break
    case 'bucket_assign':
      indices.forEach((index: number) => {
        arrayStates.value[index] = 'bucket_assign'
      })
      break
    case 'bucket_collect':
      indices.forEach((index: number) => {
        arrayStates.value[index] = 'bucket_collect'
      })
      // 执行实际收集
      if (step.value !== undefined && indices.length === 1) {
        arrayData.value[indices[0]] = step.value
      }
      break
    case 'insert':
      indices.forEach((index: number) => {
        arrayStates.value[index] = 'inserting'
      })
      if (step.value !== undefined && indices.length === 1) {
        arrayData.value[indices[0]] = step.value
      }
      break
    case 'place':
      indices.forEach((index: number) => {
        if (arrayStates.value[index] !== 'sorted') {
          arrayStates.value[index] = 'placing'
        }
      })
      // 执行实际放置操作
      if (step.value !== undefined && indices.length === 1) {
        arrayData.value[indices[0]] = step.value
      }
      break
    case 'sorted':
    case 'subsorted':
    case 'digit_complete':
      indices.forEach((index: number) => {
        arrayStates.value[index] = 'sorted'
      })
      break
    case 'pivot':
      indices.forEach((index: number) => {
        if (arrayStates.value[index] !== 'sorted') {
          arrayStates.value[index] = 'pivot'
        }
      })
      break
    case 'current':
      indices.forEach((index: number) => {
        if (arrayStates.value[index] !== 'sorted') {
          arrayStates.value[index] = 'current'
        }
      })
      break
    case 'newmin':
      indices.forEach((index: number) => {
        if (arrayStates.value[index] !== 'sorted') {
          arrayStates.value[index] = 'newmin'
        }
      })
      break
    case 'newmax':
      indices.forEach((index: number) => {
        if (arrayStates.value[index] !== 'sorted') {
          arrayStates.value[index] = 'newmax'
        }
      })
      break
    case 'divide':
      indices.forEach((index: number) => {
        if (arrayStates.value[index] !== 'sorted') {
          arrayStates.value[index] = 'dividing'
        }
      })
      break
    case 'merge':
      indices.forEach((index: number) => {
        if (arrayStates.value[index] !== 'sorted') {
          arrayStates.value[index] = 'merging'
        }
      })
      break
    case 'heap_built':
      indices.forEach((index: number) => {
        if (arrayStates.value[index] !== 'sorted') {
          arrayStates.value[index] = 'heap'
        }
      })
      break
    case 'complete':
      indices.forEach((index: number) => {
        arrayStates.value[index] = 'sorted'
      })
      break
  }
}

// 开始可视化 - 确保统计重置
const startVisualization = async () => {
  if (state.isRunning) return
  
  // 如果已完成，重新生成数组
  if (state.isCompleted) {
    generateRandomArray()
  }
  
  // 重置所有状态和统计
  state.isRunning = true
  state.isPaused = false
  state.isCompleted = false
  state.currentStep = 0
  state.startTime = Date.now()
  state.elapsedTime = 0
  state.currentRound = 0
  state.comparisons = 0  // 确保重置
  state.swaps = 0        // 确保重置
  state.pausedTime = 0
  state.pauseStartTime = 0
  
  animationSteps.value = getAlgorithmSteps()
  state.totalSteps = animationSteps.value.length
  state.totalRounds = calculateRounds(state.selectedAlgorithm, arrayData.value.length)
  
  // 启动实时时间更新
  startTimeUpdate()
  
  // 调试：打印步骤信息
  console.log('算法步骤:', animationSteps.value.map(step => ({ type: step.type, description: step.description })))
  
  for (let i = 0; i < animationSteps.value.length; i++) {
    if (!state.isRunning) break
    
    while (state.isPaused) {
      // 记录暂停开始时间
      if (state.pauseStartTime === 0) {
        state.pauseStartTime = Date.now()
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    // 如果从暂停状态恢复，累计暂停时间
    if (state.pauseStartTime > 0) {
      state.pausedTime += Date.now() - state.pauseStartTime
      state.pauseStartTime = 0
    }
    
    state.currentStep = i + 1
    executeStep(animationSteps.value[i])
    
    // 调试：打印当前统计
    console.log(`步骤 ${i + 1}: 比较=${state.comparisons}, 交换=${state.swaps}`)
    
    await new Promise(resolve => setTimeout(resolve, 1000 - state.animationSpeed * 10))
  }
  
  // 停止时间更新并记录最终时间
  stopTimeUpdate()
  state.elapsedTime = Date.now() - state.startTime - state.pausedTime
  state.isRunning = false
  state.isCompleted = true
  
  // 最终统计
  console.log(`最终统计: 比较=${state.comparisons}, 交换=${state.swaps}`)
}

// 暂停/继续 - 处理暂停时间
const togglePause = () => {
  if (state.isPaused) {
    // 从暂停恢复，累计暂停时间
    if (state.pauseStartTime > 0) {
      state.pausedTime += Date.now() - state.pauseStartTime
      state.pauseStartTime = 0
    }
    state.isPaused = false
  } else {
    // 开始暂停，记录暂停开始时间
    state.pauseStartTime = Date.now()
    state.isPaused = true
  }
}

// 停止
const stopVisualization = () => {
  stopTimeUpdate()
  state.isRunning = false
  state.isPaused = false
  state.isCompleted = false
  resetVisualization()
}

// 获取柱子颜色 - 添加新算法的颜色
const getBarColor = (index: number) => {
  const state_type = arrayStates.value[index]
  switch (state_type) {
    case 'comparing': return '#3b82f6' // 蓝色
    case 'swapping': return '#ef4444' // 红色
    case 'sorted': return '#10b981' // 绿色
    case 'pivot': return '#8b5cf6' // 紫色
    case 'current': return '#06b6d4' // 青色
    case 'newmin': return '#f97316' // 橙色
    case 'newmax': return '#dc2626' // 深红色
    case 'moving': return '#ec4899' // 粉色
    case 'inserting': return '#84cc16' // 绿黄色
    case 'dividing': return '#a855f7' // 紫色
    case 'merging': return '#0ea5e9' // 天蓝色
    case 'placing': return '#22c55e' // 绿色
    case 'heap': return '#f59e0b' // 黄色
    // 新增颜色
    case 'gap_highlight': return '#8b5cf6' // 紫色 - 希尔排序间隔
    case 'analyzing': return '#06b6d4' // 青色 - 分析阶段
    case 'counting': return '#f59e0b' // 黄色 - 计数中
    case 'rebuilding': return '#10b981' // 绿色 - 重建中
    case 'digit_highlight': return '#ec4899' // 粉色 - 数位高亮
    case 'bucket_assign': return '#f97316' // 橙色 - 分桶
    case 'bucket_collect': return '#22c55e' // 绿色 - 收集
    default: return '#e5e7eb' // 默认灰色
  }
}

// 获取当前步骤描述
const getCurrentStepDescription = () => {
  if (state.currentStep > 0 && state.currentStep <= animationSteps.value.length) {
    return animationSteps.value[state.currentStep - 1]?.description || ''
  }
  return ''
}

// 获取按钮文本 - 改为计算属性
const startButtonText = computed(() => {
  if (state.isRunning) {
    return '演示中...'
  } else if (state.isCompleted) {
    return '重新演示'
  } else {
    return '开始演示'
  }
})

// 初始化
onMounted(() => {
  generateRandomArray()
  
  // 监听窗口大小变化
  const handleResize = () => {
    // 触发响应式更新
    nextTick(() => {
      if (isMobile.value && state.arraySize > 15) {
        state.arraySize = 15
        generateRandomArray()
      }
    })
  }
  
  window.addEventListener('resize', handleResize)
  
  // 组件卸载时移除监听器
  onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
  })
})

// 组件卸载时清理定时器
onUnmounted(() => {
  stopTimeUpdate()
})
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-6 rounded-2xl bg-white space-y-6">
      <!-- 控制面板 - 响应式数组大小限制 -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label class="block text-body-sm font-medium mb-2">算法类型</label>
          <el-select v-model="state.selectedAlgorithm" :disabled="state.isRunning" class="w-full">
            <el-option
              v-for="algo in algorithmTypes"
              :key="algo.value"
              :label="algo.label"
              :value="algo.value"
            />
          </el-select>
        </div>
        
        <div>
          <label class="block text-body-sm font-medium mb-2">
            数组大小: {{ state.arraySize }}
            <span v-if="isMobile" class="text-caption text-gray-500">(手机端最大15)</span>
          </label>
          <el-slider
            v-model="state.arraySize"
            :min="5"
            :max="maxArraySizeForMobile"
            :disabled="state.isRunning"
            :show-tooltip="false"
            @change="generateRandomArray"
          />
        </div>
        
        <div>
          <label class="block text-body-sm font-medium mb-2">动画速度: {{ state.animationSpeed }}%</label>
          <el-slider
            v-model="state.animationSpeed"
            :min="1"
            :max="100"
            :show-tooltip="false"
          />
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="flex flex-wrap gap-3">
        <el-button
          type="primary"
          @click="startVisualization"
          :disabled="state.isRunning"
          :loading="state.isRunning"
        >
          {{ startButtonText }}
        </el-button>
        
        <el-button
          v-if="state.isRunning"
          @click="togglePause"
        >
          {{ state.isPaused ? '继续' : '暂停' }}
        </el-button>
        
        <el-button
          @click="stopVisualization"
          :disabled="!state.isRunning && !state.isCompleted"
        >
          停止
        </el-button>
        
        <el-button 
          @click="generateRandomArray" 
          :disabled="state.isRunning"
        >
          生成新数组
        </el-button>
      </div>

      <!-- 统计信息面板 -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
        <div class="text-center">
          <div class="text-h2 font-bold text-blue-600 font-mono">{{ formatTime(state.elapsedTime) }}</div>
          <div class="text-body-sm text-gray-600">执行时间</div>
        </div>
        
        <div class="text-center">
          <div class="text-h2 font-bold text-green-600">{{ state.currentRound }} / {{ state.totalRounds }}</div>
          <div class="text-body-sm text-gray-600">当前轮数</div>
        </div>
        
        <div class="text-center">
          <div class="text-h2 font-bold text-purple-600">{{ state.comparisons }}</div>
          <div class="text-body-sm text-gray-600">比较次数</div>
        </div>
        
        <div class="text-center">
          <div class="text-h2 font-bold text-orange-600">{{ state.swaps }}</div>
          <div class="text-body-sm text-gray-600">交换次数</div>
        </div>
      </div>

      <!-- 进度信息 -->
      <div v-if="state.totalSteps > 0" class="bg-gray-50 p-4 rounded-lg">
        <div class="flex justify-between items-center mb-2">
          <span class="text-body-sm font-medium">步骤进度: {{ state.currentStep }} / {{ state.totalSteps }}</span>
        </div>
        <el-progress :percentage="Math.round((state.currentStep / state.totalSteps) * 100)" />
        <div v-if="getCurrentStepDescription()" class="mt-2 text-body-sm text-blue-600">
          {{ getCurrentStepDescription() }}
        </div>
      </div>

      <!-- 可视化区域 - 响应式设计 -->
      <div class="bg-gray-50 p-3 sm:p-6 rounded-lg min-h-[350px] sm:min-h-[400px]">
        <!-- 添加水平滚动容器 -->
        <div class="overflow-x-auto">
          <div 
            class="flex items-end justify-center space-x-1 h-64 sm:h-80 min-w-full"
            :style="{ minWidth: `${Math.max(320, state.arraySize * (barWidth + 4))}px` }"
          >
            <div
              v-for="(value, index) in arrayData"
              :key="index"
              class="flex flex-col items-center transition-all duration-300 flex-shrink-0"
            >
              <!-- 数值显示 - 响应式字体 -->
              <div 
                class="text-caption mb-1 font-mono"
                :class="{ 'text-[10px]': isMobile && state.arraySize > 10 }"
              >
                {{ value }}
              </div>
              
              <!-- 柱状图 - 动态宽度 -->
              <div
                class="transition-all duration-300 rounded-t-sm"
                :style="{
                  width: `${barWidth}px`,
                  height: `${(value / 100) * (isMobile ? 200 : 250)}px`,
                  backgroundColor: getBarColor(index),
                  minHeight: '15px'
                }"
              ></div>
              
              <!-- 索引显示 - 响应式字体 -->
              <div 
                class="text-caption mt-1 text-gray-500"
                :class="{ 'text-[10px]': isMobile && state.arraySize > 10 }"
              >
                {{ index }}
              </div>
            </div>
          </div>
        </div>
        
        <!-- 手机端提示 -->
        <div v-if="isMobile && state.arraySize > 10" class="text-caption text-gray-500 text-center mt-2">
          💡 可以左右滑动查看完整图表
        </div>
      </div>

      <!-- 颜色说明 - 添加新算法的颜色说明 -->
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-10 gap-2 sm:gap-3 text-caption sm:text-body-sm">
        <div class="flex items-center space-x-1 sm:space-x-2">
          <div class="w-3 h-3 sm:w-4 sm:h-4 bg-gray-300 rounded flex-shrink-0"></div>
          <span class="truncate">未处理</span>
        </div>
        <div class="flex items-center space-x-1 sm:space-x-2">
          <div class="w-3 h-3 sm:w-4 sm:h-4 bg-blue-500 rounded flex-shrink-0"></div>
          <span class="truncate">比较中</span>
        </div>
        <div class="flex items-center space-x-1 sm:space-x-2">
          <div class="w-3 h-3 sm:w-4 sm:h-4 bg-red-500 rounded flex-shrink-0"></div>
          <span class="truncate">交换中</span>
        </div>
        <div class="flex items-center space-x-1 sm:space-x-2">
          <div class="w-3 h-3 sm:w-4 sm:h-4 bg-green-500 rounded flex-shrink-0"></div>
          <span class="truncate">已排序</span>
        </div>
        <div class="flex items-center space-x-1 sm:space-x-2">
          <div class="w-3 h-3 sm:w-4 sm:h-4 bg-purple-500 rounded flex-shrink-0"></div>
          <span class="truncate">基准值/间隔</span>
        </div>
        <div class="flex items-center space-x-1 sm:space-x-2">
          <div class="w-3 h-3 sm:w-4 sm:h-4 bg-cyan-500 rounded flex-shrink-0"></div>
          <span class="truncate">当前处理</span>
        </div>
        <div class="flex items-center space-x-1 sm:space-x-2">
          <div class="w-3 h-3 sm:w-4 sm:h-4 bg-orange-500 rounded flex-shrink-0"></div>
          <span class="truncate">计数/分桶</span>
        </div>
        <div class="flex items-center space-x-1 sm:space-x-2">
          <div class="w-3 h-3 sm:w-4 sm:h-4 bg-yellow-500 rounded flex-shrink-0"></div>
          <span class="truncate">统计中</span>
        </div>
        <div class="flex items-center space-x-1 sm:space-x-2">
          <div class="w-3 h-3 sm:w-4 sm:h-4 bg-pink-500 rounded flex-shrink-0"></div>
          <span class="truncate">数位高亮</span>
        </div>
        <div class="flex items-center space-x-1 sm:space-x-2">
          <div class="w-3 h-3 sm:w-4 sm:h-4 bg-lime-500 rounded flex-shrink-0"></div>
          <span class="truncate">重建/收集</span>
        </div>
      </div>
    </div>

    <!-- 描述 -->
    <ToolDetail title="功能说明">
      <div class="space-y-4">
        <div>
          <h4 class="font-medium mb-2">支持的排序算法：</h4>
          <ul class="list-disc list-inside space-y-1 text-body-sm text-gray-600">
            <li><strong>冒泡排序：</strong>通过重复遍历数组，比较相邻元素并交换，将最大元素"冒泡"到末尾</li>
            <li><strong>选择排序：</strong>每次选择未排序部分的最小元素，放到已排序部分的末尾</li>
            <li><strong>插入排序：</strong>将元素逐个插入到已排序部分的正确位置</li>
            <li><strong>快速排序：</strong>选择基准值，将数组分为小于和大于基准值的两部分，递归排序</li>
            <li><strong>归并排序：</strong>将数组分为两半，分别排序后合并</li>
            <li><strong>堆排序：</strong>构建最大堆，重复提取最大元素</li>
            <li><strong>希尔排序：</strong>改进的插入排序，通过间隔序列进行多轮插入排序</li>
            <li><strong>计数排序：</strong>统计每个元素出现次数，然后重建有序数组（非比较排序）</li>
            <li><strong>基数排序：</strong>按数位进行多轮计数排序，从低位到高位依次排序</li>
          </ul>
        </div>
        
        <div>
          <h4 class="font-medium mb-2">使用说明：</h4>
          <ul class="list-disc list-inside space-y-1 text-body-sm text-gray-600">
            <li>选择要演示的排序算法</li>
            <li>调整数组大小和动画速度</li>
            <li>点击"开始演示"观看算法执行过程</li>
            <li>可以随时暂停、继续或停止演示</li>
            <li>不同颜色表示元素的不同状态</li>
            <li>实时显示执行时间、轮数、比较次数和交换次数</li>
          </ul>
        </div>
      </div>
    </ToolDetail>
  </div>
</template>

<style scoped>
.transition-all {
  transition: all 0.3s ease;
}
</style>
