<script setup lang="ts">
import { reactive, ref, onMounted, onUnmounted, nextTick, computed } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import * as THREE from 'three'

const info = reactive({
  title: "3D数学方程式",
})

// 3D渲染相关
const canvasRef = ref<HTMLCanvasElement>()
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera  
let renderer: THREE.WebGLRenderer
let animationId: number

// 方程式参数
const equationParams = reactive({
  type: 'parametric', // parametric | implicit | function
  equation: 'x=5*cos(u)*sin(v);y=5*sin(u)*sin(v);z=5*cos(v)', // 参数方程
  rangeU: { min: 0, max: Math.PI * 2, step: 0.1 },
  rangeV: { min: 0, max: Math.PI, step: 0.1 },
  rangeX: { min: -10, max: 10, step: 0.5 },
  rangeY: { min: -10, max: 10, step: 0.5 },
  color: '#4f46e5',
  opacity: 0.8,
  wireframe: false
})

// 预设方程式
const presetEquations = [
  // === 基础几何体 ===
  {
    name: '球面',
    type: 'parametric',
    equation: 'x=5*cos(u)*sin(v);y=5*sin(u)*sin(v);z=5*cos(v)',
    description: '标准球面方程式',
    category: '基础几何体'
  },
  {
    name: '椭球面', 
    type: 'parametric',
    equation: 'x=6*cos(u)*sin(v);y=4*sin(u)*sin(v);z=3*cos(v)',
    description: '椭球面，三个轴长度不同',
    category: '基础几何体'
  },
  {
    name: '圆柱面',
    type: 'parametric',
    equation: 'x=3*cos(u);y=3*sin(u);z=v*3',
    description: '圆柱面',
    category: '基础几何体'
  },
  {
    name: '圆锥面',
    type: 'parametric', 
    equation: 'x=v*cos(u);y=v*sin(u);z=v',
    description: '圆锥面',
    category: '基础几何体'
  },
  {
    name: '立方体框架',
    type: 'parametric',
    equation: 'x=4*cos(u)*(1+0.2*sin(8*v));y=4*sin(u)*(1+0.2*sin(8*v));z=4*v-2',
    description: '立方体框架结构',
    category: '基础几何体'
  },
  
  // === 抛物面类 ===
  {
    name: '椭圆抛物面',
    type: 'function', 
    equation: 'z=x*x/16+y*y/9',
    description: '椭圆抛物面函数',
    category: '抛物面类'
  },
  {
    name: '圆形抛物面',
    type: 'function',
    equation: 'z=x*x+y*y',
    description: '标准圆形抛物面',
    category: '抛物面类'
  },
  {
    name: '双曲抛物面(马鞍面)',
    type: 'function',
    equation: 'z=x*x/16-y*y/9', 
    description: '马鞍形双曲抛物面',
    category: '抛物面类'
  },
  {
    name: '复合抛物面',
    type: 'function',
    equation: 'z=x*x*y*y/(x*x+y*y+1)',
    description: '复合形式的抛物面',
    category: '抛物面类'
  },
  
  // === 双曲面类 ===
  {
    name: '单叶双曲面',
    type: 'parametric',
    equation: 'x=4*cos(u)*(1+v*v/16);y=3*sin(u)*(1+v*v/16);z=v',
    description: '单叶双曲面',
    category: '双曲面类'
  },
  {
    name: '双叶双曲面',
    type: 'parametric',
    equation: 'x=4*cos(u)*sqrt(1+v*v);y=3*sin(u)*sqrt(1+v*v);z=v',
    description: '双叶双曲面',
    category: '双曲面类'
  },
  
  // === 螺旋类 ===
  {
    name: '螺旋面',
    type: 'parametric',
    equation: 'x=u*cos(v);y=u*sin(v);z=v*2',
    description: '螺旋形曲面',
    category: '螺旋类'
  },
  {
    name: '双螺旋',
    type: 'parametric',
    equation: 'x=3*cos(u)*cos(v);y=3*cos(u)*sin(v);z=3*sin(u)+v',
    description: 'DNA双螺旋结构',
    category: '螺旋类'
  },
  {
    name: '螺旋管',
    type: 'parametric',
    equation: 'x=(3+cos(v))*cos(u);y=(3+cos(v))*sin(u);z=sin(v)+u/3',
    description: '螺旋管状结构',
    category: '螺旋类'
  },
  {
    name: '阿基米德螺旋面',
    type: 'parametric',
    equation: 'x=u*cos(v);y=u*sin(v);z=u*sin(3*v)',
    description: '阿基米德螺旋的三维扩展',
    category: '螺旋类'
  },

  // === 环面类 ===
  {
    name: '环面',
    type: 'parametric', 
    equation: 'x=(3+cos(v))*cos(u);y=(3+cos(v))*sin(u);z=sin(v)',
    description: '甜甜圈形状的环面',
    category: '环面类'
  },
  {
    name: '扭曲环面',
    type: 'parametric',
    equation: 'x=(3+cos(v))*cos(u+v/3);y=(3+cos(v))*sin(u+v/3);z=sin(v)',
    description: '带有扭曲的环面',
    category: '环面类'
  },
  {
    name: '8字环面',
    type: 'parametric',
    equation: 'x=(2+cos(v))*cos(2*u);y=(2+cos(v))*sin(2*u);z=sin(v)*cos(u)',
    description: '8字形状的环面',
    category: '环面类'
  },
  
  // === 波浪类 ===
  {
    name: '正弦波面',
    type: 'function',
    equation: 'z=2*sin(sqrt(x*x+y*y))',
    description: '径向正弦波面',
    category: '波浪类'
  },
  {
    name: '余弦波面',
    type: 'function',
    equation: 'z=cos(x)*cos(y)',
    description: '二维余弦波面',
    category: '波浪类'
  },
  {
    name: '波纹面',
    type: 'function',
    equation: 'z=sin(x)*cos(y)*2',
    description: '正弦余弦组合波纹',
    category: '波浪类'
  },
  {
    name: '同心圆波',
    type: 'function',
    equation: 'z=3*sin(sqrt(x*x+y*y))/sqrt(x*x+y*y+1)',
    description: '同心圆状波动',
    category: '波浪类'
  },
  {
    name: '复合波浪',
    type: 'function',
    equation: 'z=sin(x+y)*cos(x-y)',
    description: '复合波浪干涉图案',
    category: '波浪类'
  },
  {
    name: '衰减波',
    type: 'function',
    equation: 'z=3*sin(sqrt(x*x+y*y))*exp(-sqrt(x*x+y*y)/10)',
    description: '径向衰减的波动',
    category: '波浪类'
  },

  // === 特殊数学图形 ===
  {
    name: '莫比乌斯带',
    type: 'parametric',
    equation: 'x=(1+v/2*cos(u/2))*cos(u);y=(1+v/2*cos(u/2))*sin(u);z=v/2*sin(u/2)',
    description: '著名的莫比乌斯带',
    category: '特殊图形'
  },
  {
    name: '克莱因瓶',
    type: 'parametric',
    equation: 'x=(2+cos(v/2)*sin(u)-sin(v/2)*sin(2*u))*cos(v);y=(2+cos(v/2)*sin(u)-sin(v/2)*sin(2*u))*sin(v);z=sin(v/2)*sin(u)+cos(v/2)*sin(2*u)',
    description: '克莱因瓶的三维投影',
    category: '特殊图形'
  },
  {
    name: '心形曲面',
    type: 'parametric',
    equation: 'x=5*cos(u)*pow(sin(v),0.5);y=5*sin(u)*pow(sin(v),0.5);z=5*cos(v)',
    description: '心形曲面',
    category: '特殊图形'
  },
  {
    name: '贝壳曲面',
    type: 'parametric',
    equation: 'x=5*(1-v/(2*pi))*cos(2*v)*(1+cos(u))+cos(2*v);y=5*(1-v/(2*pi))*sin(2*v)*(1+cos(u))+sin(2*v);z=v/(2*pi)+5*(1-v/(2*pi))*sin(u)',
    description: '贝壳螺旋曲面',
    category: '特殊图形'
  },
  {
    name: '花瓣曲面',
    type: 'parametric',
    equation: 'x=u*cos(v)*(1+cos(6*v)/3);y=u*sin(v)*(1+cos(6*v)/3);z=u*sin(6*v)/3',
    description: '六瓣花形曲面',
    category: '特殊图形'
  },

  // === 数学函数图形 ===
  {
    name: '高斯函数',
    type: 'function',
    equation: 'z=5*exp(-(x*x+y*y)/8)',
    description: '高斯分布函数',
    category: '数学函数'
  },
  {
    name: '墨西哥帽',
    type: 'function',
    equation: 'z=5*(1-x*x-y*y)*exp(-(x*x+y*y)/2)',
    description: '墨西哥帽函数（负高斯二阶导）',
    category: '数学函数'
  },
  {
    name: '双峰函数',
    type: 'function',
    equation: 'z=3*exp(-((x-2)*(x-2)+(y-2)*(y-2))/4)+2*exp(-((x+2)*(x+2)+(y+2)*(y+2))/3)',
    description: '双峰高斯分布',
    category: '数学函数'
  },
  {
    name: '鞍点函数',
    type: 'function',
    equation: 'z=x*x*x-3*x*y*y',
    description: '三次鞍点函数',
    category: '数学函数'
  },
  {
    name: '蛋盒函数',
    type: 'function',
    equation: 'z=sin(x)*sin(y)',
    description: '蛋盒状起伏函数',
    category: '数学函数'
  },

  // === 艺术化图形 ===
  {
    name: '玫瑰花',
    type: 'parametric',
    equation: 'x=u*cos(v)*cos(3*v);y=u*sin(v)*cos(3*v);z=u*sin(3*v)',
    description: '玫瑰花瓣形状',
    category: '艺术图形'
  },
  {
    name: '蝴蝶曲面',
    type: 'parametric',
    equation: 'x=2*cos(u)*cos(v)*(1+cos(v));y=2*sin(u)*cos(v)*(1+cos(v));z=2*sin(v)*(1+cos(u))',
    description: '蝴蝶翅膀形状曲面',
    category: '艺术图形'
  },
  {
    name: '星形曲面',
    type: 'parametric',
    equation: 'x=u*cos(v)*(1+cos(5*v)/3);y=u*sin(v)*(1+cos(5*v)/3);z=u*sin(5*v)/2',
    description: '五角星形曲面',
    category: '艺术图形'
  },
  {
    name: '花朵曲面',
    type: 'parametric',
    equation: 'x=u*cos(v)*(1+sin(8*v)/4);y=u*sin(v)*(1+sin(8*v)/4);z=u*cos(8*v)/2',
    description: '八瓣花朵曲面',
    category: '艺术图形'
  },
  {
    name: '扇贝曲面',
    type: 'parametric',
    equation: 'x=u*cos(v)*(1+cos(12*v)/5);y=u*sin(v)*(1+cos(12*v)/5);z=u*sin(12*v)/3',
    description: '扇贝外壳形状',
    category: '艺术图形'
  },

  // === 复杂曲面 ===
  {
    name: '双曲面',
    type: 'parametric',
    equation: 'x=4*cos(u)/cos(v);y=3*sin(u)/cos(v);z=5*tan(v)',
    description: '双曲面结构',
    category: '复杂曲面'
  },
  {
    name: '扭曲面',
    type: 'parametric',
    equation: 'x=u*cos(v+u/3);y=u*sin(v+u/3);z=v+sin(u)*cos(v)',
    description: '扭曲的曲面',
    category: '复杂曲面'
  },
  {
    name: '波动曲面',
    type: 'parametric',
    equation: 'x=u*cos(v);y=u*sin(v);z=sin(3*u)*cos(2*v)*2',
    description: '带有波动的曲面',
    category: '复杂曲面'
  },
  {
    name: '螺纹曲面',
    type: 'parametric',
    equation: 'x=cos(u)*(3+cos(3*v));y=sin(u)*(3+cos(3*v));z=sin(3*v)+v',
    description: '螺纹状曲面',
    category: '复杂曲面'
  },

  // === 振荡函数 ===
  {
    name: '振荡山峰',
    type: 'function',
    equation: 'z=3*cos(sqrt(x*x+y*y))*exp(-sqrt(x*x+y*y)/5)',
    description: '振荡衰减的山峰',
    category: '振荡函数'
  },
  {
    name: '交叉波纹',
    type: 'function',
    equation: 'z=sin(x*2)*sin(y*2)*2',
    description: '交叉波纹图案',
    category: '振荡函数'
  },
  {
    name: '同心环波',
    type: 'function', 
    equation: 'z=2*sin(3*sqrt(x*x+y*y))',
    description: '同心环状波动',
    category: '振荡函数'
  },
  {
    name: '干涉波',
    type: 'function',
    equation: 'z=sin(x+y)*cos(x-y)*3',
    description: '波的干涉图案',
    category: '振荡函数'
  },

  // === 周期性图形 ===
  {
    name: '周期波浪',
    type: 'function',
    equation: 'z=sin(x)*cos(y)*sin(x*y/4)',
    description: '复杂周期波浪',
    category: '周期图形'
  },
  {
    name: '网格曲面',
    type: 'function',
    equation: 'z=sin(x*2)*sin(y*2)+cos(x)*cos(y)',
    description: '网格状起伏曲面',
    category: '周期图形'
  },
  {
    name: '棋盘曲面',
    type: 'function',
    equation: 'z=(sin(x*pi)*sin(y*pi)>0?2:-2)',
    description: '棋盘状高低曲面',
    category: '周期图形'
  },

  // === 参数化艺术 ===
  {
    name: '花环',
    type: 'parametric',
    equation: 'x=(2+cos(3*v))*cos(u);y=(2+cos(3*v))*sin(u);z=sin(3*v)',
    description: '花环形状',
    category: '参数艺术'
  },
  {
    name: '扭结',
    type: 'parametric',
    equation: 'x=cos(u)*(3+cos(v));y=sin(u)*(3+cos(v));z=sin(v)+cos(3*u)',
    description: '扭结状图形',
    category: '参数艺术'
  },
  {
    name: 'DNA模型',
    type: 'parametric',
    equation: 'x=cos(u)+2*cos(3*u)*cos(v);y=sin(u)+2*sin(3*u)*cos(v);z=2*sin(v)+u/3',
    description: 'DNA双螺旋模型',
    category: '参数艺术'
  },
  {
    name: '海螺壳',
    type: 'parametric',
    equation: 'x=u*cos(v)*(1+cos(u)/4);y=u*sin(v)*(1+cos(u)/4);z=u*sin(u)/4+v/3',
    description: '海螺壳形状',
    category: '参数艺术'
  },

  // === 数学经典 ===
  {
    name: '猴鞍面',
    type: 'function',
    equation: 'z=x*x*x-3*x*y*y',
    description: '猴鞍面（三次曲面）',
    category: '数学经典'
  },
  {
    name: 'Enneper曲面',
    type: 'parametric',
    equation: 'x=u-u*u*u/3+u*v*v;y=v-v*v*v/3+v*u*u;z=u*u-v*v',
    description: 'Enneper最小曲面',
    category: '数学经典'
  },
  {
    name: 'Catenoid曲面',
    type: 'parametric',
    equation: 'x=cos(u)*cos(v);y=cos(u)*sin(v);z=u',
    description: 'Catenoid最小曲面',
    category: '数学经典'
  },
  {
    name: 'Boy曲面',
    type: 'parametric',
    equation: 'x=cos(u)*sin(v);y=sin(u)*sin(v);z=cos(v)+cos(u)*cos(v)*cos(v)',
    description: 'Boy曲面投影',
    category: '数学经典'
  },

  // === 复杂函数 ===
  {
    name: '峡谷函数',
    type: 'function',
    equation: 'z=sin(x*x+y*y)/(x*x+y*y+1)*5',
    description: '峡谷状地形函数',
    category: '复杂函数'
  },
  {
    name: '火山函数',
    type: 'function',
    equation: 'z=5*exp(-((x*x+y*y)/4))*sin(sqrt(x*x+y*y)*3)',
    description: '火山口形状函数',
    category: '复杂函数'
  },
  {
    name: '涟漪函数',
    type: 'function',
    equation: 'z=2*sin(sqrt(x*x+y*y)*2)*cos(sqrt(x*x+y*y)/2)',
    description: '水面涟漪效果',
    category: '复杂函数'
  },
  {
    name: '花朵函数',
    type: 'function',
    equation: 'z=2*cos(sqrt(x*x+y*y))*sin(6*atan2(y,x))',
    description: '花朵瓣状函数',
    category: '复杂函数'
  },

  // === 几何变换 ===
  {
    name: '椭圆环面',
    type: 'parametric',
    equation: 'x=(4+2*cos(v))*cos(u);y=(4+cos(v))*sin(u);z=sin(v)',
    description: '椭圆截面的环面',
    category: '几何变换'
  },
  {
    name: '扭曲圆柱',
    type: 'parametric',
    equation: 'x=3*cos(u+v/4);y=3*sin(u+v/4);z=v*2',
    description: '扭曲的圆柱面',
    category: '几何变换'
  },
  {
    name: '锥形螺旋',
    type: 'parametric',
    equation: 'x=v*cos(u);y=v*sin(u);z=v*cos(3*u)',
    description: '锥形螺旋曲面',
    category: '几何变换'
  },
  {
    name: '波动圆柱',
    type: 'parametric',
    equation: 'x=(3+sin(5*v))*cos(u);y=(3+sin(5*v))*sin(u);z=v*2',
    description: '表面波动的圆柱',
    category: '几何变换'
  },

  // === 对称图形 ===
  {
    name: '四叶草',
    type: 'parametric',
    equation: 'x=u*cos(v)*(cos(2*v)+1);y=u*sin(v)*(cos(2*v)+1);z=u*sin(2*v)',
    description: '四叶草形状',
    category: '对称图形'
  },
  {
    name: '六边形波',
    type: 'parametric',
    equation: 'x=u*cos(v);y=u*sin(v);z=2*cos(3*atan2(sin(v),cos(v)))*cos(u)',
    description: '六边形对称波动',
    category: '对称图形'
  },
  {
    name: '八角星',
    type: 'parametric',
    equation: 'x=u*cos(v)*(1+cos(4*v)/2);y=u*sin(v)*(1+cos(4*v)/2);z=u*sin(4*v)',
    description: '八角星形曲面',
    category: '对称图形'
  },

  // === 自然形态 ===
  {
    name: '山脉地形',
    type: 'function',
    equation: 'z=3*sin(x/2)*cos(y/3)+2*cos(x/3)*sin(y/2)',
    description: '模拟山脉地形',
    category: '自然形态'
  },
  {
    name: '海浪',
    type: 'function',
    equation: 'z=2*sin(x+cos(y))*cos(y+sin(x))',
    description: '海浪起伏效果',
    category: '自然形态'
  },
  {
    name: '云朵曲面',
    type: 'function',
    equation: 'z=3*sin(x/2)*sin(y/2)*exp(-((x*x+y*y)/50))',
    description: '云朵状柔和曲面',
    category: '自然形态'
  },
  {
    name: '珊瑚礁',
    type: 'parametric',
    equation: 'x=u*cos(v)*(1+sin(6*v)/4+sin(15*u)/8);y=u*sin(v)*(1+sin(6*v)/4+sin(15*u)/8);z=u*cos(6*v)/2+sin(15*u)/4',
    description: '珊瑚礁复杂结构',
    category: '自然形态'
  },

  // === 分形图形 ===
  {
    name: '分形山',
    type: 'function',
    equation: 'z=sin(x)+sin(x*2)/2+sin(x*4)/4+cos(y)+cos(y*2)/2+cos(y*4)/4',
    description: '分形山地地形',
    category: '分形图形'
  },
  {
    name: '分形波',
    type: 'function', 
    equation: 'z=sin(x)+sin(x*3)/3+sin(x*9)/9+cos(y)+cos(y*3)/3+cos(y*9)/9',
    description: '分形波浪叠加',
    category: '分形图形'
  },

  // === 物理模型 ===
  {
    name: '电磁场',
    type: 'function',
    equation: 'z=3*sin(sqrt(x*x+y*y))*cos(atan2(y,x)*3)',
    description: '模拟电磁场分布',
    category: '物理模型'
  },
  {
    name: '重力场',
    type: 'function',
    equation: 'z=5/(sqrt((x-2)*(x-2)+(y-2)*(y-2))+1)+3/(sqrt((x+2)*(x+2)+(y+2)*(y+2))+1)',
    description: '双点重力场模型',
    category: '物理模型'
  },
  {
    name: '波的传播',
    type: 'function',
    equation: 'z=2*sin(sqrt(x*x+y*y)-5)*exp(-sqrt(x*x+y*y)/8)',
    description: '波的传播和衰减',
    category: '物理模型'
  },

  // === 趣味图形 ===
  {
    name: '魔方',
    type: 'function',
    equation: 'z=sin(x*pi)*sin(y*pi)*2+cos(x*pi/2)*cos(y*pi/2)',
    description: '魔方表面图案',
    category: '趣味图形'
  },
  {
    name: '迷宫',
    type: 'function',
    equation: 'z=(sin(x*pi)*sin(y*pi)>0?3:0)+(cos(x*pi/2)*cos(y*pi/2)>0?1:0)',
    description: '迷宫状地形',
    category: '趣味图形'
  },
  {
    name: '蜂窝',
    type: 'function',
    equation: 'z=sin(x*2)*cos(y*sqrt(3))+sin((x+y)*2)*cos((x-y)*sqrt(3))',
    description: '蜂窝六边形图案',
    category: '趣味图形'
  },
  {
    name: '金字塔群',
    type: 'function',
    equation: 'z=abs(sin(x*pi))*abs(sin(y*pi))*3',
    description: '金字塔群落',
    category: '趣味图形'
  }
]

