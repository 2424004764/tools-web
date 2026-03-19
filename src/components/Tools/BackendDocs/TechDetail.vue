<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'

const route = useRoute()
const router = useRouter()

// 检测是否为移动端
const isMobile = ref(false)
const leftDrawerVisible = ref(false)

// 检测移动端
const checkMobile = () => {
  isMobile.value = window.innerWidth < 768
}

// 技术栈文档数据
const techDocs: Record<string, {
  name: string
  icon: string
  color: string
  chapters: {
    id: string
    title: string
    content: any[]
  }[]
}> = {
  mongodb: {
    name: 'MongoDB',
    icon: 'M',
    color: 'from-green-400 to-green-600',
    chapters: [
      {
        id: 'intro',
        title: 'MongoDB 简介',
        content: [
          {
            type: 'heading',
            text: '什么是 MongoDB'
          },
          {
            type: 'paragraph',
            text: 'MongoDB 是一个基于分布式文件存储的数据库，由 C++ 语言编写。旨在为 WEB 应用提供可扩展的高性能数据存储解决方案。'
          },
          {
            type: 'heading',
            text: '核心特点'
          },
          {
            type: 'list',
            items: [
              '<strong>文档型存储</strong>：数据以 BSON（Binary JSON）格式存储，灵活的文档模型',
              '<strong>高性能</strong>：支持内存缓存，查询性能高',
              '<strong>高可用性</strong>：支持自动故障转移和副本集',
              '<strong>可扩展性</strong>：支持水平分片，轻松扩展',
              '<strong>丰富的查询语言</strong>：支持丰富的查询表达式和聚合框架',
              '<strong>无模式</strong>：集合不需要预定义结构，便于快速迭代'
            ]
          },
          {
            type: 'heading',
            text: '应用场景'
          },
          {
            type: 'list',
            items: [
              '内容管理系统（CMS）',
              '实时大数据分析',
              '移动应用后端',
              '物联网（IoT）数据存储',
              '社交网络应用',
              '游戏数据存储'
            ]
          }
        ]
      },
      {
        id: 'vs-mysql',
        title: 'MongoDB vs MySQL',
        content: [
          {
            type: 'heading',
            text: '核心区别对比'
          },
          {
            type: 'table',
            headers: ['对比项', 'MongoDB', 'MySQL'],
            rows: [
              ['数据模型', '文档型（无模式）', '关系型（表结构）'],
              ['存储格式', 'BSON（类JSON）', '表格（行/列）'],
              ['Schema灵活性', '灵活，可随时修改字段', '固定，需预先定义表结构'],
              ['扩展方式', '水平分片', '垂直扩展为主'],
              ['事务支持', '4.0+支持多文档事务', '完整ACID事务'],
              ['查询语言', '丰富的查询API', '标准SQL'],
              ['性能特点', '高写入性能，适合大数据', '复杂查询优化成熟'],
              ['适用场景', '半结构化/非结构化数据', '结构化数据，复杂事务']
            ]
          },
          {
            type: 'heading',
            text: '什么时候选择 MongoDB'
          },
          {
            type: 'list',
            items: [
              '数据结构经常变化，需要灵活的 Schema',
              '需要存储大量的日志、事件流等半结构化数据',
              '需要水平扩展能力',
              '开发迭代速度快，Schema 不确定',
              '需要高吞吐量的写入操作'
            ]
          },
          {
            type: 'heading',
            text: '什么时候选择 MySQL'
          },
          {
            type: 'list',
            items: [
              '数据结构稳定，关系复杂',
              '需要强事务保证（如金融系统）',
              '需要复杂的多表关联查询',
              '团队更熟悉 SQL 生态',
              '需要成熟的分析和报表工具'
            ]
          }
        ]
      },
      {
        id: 'key-concepts',
        title: '核心概念',
        content: [
          {
            type: 'heading',
            text: '基本概念对比'
          },
          {
            type: 'paragraph',
            text: '理解 MongoDB 与关系型数据库的术语对应关系'
          },
          {
            type: 'table',
            headers: ['MongoDB', 'MySQL', '说明'],
            rows: [
              ['Database（数据库）', 'Database', '数据库容器'],
              ['Collection（集合）', 'Table', '文档集合'],
              ['Document（文档）', 'Row（行）', '数据记录'],
              ['Field（字段）', 'Column（列）', '数据字段'],
              ['Index（索引）', 'Index', '提高查询效率'],
              ['_id（主键）', 'Primary Key', '唯一标识符']
            ]
          },
          {
            type: 'heading',
            text: 'BSON 数据类型'
          },
          {
            type: 'list',
            items: [
              '<strong>String</strong>：字符串',
              '<strong>Integer</strong>：整数（32位/64位）',
              '<strong>Double</strong>：浮点数',
              '<strong>Boolean</strong>：布尔值',
              '<strong>Array</strong>：数组',
              '<strong>Object</strong>：嵌入式对象',
              '<strong>Null</strong>：空值',
              '<strong>Date</strong>：日期时间',
              '<strong>ObjectId</strong>：对象ID（文档唯一标识）',
              '<strong>Binary Data</strong>：二进制数据'
            ]
          }
        ]
      },
      {
        id: 'crud-operations',
        title: 'CRUD 操作',
        content: [
          {
            type: 'heading',
            text: '创建文档 (Create)'
          },
          {
            type: 'code',
            lang: 'javascript',
            code: `// 插入单条文档
db.users.insertOne({
  name: "张三",
  age: 25,
  email: "zhangsan@example.com",
  tags: ["developer", "mongodb"],
  createdAt: new Date()
})

// 插入多条文档
db.users.insertMany([
  { name: "李四", age: 30, role: "admin" },
  { name: "王五", age: 28, role: "user" }
])`
          },
          {
            type: 'heading',
            text: '查询文档 (Read)'
          },
          {
            type: 'code',
            lang: 'javascript',
            code: `// 查询所有文档
db.users.find()

// 条件查询
db.users.find({ age: { $gt: 25 } })

// 投影（只返回指定字段）
db.users.find({}, { name: 1, age: 1, _id: 0 })

// 排序
db.users.find().sort({ age: -1 })

// 限制数量
db.users.find().limit(10)`
          },
          {
            type: 'heading',
            text: '常用查询操作符'
          },
          {
            type: 'table',
            headers: ['操作符', '说明', '示例'],
            rows: [
              ['$eq', '等于', '{ age: 25 }'],
              ['$ne', '不等于', '{ age: { $ne: 25 } }'],
              ['$gt', '大于', '{ age: { $gt: 25 } }'],
              ['$gte', '大于等于', '{ age: { $gte: 25 } }'],
              ['$lt', '小于', '{ age: { $lt: 30 } }'],
              ['$lte', '小于等于', '{ age: { $lte: 30 } }'],
              ['$in', '在数组中', '{ age: { $in: [25, 30] } }'],
              ['$and', '与', '{ $and: [{ age: 25 }, { status: "active" }] }'],
              ['$or', '或', '{ $or: [{ age: 25 }, { role: "admin" }] }']
            ]
          },
          {
            type: 'heading',
            text: '更新文档 (Update)'
          },
          {
            type: 'code',
            lang: 'javascript',
            code: `// 更新单条文档
db.users.updateOne(
  { name: "张三" },
  { $set: { age: 26 } }
)

// 更新多条文档
db.users.updateMany(
  { role: "user" },
  { $set: { status: "active" } }
)

// 替换文档
db.users.replaceOne(
  { name: "张三" },
  { name: "张三", age: 27, city: "北京" }
)

// 常用更新操作符
db.users.updateOne(
  { _id: ObjectId("...") },
  {
    $set: { age: 28 },              // 设置字段值
    $unset: { tempField: 1 },       // 删除字段
    $inc: { score: 10 },            // 字段增加值
    $push: { tags: "mongodb" },     // 数组添加元素
    $pull: { tags: "old" },         // 数组删除元素
    $rename: { oldName: "newName" } // 重命名字段
  }
)`
          },
          {
            type: 'heading',
            text: '删除文档 (Delete)'
          },
          {
            type: 'code',
            lang: 'javascript',
            code: `// 删除单条文档
db.users.deleteOne({ name: "张三" })

// 删除多条文档
db.users.deleteMany({ status: "inactive" })

// 删除集合所有文档
db.users.deleteMany({})`
          }
        ]
      },
      {
        id: 'index',
        title: '索引',
        content: [
          {
            type: 'heading',
            text: '索引概述'
          },
          {
            type: 'paragraph',
            text: '索引可以显著提高查询性能，但会增加写入开销和存储空间。'
          },
          {
            type: 'heading',
            text: '创建索引'
          },
          {
            type: 'code',
            lang: 'javascript',
            code: `// 创建单字段索引
db.users.createIndex({ email: 1 })

// 创建复合索引
db.users.createIndex({ name: 1, age: -1 })

// 创建唯一索引
db.users.createIndex({ email: 1 }, { unique: true })

// 创建稀疏索引（只索引存在该字段的文档）
db.users.createIndex({ phone: 1 }, { sparse: true })

// 创建文本索引（全文搜索）
db.articles.createIndex({ content: "text" })

// 查看索引
db.users.getIndexes()

// 删除索引
db.users.dropIndex("email_1")`
          },
          {
            type: 'heading',
            text: '索引类型'
          },
          {
            type: 'list',
            items: [
              '<strong>单字段索引</strong>：对单个字段建立索引',
              '<strong>复合索引</strong>：对多个字段组合建立索引',
              '<strong>唯一索引</strong>：确保字段值唯一',
              '<strong>稀疏索引</strong>：只索引包含该字段的文档',
              '<strong>文本索引</strong>：支持文本搜索',
              '<strong>地理空间索引</strong>：支持地理位置查询',
              '<strong>哈希索引</strong>：基于哈希值的索引'
            ]
          },
          {
            type: 'heading',
            text: '索引优化建议'
          },
          {
            type: 'list',
            items: [
              '<strong>优先满足常用查询</strong>：根据查询频率和排序字段建立索引',
              '<strong>覆盖索引</strong>：索引包含查询所需字段，避免回表',
              '<strong>使用 hint()</strong>：强制使用特定索引进行查询优化',
              '<strong>避免过多索引</strong>：过多索引会影响写入性能',
              '<strong>定期审查</strong>：使用 db.collection.getIndexes() 和 explain() 检查索引使用情况'
            ]
          }
        ]
      },
      {
        id: 'aggregation',
        title: '聚合框架',

        content: [
          {
            type: 'heading',
            text: '聚合管道'
          },
          {
            type: 'paragraph',
            text: 'MongoDB 的聚合框架提供了强大的数据处理能力，通过管道操作符对数据进行转换和计算。'
          },
          {
            type: 'code',
            lang: 'javascript',
            code: `db.orders.aggregate([
  // $match: 筛选文档
  { $match: { status: "completed" } },

  // $group: 分组统计
  {
    $group: {
      _id: "$userId",
      totalAmount: { $sum: "$amount" },
      count: { $sum: 1 },
      avgAmount: { $avg: "$amount" }
    }
  },

  // $sort: 排序
  { $sort: { totalAmount: -1 } },

  // $limit: 限制结果数量
  { $limit: 10 },

  // $project: 投影（指定输出字段）
  {
    $project: {
      userId: "$_id",
      totalAmount: 1,
      count: 1,
      _id: 0
    }
  }
])`
          },
          {
            type: 'heading',
            text: '常用聚合操作符'
          },
          {
            type: 'table',
            headers: ['操作符', '说明'],
            rows: [
              ['$match', '筛选符合条件的文档'],
              ['$group', '按字段分组统计'],
              ['$project', '重塑文档结构，选择/重命名字段'],
              ['$sort', '排序'],
              ['$limit', '限制返回数量'],
              ['$skip', '跳过指定数量'],
              ['$lookup', '左连接其他集合'],
              ['$unwind', '展开数组'],
              ['$addFields', '添加新字段'],
              ['$facet', '多管道并行处理'],
              ['$count', '统计文档数量'],
              ['$sample', '随机抽样']
            ]
          },
          {
            type: 'heading',
            text: '分组统计示例'
          },
          {
            type: 'code',
            lang: 'javascript',
            code: `// 统计表达式
$sum: 值总和
$avg: 平均值
$min: 最小值
$max: 最大值
$first: 第一个值
$last: 最后一个值
$count: 计数
$push: 构建数组

// 按日期分组统计
db.sales.aggregate([
  {
    $group: {
      _id: {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" }
      },
      totalSales: { $sum: "$amount" },
      count: { $sum: 1 }
    }
  }
])`
          }
        ]
      },
      {
        id: 'replica-set',
        title: '副本集与高可用',
        content: [
          {
            type: 'heading',
            text: '副本集概述'
          },
          {
            type: 'paragraph',
            text: '副本集是 MongoDB 实现高可用性的基础，通过数据冗余和自动故障转移保证服务连续性。'
          },
          {
            type: 'heading',
            text: '副本集架构'
          },
          {
            type: 'list',
            items: [
              '<strong>Primary（主节点）</strong>：处理所有写操作，默认处理读操作',
              '<strong>Secondary（从节点）</strong>：复制主节点数据，可处理读请求',
              '<strong>Arbiter（仲裁节点）</strong>：不存储数据，仅参与选举'
            ]
          },
          {
            type: 'heading',
            text: '初始化副本集'
          },
          {
            type: 'code',
            lang: 'javascript',
            code: `// 启动 MongoDB 时指定副本集
mongod --replSet rs0 --port 27017

// 连接到 MongoDB 后初始化副本集
rs.initiate({
  _id: "rs0",
  members: [
    { _id: 0, host: "localhost:27017" },
    { _id: 1, host: "localhost:27018" },
    { _id: 2, host: "localhost:27019" }
  ]
})

// 查看副本集状态
rs.status()

// 添加成员
rs.add("localhost:27020")

// 移除成员
rs.remove("localhost:27020")`
          },
          {
            type: 'heading',
            text: '读写分离'
          },
          {
            type: 'code',
            lang: 'javascript',
            code: `// 设置读偏好（客户端）
// primary: 只从主节点读（默认）
// primaryPreferred: 优先主节点
// secondary: 只从节点读
// secondaryPreferred: 优先从节点
// nearest: 读延迟最低的节点

db.collection.find().readPref("secondary")`
          },
          {
            type: 'heading',
            text: '副本集配置优化'
          },
          {
            type: 'list',
            items: [
              '<strong>优先级 (priority)</strong>：控制节点选举主节点的倾向',
              '<strong>隐藏节点 (hidden)</strong>：用于备份/分析，避免对外提供服务',
              '<strong>投票权 (votes)</strong>：通常设置为1，仲裁节点可设置为0',
              '<strong>Oplog 大小</strong>：在高写入场景下适当增大以减少延迟',
              '<strong>心跳间隔</strong>：默认2秒，可根据网络环境调整'
            ]
          }
        ]
      },
      {
        id: 'sharding',
        title: '分片与扩展',

        content: [
          {
            type: 'heading',
            text: '分片概述'
          },
          {
            type: 'paragraph',
            text: '分片是 MongoDB 实现水平扩展的核心技术，将数据分散存储在多个服务器上。'
          },
          {
            type: 'heading',
            text: '分片架构组件'
          },
          {
            type: 'list',
            items: [
              '<strong>Shard（分片服务器）</strong>：存储数据分片',
              '<strong>Config Server（配置服务器）</strong>：存储集群元数据',
              '<strong>Mongos（路由服务器）</strong>：请求路由，协调查询'
            ]
          },
          {
            type: 'heading',
            text: '分片键选择'
          },
          {
            type: 'paragraph',
            text: '分片键决定了数据如何分布，选择合适的分片键至关重要。'
          },
          {
            type: 'code',
            lang: 'javascript',
            code: `// 启用分片
sh.enableSharding("mydb")

// 对集合进行分片
sh.shardCollection("mydb.users", { userId: 1 })

// 哈希分片（均匀分布）
sh.shardCollection("mydb.logs", { _id: "hashed" })`
          },
          {
            type: 'heading',
            text: '分片键选择原则'
          },
          {
            type: 'list',
            items: [
              '基数足够大（区分度高）',
              '分布均匀，避免热点',
              '考虑查询模式',
              '避免频繁修改的字段'
            ]
          }
        ]
      },
      {
        id: 'performance',
        title: '性能优化',
        content: [
          {
            type: 'heading',
            text: '查询优化'
          },
          {
            type: 'list',
            items: [
              '<strong>创建合适的索引</strong>：为常用查询字段创建索引',
              '<strong>使用投影减少返回数据</strong>：只返回需要的字段',
              '<strong>使用 $explain 分析查询</strong>：查看执行计划',
              '<strong>避免全表扫描</strong>：确保查询能使用索引',
              '<strong>合理使用分页</strong>：使用 limit() 和 skip()'
            ]
          },
          {
            type: 'heading',
            text: '分析执行计划'
          },
          {
            type: 'code',
            lang: 'javascript',
            code: `// 查看查询执行计划
db.users.find({ age: { $gt: 25 } }).explain("executionStats")

// 重点关注 stage、indexName、nReturned、totalKeysExamined、totalDocsExamined 等字段`
          },
          {
            type: 'heading',
            text: '写入优化'
          },

          {
            type: 'list',
            items: [
              '<strong>批量操作</strong>：使用 insertMany、bulkWrite',
              '<strong>调整写入关注</strong>：根据需求平衡性能和安全性',
              '<strong>使用批量插入而非单条插入</strong>'
            ]
          },
          {
            type: 'code',
            lang: 'javascript',
            code: `// 查询分析
db.users.find({ age: 25 }).explain("executionStats")

// 批量写入
db.collection.bulkWrite([
  { insertOne: { document: { name: "A" } } },
  { updateOne: { filter: { name: "B" }, update: { $set: { age: 30 } } } },
  { deleteOne: { filter: { name: "C" } } }
])`
          }
        ]
      },
      {
        id: 'transactions',
        title: '事务与ACID',
        content: [
          {
            type: 'heading',
            text: 'MongoDB 事务概述'
          },
          {
            type: 'paragraph',
            text: '从 MongoDB 4.0 开始支持多文档事务，提供 ACID 保证。事务可以跨越多个文档、集合甚至数据库。'
          },
          {
            type: 'heading',
            text: '事务语法'
          },
          {
            type: 'code',
            lang: 'javascript',
            code: `// 单文档事务（隐式）
db.collection.insertOne({ name: "test" })

// 多文档事务（显式）
const session = db.getMongo().startSession()

session.startTransaction({
  readConcern: { level: "snapshot" },
  writeConcern: { w: "majority" }
})

try {
  // 在事务中执行操作
  db.accounts.updateOne(
    { _id: "account1" },
    { $inc: { balance: -100 } },
    { session }
  )
  
  db.accounts.updateOne(
    { _id: "account2" },
    { $inc: { balance: 100 } },
    { session }
  )
  
  // 提交事务
  session.commitTransaction()
} catch (error) {
  // 回滚事务
  session.abortTransaction()
} finally {
  session.endSession()
}`
          },
          {
            type: 'heading',
            text: '事务限制'
          },
          {
            type: 'list',
            items: [
              '<strong>运行时间限制</strong>：默认60秒，可配置',
              '<strong>数据大小限制</strong>：16MB（WiredTiger缓存大小）',
              '<strong>操作数量限制</strong>：1000个操作',
              '<strong>只读事务不支持</strong>：快照隔离',
              '<strong>分片集群限制</strong>：某些操作不支持'
            ]
          },
          {
            type: 'heading',
            text: 'ACID 属性'
          },
          {
            type: 'table',
            headers: ['属性', 'MongoDB实现', '说明'],
            rows: [
              ['原子性(Atomicity)', '✓', '事务中的操作要么全部成功，要么全部失败'],
              ['一致性(Consistency)', '✓', '事务前后数据库保持一致状态'],
              ['隔离性(Isolation)', '快照隔离', '事务间相互隔离，避免脏读、不可重复读、幻读'],
              ['持久性(Durability)', '✓', '事务提交后数据持久化到磁盘']
            ]
          }
        ]
      },
      {
        id: 'security',
        title: '安全配置',
        content: [
          {
            type: 'heading',
            text: '认证与授权'
          },
          {
            type: 'code',
            lang: 'javascript',
            code: `// 启用认证启动
mongod --auth --keyFile /path/to/keyfile

// 创建管理员用户
use admin
db.createUser({
  user: "admin",
  pwd: "password",
  roles: ["userAdminAnyDatabase", "dbAdminAnyDatabase", "readWriteAnyDatabase"]
})

// 创建应用用户
use myapp
db.createUser({
  user: "appuser",
  pwd: "apppassword",
  roles: ["readWrite"]
})

// 角色权限说明
// read: 只读权限
// readWrite: 读写权限
// dbAdmin: 数据库管理权限
// userAdmin: 用户管理权限
// clusterAdmin: 集群管理权限`
          },
          {
            type: 'heading',
            text: 'TLS/SSL 加密'
          },
          {
            type: 'code',
            lang: 'bash',
            code: `# 生成自签名证书
openssl req -newkey rsa:2048 -new -x509 -days 365 -nodes \\
  -out mongodb-cert.crt -keyout mongodb-cert.key

# 合并证书和私钥
cat mongodb-cert.key mongodb-cert.crt > mongodb.pem

# 启用 TLS
mongod --tlsMode requireTLS --tlsCertificateKeyFile mongodb.pem`
          },
          {
            type: 'heading',
            text: '网络安全'
          },
          {
            type: 'list',
            items: [
              '<strong>绑定IP</strong>：使用 --bind_ip 限制监听地址',
              '<strong>防火墙</strong>：只开放必要端口（27017）',
              '<strong>VPN</strong>：生产环境建议使用VPN访问',
              '<strong>禁用HTTP接口</strong>：--nohttpinterface'
            ]
          },
          {
            type: 'heading',
            text: '数据加密'
          },
          {
            type: 'list',
            items: [
              '<strong>静态加密</strong>：使用 WiredTiger 加密存储引擎',
              '<strong>传输加密</strong>：TLS/SSL 加密网络传输',
              '<strong>字段级加密</strong>：客户端字段级加密（CSFLE）'
            ]
          }
        ]
      },
      {
        id: 'monitoring',
        title: '监控与维护',
        content: [
          {
            type: 'heading',
            text: '监控指标'
          },
          {
            type: 'code',
            lang: 'javascript',
            code: `// 服务器状态
db.serverStatus()

// 数据库统计
db.stats()

// 集合统计
db.collection.stats()

// 当前操作
db.currentOp()

// 慢查询日志
db.setProfilingLevel(2, { slowms: 100 })

// 查看慢查询
db.system.profile.find().sort({ ts: -1 }).limit(5)`
          },
          {
            type: 'heading',
            text: '常用监控工具'
          },
          {
            type: 'list',
            items: [
              '<strong>MongoDB Cloud Manager</strong>：官方监控平台',
              '<strong>MongoDB Ops Manager</strong>：企业版监控工具',
              '<strong>Prometheus + Grafana</strong>：开源监控栈',
              '<strong>DataDog</strong>：第三方监控服务',
              '<strong>Zabbix</strong>：开源监控系统'
            ]
          },
          {
            type: 'heading',
            text: '维护命令'
          },
          {
            type: 'code',
            lang: 'javascript',
            code: `// 数据库修复
db.repairDatabase()

// 压缩存储
db.runCommand({ compact: "collection" })

// 重新索引
db.collection.reIndex()

// 验证集合
db.collection.validate({ full: true })

// 导出数据
mongoexport --db=test --collection=users --out=users.json

// 导入数据
mongoimport --db=test --collection=users --file=users.json`
          },
          {
            type: 'heading',
            text: '日志管理'
          },
          {
            type: 'code',
            lang: 'bash',
            code: `# 日志轮转
mongod --logpath /var/log/mongodb/mongod.log \\
       --logRotate reopen

# 日志级别设置
db.setLogLevel(1, "query")
db.setLogLevel(0, "query")  # 恢复默认`
          }
        ]
      },
      {
        id: 'modeling',
        title: '数据建模',
        content: [
          {
            type: 'heading',
            text: '文档设计原则'
          },
          {
            type: 'list',
            items: [
              '<strong>内嵌 vs 引用</strong>：根据访问模式选择',
              '<strong>读写比例</strong>：读多场景优先内嵌',
              '<strong>数据局部性</strong>：相关数据放在一起',
              '<strong>原子性需求</strong>：需要事务的数据考虑引用',
              '<strong>文档大小限制</strong>：单个文档不超过16MB'
            ]
          },
          {
            type: 'heading',
            text: '内嵌文档模式'
          },
          {
            type: 'code',
            lang: 'javascript',
            code: `// 用户资料（内嵌地址）
{
  _id: ObjectId("..."),
  name: "张三",
  email: "zhangsan@example.com",
  addresses: [
    {
      type: "home",
      street: "北京市朝阳区",
      city: "北京",
      country: "中国"
    },
    {
      type: "work",
      street: "北京市海淀区",
      city: "北京",
      country: "中国"
    }
  ]
}

// 博客文章（内嵌评论）
{
  _id: ObjectId("..."),
  title: "MongoDB 最佳实践",
  content: "...",
  author: {
    name: "李四",
    email: "lisi@example.com"
  },
  comments: [
    {
      author: "王五",
      content: "很好",
      createdAt: ISODate("2023-01-01")
    }
  ]
}`
          },
          {
            type: 'heading',
            text: '引用模式'
          },
          {
            type: 'code',
            lang: 'javascript',
            code: `// 用户集合
{
  _id: ObjectId("user1"),
  name: "张三",
  email: "zhangsan@example.com"
}

// 订单集合（引用用户）
{
  _id: ObjectId("order1"),
  userId: ObjectId("user1"),  // 引用
  items: [...],
  total: 100,
  createdAt: ISODate("2023-01-01")
}

// 父子引用
{
  _id: ObjectId("parent"),
  children: [ObjectId("child1"), ObjectId("child2")]
}`
          },
          {
            type: 'heading',
            text: '模式设计反模式'
          },
          {
            type: 'list',
            items: [
              '<strong>过大文档</strong>：避免文档频繁增长',
              '<strong>不必要的数组</strong>：数组查询效率低',
              '<strong>过度内嵌</strong>：导致数据冗余',
              '<strong>不合理的分片键</strong>：影响查询性能'
            ]
          }
        ]
      },
      {
        id: 'backup-recovery',
        title: '备份与恢复',
        content: [
          {
            type: 'heading',
            text: '备份策略'
          },
          {
            type: 'list',
            items: [
              '<strong>逻辑备份</strong>：mongoexport/mongoimport',
              '<strong>物理备份</strong>：文件系统快照',
              '<strong>副本集备份</strong>：从节点备份减少影响',
              '<strong>分片集群备份</strong>：mongodump --oplog'
            ]
          },
          {
            type: 'heading',
            text: 'mongodump 备份'
          },
          {
            type: 'code',
            lang: 'bash',
            code: `# 全库备份
mongodump --out /backup/$(date +%Y%m%d)

# 指定数据库备份
mongodump --db=myapp --out /backup/myapp

# 压缩备份
mongodump --db=myapp --gzip --out /backup/myapp

# 备份时包含oplog（点时间恢复）
mongodump --oplog --out /backup/oplog_backup`
          },
          {
            type: 'heading',
            text: '恢复数据'
          },
          {
            type: 'code',
            lang: 'bash',
            code: `# 恢复数据库
mongorestore /backup/myapp

# 恢复到不同数据库
mongorestore --db=newapp /backup/myapp/myapp

# 从压缩备份恢复
mongorestore --gzip /backup/myapp

# 点时间恢复
mongorestore --oplogReplay /backup/oplog_backup`
          },
          {
            type: 'heading',
            text: '自动化备份脚本'
          },
          {
            type: 'code',
            lang: 'bash',
            code: `#!/bin/bash
BACKUP_DIR="/backup"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="myapp"

# 创建备份目录
mkdir -p $BACKUP_DIR/$DATE

# 执行备份
mongodump --db=$DB_NAME --out=$BACKUP_DIR/$DATE --gzip

# 清理7天前的备份
find $BACKUP_DIR -type d -mtime +7 -exec rm -rf {} +

echo "Backup completed: $BACKUP_DIR/$DATE"`
          }
        ]
      },
      {
        id: 'advanced-features',
        title: '高级特性',
        content: [
          {
            type: 'heading',
            text: '变更流 (Change Streams)'
          },
          {
            type: 'paragraph',
            text: '变更流允许应用程序监听数据库的实时变更，实现事件驱动架构。'
          },
          {
            type: 'code',
            lang: 'javascript',
            code: `// 监听集合变更
const changeStream = db.collection.watch()

changeStream.on('change', (change) => {
  console.log('变更类型:', change.operationType)
  console.log('文档ID:', change.documentKey._id)
  
  if (change.operationType === 'insert') {
    console.log('新文档:', change.fullDocument)
  }
})

// 监听特定操作
db.collection.watch([
  { $match: { operationType: { $in: ['insert', 'update'] } } }
])

// 带过滤的变更流
db.collection.watch([
  {
    $match: {
      $and: [
        { operationType: 'update' },
        { 'updateDescription.updatedFields.status': { $exists: true } }
      ]
    }
  }
])`
          },
          {
            type: 'heading',
            text: '地理空间查询'
          },
          {
            type: 'code',
            lang: 'javascript',
            code: `// 创建地理空间索引
db.places.createIndex({ location: "2dsphere" })

// 插入地理位置数据
db.places.insertMany([
  {
    name: "天安门",
    location: {
      type: "Point",
      coordinates: [116.3974, 39.9093]  // [经度, 纬度]
    }
  },
  {
    name: "故宫",
    location: {
      type: "Point", 
      coordinates: [116.3974, 39.9163]
    }
  }
])

// 附近查询
db.places.find({
  location: {
    $near: {
      $geometry: {
        type: "Point",
        coordinates: [116.4074, 39.9093]
      },
      $maxDistance: 1000  // 米
    }
  }
})

// 多边形查询
db.places.find({
  location: {
    $geoWithin: {
      $geometry: {
        type: "Polygon",
        coordinates: [[
          [116.3, 39.8],
          [116.5, 39.8],
          [116.5, 40.0],
          [116.3, 40.0],
          [116.3, 39.8]
        ]]
      }
    }
  }
})`
          },
          {
            type: 'heading',
            text: '全文搜索'
          },
          {
            type: 'code',
            lang: 'javascript',
            code: `// 创建文本索引
db.articles.createIndex({ 
  title: "text", 
  content: "text" 
})

// 基本文本搜索
db.articles.find({ 
  $text: { $search: "MongoDB 数据库" } 
})

// 带权重的文本搜索
db.articles.find({
  $text: {
    $search: "MongoDB",
    $caseSensitive: false,
    $diacriticSensitive: false
  }
})

// 文本搜索评分
db.articles.find(
  { $text: { $search: "database" } },
  { score: { $meta: "textScore" } }
).sort({ score: { $meta: "textScore" } })`
          },
          {
            type: 'heading',
            text: 'GridFS 大文件存储'
          },
          {
            type: 'code',
            lang: 'javascript',
            code: `// 存储大文件
const fs = require('fs')
const mongo = require('mongodb')

// 获取GridFS桶
const bucket = new mongo.GridFSBucket(db, { bucketName: 'files' })

// 上传文件
fs.createReadStream('./large-file.pdf')
  .pipe(bucket.openUploadStream('large-file.pdf', {
    metadata: { 
      author: '张三',
      uploadDate: new Date()
    }
  }))

// 下载文件
bucket.openDownloadStreamByName('large-file.pdf')
  .pipe(fs.createWriteStream('./downloaded-file.pdf'))

// 查询文件信息
db.files.find({ filename: 'large-file.pdf' })`
          }
        ]
      }
    ]
  }
}