// 当前选中的分类
const selectedCategory = ref('基础几何体')

// 分类选项
const categoryOptions = computed(() => {
  const categories = [
    { value: '基础几何体', label: '📐 基础几何体' },
    { value: '抛物面类', label: '📈 抛物面类' },
    { value: '双曲面类', label: '🔄 双曲面类' },
    { value: '螺旋类', label: '🌪️ 螺旋类' },
    { value: '环面类', label: '🍩 环面类' },
    { value: '波浪类', label: '🌊 波浪类' },
    { value: '特殊图形', label: '✨ 特殊图形' },
    { value: '数学函数', label: '📊 数学函数' },
    { value: '艺术图形', label: '🎨 艺术图形' },
    { value: '复杂曲面', label: '🔬 复杂曲面' },
    { value: '振荡函数', label: '📡 振荡函数' },
    { value: '周期图形', label: '🔄 周期图形' },
    { value: '参数艺术', label: '🎭 参数艺术' },
    { value: '数学经典', label: '📚 数学经典' },
    { value: '分形图形', label: '🔺 分形图形' },
    { value: '物理模型', label: '⚛️ 物理模型' },
    { value: '几何变换', label: '🔄 几何变换' },
    { value: '对称图形', label: '🔳 对称图形' },
    { value: '自然形态', label: '🌿 自然形态' },
    { value: '趣味图形', label: '🎲 趣味图形' }
  ]
  
  // 只返回有方程式的分类
  return categories.filter(cat => 
    presetEquations.some(eq => eq.category === cat.value)
  )
})

// 当前选中分类的方程式
const currentCategoryEquations = computed(() => {
  return presetEquations.filter(eq => eq.category === selectedCategory.value)
})

// 初始化3D场景
const initScene = () => {
  if (!canvasRef.value) return

  // 场景
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf8fafc)

  // 相机
  camera = new THREE.PerspectiveCamera(75, canvasRef.value.offsetWidth / canvasRef.value.offsetHeight, 0.1, 1000)
  camera.position.set(10, 10, 10)
  camera.lookAt(0, 0, 0)

  // 渲染器
  renderer = new THREE.WebGLRenderer({ canvas: canvasRef.value, antialias: true })
  renderer.setSize(canvasRef.value.offsetWidth, canvasRef.value.offsetHeight)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  // 添加光源
  const ambientLight = new THREE.AmbientLight(0x404040, 0.6)
  scene.add(ambientLight)
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
  directionalLight.position.set(10, 10, 5)
  directionalLight.castShadow = true
  scene.add(directionalLight)

  // 添加坐标轴
  addAxes()
  
  // 绘制方程式
  drawEquation()

  // 添加控制器
  addControls()
}

// 创建文字标识
const createTextSprite = (text: string, color = '#000000', size = 64) => {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')!
  
  canvas.width = size
  canvas.height = size
  
  context.fillStyle = color
  context.font = `bold ${size * 0.6}px Arial`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(text, size / 2, size / 2)
  
  const texture = new THREE.CanvasTexture(canvas)
  const material = new THREE.SpriteMaterial({ map: texture })
  const sprite = new THREE.Sprite(material)
  
  const scale = 2
  sprite.scale.set(scale, scale, 1)
  
  return sprite
}