// 当前技术栈
const currentTech = ref<any>(null)
const activeChapter = ref<string>('')

// 获取技术栈信息
const loadTechData = () => {
  const techId = route.params.techId as string
  if (techDocs[techId]) {
    currentTech.value = techDocs[techId]
    // 设置默认激活章节（第一个章节）
    if (currentTech.value && currentTech.value.chapters.length > 0 && !activeChapter.value) {
      activeChapter.value = currentTech.value.chapters[0].id
    }
  } else {
    // 技术栈不存在，返回列表页
    router.push('/backend-docs')
  }
}

// 检测当前可见章节
const updateActiveChapter = () => {
  if (!currentTech.value) return
  
  const chapters = currentTech.value.chapters
  
  for (let i = chapters.length - 1; i >= 0; i--) {
    const element = document.getElementById(chapters[i].id)
    if (element) {
      const rect = element.getBoundingClientRect()
      if (rect.top <= 100) { // 章节顶部距离视口顶部100px以内
        activeChapter.value = chapters[i].id
        break
      }
    }
  }
}

// 滚动到指定章节
const scrollToChapter = (chapterId: string) => {
  const element = document.getElementById(chapterId)
  if (element) {
    const offset = 80 // 顶部导航栏高度
    const elementPosition = element.getBoundingClientRect().top
    const offsetPosition = elementPosition + window.pageYOffset - offset

    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth'
    })
    
    // 更新URL hash
    router.replace({ hash: `#${chapterId}` })
    
    // 设置激活状态
    activeChapter.value = chapterId
    
    // 聚焦到元素（无障碍性）
    element.focus({ preventScroll: true })
    
    if (isMobile.value) {
      leftDrawerVisible.value = false
    }
  }
}