// 添加坐标轴
const addAxes = () => {
  const axesHelper = new THREE.AxesHelper(10)
  scene.add(axesHelper)
  
  // 添加网格
  const gridHelper = new THREE.GridHelper(20, 20, 0x888888, 0xcccccc)
  scene.add(gridHelper)
  
  // 添加坐标轴标识
  const axisLength = 10
  
  // X轴标识 (红色)
  const xLabel = createTextSprite('X', '#ff0000')
  xLabel.position.set(axisLength + 1, 0, 0)
  scene.add(xLabel)
  
  // Y轴标识 (绿色) 
  const yLabel = createTextSprite('Y', '#00ff00')
  yLabel.position.set(0, axisLength + 1, 0)
  scene.add(yLabel)
  
  // Z轴标识 (蓝色)
  const zLabel = createTextSprite('Z', '#0000ff')
  zLabel.position.set(0, 0, axisLength + 1)
  scene.add(zLabel)
  
  // 添加刻度标识
  addAxisLabels()
}

// 添加坐标轴刻度标识
const addAxisLabels = () => {
  const labelDistance = 5
  const labelScale = 1.5
  
  // X轴刻度
  for (let i = -10; i <= 10; i += labelDistance) {
    if (i === 0) continue
    const label = createTextSprite(i.toString(), '#666666', 32)
    label.position.set(i, -0.5, 0)
    label.scale.set(labelScale, labelScale, 1)
    scene.add(label)
  }
  
  // Y轴刻度  
  for (let i = -10; i <= 10; i += labelDistance) {
    if (i === 0) continue
    const label = createTextSprite(i.toString(), '#666666', 32)
    label.position.set(-0.5, i, 0)
    label.scale.set(labelScale, labelScale, 1)
    scene.add(label)
  }
  
  // Z轴刻度
  for (let i = -10; i <= 10; i += labelDistance) {
    if (i === 0) continue
    const label = createTextSprite(i.toString(), '#666666', 32)
    label.position.set(0, -0.5, i)
    label.scale.set(labelScale, labelScale, 1)
    scene.add(label)
  }
  
  // 原点标识
  const originLabel = createTextSprite('O', '#333333', 32)
  originLabel.position.set(-1, -1, 0)
  originLabel.scale.set(labelScale, labelScale, 1)
  scene.add(originLabel)
}

// 添加控制器 
const addControls = () => {
  // 简单的鼠标控制
  let isMouseDown = false
  let mouseX = 0, mouseY = 0

  canvasRef.value?.addEventListener('mousedown', (e) => {
    isMouseDown = true
    mouseX = e.clientX
    mouseY = e.clientY
  })

  canvasRef.value?.addEventListener('mousemove', (e) => {
    if (!isMouseDown) return
    
    const deltaX = e.clientX - mouseX
    const deltaY = e.clientY - mouseY
    
    // 旋转相机
    const spherical = new THREE.Spherical()
    spherical.setFromVector3(camera.position)
    spherical.theta -= deltaX * 0.01
    spherical.phi += deltaY * 0.01
    spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi))
    
    camera.position.setFromSpherical(spherical)
    camera.lookAt(0, 0, 0)
    
    mouseX = e.clientX
    mouseY = e.clientY
  })

  canvasRef.value?.addEventListener('mouseup', () => {
    isMouseDown = false
  })

  // 缩放 - 增强版滚轮事件处理
  const handleWheel = (e: WheelEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()
    
    const scale = e.deltaY > 0 ? 1.1 : 0.9
    camera.position.multiplyScalar(scale)
    camera.position.x = Math.max(-50, Math.min(50, camera.position.x))
    camera.position.y = Math.max(-50, Math.min(50, camera.position.y))
    camera.position.z = Math.max(-50, Math.min(50, camera.position.z))
    
    return false
  }
  
  canvasRef.value?.addEventListener('wheel', handleWheel, { passive: false })
  
  // 鼠标进入画布时禁用页面滚动
  canvasRef.value?.addEventListener('mouseenter', () => {
    document.body.style.overflow = 'hidden'
  })
  
  // 鼠标离开画布时恢复页面滚动
  canvasRef.value?.addEventListener('mouseleave', () => {
    document.body.style.overflow = 'auto'
  })
}