onMounted(async () => {
  await nextTick()
  window.requestAnimationFrame(() => {
    checkMobile()
  })
  window.addEventListener('resize', checkMobile)
  window.addEventListener('scroll', updateActiveChapter)
  loadTechData()

  // 检查 URL hash，滚动到对应章节
  if (route.hash) {
    nextTick(() => {
      const chapterId = route.hash.slice(1)
      scrollToChapter(chapterId)
    })
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
  window.removeEventListener('scroll', updateActiveChapter)
})

// 监听路由变化
watch(() => route.params.techId, () => {
  loadTechData()
})

// 监听路由 hash 变化
watch(() => route.hash, (newHash) => {
  if (newHash) {
    nextTick(() => {
      const chapterId = newHash.slice(1)
      scrollToChapter(chapterId)
    })
  }
})

// 返回列表页
const goBack = () => {
  router.push('/backend-docs')
}

// 渲染内容块
const renderContent = (item: any) => {
  switch (item.type) {
    case 'heading':
      return item.text
    case 'paragraph':
      return item.text
    case 'list':
      return item.items
    case 'table':
      return { headers: item.headers, rows: item.rows }
    case 'code':
      return { lang: item.lang, code: item.code }
    default:
      return null
  }
}
</script>

<template>
  <div class="flex flex-col mt-3 min-h-screen">
    <DetailHeader :title="currentTech?.name || '技术文档'"></DetailHeader>

    <!-- 返回按钮 -->
    <div class="mb-4">
      <el-button @click="goBack" :icon="ArrowLeft" circle />
    </div>

    <!-- 主内容区 -->
    <div class="bg-white rounded-2xl flex-1 flex">
      <!-- 左侧目录 -->
      <div
        v-if="currentTech && !isMobile"
        class="fixed left-60 top-24 w-64 h-[calc(100vh-6rem)] border-r border-gray-100 bg-gray-50 overflow-y-auto z-10"
      >
        <div class="p-4">
          <!-- 技术栈信息 -->
          <div :class="['w-12 h-12 rounded-lg bg-gradient-to-br ' + currentTech.color + ' flex items-center justify-center mb-4']">
            <span class="text-xl font-bold text-white">{{ currentTech.icon }}</span>
          </div>
          <h3 class="font-bold text-gray-800 mb-4">{{ currentTech.name }} 文档</h3>

          <!-- 章节目录 -->
          <div class="space-y-1">
            <a
              v-for="chapter in currentTech.chapters"
              :key="chapter.id"
              :href="`#${chapter.id}`"
              :class="[
                'block px-3 py-2 rounded-lg transition-all duration-200 text-sm no-underline',
                activeChapter === chapter.id 
                  ? 'bg-blue-100 text-blue-900 font-medium' 
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              ]"
              @click.prevent="scrollToChapter(chapter.id)"
            >
              {{ chapter.title }}
            </a>
          </div>
        </div>
      </div>

      <!-- 移动端抽屉 -->
      <el-drawer
        v-model="leftDrawerVisible"
        direction="ltr"
        :size="280"
        v-if="isMobile && currentTech"
      >
        <template #header>
          <div class="flex items-center gap-3">
            <div :class="['w-10 h-10 rounded-lg bg-gradient-to-br ' + currentTech.color + ' flex items-center justify-center']">
              <span class="text-lg font-bold text-white">{{ currentTech.icon }}</span>
            </div>
            <span class="font-bold">{{ currentTech.name }} 文档</span>
          </div>
        </template>
        <div class="space-y-1">
          <a
            v-for="chapter in currentTech.chapters"
            :key="chapter.id"
            :href="`#${chapter.id}`"
            :class="[
              'block px-3 py-2 rounded-lg transition-all duration-200 no-underline',
              activeChapter === chapter.id 
                ? 'bg-blue-100 text-blue-900 font-medium' 
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            ]"
            @click.prevent="scrollToChapter(chapter.id)"
          >
            {{ chapter.title }}
          </a>
        </div>
      </el-drawer>

      <!-- 右侧内容区 -->
      <div :class="isMobile ? 'flex-1' : 'ml-64 flex-1'">
        <!-- 移动端目录按钮 -->
        <div
          v-if="isMobile && currentTech"
          class="p-4 border-b border-gray-100 flex items-center gap-3 sticky top-0 bg-white z-10"
        >
          <el-button @click="leftDrawerVisible = true" :icon="Menu" circle />
          <span class="font-medium text-gray-800">{{ currentTech.name }} 文档</span>
        </div>

        <!-- 内容区域 -->
        <div id="tech-detail-scroll-container" class="flex-1 p-6 overflow-auto break-words">
          <div v-if="currentTech" class="space-y-12">
            <!-- 遍历所有章节 -->
            <div
              v-for="chapter in currentTech.chapters"
              :id="chapter.id"
              :key="chapter.id"
              class="chapter-section scroll-mt-20"
              tabindex="-1"
            >
              <h2 class="text-2xl font-bold text-gray-800 mb-6 pb-4 border-b border-gray-100">
                {{ chapter.title }}
              </h2>

              <div class="prose prose-gray max-w-none space-y-6">
                <div v-for="(item, index) in chapter.content" :key="index" class="content-block">
                  <!-- 标题 -->
                  <h3 v-if="item.type === 'heading'" class="text-xl font-semibold text-gray-800 mt-6 mb-3">
                    {{ renderContent(item) }}
                  </h3>

                  <!-- 段落 -->
                  <p v-else-if="item.type === 'paragraph'" class="text-gray-600 leading-relaxed">
                    {{ renderContent(item) }}
                  </p>

                  <!-- 列表 -->
                  <ul v-else-if="item.type === 'list'" class="space-y-2">
                    <li v-for="(listItem, i) in item.items" :key="i" class="flex items-start gap-2 text-gray-600">
                      <span class="text-green-500 mt-1">•</span>
                      <span v-html="listItem"></span>
                    </li>
                  </ul>

                  <!-- 表格 -->
                  <div v-else-if="item.type === 'table'" :class="isMobile ? 'my-4 break-words' : 'overflow-x-auto my-4 break-words'">
                    <table class="min-w-full divide-y divide-gray-200 border border-gray-200">
                      <thead class="bg-gray-50">
                        <tr>
                          <th
                            v-for="(header, i) in item.headers"
                            :key="i"
                            class="px-4 py-3 text-left text-sm font-semibold text-gray-700"
                          >
                            {{ header }}
                          </th>
                        </tr>
                      </thead>
                      <tbody class="bg-white divide-y divide-gray-200">
                        <tr v-for="(row, i) in item.rows" :key="i">
                          <td
                            v-for="(cell, j) in row"
                            :key="j"
                            class="px-4 py-3 text-sm text-gray-600"
                            v-html="cell"
                          ></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <!-- 代码块 -->
                  <div v-else-if="item.type === 'code'" class="my-4 break-words">
                    <div class="flex items-center justify-between px-4 py-2 bg-gray-800 text-gray-300 text-sm rounded-t-lg">
                      <span>{{ item.lang }}</span>
                    </div>
                    <pre :class="isMobile ? 'bg-gray-900 text-gray-100 p-4 rounded-b-lg text-sm leading-relaxed break-words whitespace-pre-wrap' : 'bg-gray-900 text-gray-100 p-4 overflow-x-auto rounded-b-lg text-sm leading-relaxed break-words whitespace-pre-wrap'"><code>{{ item.code }}</code></pre>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 空状态 -->
          <div v-else class="flex items-center justify-center text-gray-400 h-64">
            加载中...
          </div>
        </div>
      </div>
    </div>

    <!-- 返回顶部 -->
    <el-backtop
      target="#tech-detail-scroll-container"
      :visibility-height="240"
      :right="20"
      :bottom="64"
    />
  </div>
</template>

<script lang="ts">
import { ArrowLeft, Menu } from '@element-plus/icons-vue'
export default {
  components: { ArrowLeft, Menu }
}
</script>

<style scoped>
.content-block h3:first-child {
  margin-top: 0;
}

/* 代码块样式优化 */
pre code {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
}

/* 表格样式优化 */
table {
  font-size: 14px;
}

/* 响应式表格 */
@media (max-width: 768px) {
  table {
    font-size: 12px;
  }
}

/* 锚点偏移 */
.scroll-mt-20 {
  scroll-margin-top: 5rem;
}

/* 取消锚点聚焦自动黑色边框 */
.chapter-section:focus,
.chapter-section:focus-visible,
.chapter-section:target {
  outline: none !important;
  box-shadow: none !important;
}

/* 左侧目录滚动条样式 */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
}

::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
</style>