// 解析并计算方程式
const evaluateEquation = (equations: string, u?: number, v?: number, x?: number, y?: number) => {
  try {
    const parts = equations.split(';')
    const result: any = {}
    
    parts.forEach(part => {
      const [variable, expression] = part.split('=')
      if (variable && expression) {
        // 创建安全的表达式替换
        let expr = expression.trim()
        
        // 先替换数学常数和函数
        expr = expr
          .replace(/\bpi\b/g, 'Math.PI')
          .replace(/\be\b(?!\w)/g, 'Math.E')  // 确保不匹配exp中的e
          .replace(/\bexp\b/g, 'Math.exp')
          .replace(/\blog\b/g, 'Math.log')
          .replace(/\bpow\b/g, 'Math.pow')
          .replace(/\bsqrt\b/g, 'Math.sqrt')
          .replace(/\babs\b/g, 'Math.abs')
          .replace(/\bcos\b/g, 'Math.cos')
          .replace(/\bsin\b/g, 'Math.sin') 
          .replace(/\btan\b/g, 'Math.tan')
          .replace(/\batan2\b/g, 'Math.atan2')
        
        // 安全地替换变量 - 使用括号包围数值以避免语法错误
        if (u !== undefined) {
          expr = expr.replace(/\bu\b/g, `(${u})`)
        }
        if (v !== undefined) {
          expr = expr.replace(/\bv\b/g, `(${v})`)
        }
        if (x !== undefined) {
          expr = expr.replace(/\bx\b/g, `(${x})`)
        }
        if (y !== undefined) {
          expr = expr.replace(/\by\b/g, `(${y})`)
        }
        
        // 处理指数运算符 ^ 转换为 Math.pow
        expr = expr.replace(/([^*\/+-]+)\^([^*\/+-]+)/g, 'Math.pow($1,$2)')
        
        // console.log('计算表达式:', expr) // 调试用
        
        const evalResult = eval(expr)
        result[variable.trim()] = isNaN(evalResult) || !isFinite(evalResult) ? 0 : evalResult
      }
    })
    
    return result
  } catch (error) {
    console.error('方程式计算错误:', error, '原始表达式:', equations)
    return null
  }
}

// 绘制方程式
const drawEquation = () => {
  // 清除现有的方程式图形
  const existingMesh = scene.getObjectByName('equation')
  if (existingMesh) {
    scene.remove(existingMesh)
  }

  let geometry: THREE.BufferGeometry
  
  if (equationParams.type === 'parametric') {
    geometry = createParametricGeometry()
  } else if (equationParams.type === 'function') {
    geometry = createFunctionGeometry()
  } else {
    return
  }

  const material = new THREE.MeshLambertMaterial({
    color: equationParams.color,
    transparent: true,
    opacity: equationParams.opacity,
    wireframe: equationParams.wireframe,
    side: THREE.DoubleSide
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'equation'
  scene.add(mesh)
}

// 创建参数方程几何体
const createParametricGeometry = () => {
  const vertices: number[] = []
  const indices: number[] = []
  
  const uSteps = Math.ceil((equationParams.rangeU.max - equationParams.rangeU.min) / equationParams.rangeU.step)
  const vSteps = Math.ceil((equationParams.rangeV.max - equationParams.rangeV.min) / equationParams.rangeV.step)
  
  // 生成顶点
  for (let i = 0; i <= uSteps; i++) {
    for (let j = 0; j <= vSteps; j++) {
      const u = equationParams.rangeU.min + (i / uSteps) * (equationParams.rangeU.max - equationParams.rangeU.min)
      const v = equationParams.rangeV.min + (j / vSteps) * (equationParams.rangeV.max - equationParams.rangeV.min)
      
      const point = evaluateEquation(equationParams.equation, u, v)
      if (point && point.x !== undefined && point.y !== undefined && point.z !== undefined) {
        vertices.push(point.x, point.y, point.z)
      } else {
        vertices.push(0, 0, 0) // 默认值
      }
    }
  }
  
  // 生成面索引
  for (let i = 0; i < uSteps; i++) {
    for (let j = 0; j < vSteps; j++) {
      const a = i * (vSteps + 1) + j
      const b = (i + 1) * (vSteps + 1) + j
      const c = (i + 1) * (vSteps + 1) + (j + 1)
      const d = i * (vSteps + 1) + (j + 1)
      
      indices.push(a, b, d)
      indices.push(b, c, d)
    }
  }
  
  const geometry = new THREE.BufferGeometry()
  geometry.setIndex(indices)
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.computeVertexNormals()
  
  return geometry
}

// 创建函数方程几何体
const createFunctionGeometry = () => {
  const vertices: number[] = []
  const indices: number[] = []
  
  const xSteps = Math.ceil((equationParams.rangeX.max - equationParams.rangeX.min) / equationParams.rangeX.step)
  const ySteps = Math.ceil((equationParams.rangeY.max - equationParams.rangeY.min) / equationParams.rangeY.step)
  
  // 生成顶点
  for (let i = 0; i <= xSteps; i++) {
    for (let j = 0; j <= ySteps; j++) {
      const x = equationParams.rangeX.min + (i / xSteps) * (equationParams.rangeX.max - equationParams.rangeX.min)
      const y = equationParams.rangeY.min + (j / ySteps) * (equationParams.rangeY.max - equationParams.rangeY.min)
      
      const point = evaluateEquation(equationParams.equation, undefined, undefined, x, y)
      if (point && point.z !== undefined && !isNaN(point.z) && isFinite(point.z)) {
        vertices.push(x, y, point.z)
      } else {
        vertices.push(x, y, 0) // 默认值
      }
    }
  }
  
  // 生成面索引
  for (let i = 0; i < xSteps; i++) {
    for (let j = 0; j < ySteps; j++) {
      const a = i * (ySteps + 1) + j
      const b = (i + 1) * (ySteps + 1) + j
      const c = (i + 1) * (ySteps + 1) + (j + 1)
      const d = i * (ySteps + 1) + (j + 1)
      
      indices.push(a, b, d)
      indices.push(b, c, d)
    }
  }
  
  const geometry = new THREE.BufferGeometry()
  geometry.setIndex(indices)
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.computeVertexNormals()
  
  return geometry
}

// 动画循环
const animate = () => {
  animationId = requestAnimationFrame(animate)
  renderer.render(scene, camera)
}

// 重新绘制
const redraw = () => {
  drawEquation()
}

// 设置预设方程式
const setPresetEquation = (preset: any) => {
  equationParams.type = preset.type
  equationParams.equation = preset.equation
  nextTick(() => {
    redraw()
  })
}

// 重置视角
const resetCamera = () => {
  camera.position.set(10, 10, 10)
  camera.lookAt(0, 0, 0)
}

// 窗口大小调整
const handleResize = () => {
  if (!canvasRef.value) return
  const width = canvasRef.value.offsetWidth
  const height = canvasRef.value.offsetHeight
  
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

onMounted(async () => {
  // 动态导入Three.js以减少初始包大小
  await nextTick()
  if (canvasRef.value) {
    initScene()
    animate()
    window.addEventListener('resize', handleResize)
  }
})

onUnmounted(() => {
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
  window.removeEventListener('resize', handleResize)
})
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white space-y-4">
      <!-- 方程式类型选择 -->
      <div class="space-y-2">
        <label class="text-body-sm font-medium text-gray-700">方程式类型</label>
        <el-radio-group v-model="equationParams.type" @change="redraw">
          <el-radio value="parametric">参数方程 (x=f(u,v), y=g(u,v), z=h(u,v))</el-radio>
          <el-radio value="function">函数方程 (z=f(x,y))</el-radio>
        </el-radio-group>
      </div>

      <!-- 方程式输入 -->
      <div class="space-y-2">
        <label class="text-body-sm font-medium text-gray-700">方程式</label>
        <el-input 
          v-model="equationParams.equation"
          placeholder="输入方程式，如: x=5*cos(u)*sin(v);y=5*sin(u)*sin(v);z=5*cos(v)"
          @input="redraw"
          class="font-mono"
        />
        <div class="text-caption text-gray-500">
          支持函数: cos, sin, tan, sqrt, abs, exp, log, pow, pi, e
        </div>
      </div>

      <!-- 预设方程式 -->
      <div class="space-y-3">
        <label class="text-body-sm font-medium text-gray-700">预设方程式 ({{ presetEquations.length }}个)</label>
        
        <!-- 分类选择 -->
        <div class="flex items-center gap-3 flex-wrap">
          <span class="text-body-sm text-gray-600">选择分类:</span>
          <el-select 
            v-model="selectedCategory" 
            placeholder="请选择分类"
            class="w-48"
            size="small"
          >
            <el-option
              v-for="category in categoryOptions"
              :key="category.value"
              :label="category.label"
              :value="category.value"
            />
          </el-select>
          <span class="text-caption text-gray-500">
            ({{ currentCategoryEquations.length }}个方程式)
          </span>
        </div>
        
        <!-- 当前分类的方程式 -->
        <div v-if="currentCategoryEquations.length > 0" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
          <el-button 
            v-for="preset in currentCategoryEquations" 
            :key="preset.name"
            size="small"
            type="primary"
            plain
            @click="setPresetEquation(preset)"
            :title="preset.description"
            class="text-caption justify-start"
          >
            {{ preset.name }}
          </el-button>
        </div>
        
        <!-- 快速切换常用分类 -->
        <div class="flex flex-wrap gap-1 items-center">
          <span class="text-caption text-gray-500 mr-2">快速切换:</span>
          <el-tag 
            v-for="quickCat in ['基础几何体', '波浪类', '艺术图形', '数学函数']"
            :key="quickCat"
            size="small"
            :type="selectedCategory === quickCat ? 'primary' : 'info'" 
            class="cursor-pointer"
            @click="selectedCategory = quickCat"
          >
            {{ quickCat }}
          </el-tag>
        </div>
      </div>

      <!-- 参数范围设置 -->
      <div v-if="equationParams.type === 'parametric'" class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="space-y-2">
          <label class="text-body-sm font-medium text-gray-700">参数 u 范围</label>
          <div class="flex gap-2 items-center">
            <el-input-number v-model="equationParams.rangeU.min" :step="0.1" size="small" @change="redraw" />
            <span>到</span>
            <el-input-number v-model="equationParams.rangeU.max" :step="0.1" size="small" @change="redraw" />
            <span>步长</span>
            <el-input-number v-model="equationParams.rangeU.step" :step="0.01" :min="0.01" size="small" @change="redraw" />
          </div>
        </div>
        <div class="space-y-2">
          <label class="text-body-sm font-medium text-gray-700">参数 v 范围</label>
          <div class="flex gap-2 items-center">
            <el-input-number v-model="equationParams.rangeV.min" :step="0.1" size="small" @change="redraw" />
            <span>到</span>
            <el-input-number v-model="equationParams.rangeV.max" :step="0.1" size="small" @change="redraw" />
            <span>步长</span>
            <el-input-number v-model="equationParams.rangeV.step" :step="0.01" :min="0.01" size="small" @change="redraw" />
          </div>
        </div>
      </div>

      <div v-if="equationParams.type === 'function'" class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="space-y-2">
          <label class="text-body-sm font-medium text-gray-700">x 轴范围</label>
          <div class="flex gap-2 items-center">
            <el-input-number v-model="equationParams.rangeX.min" :step="1" size="small" @change="redraw" />
            <span>到</span>
            <el-input-number v-model="equationParams.rangeX.max" :step="1" size="small" @change="redraw" />
            <span>步长</span>
            <el-input-number v-model="equationParams.rangeX.step" :step="0.1" :min="0.1" size="small" @change="redraw" />
          </div>
        </div>
        <div class="space-y-2">
          <label class="text-body-sm font-medium text-gray-700">y 轴范围</label>
          <div class="flex gap-2 items-center">
            <el-input-number v-model="equationParams.rangeY.min" :step="1" size="small" @change="redraw" />
            <span>到</span>
            <el-input-number v-model="equationParams.rangeY.max" :step="1" size="small" @change="redraw" />
            <span>步长</span>
            <el-input-number v-model="equationParams.rangeY.step" :step="0.1" :min="0.1" size="small" @change="redraw" />
          </div>
        </div>
      </div>

      <!-- 显示设置 -->
      <div class="flex flex-wrap gap-4 items-center">
        <div class="flex items-center gap-2">
          <label class="text-body-sm font-medium text-gray-700">颜色</label>
          <el-color-picker v-model="equationParams.color" @change="redraw" />
        </div>
        <div class="flex items-center gap-2">
          <label class="text-body-sm font-medium text-gray-700">透明度</label>
          <el-slider 
            v-model="equationParams.opacity" 
            :min="0.1" 
            :max="1" 
            :step="0.1"
            @change="redraw"
            style="width: 120px"
          />
        </div>
        <el-checkbox v-model="equationParams.wireframe" @change="redraw">线框模式</el-checkbox>
        <el-button @click="resetCamera" size="small">重置视角</el-button>
      </div>

      <!-- 3D画布 -->
      <div class="relative canvas-container">
        <canvas 
          ref="canvasRef" 
          class="w-full h-96 border border-gray-200 rounded-lg cursor-grab active:cursor-grabbing"
        ></canvas>
        <div class="absolute top-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-caption">
          鼠标拖拽旋转 | 滚轮缩放
        </div>
      </div>
    </div>

    <!-- 使用说明 -->
    <ToolDetail title="使用说明">
      <div class="space-y-4">
        <div>
          <h4 class="font-medium mb-2">参数方程</h4>
          <p class="text-body-sm text-gray-600 mb-2">格式: x=f(u,v);y=g(u,v);z=h(u,v)</p>
          <p class="text-body-sm text-gray-600">示例: x=5*cos(u)*sin(v);y=5*sin(u)*sin(v);z=5*cos(v) (球面)</p>
        </div>
        <div>
          <h4 class="font-medium mb-2">函数方程</h4>
          <p class="text-body-sm text-gray-600 mb-2">格式: z=f(x,y)</p>
          <p class="text-body-sm text-gray-600">示例: z=x*x/16+y*y/9 (椭圆抛物面)</p>
        </div>
        <div>
          <h4 class="font-medium mb-2">支持的函数</h4>
          <p class="text-body-sm text-gray-600">
            cos, sin, tan, sqrt, abs, exp, log, pow, pi, e<br/>
            运算符: +, -, *, /, ^, ()
          </p>
        </div>
        <div>
          <h4 class="font-medium mb-2">交互操作</h4>
          <p class="text-body-sm text-gray-600">
            • 鼠标拖拽：旋转视角<br/>
            • 滚轮：缩放视图<br/>
            • 调整参数范围和步长可改变精度和性能
          </p>
        </div>
      </div>
    </ToolDetail>
  </div>
</template>

<style scoped>
.el-radio {
  margin-right: 20px;
}

.canvas-container {
  touch-action: none;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  -khtml-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}

.canvas-container canvas {
  touch-action: none;
}
</style>
