// 技术文档数据管理
export interface TechDocData {
  name: string
  icon: string
  color: string
  chapters: {
    id: string
    title: string
    children?: {
      id: string
      title: string
    }[]
    content: any[]
  }[]
}

// MongoDB 文档数据
export const mongodbDoc: TechDocData = {
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
          text: '读取文档 (Read)'
        },
        {
          type: 'code',
          lang: 'javascript',
          code: `// 查询所有文档
db.users.find()

// 条件查询
db.users.find({ age: { $gte: 25 } })

// 查询单个文档
db.users.findOne({ email: "zhangsan@example.com" })

// 投影（只返回指定字段）
db.users.find({}, { name: 1, email: 1, _id: 0 })

// 排序
db.users.find().sort({ age: -1 })

// 分页
db.users.find().skip(10).limit(5)`
        },
        {
          type: 'heading',
          text: '更新文档 (Update)'
        },
        {
          type: 'code',
          lang: 'javascript',
          code: `// 更新单个文档
db.users.updateOne(
  { email: "zhangsan@example.com" },
  { $set: { age: 26, updatedAt: new Date() } }
)

// 更新多个文档
db.users.updateMany(
  { role: "user" },
  { $set: { status: "active" } }
)

// 替换整个文档
db.users.replaceOne(
  { email: "zhangsan@example.com" },
  {
    name: "张三",
    age: 26,
    email: "zhangsan@example.com",
    role: "senior-developer"
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
          code: `// 删除单个文档
db.users.deleteOne({ email: "zhangsan@example.com" })

// 删除多个文档
db.users.deleteMany({ status: "inactive" })

// 删除所有文档
db.users.deleteMany({})`
        }
      ]
    },
    {
      id: 'indexing',
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
  { $limit: 10 }
])`
        },
        {
          type: 'heading',
          text: '常用聚合操作符'
        },
        {
          type: 'table',
          headers: ['阶段', '操作符', '说明'],
          rows: [
            ['$match', '筛选条件', '过滤文档，类似find()'],
            ['$group', '分组统计', '按字段分组并计算聚合值'],
            ['$sort', '排序', '对结果进行排序'],
            ['$limit', '限制数量', '限制返回文档数量'],
            ['$skip', '跳过文档', '跳过指定数量的文档'],
            ['$project', '字段投影', '选择、重命名和转换字段'],
            ['$unwind', '展开数组', '将数组字段展开为多个文档'],
            ['$lookup', '左连接', '类似SQL的LEFT JOIN']
          ]
        },
        {
          type: 'heading',
          text: '聚合表达式'
        },
        {
          type: 'code',
          lang: 'javascript',
          code: `// 数学表达式
{ $sum: "$price" }      // 求和
{ $avg: "$price" }      // 平均值
{ $min: "$price" }      // 最小值
{ $max: "$price" }      // 最大值

// 条件表达式
{
  $cond: {
    if: { $gte: ["$score", 60] },
    then: "及格",
    else: "不及格"
  }
}

// 字符串表达式
{ $concat: ["$firstName", " ", "$lastName"] }  // 字符串拼接
{ $toLower: "$name" }     // 转小写
{ $toUpper: "$name" }     // 转大写

// 数组表达式
{ $size: "$tags" }        // 数组长度
{ $in: ["mongodb", "$tags"] }  // 是否包含元素`
        }
      ]
    },
    {
      id: 'replication',
      title: '副本集',
      content: [
        {
          type: 'heading',
          text: '副本集概述'
        },
        {
          type: 'paragraph',
          text: '副本集是一组维护相同数据集的 MongoDB 服务器，提供数据冗余和高可用性。'
        },
        {
          type: 'heading',
          text: '副本集架构'
        },
        {
          type: 'list',
          items: [
            '<strong>Primary（主节点）</strong>：接收所有写操作',
            '<strong>Secondary（从节点）</strong>：从主节点复制数据，提供读操作',
            '<strong>Arbiter（仲裁节点）</strong>：参与选举，不存储数据'
          ]
        },
        {
          type: 'heading',
          text: '部署副本集'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# 启动三个 MongoDB 实例
mongod --replSet rs0 --port 27017 --dbpath /data/db1
mongod --replSet rs0 --port 27018 --dbpath /data/db2
mongod --replSet rs0 --port 27019 --dbpath /data/db3

# 启动仲裁节点
mongod --replSet rs0 --port 27020 --dbpath /data/arbiter`
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
          text: '分片策略'
        },
        {
          type: 'list',
          items: [
            '<strong>范围分片</strong>：基于分片键值的范围分布数据',
            '<strong>哈希分片</strong>：基于分片键哈希值均匀分布数据',
            '<strong>区域分片</strong>：基于地理位置或自定义标签分布数据'
          ]
        },
        {
          type: 'heading',
          text: '分片管理'
        },
        {
          type: 'code',
          lang: 'javascript',
          code: `// 查看分片状态
sh.status()

// 添加分片服务器
sh.addShard("rs1/localhost:27021,localhost:27022")

// 重新平衡分片
sh.startBalancer()
sh.stopBalancer()

// 查看分片分布
db.collection.getShardDistribution()`
        }
      ]
    },
    {
      id: 'transactions',
      title: '事务',
      content: [
        {
          type: 'heading',
          text: '多文档事务'
        },
        {
          type: 'paragraph',
          text: 'MongoDB 4.0+ 支持多文档事务，确保多个文档操作的原子性。'
        },
        {
          type: 'code',
          lang: 'javascript',
          code: `// 启动事务会话
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
          code: `# 生成证书
openssl req -new -x509 -days 365 -out mongodb.crt -keyout mongodb.key

# 合并证书和私钥
cat mongodb.key mongodb.crt > mongodb.pem

# 启用 TLS 启动
mongod --sslMode requireSSL --sslPEMKeyFile mongodb.pem`
        },
        {
          type: 'heading',
          text: '网络安全'
        },
        {
          type: 'code',
          lang: 'javascript',
          code: `// 绑定特定 IP
mongod --bind_ip 127.0.0.1,192.168.1.100

// 禁用 HTTP 接口
mongod --nohttpinterface

// 设置最大连接数
mongod --maxConns 1000`
        },
        {
          type: 'heading',
          text: '审计日志'
        },
        {
          type: 'code',
          lang: 'javascript',
          code: `// 启用审计
mongod --auditDestination file --auditFormat JSON --auditPath /var/log/mongodb/audit.log

// 审计配置
db.createUser({
  user: "auditor",
  pwd: "auditpass",
  roles: ["clusterAdmin"]
})`
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
            '<strong>逻辑备份</strong>：使用 mongoexport/mongoimport，灵活但慢',
            '<strong>物理备份</strong>：直接复制数据文件，快但需要停止服务',
            '<strong>副本集备份</strong>：从从节点备份，不影响主节点',
            '<strong>分片集群备份</strong>：需要备份所有组件'
          ]
        },
        {
          type: 'heading',
          text: '使用 mongodump 备份'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# 备份整个数据库
mongodump --db mydb --out /backup/$(date +%Y%m%d)

# 备份特定集合
mongodump --db mydb --collection users --out /backup/users

# 压缩备份
mongodump --db mydb --out /backup --gzip

# 远程备份
mongodump --host mongodb.example.com --port 27017 --db mydb --out /backup`
        },
        {
          type: 'heading',
          text: '使用 mongorestore 恢复'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# 恢复数据库
mongorestore --db mydb /backup/mydb

# 恢复到不同数据库
mongorestore --db newdb /backup/mydb

# 从压缩备份恢复
mongorestore --gzip --db mydb /backup/mydb

# 恢复特定集合
mongorestore --db mydb --collection users /backup/mydb/users`
        },
        {
          type: 'heading',
          text: '自动化备份脚本'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `#!/bin/bash

# 备份脚本
DB_NAME="mydb"
BACKUP_DIR="/backup"
DATE=$(date +%Y%m%d_%H%M%S)

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
      id: 'monitoring',
      title: '监控与维护',
      content: [
        {
          type: 'heading',
          text: '监控指标'
        },
        {
          type: 'list',
          items: [
            '<strong>连接数</strong>：当前活跃连接数量',
            '<strong>操作统计</strong>：读写操作的频率和延迟',
            '<strong>内存使用</strong>：WiredTiger缓存和系统内存',
            '<strong>磁盘I/O</strong>：读写操作的磁盘性能',
            '<strong>副本集状态</strong>：主从同步延迟和健康状态',
            '<strong>慢查询日志</strong>：识别性能瓶颈'
          ]
        },
        {
          type: 'heading',
          text: '数据库状态检查'
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

// 副本集状态
rs.status()

// 分片状态
sh.status()`
        },
        {
          type: 'heading',
          text: '性能分析'
        },
        {
          type: 'code',
          lang: 'javascript',
          code: `// 启用性能分析器
db.setProfilingLevel(2, { slowms: 100 })

// 查看慢查询
db.system.profile.find().sort({ ts: -1 }).limit(5)

// 解释查询执行计划
db.collection.find({ field: "value" }).explain("executionStats")

// 查看当前操作
db.currentOp()`
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
  userId: ObjectId("user1"),  // 引用用户ID
  items: [...],
  total: 100
}

// 使用 $lookup 进行关联查询
db.orders.aggregate([
  {
    $lookup: {
      from: "users",
      localField: "userId",
      foreignField: "_id",
      as: "user"
    }
  }
])`
        },
        {
          type: 'heading',
          text: '数据建模最佳实践'
        },
        {
          type: 'list',
          items: [
            '<strong>优先考虑读取模式</strong>：设计时优先考虑应用的主要查询模式',
            '<strong>避免过度规范化</strong>：MongoDB 不需要严格的规范化设计',
            '<strong>使用合适的分片键</strong>：为分片集群选择合适的分片键',
            '<strong>预留字段</strong>：为未来可能的变化预留一些字段',
            '<strong>定期审查</strong>：随着应用发展定期审查数据模型'
          ]
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
db.articles.createIndex({ title: "text", content: "text" })

// 文本搜索
db.articles.find({
  $text: { $search: "MongoDB 教程" }
})

// 带分数的文本搜索
db.articles.find(
  { $text: { $search: "MongoDB" } },
  { score: { $meta: "textScore" } }
).sort({ score: { $meta: "textScore" } })

// 排除特定词
db.articles.find({
  $text: { $search: "MongoDB -MySQL" }
})`
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

// 连接数据库
const client = await mongo.MongoClient.connect('mongodb://localhost:27017')
const db = client.db('mydb')
const bucket = new mongo.GridFSBucket(db)

// 上传文件
const uploadStream = bucket.openUploadStream('large-file.pdf')
fs.createReadStream('./large-file.pdf').pipe(uploadStream)

// 下载文件
const downloadStream = bucket.openDownloadStreamByName('large-file.pdf')
downloadStream.pipe(fs.createWriteStream('./downloaded-file.pdf'))`
        }
      ]
    }
  ]
}

// MySQL 文档数据
export const mysqlDoc: TechDocData = {
  name: 'MySQL',
  icon: 'M',
  color: 'from-blue-400 to-blue-600',
  chapters: [
    {
      id: 'intro',
      title: 'MySQL 简介',
      content: [
        {
          type: 'heading',
          text: '什么是 MySQL'
        },
        {
          type: 'paragraph',
          text: 'MySQL 是最流行的开源关系型数据库管理系统，由 Oracle 公司维护。MySQL 8.0 是当前主流版本，引入了窗口函数、CTE、JSON增强等大量新特性。'
        },
        {
          type: 'heading',
          text: '核心特点'
        },
        {
          type: 'list',
          items: [
            '<strong>关系型数据库</strong>：基于表结构的数据存储，支持完整的 SQL 标准',
            '<strong>ACID 事务</strong>：InnoDB 引擎保证数据一致性和完整性',
            '<strong>高性能</strong>：优化的查询引擎、索引系统和查询缓存',
            '<strong>可扩展性</strong>：支持读写分离、分库分表和集群部署',
            '<strong>丰富的生态</strong>：广泛的工具、驱动和社区支持',
            '<strong>多存储引擎</strong>：InnoDB（默认）、MyISAM、Memory、CSV 等'
          ]
        },
        {
          type: 'heading',
          text: 'MySQL 8.0 新特性'
        },
        {
          type: 'list',
          items: [
            '<strong>窗口函数</strong>：支持 ROW_NUMBER()、RANK()、DENSE_RANK() 等',
            '<strong>公用表表达式 (CTE)</strong>：支持递归和非递归 CTE',
            '<strong>JSON 增强</strong>：JSON 表函数、JSON 聚合函数、部分索引更新',
            '<strong>降序索引</strong>：真正支持降序扫描，提升 ORDER BY DESC 性能',
            '<strong>不可见索引</strong>：索引维护不影响查询，便于测试和优化',
            '<strong>直方图统计</strong>：改进查询优化器的统计信息收集',
            '<strong>资源组</strong>：精细控制资源使用，支持多租户隔离',
            '<strong>认证增强</strong>：默认使用 caching_sha2_password，提升安全性'
          ]
        }
      ]
    },
    {
      id: 'architecture',
      title: '架构与存储引擎',
      content: [
        {
          type: 'heading',
          text: 'MySQL 架构'
        },
        {
          type: 'paragraph',
          text: 'MySQL 采用分层架构设计：'
        },
        {
          type: 'list',
          items: [
            '<strong>连接层</strong>：负责客户端连接、身份认证、线程管理',
            '<strong>服务层</strong>：SQL 接口、解析器、优化器、缓存',
            '<strong>存储引擎层</strong>：负责数据的存储和提取',
            '<strong>存储层</strong>：文件系统、数据文件、日志文件'
          ]
        },
        {
          type: 'heading',
          text: '存储引擎对比'
        },
        {
          type: 'table',
          headers: ['特性', 'InnoDB', 'MyISAM', 'Memory'],
          rows: [
            ['事务支持', '✓', '✗', '✗'],
            ['外键约束', '✓', '✗', '✗'],
            ['行级锁', '✓', '✗', '✓'],
            ['表级锁', '✓', '✓', '✓'],
            ['崩溃恢复', '✓', '✗', '✗'],
            ['支持外键', '✓', '✗', '✗'],
            ['适用场景', 'OLTP', '读密集', '临时表']
          ]
        },
        {
          type: 'heading',
          text: 'InnoDB 引擎深入'
        },
        {
          type: 'list',
          items: [
            '<strong>缓冲池 (Buffer Pool)</strong>：缓存数据页和索引页，默认 128MB',
            '<strong>重做日志 (Redo Log)</strong>：实现崩溃恢复和持久性',
            '<strong>撤销日志 (Undo Log)</strong>：支持 MVCC 和事务回滚',
            '<strong>更改缓冲 (Change Buffer)</strong>：缓存辅助索引的变更',
            '<strong>自适应哈希索引</strong>：自动为热点数据创建哈希索引'
          ]
        },
        {
          type: 'heading',
          text: '企业级配置示例'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `[mysqld]
# 基础配置
port = 3306
datadir = /var/lib/mysql
socket = /var/lib/mysql/mysql.sock

# 字符集 (推荐 utf8mb4)
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci

# 连接配置
max_connections = 500
max_connect_errors = 10000
wait_timeout = 28800
interactive_timeout = 28800

# InnoDB 内存配置 (物理内存的 70-80%)
innodb_buffer_pool_size = 4G
innodb_buffer_pool_instances = 4
innodb_log_file_size = 512M
innodb_log_buffer_size = 16M

# InnoDB I/O 配置
innodb_io_capacity = 2000
innodb_io_capacity_max = 4000
innodb_flush_method = O_DIRECT

# InnoDB 并发配置
innodb_read_io_threads = 8
innodb_write_io_threads = 8
innodb_purge_threads = 4
innodb_page_cleaners = 4

# 事务配置
innodb_flush_log_at_trx_commit = 1  # 安全性最高
sync_binlog = 1                     # 双一配置，保证安全

# 慢查询日志
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 2

# Binlog 配置
log_bin = mysql-bin
binlog_format = ROW
binlog_row_image = FULL
expire_logs_days = 7`
        }
      ]
    },
    {
      id: 'request-flow',
      title: '从请求到 MySQL',
      children: [
        { id: 'request-flow-app', title: '应用请求到数据库的链路' },
        { id: 'request-flow-mysql', title: 'MySQL 内部执行链路' },
        { id: 'request-flow-select', title: 'SELECT 语句执行' },
        { id: 'request-flow-write', title: '写语句执行' },
        { id: 'request-flow-buffer-pool', title: 'Buffer Pool 高频考点' },
        { id: 'request-flow-buffer-pool-params', title: 'Buffer Pool 关键参数' },
        { id: 'request-flow-buffer-pool-hit-rate', title: '命中率怎么看' },
        { id: 'request-flow-interview', title: '常见问题' }
      ],
      content: [
        {
          type: 'heading',
          id: 'request-flow-app',
          text: '应用请求到数据库的链路'
        },
        {
          type: 'paragraph',
          text: '面试里如果被问“一个请求是怎么查到 MySQL 的”，建议按“应用侧链路 + MySQL 内部执行链路”来回答，表达会更完整。'
        },
        {
          type: 'list',
          items: [
            '<strong>1. 请求进入应用</strong>：浏览器或客户端请求先到 Nginx / 网关，再转发到应用服务。',
            '<strong>2. 业务层组织 SQL</strong>：Controller -> Service -> DAO/Repository，最终由 ORM 或数据库驱动拼出 SQL。',
            '<strong>3. 连接池获取连接</strong>：应用通常不会每次现建连接，而是从 HikariCP、Druid 等连接池中拿一个可用连接，减少 TCP 建连和鉴权开销。',
            '<strong>4. SQL 发往 MySQL</strong>：驱动通过 MySQL 协议把 SQL 发给服务端，随后进入 MySQL 内部执行流程。'
          ]
        },
        {
          type: 'heading',
          id: 'request-flow-mysql',
          text: 'MySQL 内部执行链路'
        },
        {
          type: 'list',
          items: [
            '<strong>连接器</strong>：负责 TCP 连接、用户认证、权限校验、线程分配。连接建立后，当前会话的权限信息会被缓存到这个连接里。',
            '<strong>查询缓存</strong>：这是老版本常见考点，但 MySQL 8.0 已移除 Query Cache，面试中最好主动说明这一点。',
            '<strong>解析器</strong>：先做词法分析，再做语法分析，识别 SQL 关键字、表名、字段名，生成语法树；语法错误一般在这一层报出。',
            '<strong>预处理器</strong>：检查表和列是否存在，处理别名、权限、类型转换等语义问题。',
            '<strong>优化器</strong>：基于成本选择执行计划，例如走哪个索引、是否使用覆盖索引、是否索引下推、Join 顺序怎么排。',
            '<strong>执行器</strong>：按照执行计划调用存储引擎接口，真正把读写请求交给 InnoDB 去完成。'
          ]
        },
        {
          type: 'heading',
          id: 'request-flow-select',
          text: '一条 SELECT 语句会发生什么'
        },
        {
          type: 'list',
          items: [
            '<strong>先拿执行计划</strong>：执行器根据优化器选出的索引和访问路径开始查找数据。',
            '<strong>先查 Buffer Pool</strong>：InnoDB 会先看目标数据页是否已经在 Buffer Pool 中，命中则直接读内存，未命中才去磁盘读取 16KB 页到内存。',
            '<strong>可能发生回表</strong>：如果先通过二级索引定位到主键，再根据主键去聚簇索引取整行，这就是回表；覆盖索引可以避免这一步。',
            '<strong>一致性读依赖 MVCC</strong>：普通快照读会结合 undo log 找到当前事务可见的数据版本，减少读写冲突。',
            '<strong>结果返回客户端</strong>：存储引擎把记录交给执行器，执行器再把结果集返回给应用。'
          ]
        },
        {
          type: 'heading',
          id: 'request-flow-write',
          text: '一条 UPDATE/INSERT/DELETE 语句会发生什么'
        },
        {
          type: 'list',
          items: [
            '<strong>先定位记录并加锁</strong>：更新前需要找到目标行，必要时加行锁或间隙锁，防止并发问题。',
            '<strong>修改 Buffer Pool 中的数据页</strong>：真正的数据页通常先在内存里修改，修改后的页称为脏页。',
            '<strong>写 Undo Log</strong>：用于事务回滚和 MVCC，保证旧版本可追溯。',
            '<strong>写 Redo Log</strong>：这是 WAL 思想，先顺序写日志，再择机刷数据页，保证崩溃恢复能力。',
            '<strong>写 Binlog</strong>：Server 层记录逻辑日志，主要用于主从复制和数据恢复。',
            '<strong>两阶段提交</strong>：提交事务时要协调 redo log 和 binlog，避免一个成功一个失败导致主从或恢复结果不一致。'
          ]
        },
        {
          type: 'heading',
          id: 'request-flow-buffer-pool',
          text: 'Buffer Pool 高频考点'
        },
        {
          type: 'list',
          items: [
            '<strong>它是什么</strong>：InnoDB 的核心内存区域，用来缓存数据页、索引页、undo 页等，MySQL 快很大程度依赖它。',
            '<strong>为什么能提升性能</strong>：很多查询会反复访问热点页，命中 Buffer Pool 就不需要磁盘随机 I/O。',
            '<strong>脏页不是坏页</strong>：脏页只是“内存已改、磁盘未刷”的页，后台线程会在合适时机刷盘。',
            '<strong>和 Redo Log 的关系</strong>：Buffer Pool 负责加速读写，Redo Log 负责持久化保障；一个偏性能，一个偏可靠性。',
            '<strong>命中率低的原因</strong>：Buffer Pool 太小、全表扫描过多、索引设计差、热点数据分散，都会让磁盘 I/O 上升。'
          ]
        },
        {
          type: 'heading',
          id: 'request-flow-buffer-pool-params',
          text: 'Buffer Pool 关键参数'
        },
        {
          type: 'list',
          items: [
            '<strong>innodb_buffer_pool_size</strong>：最核心的参数，决定 Buffer Pool 总大小。线上调优先看它，通常建议分配为机器内存的 50% 到 80%，专用数据库机器可以更高。常见参考值：8GB 内存可先给 4GB~6GB，16GB 内存可先给 8GB~12GB，32GB 内存可先给 16GB~24GB；如果命中率长期低于 99%，优先评估继续增大它。',
            '<strong>innodb_buffer_pool_instances</strong>：把 Buffer Pool 切成多个实例，降低并发争用。一般在 Buffer Pool 较大时再配置，例如 1GB 以上可以考虑拆分。',
            '<strong>innodb_buffer_pool_chunk_size</strong>：控制在线调整 Buffer Pool 时的伸缩粒度，和动态扩容、缩容有关。',
            '<strong>innodb_old_blocks_pct / innodb_old_blocks_time</strong>：控制 LRU 链表里 old 区域比例和停留时间，降低大查询或全表扫描把热点页挤掉的风险。',
            '<strong>innodb_buffer_pool_dump_at_shutdown / innodb_buffer_pool_load_at_startup</strong>：关闭时导出热点页、启动时预热加载，减少重启后的冷启动问题。'
          ]
        },
        {
          type: 'heading',
          id: 'request-flow-buffer-pool-hit-rate',
          text: '命中率怎么看'
        },
        {
          type: 'paragraph',
          text: 'Buffer Pool 命中率常用来判断内存是否足够。面试里可以直接说：如果命中率长期小于 99%，通常说明 Buffer Pool 偏小，应优先评估增大 innodb_buffer_pool_size。'
        },
        {
          type: 'code',
          lang: 'sql',
          code: `-- 查看 Buffer Pool 相关状态
SHOW GLOBAL STATUS LIKE 'Innodb_buffer_pool_read%';

-- 关键指标说明
-- Innodb_buffer_pool_reads: 需要从磁盘读取页的次数
-- Innodb_buffer_pool_read_requests: 逻辑读请求次数

-- 常见命中率公式
-- hit rate = 1 - Innodb_buffer_pool_reads / Innodb_buffer_pool_read_requests

-- 如果命中率长期低于 99%，通常优先考虑增大 innodb_buffer_pool_size
-- 但也要同时排查：
-- 1. 是否存在大量全表扫描
-- 2. 是否索引设计不合理
-- 3. 是否有大查询把热点页挤出缓存`
        },
        {
          type: 'heading',
          id: 'request-flow-interview',
          text: '常见问题'
        },
        {
          type: 'list',
          items: [
            '<strong>为什么写请求提交成功了，数据页可能还没落盘？</strong>：因为 MySQL 采用 WAL，提交时更关键的是 redo log 落盘，不是马上把脏页刷盘。',
            '<strong>Redo Log 和 Binlog 有什么区别？</strong>：Redo Log 是 InnoDB 层的物理日志，用于崩溃恢复；Binlog 是 Server 层的逻辑日志，用于复制和恢复。',
            '<strong>为什么需要两阶段提交？</strong>：为了保证 redo log 和 binlog 一致，否则主库恢复和从库复制可能出现数据不一致。',
            '<strong>为什么查询有时明明建了索引还是慢？</strong>：可能是优化器判断全表扫描成本更低，也可能发生隐式转换、范围过大、回表过多、统计信息不准。',
            '<strong>连接池为什么重要？</strong>：如果每个请求都重新建 MySQL 连接，TCP 握手、认证和线程创建的开销会非常明显，吞吐量会下降。',
            '<strong>为什么不建议把 max_connections 配得特别大？</strong>：连接数太大不等于吞吐更高，反而会带来线程切换、内存占用和锁竞争，很多场景应该优先用连接池和限流。',
            '<strong>为什么全表扫描会拖慢数据库？</strong>：它会读取大量无效数据页，挤占 Buffer Pool，增加磁盘 I/O，还可能影响其他热点查询。',
            '<strong>为什么回表会慢？</strong>：二级索引先拿到主键，再去聚簇索引取整行，会多一次甚至多次随机访问；如果能做成覆盖索引，通常会快很多。',
            '<strong>为什么主键建议尽量短且递增？</strong>：InnoDB 的主键就是聚簇索引，主键越大，二级索引也越大；递增主键还能减少页分裂，写入更稳定。',
            '<strong>为什么自增主键通常比 UUID 更适合 InnoDB？</strong>：UUID 更随机，容易导致页分裂、索引离散和缓存命中率下降，而自增主键写入更顺序。',
            '<strong>为什么慢查询不一定只是“没加索引”？</strong>：也可能是 SQL 写法差、返回列太多、排序分组不合理、Join 顺序不好、热点竞争严重。',
            '<strong>为什么 count(*) 有时也会慢？</strong>：InnoDB 不会像某些引擎那样直接维护精确总行数，大表上 count(*) 仍可能需要扫描较多数据或索引页。',
            '<strong>为什么短事务比长事务更安全？</strong>：长事务会让 undo log 无法及时清理，增加锁持有时间，放大死锁概率，也会拖慢 purge。',
            '<strong>为什么会发生死锁？</strong>：本质是不同事务以不同顺序获取资源，互相等待；常见做法是统一加锁顺序、缩小事务范围、尽快提交。',
            '<strong>为什么 RR 隔离级别下还能解决幻读问题？</strong>：InnoDB 在当前读场景下通过 next-key lock，把记录锁和间隙锁结合起来控制范围插入。',
            '<strong>为什么刷脏页会影响性能？</strong>：刷盘本身会占用 I/O 带宽，如果脏页堆积过多，后台集中刷盘会让查询和写入都抖动。',
            '<strong>为什么有时候 CPU 不高，数据库还是很慢？</strong>：瓶颈可能在磁盘 I/O、锁等待、日志刷盘、网络往返或者连接排队，不一定是 CPU。'
          ]
        }
      ]
    },
    {
      id: 'common-errors',
      title: '常见报错',
      content: [
        {
          type: 'heading',
          text: '常见报错'
        },
        {
          type: 'list',
          items: [
            '<strong>Too many connections</strong>：连接数打满。常见原因是连接池过大、应用连接未释放、慢查询导致连接长时间占用；先看 `max_connections`、连接池配置和慢查询。',
            '<strong>Access denied for user</strong>：用户名、密码、认证插件、来源 IP 或权限不对。先确认账号是否允许从当前主机连接，再检查授权和密码。',
            '<strong>Unknown database / Table does not exist / Unknown column</strong>：库、表或字段不存在，或者环境、大小写、发布版本不一致；优先检查 DDL 是否已执行到当前环境。',
            '<strong>Lock wait timeout exceeded</strong>：锁等待超时，通常是事务太长、更新顺序不一致、索引缺失导致锁范围扩大；先找阻塞会话和未提交事务。',
            '<strong>Deadlock found when trying to get lock</strong>：死锁。重点排查两个事务的加锁顺序、事务范围和索引是否命中，必要时让业务做重试。',
            '<strong>Duplicate entry for key PRIMARY/UNIQUE</strong>：主键或唯一索引冲突。常见于并发插入、幂等设计不足、业务唯一约束遗漏。',
            '<strong>Data too long for column</strong>：写入值超过字段长度，常见于 `varchar` 长度不够、字符集变化后字节数变大、上游未做长度校验。',
            '<strong>Cannot add or update a child row: a foreign key constraint fails</strong>：外键约束失败，通常是主表记录不存在、删除顺序不对，或关联字段类型不一致。',
            '<strong>Lost connection to MySQL server during query</strong>：查询时间过长、结果集过大、网络不稳定、`wait_timeout` 太小都可能触发；先区分是执行超时还是连接被中断。',
            '<strong>MySQL server has gone away</strong>：连接已断开，常见于连接空闲过久、报文过大、服务端重启；要结合 `wait_timeout`、`max_allowed_packet` 和应用重连机制一起看。',
            '<strong>Packet too large / max_allowed_packet</strong>：单次请求包太大，常见于批量插入过大、BLOB/TEXT 上传过大；可以拆批次，或适当增大 `max_allowed_packet`。',
            '<strong>Incorrect string value</strong>：字符集或排序规则不匹配，典型场景是表不是 `utf8mb4` 却写入 emoji；检查库表连接三者的字符集是否一致。',
            '<strong>Out of memory / sort buffer / temporary table 相关报错</strong>：通常不是单纯“机器内存不够”，也可能是并发太高、排序分组过大、临时表过多；要结合 SQL 和参数一起看。',
            '<strong>磁盘满或只读报错</strong>：例如表空间、binlog、临时目录写满，或者实例进入只读状态；这类问题优先看磁盘、挂载和日志目录，而不是先改 SQL。'
          ]
        }
      ]
    },
    {
      id: 'index-optimization',
      title: '索引优化',
      content: [
        {
          type: 'heading',
          text: '索引类型'
        },
        {
          type: 'list',
          items: [
            '<strong>主键索引 (PRIMARY)</strong>：唯一标识，聚簇索引',
            '<strong>唯一索引 (UNIQUE)</strong>：保证值唯一',
            '<strong>普通索引 (INDEX)</strong>：加速查询',
            '<strong>联合索引</strong>：多个字段组合',
            '<strong>全文索引 (FULLTEXT)</strong>：文本搜索',
            '<strong>空间索引 (SPATIAL)</strong>：地理数据查询'
          ]
        },
        {
          type: 'heading',
          text: '索引设计原则'
        },
        {
          type: 'list',
          items: [
            '<strong>选择合适的列</strong>：WHERE、ORDER BY、JOIN 的列',
            '<strong>最左前缀原则</strong>：联合索引按最左优先匹配',
            '<strong>区分度高</strong>：选择区分度高的列建立索引',
            '<strong>避免过多索引</strong>：索引会增加写操作开销',
            '<strong>索引列不为 NULL</strong>：NULL 值影响索引效率'
          ]
        },
        {
          type: 'heading',
          text: '联合索引与最左前缀'
        },
        {
          type: 'code',
          lang: 'sql',
          code: `-- 创建联合索引 (name, age, city)
CREATE INDEX idx_user_info ON users(name, age, city);

-- 能使用索引的查询
SELECT * FROM users WHERE name = 'Tom';                    -- ✓
SELECT * FROM users WHERE name = 'Tom' AND age = 20;        -- ✓
SELECT * FROM users WHERE name = 'Tom' AND age = 20 AND city = 'Beijing'; -- ✓

-- 不能使用索引的查询 (违反最左前缀)
SELECT * FROM users WHERE age = 20;                         -- ✗
SELECT * FROM users WHERE city = 'Beijing';                  -- ✗
SELECT * FROM users WHERE age = 20 AND city = 'Beijing';     -- ✗

-- 使用索引排序
SELECT * FROM users WHERE name = 'Tom' ORDER BY age;         -- ✓
SELECT * FROM users WHERE name = 'Tom' ORDER BY age, city;   -- ✓
SELECT * FROM users WHERE name = 'Tom' ORDER BY city;        -- ✗ (跳过age)`
        },
        {
          type: 'heading',
          text: '索引下推 (ICP)'
        },
        {
          type: 'paragraph',
          text: 'MySQL 5.6+ 引入的索引下推优化，将 WHERE 条件尽可能下推到存储引擎层过滤，减少回表次数。'
        },
        {
          type: 'code',
          lang: 'sql',
          code: `-- 假设联合索引 (name, age)
SELECT * FROM users WHERE name LIKE 'Tom%' AND age > 20;

-- 无 ICP: 存储引擎返回所有 name 开头是 Tom 的记录，Server 层过滤 age
-- 有 ICP: 存储引擎直接过滤 age > 20，只返回符合条件的数据`
        },
        {
          type: 'heading',
          text: '覆盖索引'
        },
        {
          type: 'paragraph',
          text: '查询所需字段都在索引中，无需回表，大幅提升性能。'
        },
        {
          type: 'code',
          lang: 'sql',
          code: `-- 联合索引 (name, age, email)
SELECT name, age, email FROM users WHERE name = 'Tom';
-- 索引已包含所需字段，无需回表`

        },
        {
          type: 'heading',
          text: '索引失效场景'
        },
        {
          type: 'list',
          items: [
            '<strong>使用函数</strong>：WHERE YEAR(create_time) = 2024',
            '<strong>隐式转换</strong>：字符串列用数字查询',
            '<strong>LIKE 前缀通配符</strong>：WHERE name LIKE \'%Tom\'',
            '<strong>OR 条件</strong>：未索引的列使用 OR',
            '<strong>不等于</strong>：WHERE age != 18（可走索引但效率低）',
            '<strong>IS NULL / IS NOT NULL</strong>：视情况而定'
          ]
        },
        {
          type: 'heading',
          text: '索引分析工具'
        },
        {
          type: 'code',
          lang: 'sql',
          code: `-- 查看索引使用情况
SHOW INDEX FROM users;

-- 分析索引选择性（越接近1越好）
SELECT COUNT(DISTINCT name) / COUNT(*) FROM users;

-- 查看索引基数
ANALYZE TABLE users;
SHOW INDEX FROM users;

-- 系统库查看索引统计
SELECT * FROM mysql.innodb_index_stats;`
        }
      ]
    },
    {
      id: 'query-optimization',
      title: '查询优化',
      content: [
        {
          type: 'heading',
          text: 'EXPLAIN 执行计划分析'
        },
        {
          type: 'paragraph',
          text: '使用 EXPLAIN 分析 SQL 执行计划，优化查询性能。'
        },
        {
          type: 'code',
          lang: 'sql',
          code: `EXPLAIN SELECT * FROM users WHERE name = 'Tom';

+----+-------------+-------+------+---------------+------+---------+-------+------+-------+
| id | select_type | table | type | possible_keys | key  | key_len | ref   | rows | Extra |
+----+-------------+-------+------+---------------+------+---------+-------+------+-------+

# 关键字段说明
# type: 访问类型，性能从好到差：system > const > eq_ref > ref > range > index > ALL
# key: 实际使用的索引
# rows: 预估扫描行数，越少越好
# Extra: 额外信息
#   - Using index: 覆盖索引，好！
#   - Using filesort: 文件排序，需要优化
#   - Using temporary: 使用临时表，需要优化`
        },
        {
          type: 'heading',
          text: 'SQL 编写最佳实践'
        },
        {
          type: 'list',
          items: [
            '<strong>避免 SELECT *</strong>：只查询需要的列，减少网络传输和内存占用',
            '<strong>合理使用 LIMIT</strong>：分页查询使用 LIMIT，避免大结果集',
            '<strong>批量操作</strong>：使用批量插入代替单条插入',
            '<strong>避免子查询</strong>：复杂子查询改用 JOIN',
            '<strong>使用 UNION ALL</strong>：不需要去重时用 UNION ALL 代替 UNION',
            '<strong>使用绑定变量</strong>：预编译语句，防止 SQL 注入'
          ]
        },
        {
          type: 'heading',
          text: '子查询优化'
        },
        {
          type: 'code',
          lang: 'sql',
          code: `-- 不推荐：子查询
SELECT * FROM users WHERE id IN (SELECT user_id FROM orders WHERE amount > 1000);

-- 推荐：改写为 JOIN
SELECT u.* FROM users u
INNER JOIN orders o ON u.id = o.user_id
WHERE o.amount > 1000;

-- 或者使用 EXISTS (更高效)
SELECT * FROM users u
WHERE EXISTS (
  SELECT 1 FROM orders o
  WHERE o.user_id = u.id AND o.amount > 1000
);`
        },
        {
          type: 'heading',
          text: '分页优化'
        },
        {
          type: 'code',
          lang: 'sql',
          code: `-- 传统分页（深分页性能差）
SELECT * FROM orders ORDER BY id LIMIT 1000000, 20;

-- 优化方案1：使用上次最大ID
SELECT * FROM orders WHERE id > 1000000 ORDER BY id LIMIT 20;

-- 优化方案2：延迟关联
SELECT o.* FROM orders o
INNER JOIN (SELECT id FROM orders ORDER BY id LIMIT 1000000, 20) t
ON o.id = t.id;`
        },
        {
          type: 'heading',
          text: '慢查询分析'
        },
        {
          type: 'code',
          lang: 'sql',
          code: `-- 开启慢查询日志
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 2;

-- 查看 slow_query_log 配置
SHOW VARIABLES LIKE '%slow_query%';

-- 分析慢查询日志
mysqldumpslow -s t -t 10 /var/log/mysql/slow.log

-- 使用 pt-query-digest 分析
pt-query-digest /var/log/mysql/slow.log`
        }
      ]
    },
    {
      id: 'transaction',
      title: '事务与锁',
      content: [
        {
          type: 'heading',
          text: '事务隔离级别'
        },
        {
          type: 'table',
          headers: ['隔离级别', '脏读', '不可重复读', '幻读', '说明'],
          rows: [
            ['READ UNCOMMITTED', '✓', '✓', '✓', '读未提交，几乎不用'],
            ['READ COMMITTED', '✗', '✓', '✓', '读已提交，Oracle 默认'],
            ['REPEATABLE READ', '✗', '✗', '✓', '可重复读，MySQL 默认'],
            ['SERIALIZABLE', '✗', '✗', '✗', '串行化，最高隔离']
          ]
        },
        {
          type: 'heading',
          text: 'MVCC 多版本并发控制'
        },
        {
          type: 'paragraph',
          text: 'InnoDB 通过 MVCC 实现非锁定读，允许读写操作并发执行。'
        },
        {
          type: 'list',
          items: [
            '<strong>Read View</strong>：事务启动时创建的快照视图',
            '<strong>Undo Log</strong>：存储数据的历史版本',
            '<strong>隐藏列</strong>：DB_TRX_ID、DB_ROLL_PTR、DB_ROW_ID'
          ]
        },
        {
          type: 'heading',
          text: '锁机制'
        },
        {
          type: 'list',
          items: [
            '<strong>共享锁 (S Lock)</strong>：读锁，允许多个事务同时读取',
            '<strong>排他锁 (X Lock)</strong>：写锁，只允许一个事务修改',
            '<strong>意向锁</strong>：表级锁，表明将来要对行加锁',
            '<strong>间隙锁</strong>：锁定索引记录之间的间隙，防止幻读',
            '<strong>临键锁</strong>：记录锁 + 间隙锁'
          ]
        },
        {
          type: 'heading',
          text: '锁等待与死锁'
        },
        {
          type: 'code',
          lang: 'sql',
          code: `-- 查看锁等待情况
SELECT * FROM information_schema.innodb_locks;
SELECT * FROM information_schema.innodb_lock_waits;
SELECT * FROM information_schema.innodb_trx;

-- 查看死锁日志
SHOW ENGINE INNODB STATUS;

-- 设置锁等待超时
SET SESSION innodb_lock_wait_timeout = 50;

-- 死锁检测（默认开启）
SET GLOBAL innodb_deadlock_detect = ON;`
        },
        {
          type: 'heading',
          text: '事务最佳实践'
        },
        {
          type: 'list',
          items: [
            '<strong>事务要短</strong>：避免长事务，减少锁持有时间',
            '<strong>尽早提交</strong>：事务完成后立即提交',
            '<strong>避免大事务</strong>：大量更新分批执行',
            '<strong>设置合理隔离级别</strong>：默认 REPEATABLE READ',
            '<strong>注意锁顺序</strong>：多表操作按固定顺序访问'
          ]
        }
      ]
    },
    {
      id: 'replication',
      title: '主从复制',
      content: [
        {
          type: 'heading',
          text: '复制原理'
        },
        {
          type: 'list',
          items: [
            '<strong>Binlog</strong>：主库记录所有数据变更的二进制日志',
            '<strong>I/O Thread</strong>：从库请求并接收主库的 Binlog',
            '<strong>Relay Log</strong>：从库存储 Binlog 的中继日志',
            '<strong>SQL Thread</strong>：从库重放中继日志中的变更'
          ]
        },
        {
          type: 'heading',
          text: 'Binlog 格式'
        },
        {
          type: 'table',
          headers: ['格式', '优点', '缺点', '适用场景'],
          rows: [
            ['STATEMENT', '日志小，节省空间', '可能不一致，函数可能有问题', '简单查询'],
            ['ROW', '最安全，数据一致', '日志大，无法从日志看具体语句', '生产环境推荐'],
            ['MIXED', '折中方案', '复杂场景仍可能有问题', '一般场景']
          ]
        },
        {
          type: 'heading',
          text: 'GTID 复制'
        },
        {
          type: 'paragraph',
          text: 'GTID (Global Transaction ID) 是 MySQL 5.6 引入的全局事务 ID，简化主从复制管理。'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `[mysqld]
# 启用 GTID
gtid_mode = ON
enforce_gtid_consistency = ON

# 启用 binlog
log_bin = mysql-bin
binlog_format = ROW
binlog_row_image = FULL`
        },
        {
          type: 'heading',
          text: '主从配置示例'
        },
        {
          type: 'code',
          lang: 'sql',
          code: `-- 主库配置
CHANGE MASTER TO
  MASTER_HOST='192.168.1.10',
  MASTER_USER='repl',
  MASTER_PASSWORD='password',
  MASTER_PORT=3306,
  MASTER_AUTO_POSITION=1;  -- GTID 模式

-- 启动从库复制
START SLAVE;

-- 查看从库状态
SHOW SLAVE STATUS\\G

-- 关键指标
-- Slave_IO_Running: Yes
-- Slave_SQL_Running: Yes
-- Seconds_Behind_Master: 延迟秒数（0表示无延迟）`
        },
        {
          type: 'heading',
          text: '并行复制'
        },
        {
          type: 'paragraph',
          text: 'MySQL 5.7+ 支持并行复制，提升从库应用速度。'
        },
        {
          type: 'code',
          lang: 'sql',
          code: `-- 设置并行复制模式
SET GLOBAL slave_parallel_type = 'LOGICAL_CLOCK';
SET GLOBAL slave_parallel_workers = 4;  -- 并行线程数`
        }
      ]
    },
    {
      id: 'sharding',
      title: '分库分表',
      content: [
        {
          type: 'heading',
          text: '分库分表策略'
        },
        {
          type: 'list',
          items: [
            '<strong>垂直分库</strong>：按业务模块拆分，不同库不同业务',
            '<strong>垂直分表</strong>：按字段使用频率拆分，热字段与冷字段分离',
            '<strong>水平分库</strong>：同一业务数据分散到多个库',
            '<strong>水平分表</strong>：同一表数据分散到多个表'
          ]
        },
        {
          type: 'heading',
          text: '分片策略'
        },
        {
          type: 'table',
          headers: ['策略', '说明', '优点', '缺点'],
          rows: [
            ['Range', '按范围分片', '查询范围数据快', '数据分布不均'],
            ['Hash', '哈希取模', '数据均匀分布', '范围查询需扫表'],
            ['一致性Hash', '解决扩容问题', '减少迁移量', '实现复杂'],
            ['地理位置', '按区域分片', '就近访问', '热点问题']
          ]
        },
        {
          type: 'heading',
          text: '分库分表中间件'
        },
        {
          type: 'list',
          items: [
            '<strong>ShardingSphere</strong>：Apache 开源，功能完善',
            '<strong>Mycat</strong>：老牌中间件，社区活跃',
            '<strong>Vitess</strong>：YouTube 开源，云原生',
            '<strong>cobar</strong>：阿里开源，已停止维护'
          ]
        },
        {
          type: 'heading',
          text: '分库分表问题'
        },
        {
          type: 'list',
          items: [
            '<strong>分布式事务</strong>：跨库事务一致性难保证',
            '<strong>跨库 JOIN</strong>：需要应用层组装或使用 Elasticsearch',
            '<strong>分页排序</strong>：需要先查询每个分片再聚合',
            '<strong>主键生成</strong>：需要分布式 ID 生成方案',
            '<strong>数据迁移</strong>：扩容时数据迁移复杂'
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
          text: '备份方式'
        },
        {
          type: 'table',
          headers: ['方式', '工具', '优点', '缺点'],
          rows: [
            ['逻辑备份', 'mysqldump', '跨平台、可编辑', '速度慢、恢复慢'],
            ['物理备份', 'xtrabackup', '速度快、支持增量', '文件格式依赖平台'],
            ['Binlog', 'mysqlbinlog', '点时间恢复', '需要基础备份']
          ]
        },
        {
          type: 'heading',
          text: 'mysqldump 备份'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# 全库备份
mysqldump -u root -p --all-databases --single-transaction --master-data=2 > all.sql

# 单库备份
mysqldump -u root -p --databases mydb > mydb.sql

# 单表备份
mysqldump -u root -p mydb users > users.sql

# 压缩备份
mysqldump -u root -p --all-databases | gzip > all.sql.gz

# 关键参数说明
# --single-transaction: 一致性读，不锁表 (InnoDB)
# --master-data=2: 记录 binlog 位置
# --quick: 逐行导出，避免内存溢出
# --routines: 导出存储过程和函数
# --triggers: 导出触发器
# --events: 导出事件`
        },
        {
          type: 'heading',
          text: 'XtraBackup 备份'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# 全量备份
xtrabackup --backup --target-dir=/backup/full \\
  --user=root --password=password

# 增量备份
xtrabackup --backup --target-dir=/backup/inc1 \\
  --incremental-basedir=/backup/full

# 准备备份
xtrabackup --prepare --target-dir=/backup/full

# 恢复
xtrabackup --copy-back --target-dir=/backup/full`
        },
        {
          type: 'heading',
          text: 'Binlog 恢复'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# 查看 binlog 内容
mysqlbinlog --base64-output=DECODE-ROWS -v mysql-bin.000001

# 指定时间恢复
mysqlbinlog --start-datetime="2024-01-01 00:00:00" \\
            --stop-datetime="2024-01-01 23:59:59" \\
            mysql-bin.000001 | mysql -u root -p

# 指定位置恢复
mysqlbinlog --start-position=1000 \\
            --stop-position=2000 \\
            mysql-bin.000001 | mysql -u root -p`
        }
      ]
    },
    {
      id: 'monitoring',
      title: '监控与运维',
      content: [
        {
          type: 'heading',
          text: '关键监控指标'
        },
        {
          type: 'list',
          items: [
            '<strong>QPS/TPS</strong>：每秒查询/事务数',
            '<strong>连接数</strong>：当前活跃连接数',
            '<strong>慢查询</strong：超过阈值的查询数量',
            '<strong>缓冲池命中率</strong>：理想值 > 99%',
            '<strong>磁盘 I/O</strong>：读写 IOPS 和延迟',
            '<strong>主从延迟</strong>：Seconds_Behind_Master',
            '<strong>死锁</strong>：死锁发生频率'
          ]
        },
        {
          type: 'heading',
          text: '性能视图 (Performance Schema)'
        },
        {
          type: 'code',
          lang: 'sql',
          code: `-- 启用 Performance Schema
UPDATE performance_schema.setup_instruments
SET ENABLED = 'YES', TIMED = 'YES'
WHERE NAME LIKE '%statement/%';

-- 查看当前正在执行的 SQL
SELECT * FROM performance_schema.events_statements_current;

-- 查看历史慢查询
SELECT * FROM performance_schema.events_statements_history_long
ORDER BY TIMER_WAIT DESC LIMIT 10;

-- 查看文件 I/O 统计
SELECT * FROM performance_schema.file_summary_by_instance;`
        },
        {
          type: 'heading',
          text: '系统库查询'
        },
        {
          type: 'code',
          lang: 'sql',
          code: `-- 服务器状态信息
SHOW STATUS;
SHOW STATUS LIKE 'Threads%';
SHOW STATUS LIKE 'Questions';

-- InnoDB 状态
SHOW ENGINE INNODB STATUS\\G

-- 表统计信息
SELECT * FROM information_schema.tables
WHERE TABLE_SCHEMA = 'mydb';`
        }
      ]
    }
  ]
}

// Docker 文档数据
export const dockerDoc: TechDocData = {
  name: 'Docker',
  icon: 'D',
  color: 'from-cyan-400 to-cyan-600',
  chapters: [
    {
      id: 'intro',
      title: 'Docker 简介',
      content: [
        {
          type: 'heading',
          text: '什么是 Docker'
        },
        {
          type: 'paragraph',
          text: 'Docker 是一个开源的容器化平台，使用 Linux 容器技术将应用程序及其依赖项打包成轻量级、可移植的容器。'
        },
        {
          type: 'heading',
          text: '核心概念'
        },
        {
          type: 'list',
          items: [
            '<strong>镜像 (Image)</strong>：只读的应用模板，包含运行应用所需的一切',
            '<strong>容器 (Container)</strong>：镜像的运行实例，隔离的运行环境',
            '<strong>仓库 (Registry)</strong>：存储和分发镜像的服务，如 Docker Hub',
            '<strong>Dockerfile</strong>：构建镜像的脚本文件',
            '<strong>Compose</strong>：定义和运行多容器应用的工具'
          ]
        },
        {
          type: 'heading',
          text: 'Docker vs 虚拟机'
        },
        {
          type: 'table',
          headers: ['特性', 'Docker 容器', '虚拟机'],
          rows: [
            ['启动速度', '秒级', '分钟级'],
            ['内存占用', 'MB 级', 'GB 级'],
            ['隔离性', '进程级', '系统级'],
            ['性能', '接近原生', '有损耗'],
            ['可移植性', '强', '弱']
          ]
        }
      ]
    },
    {
      id: 'installation',
      title: '安装与配置',
      content: [
        {
          type: 'heading',
          text: 'Linux 安装'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# Ubuntu/Debian 安装
# 更新包索引
sudo apt-get update

# 安装依赖
sudo apt-get install ca-certificates curl gnupg lsb-release

# 添加 Docker 官方 GPG 密钥
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# 添加仓库
echo \\
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \\
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 安装 Docker Engine
sudo apt-get update
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 启动 Docker
sudo systemctl start docker
sudo systemctl enable docker

# 验证安装
sudo docker run hello-world`
        },
        {
          type: 'heading',
          text: '配置国内镜像加速'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# 编辑 Docker 配置
sudo vim /etc/docker/daemon.json

# 添加以下内容
{
  "registry-mirrors": [
    "https://docker.mirrors.ustc.edu.cn",
    "https://hub-mirror.c.163.com",
    "https://mirror.ccs.tencentyun.com"
  ],
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "100m",
    "max-file": "3"
  },
  "storage-driver": "overlay2"
}

# 重启 Docker
sudo systemctl daemon-reload
sudo systemctl restart docker`
        },
        {
          type: 'heading',
          text: '用户权限配置'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# 将用户添加到 docker 组，避免每次使用 sudo
sudo usermod -aG docker $USER

# 重新登录或执行
newgrp docker

# 验证（无需 sudo）
docker ps`
        }
      ]
    },
    {
      id: 'dockerfile',
      title: 'Dockerfile 最佳实践',
      content: [
        {
          type: 'heading',
          text: 'Dockerfile 基础指令'
        },
        {
          type: 'code',
          lang: 'dockerfile',
          code: `# 基础镜像
FROM ubuntu:22.04

# 维护者信息
LABEL maintainer="your-email@example.com"

# 设置工作目录
WORKDIR /app

# 复制依赖文件
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制应用代码
COPY . .

# 暴露端口
EXPOSE 3000

# 环境变量
ENV NODE_ENV=production

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s \\
  CMD curl -f http://localhost:3000/health || exit 1

# 启动命令
CMD ["node", "server.js"]`
        },
        {
          type: 'heading',
          text: '多阶段构建'
        },
        {
          type: 'code',
          lang: 'dockerfile',
          code: `# 构建阶段
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 生产阶段
FROM node:18-alpine AS production

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

ENV NODE_ENV=production

EXPOSE 3000
CMD ["node", "dist/server.js"]`
        },
        {
          type: 'heading',
          text: '优化技巧'
        },
        {
          type: 'list',
          items: [
            '<strong>使用 alpine 镜像</strong>：体积更小',
            '<strong>合并 RUN 指令</strong>：减少镜像层数',
            '<strong>利用构建缓存</strong>：不常变化的指令放前面',
            '<strong>使用 .dockerignore</strong>：排除不必要的文件',
            '<strong>多阶段构建</strong>：减小最终镜像体积',
            '<strong>最小化层</strong>：RUN apt-get update && apt-get install -y && rm -rf /var/lib/apt/lists/*'
          ]
        },
        {
          type: 'heading',
          text: '.dockerignore 示例'
        },
        {
          type: 'code',
          lang: 'text',
          code: `node_modules
npm-debug.log
.git
.gitignore
.env
.env.local
README.md
.vscode
.idea
*.log
coverage
dist`
        }
      ]
    },
    {
      id: 'docker-compose',
      title: 'Docker Compose',
      content: [
        {
          type: 'heading',
          text: 'Compose 基础'
        },
        {
          type: 'code',
          lang: 'yaml',
          code: `version: '3.8'

services:
  # 应用服务
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: myapp
    restart: always
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DB_HOST=mysql
    env_file:
      - .env
    networks:
      - app-network
    depends_on:
      - mysql
      - redis
    volumes:
      - ./logs:/app/logs
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # MySQL 服务
  mysql:
    image: mysql:8.0
    container_name: mysql
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: \${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: myapp
    ports:
      - "3306:3306"
    volumes:
      - mysql-data:/var/lib/mysql
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - app-network
    command: --default-authentication-plugin=mysql_native_password

  # Redis 服务
  redis:
    image: redis:7-alpine
    container_name: redis
    restart: always
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    networks:
      - app-network
    command: redis-server --appendonly yes

  # Nginx 反向代理
  nginx:
    image: nginx:alpine
    container_name: nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    networks:
      - app-network
    depends_on:
      - app

networks:
  app-network:
    driver: bridge

volumes:
  mysql-data:
  redis-data:`
        },
        {
          type: 'heading',
          text: '常用命令'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# 启动所有服务
docker-compose up -d

# 停止所有服务
docker-compose down

# 查看服务状态
docker-compose ps

# 查看服务日志
docker-compose logs -f app

# 重启服务
docker-compose restart app

# 进入容器
docker-compose exec app bash

# 查看资源使用
docker-compose top

# 扩展服务
docker-compose up -d --scale app=3`
        }
      ]
    },
    {
      id: 'network',
      title: '网络管理',
      content: [
        {
          type: 'heading',
          text: '网络驱动类型'
        },
        {
          type: 'table',
          headers: ['驱动', '说明', '使用场景'],
          rows: [
            ['bridge', '默认桥接网络', '单机多容器通信'],
            ['host', '使用宿主机网络', '高性能，无隔离'],
            ['overlay', '跨主机网络', 'Swarm 集群'],
            ['macvlan', '为容器分配 MAC 地址', '需要容器像独立主机'],
            ['none', '无网络', '完全隔离']
          ]
        },
        {
          type: 'heading',
          text: '网络操作'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# 创建网络
docker network create my-network

# 创建带驱动的网络
docker network create -d overlay my-overlay-network

# 创建带子网的网桥网络
docker network create \\
  --driver bridge \\
  --subnet 172.28.0.0/16 \\
  --ip-range 172.28.5.0/24 \\
  --gateway 172.28.5.254 \\
  my-br-network

# 查看网络
docker network ls

# 查看网络详情
docker network inspect my-network

# 连接容器到网络
docker network connect my-network mycontainer

# 断开网络连接
docker network disconnect my-network mycontainer

# 删除网络
docker network rm my-network`
        }
      ]
    },
    {
      id: 'storage',
      title: '存储管理',
      content: [
        {
          type: 'heading',
          text: '数据卷 (Volume)'
        },
        {
          type: 'paragraph',
          text: '数据卷是由 Docker 管理的存储，独立于容器生命周期，适合持久化数据。'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# 创建数据卷
docker volume create my-volume

# 查看数据卷
docker volume ls

# 查看数据卷详情
docker volume inspect my-volume

# 使用数据卷启动容器
docker run -d -v my-volume:/app/data nginx

# 删除数据卷
docker volume rm my-volume

# 清理未使用的数据卷
docker volume prune`
        },
        {
          type: 'heading',
          text: '绑定挂载 (Bind Mount)'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# 挂载宿主机目录
docker run -d -v /host/path:/container/path nginx

# 只读挂载
docker run -d -v /host/path:/container/path:ro nginx

# 挂载单个文件
docker run -d -v /host/config.conf:/etc/config.conf nginx`
        },
        {
          type: 'heading',
          text: 'tmpfs 挂载'
        },
        {
          type: 'paragraph',
          text: 'tmpfs 挂载存储在内存中，容器删除后数据丢失，适合临时数据。'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# 创建 tmpfs 挂载
docker run -d --tmpfs /tmp:rw,size=100m nginx`
        }
      ]
    },
    {
      id: 'security',
      title: '安全最佳实践',
      content: [
        {
          type: 'heading',
          text: '镜像安全'
        },
        {
          type: 'list',
          items: [
            '<strong>使用官方镜像</strong>：优先使用 Docker Hub 官方镜像',
            '<strong>定期更新</strong>：及时更新基础镜像和安全补丁',
            '<strong>扫描漏洞</strong>：使用 docker scan 扫描镜像漏洞',
            '<strong>最小化镜像</strong>：只包含必要的组件',
            '<strong>不存储敏感信息</strong>：避免在镜像中存储密码密钥'
          ]
        },
        {
          type: 'heading',
          text: '容器安全'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# 以非 root 用户运行容器
docker run -u 1000:1000 nginx

# 只读文件系统
docker run --read-only nginx

# 限制容器资源
docker run \\
  --memory="512m" \\
  --cpus="1.5" \\
  --pids-limit 100 \\
  nginx

# 使用 --security-opt
docker run --security-opt=no-new-privileges nginx

# AppArmor 配置
docker run --security-opt apparmor=docker-default nginx`
        },
        {
          type: 'heading',
          text: '镜像扫描'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# 扫描镜像漏洞
docker scan my-image:latest

# 使用 Trivy 扫描
trivy image my-image:latest`
        },
        {
          type: 'heading',
          text: '使用 Secrets 管理敏感数据'
        },
        {
          type: 'code',
          lang: 'yaml',
          code: `# docker-compose.yml
version: '3.8'

services:
  app:
    image: myapp
    secrets:
      - db_password
      - api_key

secrets:
  db_password:
    file: ./secrets/db_password.txt
  api_key:
    file: ./secrets/api_key.txt`
        }
      ]
    },
    {
      id: 'production',
      title: '生产环境部署',
      content: [
        {
          type: 'heading',
          text: '资源限制'
        },
        {
          type: 'code',
          lang: 'yaml',
          code: `# docker-compose.yml
version: '3.8'

services:
  app:
    image: myapp:latest
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
    restart: always`
        },
        {
          type: 'heading',
          text: '日志管理'
        },
        {
          type: 'code',
          lang: 'json',
          code: `{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3",
    "labels": "production",
    "compress": "true"
  }
}`
        },
        {
          type: 'heading',
          text: '健康检查'
        },
        {
          type: 'code',
          lang: 'yaml',
          code: `# docker-compose.yml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s`
        },
        {
          type: 'heading',
          text: 'CI/CD 集成'
        },
        {
          type: 'code',
          lang: 'yaml',
          code: `# GitHub Actions 示例
name: Docker Build and Deploy

on:
  push:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2

      - name: Login to Docker Hub
        uses: docker/login-action@v2
        with:
          username: \${{ secrets.DOCKER_USERNAME }}
          password: \${{ secrets.DOCKER_PASSWORD }}

      - name: Build and push
        uses: docker/build-push-action@v4
        with:
          context: .
          push: true
          tags: user/app:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max`
        }
      ]
    }
  ]
}

// Go 文档数据
export const goDoc: TechDocData = {
  name: 'Go',
  icon: 'G',
  color: 'from-cyan-500 to-blue-600',
  chapters: [
    {
      id: 'intro',
      title: 'Go 语言简介',
      content: [
        {
          type: 'heading',
          text: '什么是 Go'
        },
        {
          type: 'paragraph',
          text: 'Go (Golang) 是 Google 开发的一门开源编程语言，专注于简洁、高效和并发。适合构建云原生应用、微服务、DevOps 工具等。'
        },
        {
          type: 'heading',
          text: '核心特性'
        },
        {
          type: 'list',
          items: [
            '<strong>简洁语法</strong>：25个关键字，学习曲线平缓',
            '<strong>原生并发</strong>：Goroutine 和 Channel，轻量级并发模型',
            '<strong>高性能</strong>：接近 C 语言的性能，编译型语言',
            '<strong>垃圾回收</strong>：高效的 GC 实现，低延迟',
            '<strong>静态类型</strong>：类型安全，编译期检查',
            '<strong>标准库丰富</strong>：net/http、database/sql 等开箱即用',
            '<strong>跨平台</strong>：支持交叉编译，一次编译到处运行'
          ]
        },
        {
          type: 'heading',
          text: '应用场景'
        },
        {
          type: 'list',
          items: [
            '微服务架构',
            '云原生应用 (Kubernetes、Docker 都是用 Go 编写)',
            '网络编程和 API 服务',
            'DevOps 工具',
            '区块链开发',
            '分布式系统'
          ]
        }
      ]
    },
    {
      id: 'basic-syntax',
      title: '基础语法',
      content: [
        {
          type: 'heading',
          text: '变量与常量'
        },
        {
          type: 'code',
          lang: 'go',
          code: `package main

import "fmt"

// 变量声明
var name string = "Alice"
var age = 25  // 类型推导

// 短变量声明（函数内使用）
func main() {
    city := "Beijing"  // 最常用

    // 常量
    const PI = 3.14
    const MaxUsers = 1000

    // 多变量声明
    x, y := 10, 20

    fmt.Printf("%s is %d years old\\n", name, age)
}`
        },
        {
          type: 'heading',
          text: '数据类型'
        },
        {
          type: 'code',
          lang: 'go',
          code: `// 基本类型
var b bool = true           // 布尔
var i int = 42              // 整型（int8, int16, int32, int64）
var f float64 = 3.14        // 浮点（float32, float64）
var s string = "hello"      // 字符串
var b byte = 'a'            // 字节（uint8 别名）
var r rune = '中'           // Unicode 字符（int32 别名）

// 复合类型
var arr [3]int = [3]int{1, 2, 3}           // 数组
var slice []int = []int{1, 2, 3}            // 切片
var m map[string]int = make(map[string]int) // Map
`
        },
        {
          type: 'heading',
          text: '指针'
        },
        {
          type: 'code',
          lang: 'go',
          code: `func main() {
    x := 42
    p := &x  // p 是指向 x 的指针

    fmt.Println(*p) // 输出 42（解引用）
    fmt.Println(p)  // 输出内存地址

    *p = 100       // 通过指针修改 x
    fmt.Println(x) // 输出 100
}`
        },
        {
          type: 'heading',
          text: '控制结构'
        },
        {
          type: 'code',
          lang: 'go',
          code: `// if 语句（无括号）
if x > 0 {
    fmt.Println("positive")
} else if x < 0 {
    fmt.Println("negative")
} else {
    fmt.Println("zero")
}

// if 带初始化
if err := doSomething(); err != nil {
    return err
}

// for 循环（Go 只有 for）
for i := 0; i < 10; i++ {
    fmt.Println(i)
}

// while 风格
for condition {
    // 循环体
}

// 无限循环
for {
    // 永远执行
}

// 遍历 slice/map
for i, v := range slice {
    fmt.Printf("index: %d, value: %d\\n", i, v)
}

for k, v := range myMap {
    fmt.Printf("key: %s, value: %d\\n", k, v)
}

// switch
switch value {
case 1:
    fmt.Println("one")
case 2:
    fmt.Println("two")
default:
    fmt.Println("other")
}`
        }
      ]
    },
    {
      id: 'functions',
      title: '函数',
      content: [
        {
          type: 'heading',
          text: '函数定义'
        },
        {
          type: 'code',
          lang: 'go',
          code: `// 基本函数
func add(a, b int) int {
    return a + b
}

// 多返回值（Go 特色）
func divide(a, b int) (int, error) {
    if b == 0 {
        return 0, fmt.Errorf("division by zero")
    }
    return a / b, nil
}

// 命名返回值
func rectangle(width, height int) (area int, perimeter int) {
    area = width * height
    perimeter = 2 * (width + height)
    return  // 自动返回 area 和 perimeter
}

// 可变参数
func sum(nums ...int) int {
    total := 0
    for _, num := range nums {
        total += num
    }
    return total
}

// 使用
result, err := divide(10, 2)
if err != nil {
    log.Fatal(err)
}`
        },
        {
          type: 'heading',
          text: '闭包与函数作为值'
        },
        {
          type: 'code',
          lang: 'go',
          code: `// 函数作为类型
type Operation func(int, int) int

func apply(op Operation, a, b int) int {
    return op(a, b)
}

// 闭包
func makeAdder(x int) func(int) int {
    return func(y int) int {
        return x + y
    }
}

adder := makeAdder(10)
fmt.Println(adder(5)) // 输出 15`
        },
        {
          type: 'heading',
          text: 'defer 延迟执行'
        },
        {
          type: 'code',
          lang: 'go',
          code: `func processFile(filename string) error {
    file, err := os.Open(filename)
    if err != nil {
        return err
    }
    defer file.Close()  // 函数返回前执行

    // 处理文件...
    return nil
}

// 多个 defer 按栈顺序执行（LIFO）
func example() {
    defer fmt.Println("first")
    defer fmt.Println("second")
    defer fmt.Println("third")
}
// 输出：third, second, first`
        }
      ]
    },
    {
      id: 'struct',
      title: '结构体与方法',
      content: [
        {
          type: 'heading',
          text: '结构体定义'
        },
        {
          type: 'code',
          lang: 'go',
          code: `// 定义结构体
type User struct {
    ID       int
    Name     string
    Email    string
    CreateAt time.Time
}

// 创建实例
u1 := User{ID: 1, Name: "Alice"}   // 指定字段
u2 := User{1, "Bob", "bob@e.com"}  // 按顺序
u3 := new(User)                    // 返回指针
u3.Name = "Charlie"

// 匿名结构体
person := struct {
    Name string
    Age  int
}{
    Name: "David",
    Age:  30,
}`
        },
        {
          type: 'heading',
          text: '方法'
        },
        {
          type: 'code',
          lang: 'go',
          code: `// 值接收者
func (u User) GetName() string {
    return u.Name
}

// 指针接收者（可修改结构体）
func (u *User) SetName(name string) {
    u.Name = name
}

// 接口实现
type Stringer interface {
    String() string
}

func (u User) String() string {
    return fmt.Sprintf("User(%d, %s)", u.ID, u.Name)
}`
        },
        {
          type: 'heading',
          text: '接口'
        },
        {
          type: 'code',
          lang: 'go',
          code: `// 定义接口
type Writer interface {
    Write([]byte) (int, error)
    Close() error
}

// 实现（隐式，无需显式声明）
type FileWriter struct {
    file *os.File
}

func (fw *FileWriter) Write(data []byte) (int, error) {
    return fw.file.Write(data)
}

func (fw *FileWriter) Close() error {
    return fw.file.Close()
}

// 空接口（interface{}）可接收任何类型
func printAny(v interface{}) {
    fmt.Println(v)
}

// 类型断言
var i interface{} = "hello"
s, ok := i.(string)
if ok {
    fmt.Println(s)
}

// 类型 switch
switch v := i.(type) {
case int:
    fmt.Println("整数:", v)
case string:
    fmt.Println("字符串:", v)
default:
    fmt.Println("其他类型")
}`
        }
      ]
    },
    {
      id: 'concurrency',
      title: '并发编程',
      content: [
        {
          type: 'heading',
          text: 'Goroutine'
        },
        {
          type: 'paragraph',
          text: 'Goroutine 是 Go 的轻量级线程，由 Go 运行时管理，只需在函数调用前加 go 关键字。'
        },
        {
          type: 'code',
          lang: 'go',
          code: `func sayHello() {
    fmt.Println("Hello from goroutine")
}

func main() {
    // 启动 goroutine
    go sayHello()

    // 匿名函数 goroutine
    go func(msg string) {
        fmt.Println(msg)
    }!("Hello")

    // 等待 goroutine（通常用 WaitGroup）
    time.Sleep(time.Second)
}`
        },
        {
          type: 'heading',
          text: 'Channel 通道'
        },
        {
          type: 'code',
          lang: 'go',
          code: `// 创建 channel
ch := make(chan int)

// 发送
go func() {
    ch <- 42  // 发送数据到 channel
}()

// 接收
value := <-ch  // 从 channel 接收数据

// 缓冲 channel
buffered := make(chan int, 10)

// 只读/只写 channel
func producer(ch chan<- int) {
    ch <- 1
}

func consumer(ch <-chan int) {
    <-ch
}

// select 多路复用
select {
case msg := <-ch1:
    fmt.Println("from ch1:", msg)
case msg := <-ch2:
    fmt.Println("from ch2:", msg)
case <-time.After(time.Second):
    fmt.Println("timeout")
}`
        },
        {
          type: 'heading',
          text: 'sync 包'
        },
        {
          type: 'code',
          lang: 'go',
          code: `// WaitGroup 等待一组 goroutine
var wg sync.WaitGroup

for i := 0; i < 5; i++ {
    wg.Add(1)
    go func(n int) {
        defer wg.Done()
        fmt.Println("Worker", n)
    }(i)
}
wg.Wait()

// Mutex 互斥锁
var mu sync.Mutex
var count int

func increment() {
    mu.Lock()
    count++
    mu.Unlock()
}

// Once 只执行一次
var once sync.Once
func init() {
    once.Do(func() {
        // 初始化代码只执行一次
    })
}

// Context 上下文控制
func worker(ctx context.Context) {
    for {
        select {
        case <-ctx.Done():
            fmt.Println("cancelled")
            return
        default:
            // 工作...
        }
    }
}

ctx, cancel := context.WithCancel(context.Background())
go worker(ctx)
cancel()  // 取消所有监听该 ctx 的 goroutine`
        }
      ]
    },
    {
      id: 'error-handling',
      title: '错误处理',
      content: [
        {
          type: 'heading',
          text: '错误处理模式'
        },
        {
          type: 'paragraph',
          text: 'Go 没有异常机制，使用返回值表示错误。'
        },
        {
          type: 'code',
          lang: 'go',
          code: `// 基本错误处理
func readFile(path string) ([]byte, error) {
    data, err := os.ReadFile(path)
    if err != nil {
        return nil, fmt.Errorf("read file failed: %w", err)
    }
    return data, nil
}

// 使用
data, err := readFile("config.json")
if err != nil {
    log.Printf("error: %v", err)
    return
}

// 自定义错误
type ValidationError struct {
    Field   string
    Message string
}

func (e *ValidationError) Error() string {
    return fmt.Sprintf("%s: %s", e.Field, e.Message)
}

// panic 和 recover（类似异常）
func safeOperation() {
    defer func() {
        if r := recover(); r != nil {
            log.Printf("recovered from panic: %v", r)
        }
    }()

    // 可能 panic 的代码
    panic("something went wrong")
}`
        }
      ]
    },
    {
      id: 'web',
      title: 'Web 开发',
      content: [
        {
          type: 'heading',
          text: 'HTTP Server'
        },
        {
          type: 'code',
          lang: 'go',
          code: `package main

import (
    "encoding/json"
    "net/http"
)

type User struct {
    Name string \`json:"name"\`
    Email string \`json:"email"\`
}

func main() {
    // 路由
    http.HandleFunc("/", homeHandler)
    http.HandleFunc("/api/users", usersHandler)

    // 启动服务器
    http.ListenAndServe(":8080", nil)
}

func homeHandler(w http.ResponseWriter, r *http.Request) {
    w.Write([]byte("Welcome!"))
}

func usersHandler(w http.ResponseWriter, r *http.Request) {
    users := []User{
        {Name: "Alice", Email: "alice@example.com"},
        {Name: "Bob", Email: "bob@example.com"},
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(users)
}`
        },
        {
          type: 'heading',
          text: 'Gin 框架'
        },
        {
          type: 'code',
          lang: 'go',
          code: `package main

import (
    "github.com/gin-gonic/gin"
    "net/http"
)

type User struct {
    Name  string \`json:"name" binding:"required"\`
    Email string \`json:"email" binding:"required,email"\`
}

func main() {
    r := gin.Default()

    // 中间件
    r.Use(Logger())

    // 路由组
    api := r.Group("/api/v1")
    {
        api.GET("/users", GetUsers)
        api.POST("/users", CreateUser)
        api.GET("/users/:id", GetUser)
    }

    r.Run(":8080")
}

func GetUsers(c *gin.Context) {
    users := []User{...}
    c.JSON(http.StatusOK, gin.H{"data": users})
}

func CreateUser(c *gin.Context) {
    var user User
    if err := c.ShouldBindJSON(&user); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    // 保存用户...
    c.JSON(http.StatusCreated, gin.H{"data": user})
}`
        }
      ]
    },
    {
      id: 'testing',
      title: '测试',
      content: [
        {
          type: 'heading',
          text: '单元测试'
        },
        {
          type: 'code',
          lang: 'go',
          code: `// calculator.go
func Add(a, b int) int {
    return a + b
}

// calculator_test.go
package calculator

import "testing"

func TestAdd(t *testing.T) {
    tests := []struct {
        name string
        a, b int
        want int
    }{
        {"positive", 2, 3, 5},
        {"negative", -1, -1, -2},
        {"zero", 0, 0, 0},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            if got := Add(tt.a, tt.b); got != tt.want {
                t.Errorf("Add() = %v, want %v", got, tt.want)
            }
        })
    }
}`
        },
        {
          type: 'heading',
          text: '基准测试'
        },
        {
          type: 'code',
          lang: 'go',
          code: `func BenchmarkAdd(b *testing.B) {
    for i := 0; i < b.N; i++ {
        Add(1, 2)
    }
}

// 运行：go test -bench=. -benchmem`
        },
        {
          type: 'heading',
          text: '表驱动测试'
        },
        {
          type: 'code',
          lang: 'go',
          code: `func TestValidateEmail(t *testing.T) {
    tests := []struct {
        email string
        valid bool
    }{
        {"test@example.com", true},
        {"invalid-email", false},
        {"", false},
    }

    for _, tt := range tests {
        got := ValidateEmail(tt.email)
        if got != tt.valid {
            t.Errorf("%s: got %v, want %v", tt.email, got, tt.valid)
        }
    }
}`
        }
      ]
    },
    {
      id: 'project-structure',
      title: '项目结构',
      content: [
        {
          type: 'heading',
          text: '标准项目布局'
        },
        {
          type: 'code',
          lang: 'text',
          code: `myapp/
├── cmd/                    # 主应用程序
│   └── myapp/
│       └── main.go
├── internal/               # 私有应用和库代码
│   ├── handler/
│   ├── model/
│   ├── repository/
│   └── service/
├── pkg/                    # 可被外部使用的库
├── api/                    # API 定义文件
│   ├── http/
│   └── grpc/
├── configs/                # 配置文件
├── scripts/                # 构建、安装脚本
├── test/                   # 额外的测试数据
├── docs/                   # 文档
├── go.mod
└── go.sum`
        },
        {
          type: 'heading',
          text: '依赖管理'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# 初始化模块
go mod init myapp

# 添加依赖
go get github.com/gin-gonic/gin

# 添加特定版本
go get github.com/gin-gonic/gin@v1.9.0

# 下载依赖到 vendor
go mod vendor

# 整理依赖
go mod tidy

# 更新依赖
go get -u ./...

# 验证依赖
go mod verify`
        }
      ]
    }
  ]
}

// Redis 文档数据
export const redisDoc: TechDocData = {
  name: 'Redis',
  icon: 'R',
  color: 'from-red-500 to-red-700',
  chapters: [
    {
      id: 'intro',
      title: 'Redis 简介',
      content: [
        {
          type: 'heading',
          text: '什么是 Redis'
        },
        {
          type: 'paragraph',
          text: 'Redis (Remote Dictionary Server) 是开源的内存数据结构存储，可用作数据库、缓存、消息代理和流引擎。支持多种数据结构，并提供持久化、主从复制、集群等功能。'
        },
        {
          type: 'heading',
          text: '核心特性'
        },
        {
          type: 'list',
          items: [
            '<strong>内存存储</strong>：所有数据存储在内存中，读写速度极快',
            '<strong>丰富数据结构</strong>：String、Hash、List、Set、ZSet、Stream 等',
            '<strong>持久化</strong>：RDB 快照和 AOF 日志两种方式',
            '<strong>主从复制</strong>：支持数据复制，实现高可用',
            '<strong>集群</strong>：支持水平扩展',
            '<strong>单线程模型</strong>：避免锁竞争，简化实现',
            '<strong>发布订阅</strong>：消息传递机制'
          ]
        },
        {
          type: 'heading',
          text: '应用场景'
        },
        {
          type: 'list',
          items: [
            '<strong>缓存</strong>：热点数据缓存，减轻数据库压力',
            '<strong>会话存储</strong>：分布式 session 存储',
            '<strong>排行榜</strong>：使用 ZSet 实现排行榜',
            '<strong>计数器</strong>：原子性计数',
            '<strong>分布式锁</strong>：SET NX EX 实现',
            '<strong>消息队列</strong>：List 或 Stream 实现队列',
            '<strong>限流</strong>：滑动窗口算法'
          ]
        }
      ]
    },
    {
      id: 'data-types',
      title: '数据类型',
      content: [
        {
          type: 'heading',
          text: 'String 字符串'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# 设置和获取
SET key value
GET key

# 设置过期时间（秒）
SET key value EX 60

# 不存在时设置
SETNX key value

# 批量设置
MSET key1 value1 key2 value2

# 计数
INCR counter
INCRBY counter 10
DECR counter
DECRBY counter 5`
        },
        {
          type: 'heading',
          text: 'Hash 哈希'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# 设置字段
HSET user:1 name "Alice" age 25

# 获取字段
HGET user:1 name
HGETALL user:1

# 检查字段存在
HEXISTS user:1 email

# 获取所有字段
HKEYS user:1
HVALS user:1

# 增加数值
HINCRBY user:1 age 1`
        },
        {
          type: 'heading',
          text: 'List 列表'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# 左侧推入（队列）
LPUSH queue item1 item2

# 右侧弹出
RPOP queue

# 右侧推入（栈）
RPUSH stack item

# 范围查询
LRANGE list 0 -1

# 列表长度
LLEN list

# 阻塞弹出（消息队列）
BLPOP queue 0`
        },
        {
          type: 'heading',
          text: 'Set 集合'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# 添加成员
SADD set1 item1 item2 item3

# 获取所有成员
SMEMBERS set1

# 检查存在
SISMEMBER set1 item1

# 集合运算
SINTER set1 set2      # 交集
SUNION set1 set2      # 并集
SDIFF set1 set2       # 差集

# 随机获取
SRANDMEMBER set1
SPOP set1`
        },
        {
          type: 'heading',
          text: 'ZSet 有序集合'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# 添加成员（分数）
ZADD leaderboard 100 "player1" 200 "player2" 150 "player3"

# 范围查询（升序）
ZRANGE leaderboard 0 -1

# 范围查询（降序）
ZREVRANGE leaderboard 0 -1

# 带分数查询
ZRANGE leaderboard 0 -1 WITHSCORES

# 分数范围查询
ZRANGEBYSCORE leaderboard 100 200

# 获取排名
ZRANK leaderboard "player1"      # 升序排名
ZREVRANK leaderboard "player1"   # 降序排名

# 增加分数
ZINCRBY leaderboard 10 "player1"`
        },
        {
          type: 'heading',
          text: 'Stream 流（Redis 5.0+）'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# 添加消息
XADD mystream * sensor temp 25.5

# 读取消息
XREAD STREAMS mystream 0

# 消费者组
XGROUP CREATE mystream mygroup 0

# 从组读取
XREADGROUP GROUP mygroup consumer1 STREAMS mystream >`

        }
      ]
    },
    {
      id: 'persistence',
      title: '持久化机制',
      content: [
        {
          type: 'heading',
          text: 'RDB 快照'
        },
        {
          type: 'paragraph',
          text: 'RDB 在指定时间间隔内生成数据集的时间点快照。'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# 手动触发快照
SAVE    # 阻塞式
BGSAVE  # 异步

# 配置
save 900 1      # 900秒内至少1个key变化
save 300 10     # 300秒内至少10个key变化
save 60 10000   # 60秒内至少10000个key变化

# 压缩
rdbcompression yes

# 快照文件名
dbfilename dump.rdb`
        },
        {
          type: 'heading',
          text: 'AOF 日志'
        },
        {
          type: 'paragraph',
          text: 'AOF 记录每个写操作命令，恢复时重新执行。'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# 启用 AOF
appendonly yes

# AOF 文件名
appendfilename "appendonly.aof"

# 同步策略
appendfsync always    # 每次写入同步（最安全）
appendfsync everysec  # 每秒同步（推荐）
appendfsync no        # 由操作系统决定

# AOF 重写配置
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb`
        },
        {
          type: 'heading',
          text: '混合持久化（RDB+AOF）'
        },
        {
          type: 'paragraph',
          text: 'Redis 4.0+ 支持混合持久化，AOF 重写时将 RDB 内容写入 AOF 文件开头。'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `aof-use-rdb-preamble yes`
        }
      ]
    },
    {
      id: 'replication',
      title: '主从复制',
      content: [
        {
          type: 'heading',
          text: '复制原理'
        },
        {
          type: 'list',
          items: [
            '<strong>全量同步</strong>：从节点首次连接或无法部分同步时进行',
            '<strong>部分同步</strong>：复制偏移量在复制积压缓冲区内',
            '<strong>异步复制</strong>：主节点处理完命令后异步发送给从节点'
          ]
        },
        {
          type: 'heading',
          text: '配置主从'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# 从节点配置
replicaof <masterip> <masterport>

# 主节点密码（如果有）
masterauth <password>

# 只读模式
replica-serve-stale-data yes`
        },
        {
          type: 'heading',
          text: '哨兵 Sentinel'
        },
        {
          type: 'paragraph',
          text: '哨兵监控主从节点，自动故障转移。'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# sentinel.conf
port 26379

# 监控主节点
sentinel monitor mymaster 127.0.0.1 6379 2

# 主节点密码
sentinel auth-pass mymaster <password>

# 故障转移配置
sentinel down-after-milliseconds mymaster 5000
sentinel parallel-syncs mymaster 1
sentinel failover-timeout mymaster 30000`
        }
      ]
    },
    {
      id: 'cluster',
      title: '集群',
      content: [
        {
          type: 'heading',
          text: '集群架构'
        },
        {
          type: 'list',
          items: [
            '<strong>分片</strong>：16384 个哈希槽，数据分散到多个节点',
            '<strong>高可用</strong>：每个主节点有多个从节点',
            '<strong>自动故障转移</strong>：主节点故障时从节点提升为主节点'
          ]
        },
        {
          type: 'heading',
          text: '集群配置'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# 启用集群
cluster-enabled yes
cluster-config-file nodes.conf
cluster-node-timeout 5000

# 创建集群（6个节点，3主3从）
redis-cli --cluster create \\
  127.0.0.1:7001 127.0.0.1:7002 127.0.0.1:7003 \\
  127.0.0.1:7004 127.0.0.1:7005 127.0.0.1:7006 \\
  --cluster-replicas 1`
        },
        {
          type: 'heading',
          text: '集群操作'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# 连接集群
redis-cli -c -p 7001

# 查看集群状态
cluster info

# 查看节点
cluster nodes

# 添加节点
redis-cli --cluster add-node new_node:7001 existing_node:7001

# 删除节点
redis-cli --cluster del-node node_ip:7001 node_id

# 重新分片
redis-cli --cluster reshard existing_node:7001`
        }
      ]
    },
    {
      id: 'performance',
      title: '性能优化',
      content: [
        {
          type: 'heading',
          text: '内存优化'
        },
        {
          type: 'list',
          items: [
            '<strong>设置过期时间</strong>：及时清理无效数据',
            '<strong>选择合适的数据结构</strong>：如用 Hash 代替多个 String',
            '<strong>使用压缩列表</strong>：小数据量自动使用压缩',
            '<strong>禁用 THP</strong>：Transparent Huge Pages 影响性能'
          ]
        },
        {
          type: 'heading',
          text: '命令优化'
        },
        {
          type: 'list',
          items: [
            '<strong>避免 KEYS</strong>：使用 SCAN 代替 KEYS',
            '<strong>批量操作</strong>：使用 MGET、MSET 等批量命令',
            '<strong>使用 Pipeline</strong>：减少网络往返',
            '<strong>使用 Lua 脚本</strong>：复杂原子操作'
          ]
        },
        {
          type: 'heading',
          text: 'Pipeline 示例'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# 使用 Pipeline 批量执行
echo -e '
SET key1 value1
SET key2 value2
GET key1
' | redis-cli --pipe`
        },
        {
          type: 'heading',
          text: 'Lua 脚本'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# 限流脚本
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local expire = tonumber(ARGV[2])

local current = redis.call('GET', key) or 0
if current + 1 > limit then
  return 0
else
  redis.call('INCR', key)
  redis.call('EXPIRE', key, expire)
  return 1
end

# 执行脚本
redis-cli --eval limit.lua key1 , 100 60`
        }
      ]
    },
    {
      id: 'patterns',
      title: '常见应用模式',
      content: [
        {
          type: 'heading',
          text: '分布式锁'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# 加锁（SET NX EX）
SET lock:resource1 unique_value NX EX 10

# 解锁（Lua 保证原子性）
if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
else
    return 0
end`
        },
        {
          type: 'heading',
          text: '限流'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# 滑动窗口限流
ZADD rate_limit:user1 timestamp now
ZREMRANGEBYSCORE rate_limit:user1 0 (now-60s
ZCARD rate_limit:user1

# 如果 count > limit 则拒绝`
        },
        {
          type: 'heading',
          text: '排行榜'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# 添加分数
ZADD leaderboard 100 player1

# 获取 Top 10
ZREVRANGE leaderboard 0 9 WITHSCORES

# 获取用户排名
ZREVRANK leaderboard player1`
        },
        {
          type: 'heading',
          text: '消息队列'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# 生产者
LPUSH queue task1

# 消费者
RPOP queue

# 阻塞式消费
BRPOP queue 0`
        }
      ]
    }
  ]
}

// Nginx 文档数据
export const nginxDoc: TechDocData = {
  name: 'Nginx',
  icon: 'N',
  color: 'from-green-500 to-green-700',
  chapters: [
    {
      id: 'intro',
      title: 'Nginx 简介',
      content: [
        {
          type: 'heading',
          text: '什么是 Nginx'
        },
        {
          type: 'paragraph',
          text: 'Nginx 是高性能的 HTTP 服务器和反向代理服务器，也可以作为 IMAP/POP3/SMTP 代理服务器。以高并发、低内存占用著称，适合处理静态资源、负载均衡、反向代理等场景。'
        },
        {
          type: 'heading',
          text: '核心特性'
        },
        {
          type: 'list',
          items: [
            '<strong>高性能</strong>：基于事件驱动模型，可处理数万并发连接',
            '<strong>低内存</strong>：10,000 个非活跃连接约 2.5MB 内存',
            '<strong>热部署</strong>：配置变更无需中断服务',
            '<strong>反向代理</strong>：支持多种协议的代理',
            '<strong>负载均衡</strong>：内置多种负载均衡算法',
            '<strong>静态文件服务</strong>：高效的静态资源处理',
            '<strong>SSL/TLS</strong>：支持 HTTPS 和 SNI'
          ]
        },
        {
          type: 'heading',
          text: '应用场景'
        },
        {
          type: 'list',
          items: [
            'Web 服务器',
            '反向代理',
            '负载均衡器',
            'API 网关',
            '静态资源服务',
            'WebSocket 代理',
            'SSL 卸载'
          ]
        }
      ]
    },
    {
      id: 'basic-config',
      title: '基础配置',
      content: [
        {
          type: 'heading',
          text: '配置文件结构'
        },
        {
          type: 'code',
          lang: 'nginx',
          code: `# 全局配置
worker_processes auto;          # 工作进程数
worker_cpu_affinity auto;        # CPU 亲和性
worker_rlimit_nofile 65535;      # 文件描述符限制

events {
    use epoll;                    # 事件驱动模型
    worker_connections 10240;     # 每个工作进程最大连接数
    multi_accept on;              # 同时接受多个连接
}

http {
    # 基础配置
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # 日志格式
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for" '
                    '$request_time $upstream_response_time';

    # 性能优化
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    keepalive_requests 100;

    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript;

    # 虚拟主机
    include /etc/nginx/conf.d/*.conf;
}`
        },
        {
          type: 'heading',
          text: '虚拟主机配置'
        },
        {
          type: 'code',
          lang: 'nginx',
          code: `server {
    listen 80;
    listen [::]:80;
    server_name example.com www.example.com;

    # 字符集
    charset utf-8;

    # 访问日志
    access_log /var/log/nginx/example.access.log main;
    error_log /var/log/nginx/example.error.log warn;

    # 根目录
    root /var/www/example;
    index index.html index.htm;

    # 静态文件缓存
    location ~* \\.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # 反向代理
    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 错误页面
    error_page 404 /404.html;
    error_page 500 502 503 504 /50x.html;
}`
        }
      ]
    },
    {
      id: 'reverse-proxy',
      title: '反向代理',
      content: [
        {
          type: 'heading',
          text: '基本代理配置'
        },
        {
          type: 'code',
          lang: 'nginx',
          code: `location / {
    proxy_pass http://127.0.0.1:3000;

    # 传递原始请求头
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # 超时配置
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;

    # 缓冲配置
    proxy_buffering on;
    proxy_buffer_size 4k;
    proxy_buffers 8 4k;
}`
        },
        {
          type: 'heading',
          text: 'WebSocket 代理'
        },
        {
          type: 'code',
          lang: 'nginx',
          code: `location /ws/ {
    proxy_pass http://backend;
    proxy_http_version 1.1;

    # WebSocket 需要的请求头
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";

    # 超时配置（WebSocket 需要长连接）
    proxy_connect_timeout 7d;
    proxy_send_timeout 7d;
    proxy_read_timeout 7d;
}`
        },
        {
          type: 'heading',
          text: '条件代理'
        },
        {
          type: 'code',
          lang: 'nginx',
          code: `# 根据请求头代理不同后端
map $http_user_agent $backend_pool {
    default "backend_default";
    ~*mobile "backend_mobile";
}

server {
    location / {
        proxy_pass http://$backend_pool;
    }
}

# 根据参数代理
if ($query_string ~* "version=v2") {
    proxy_pass http://backend_v2;
}`
        }
      ]
    },
    {
      id: 'load-balancing',
      title: '负载均衡',
      content: [
        {
          type: 'heading',
          text: '负载均衡算法'
        },
        {
          type: 'table',
          headers: ['算法', '说明'],
          rows: [
            ['轮询 (round_robin)', '默认，按顺序分配'],
            ['least_conn', '最少连接，分配给活动连接最少的服务器'],
            ['ip_hash', '根据客户端 IP 哈希，同一 IP 访问同一服务器'],
            ['hash', '自定义 key 哈希'],
            ['random', '随机选择（需要 two 参数）']
          ]
        },
        {
          type: 'heading',
          text: 'Upstream 配置'
        },
        {
          type: 'code',
          lang: 'nginx',
          code: `# 基本轮询
upstream backend {
    server 192.168.1.10:8080;
    server 192.168.1.11:8080;
    server 192.168.1.12:8080;
}

# 最少连接
upstream backend {
    least_conn;
    server 192.168.1.10:8080;
    server 192.168.1.11:8080;
}

# IP 哈希（会话保持）
upstream backend {
    ip_hash;
    server 192.168.1.10:8080;
    server 192.168.1.11:8080;
}

# 权重配置
upstream backend {
    server 192.168.1.10:8080 weight=3;
    server 192.168.1.11:8080 weight=2;
    server 192.168.1.12:8080 weight=1;
}

# 备用服务器
upstream backend {
    server 192.168.1.10:8080;
    server 192.168.1.11:8080 backup;
}

# 健康检查
upstream backend {
    server 192.168.1.10:8080 max_fails=3 fail_timeout=30s;
    server 192.168.1.11:8080 max_fails=3 fail_timeout=30s;
}`
        }
      ]
    },
    {
      id: 'https',
      title: 'HTTPS 配置',
      content: [
        {
          type: 'heading',
          text: 'SSL 基础配置'
        },
        {
          type: 'code',
          lang: 'nginx',
          code: `server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name example.com;

    # 证书配置
    ssl_certificate /etc/nginx/ssl/example.com.crt;
    ssl_certificate_key /etc/nginx/ssl/example.com.key;

    # SSL 协议和密码套件
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # SSL 会话缓存
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/nginx/ssl/ca-bundle.crt;

    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
}`
        },
        {
          type: 'heading',
          text: 'HTTP 重定向到 HTTPS'
        },
        {
          type: 'code',
          lang: 'nginx',
          code: `server {
    listen 80;
    listen [::]:80;
    server_name example.com;

    # Let's Encrypt 验证
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # 重定向到 HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name example.com;
    # ...
}`
        }
      ]
    },
    {
      id: 'security',
      title: '安全配置',
      content: [
        {
          type: 'heading',
          text: '请求限制'
        },
        {
          type: 'code',
          lang: 'nginx',
          code: `# 限制请求速率
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

location /api/ {
    limit_req zone=api_limit burst=20 nodelay;
    proxy_pass http://backend;
}

# 限制连接数
limit_conn_zone $binary_remote_addr zone=conn_limit:10m;

server {
    limit_conn conn_limit 10;
}

# 限制带宽
location /download/ {
    limit_rate 1m;
}`
        },
        {
          type: 'heading',
          text: '访问控制'
        },
        {
          type: 'code',
          lang: 'nginx',
          code: `# IP 白名单
location /admin/ {
    allow 192.168.1.0/24;
    deny all;
}

# 基本认证
location /admin/ {
    auth_basic "Restricted Access";
    auth_basic_user_file /etc/nginx/.htpasswd;
    # 生成密码: htpasswd -c /etc/nginx/.htpasswd user
}`
        },
        {
          type: 'heading',
          text: '安全头'
        },
        {
          type: 'code',
          lang: 'nginx',
          code: `# 添加安全响应头
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

# 隐藏版本号
server_tokens off;`
        }
      ]
    },
    {
      id: 'cache',
      title: '缓存配置',
      content: [
        {
          type: 'heading',
          text: '代理缓存'
        },
        {
          type: 'code',
          lang: 'nginx',
          code: `# 定义缓存路径
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=my_cache:10m max_size=1g inactive=60m;

server {
    location / {
        proxy_cache my_cache;
        proxy_cache_key "$scheme$request_method$host$request_uri";
        proxy_cache_valid 200 304 10m;
        proxy_cache_valid 301 302 1h;
        proxy_cache_valid any 1m;

        # 缓存绕过
        proxy_cache_bypass $http_cache_control;
        add_header X-Cache-Status $upstream_cache_status;

        proxy_pass http://backend;
    }
}`
        },
        {
          type: 'heading',
          text: 'FastCGI 缓存'
        },
        {
          type: 'code',
          lang: 'nginx',
          code: `fastcgi_cache_path /var/cache/nginx/fastcgi levels=1:2 keys_zone=phpcache:100m inactive=60m;

server {
    location ~ \\.php$ {
        fastcgi_cache phpcache;
        fastcgi_cache_key "$scheme$request_method$host$request_uri";
        fastcgi_cache_valid 200 60m;
        fastcgi_cache_bypass $skip_cache;
        fastcgi_no_cache $skip_cache;

        set $skip_cache 0;
        if ($query_string ~* "nocache") {
            set $skip_cache 1;
        }

        fastcgi_pass unix:/var/run/php-fpm.sock;
    }
}`
        }
      ]
    },
    {
      id: 'logging',
      title: '日志管理',
      content: [
        {
          type: 'heading',
          text: '访问日志配置'
        },
        {
          type: 'code',
          lang: 'nginx',
          code: `# 自定义日志格式
http {
    log_format main '$remote_addr - $remote_user [$time_local] '
                    '"$request" $status $body_bytes_sent '
                    '"$http_referer" "$http_user_agent" '
                    '$request_time $upstream_response_time';

    log_format json '{'
        '"time": "$time_iso8601",'
        '"remote_addr": "$remote_addr",'
        '"request": "$request",'
        '"status": $status,'
        '"bytes": $body_bytes_sent,'
        '"request_time": $request_time,'
        '"upstream_response_time": "$upstream_response_time"'
    '}';

    access_log /var/log/nginx/access.log json;
}`
        },
        {
          type: 'heading',
          text: '日志切割'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# logrotate 配置
/var/log/nginx/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        [ -f /var/run/nginx.pid ] && kill -USR1 \`cat /var/run/nginx.pid\`
    endscript
}`
        }
      ]
    }
  ]
}

// PostgreSQL 文档数据
export const pgsqlDoc: TechDocData = {
  name: 'PostgreSQL',
  icon: 'P',
  color: 'from-indigo-500 to-blue-700',
  chapters: [
    {
      id: 'intro',
      title: 'PostgreSQL 简介',
      content: [
        {
          type: 'heading',
          text: '什么是 PostgreSQL'
        },
        {
          type: 'paragraph',
          text: 'PostgreSQL 是功能最强大的开源对象关系数据库系统 (ORDBMS)，拥有超过 35 年的开发历史。以可靠性、数据完整性、正确性著称，支持 SQL 标准并提供丰富的高级特性。'
        },
        {
          type: 'heading',
          text: '核心特性'
        },
        {
          type: 'list',
          items: [
            '<strong>ACID 事务</strong>：完整的事务支持，保证数据一致性',
            '<strong>丰富的数据类型</strong>：JSON/JSONB、数组、XML、几何类型等',
            '<strong>高级索引</strong>：B-tree、Hash、GiST、SP-GiST、GIN、BRIN',
            '<strong>全文搜索</strong>：内置全文检索功能',
            '<strong>扩展性</strong>：支持自定义函数、类型、操作符',
            '<strong>分区表</strong>：原生支持表分区',
            '<strong>逻辑复制</strong>：支持流复制和逻辑复制',
            '<strong>MVCC</strong>：多版本并发控制，无锁读取'
          ]
        },
        {
          type: 'heading',
          text: '应用场景'
        },
        {
          type: 'list',
          items: [
            '企业级应用',
            '地理信息系统 (PostGIS)',
            '金融系统',
            '数据仓库',
            '科学计算',
            'Web 应用后端'
          ]
        }
      ]
    },
    {
      id: 'data-types',
      title: '数据类型',
      content: [
        {
          type: 'heading',
          text: '基本数据类型'
        },
        {
          type: 'code',
          lang: 'sql',
          code: `-- 数值类型
smallint          -- 2字节
integer / int     -- 4字节
bigint            -- 8字节
decimal / numeric -- 精确数值
real / double     -- 浮点数

-- 字符类型
varchar(n)        -- 变长字符串
text              -- 无限制变长字符串
char(n)           -- 定长字符串

-- 日期时间
timestamp         -- 日期和时间（带时区）
date              -- 日期
time              -- 时间
interval          -- 时间间隔

-- 布尔类型
boolean / bool    -- true/false`
        },
        {
          type: 'heading',
          text: '高级数据类型'
        },
        {
          type: 'code',
          lang: 'sql',
          code: `-- JSON/JSONB
json              -- 文本存储，保留格式和空格
jsonb             -- 二进制存储，支持索引，查询更快

-- 数组
integer[]         -- 整数数组
text[][]          -- 二维文本数组

-- 货币类型
money             -- 货币金额

-- UUID
uuid              -- 通用唯一标识符

-- 网络地址
inet              -- IPv4/IPv6 地址
cidr              -- 网络段
macaddr           -- MAC 地址

-- 位串
bit(n)            -- 定长位串
varbit(n)         -- 变长位串`
        },
        {
          type: 'heading',
          text: 'JSONB 操作'
        },
        {
          type: 'code',
          lang: 'sql',
          code: `-- 创建表
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name TEXT,
    metadata JSONB
);

-- 插入数据
INSERT INTO products (name, metadata) VALUES
('iPhone', '{"price": 999, "storage": ["64GB", "128GB"], "color": "black"}');

-- 查询 JSON 字段
SELECT metadata->>'price' AS price FROM products;

-- 条件查询
SELECT * FROM products WHERE metadata->>'price' > '500';

-- 更新 JSON 字段
UPDATE products
SET metadata = jsonb_set(metadata, '{price}', '"899"')
WHERE id = 1;

-- JSONB 索引
CREATE INDEX idx_metadata ON products USING gin(metadata);`
        }
      ]
    },
    {
      id: 'advanced-queries',
      title: '高级查询',
      content: [
        {
          type: 'heading',
          text: '窗口函数'
        },
        {
          type: 'code',
          lang: 'sql',
          code: `-- ROW_NUMBER 行号
SELECT id, name, salary,
    ROW_NUMBER() OVER (ORDER BY salary DESC) AS rank
FROM employees;

-- RANK 排名（相同值相同排名，跳过）
SELECT id, name, score,
    RANK() OVER (ORDER BY score DESC) AS rank
FROM students;

-- DENSE_RANK 排名（相同值相同排名，不跳过）
SELECT id, name, score,
    DENSE_RANK() OVER (ORDER BY score DESC) AS rank
FROM students;

-- LAG/LEAD 访问前后行
SELECT id, date, amount,
    LAG(amount) OVER (ORDER BY date) AS prev_amount
FROM transactions;

-- 分组聚合
SELECT department, employee, salary,
    SUM(salary) OVER (PARTITION BY department) AS dept_total
FROM employees;`
        },
        {
          type: 'heading',
          text: 'CTE (公用表表达式)'
        },
        {
          type: 'code',
          lang: 'sql',
          code: `-- 基本 CTE
WITH department_avg AS (
    SELECT department, AVG(salary) AS avg_salary
    FROM employees
    GROUP BY department
)
SELECT e.name, e.salary, d.avg_salary
FROM employees e
JOIN department_avg d ON e.department = d.department;

-- 递归 CTE
WITH RECURSIVE subordinates AS (
    -- 初始查询
    SELECT id, name, manager_id
    FROM employees
    WHERE id = 1

    UNION ALL

    -- 递归查询
    SELECT e.id, e.name, e.manager_id
    FROM employees e
    INNER JOIN subordinates s ON e.manager_id = s.id
)
SELECT * FROM subordinates;`
        },
        {
          type: 'heading',
          text: 'LATERAL JOIN'
        },
        {
          type: 'code',
          lang: 'sql',
          code: `-- LATERAL 允许子查询引用前面表的列
SELECT *
FROM departments d
CROSS JOIN LATERAL (
    SELECT *
    FROM employees e
    WHERE e.department_id = d.id
    ORDER BY salary DESC
    LIMIT 3
) AS top_employees;`
        }
      ]
    },
    {
      id: 'index',
      title: '索引',
      content: [
        {
          type: 'heading',
          text: '索引类型'
        },
        {
          type: 'list',
          items: [
            '<strong>B-tree</strong>：默认索引，支持范围查询和排序',
            '<strong>Hash</strong>：等值查询优化',
            '<strong>GiST</strong>：几何、全文搜索',
            '<strong>SP-GiST</strong>：空间分区数据',
            '<strong>GIN</strong>：数组、JSONB、全文搜索',
            '<strong>BRIN</strong>：大表块级索引'
          ]
        },
        {
          type: 'heading',
          text: '创建索引'
        },
        {
          type: 'code',
          lang: 'sql',
          code: `-- 普通索引
CREATE INDEX idx_user_email ON users(email);

-- 唯一索引
CREATE UNIQUE INDEX idx_user_username ON users(username);

-- 复合索引
CREATE INDEX idx_order_user_date ON orders(user_id, created_at);

-- 部分索引（带条件）
CREATE INDEX idx_active_users ON users(email) WHERE is_active = true;

-- 表达式索引
CREATE INDEX idx_user_lower_email ON users(LOWER(email));

-- JSONB GIN 索引
CREATE INDEX idx_product_metadata ON products USING gin(metadata);

-- 并发创建索引（不锁表）
CREATE INDEX CONCURRENTLY idx_user_email ON users(email);`
        },
        {
          type: 'heading',
          text: '索引优化'
        },
        {
          type: 'list',
          items: [
            '<strong>EXPLAIN ANALYZE</strong>：分析查询执行计划',
            '<strong>部分索引</strong>：只索引常用数据',
            '<strong>覆盖索引</strong>：索引包含查询所需字段',
            '<strong>定期重建</strong>：REINDEX TABLE 或 CONCURRENTLY'
          ]
        },
        {
          type: 'code',
          lang: 'sql',
          code: `-- 查看查询计划
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';

-- 查看索引使用情况
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan;`
        }
      ]
    },
    {
      id: 'performance',
      title: '性能优化',
      content: [
        {
          type: 'heading',
          text: '配置优化'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# postgresql.conf

# 内存配置
shared_buffers = 256MB              # 约 25% 内存
effective_cache_size = 1GB          # 约 50-75% 内存
work_mem = 4MB                      # 每个操作内存
maintenance_work_mem = 64MB

# WAL 配置
wal_buffers = 16MB
min_wal_size = 1GB
max_wal_size = 4GB
wal_level = replica

# 检查点
checkpoint_completion_target = 0.9
checkpoint_timeout = 15min

# 并发
max_connections = 100
max_worker_processes = 8
max_parallel_workers_per_gather = 4
max_parallel_workers = 8

# 查询优化
random_page_cost = 1.1              # SSD 可设为 1.1
effective_io_concurrency = 200      # SSD`
        },
        {
          type: 'heading',
          text: 'VACUUM 与维护'
        },
        {
          type: 'code',
          lang: 'sql',
          code: `-- 自动清理
ALTER TABLE users SET (autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE users SET (autovacuum_analyze_scale_factor = 0.05);

-- 手动清理
VACUUM ANALYZE users;

-- 完全清理（回收空间给系统）
VACUUM FULL users;

-- 只分析不清理
ANALYZE users;

-- 查看表膨胀情况
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;`
        }
      ]
    },
    {
      id: 'replication',
      title: '主从复制',
      content: [
        {
          type: 'heading',
          text: '流复制配置'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# 主库配置 (postgresql.conf)
listen_addresses = '*'
wal_level = replica
max_wal_senders = 5
wal_keep_size = 1GB
synchronous_commit = on

# pg_hba.conf 添加复制用户
host    replication     replicator      192.168.1.0/24      scram-sha-256

# 创建复制用户
CREATE USER replicator REPLICATION LOGIN PASSWORD 'password';`
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# 从库配置
# recovery.conf (PostgreSQL 12+ 在 postgresql.conf 或 standby.signal)
standby_mode = on
primary_conninfo = 'host=192.168.1.10 port=5432 user=replicator password=password'

# 或使用 pg_basebackup 初始化
pg_basebackup -h 192.168.1.10 -D /var/lib/postgresql/data -U replicator -P -v -R`
        },
        {
          type: 'heading',
          text: '复制模式'
        },
        {
          type: 'table',
          headers: ['模式', '说明'],
          rows: [
            ['异步复制', '主库提交后不等从库确认，性能好'],
            ['同步复制', '主库等待至少一个从库确认，数据最安全'],
            ['半同步复制', '介于两者之间']
          ]
        },
        {
          type: 'code',
          lang: 'sql',
          code: `-- 设置同步复制
ALTER SYSTEM SET synchronous_standby_names = 'standby1';

-- 查看复制状态
SELECT * FROM pg_stat_replication;`
        }
      ]
    },
    {
      id: 'backup',
      title: '备份与恢复',
      content: [
        {
          type: 'heading',
          text: '逻辑备份 (pg_dump)'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# 备份整个数据库
pg_dump -U postgres mydb > mydb_backup.sql

# 压缩备份
pg_dump -U postgres mydb | gzip > mydb_backup.sql.gz

# 自定义格式备份（支持并行恢复）
pg_dump -U postgres -F d -j 4 -f mydb_backup mydb

# 只备份表结构
pg_dump -U postgres -s mydb > schema.sql

# 只备份数据
pg_dump -U postgres -a mydb > data.sql

# 恢复
psql -U postgres mydb < mydb_backup.sql

# 恢复自定义格式备份
pg_restore -U postgres -d mydb -j 4 mydb_backup/`
        },
        {
          type: 'heading',
          text: '物理备份 (pg_basebackup)'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# 全量备份
pg_basebackup -D /backup/pg_backup -Ft -z -P -U postgres

# 增量备份（需要先有全量备份）
pg_basebackup -D /backup/pg_inc -Ft -z -P -U postgres -X stream`
        },
        {
          type: 'heading',
          text: 'PITR (时间点恢复)'
        },
        {
          type: 'paragraph',
          text: '使用 WAL 日志恢复到任意时间点。'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# 配置归档
archive_mode = on
archive_command = 'cp %p /archive/%f'

# 恢复到指定时间
# recovery.conf
restore_command = 'cp /archive/%f %p'
recovery_target_time = '2024-01-01 12:00:00'`
        }
      ]
    },
    {
      id: 'security',
      title: '安全配置',
      content: [
        {
          type: 'heading',
          text: '访问控制'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# pg_hba.conf 配置
# TYPE  DATABASE        USER            ADDRESS                 METHOD

# 本地连接
local   all             postgres                                peer

# 本地网络
host    all             all             127.0.0.1/32            scram-sha-256
host    all             all             ::1/128                 scram-sha-256

# 内网
host    all             all             192.168.1.0/24          scram-sha-256

# 复制连接
host    replication     replicator      192.168.1.0/24          scram-sha-256`
        },
        {
          type: 'heading',
          text: '权限管理'
        },
        {
          type: 'code',
          lang: 'sql',
          code: `-- 创建角色
CREATE USER app_user WITH PASSWORD 'secure_password';

-- 授予数据库权限
GRANT CONNECT ON DATABASE mydb TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- 设置默认权限
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

-- 行级安全 (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_isolation ON users
    FOR ALL
    USING (user_id = current_user_id());`
        }
      ]
    },
    {
      id: 'extensions',
      title: '常用扩展',
      content: [
        {
          type: 'heading',
          text: 'PostGIS (地理信息)'
        },
        {
          type: 'code',
          lang: 'sql',
          code: `-- 安装扩展
CREATE EXTENSION postgis;

-- 创建几何表
CREATE TABLE locations (
    id SERIAL PRIMARY KEY,
    name TEXT,
    geom GEOMETRY(Point, 4326)
);

-- 插入位置
INSERT INTO locations (name, geom) VALUES
('北京', ST_SetSRID(ST_MakePoint(116.4074, 39.9042), 4326));

-- 距离查询
SELECT name, ST_Distance(geom, ST_SetSRID(ST_MakePoint(116.4, 39.9), 4326)) AS distance
FROM locations;`
        },
        {
          type: 'heading',
          text: 'pg_trgm (模糊搜索)'
        },
        {
          type: 'code',
          lang: 'sql',
          code: `-- 安装扩展
CREATE EXTENSION pg_trgm;

-- 创建 GIN 索引
CREATE INDEX idx_name_trgm ON users USING gin(name gin_trgm_ops);

-- 模糊搜索
SELECT * FROM users WHERE name LIKE '%john%';

-- 相似度搜索
SELECT * FROM users WHERE similarity(name, 'john') > 0.3;`
        },
        {
          type: 'heading',
          text: 'uuid-ossp'
        },
        {
          type: 'code',
          lang: 'sql',
          code: `-- 安装扩展
CREATE EXTENSION "uuid-ossp";

-- 生成 UUID
SELECT uuid_generate_v4();

-- 表中使用
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT
);`
        }
      ]
    }
  ]
}

// 技术文档数据映射
export const tcpUdpDoc: TechDocData = {
  name: 'TCP/UDP',
  icon: 'N',
  color: 'from-sky-400 to-cyan-600',
  chapters: [
    {
      id: 'intro',
      title: 'TCP 与 UDP 是什么',
      content: [
        {
          type: 'heading',
          text: '它们属于哪一层'
        },
        {
          type: 'paragraph',
          text: 'TCP 和 UDP 都属于传输层协议，位于应用层和网络层之间。应用层把数据交给传输层，传输层负责在进程之间传输数据，再由 IP 协议负责把数据送到目标主机。简单说，IP 解决“发到哪台机器”，TCP/UDP 解决“发给机器上的哪个进程，以及怎么发”。'
        },
        {
          type: 'heading',
          text: 'TCP 是什么'
        },
        {
          type: 'paragraph',
          text: 'TCP（Transmission Control Protocol，传输控制协议）是一种面向连接、可靠、基于字节流的传输层协议。它在正式传输数据前需要先建立连接，传输过程中会保证数据按序到达、无重复、无丢失，并通过确认应答、重传、流量控制、拥塞控制等机制来提升可靠性。'
        },
        {
          type: 'list',
          items: [
            '<strong>面向连接</strong>：通信前先建立连接，通信结束后显式关闭连接',
            '<strong>可靠传输</strong>：有确认、超时重传、校验、排序、去重等机制',
            '<strong>面向字节流</strong>：应用看到的是连续字节，不关心底层分成几个报文段',
            '<strong>全双工通信</strong>：同一条连接上双方都可以同时发送和接收数据'
          ]
        },
        {
          type: 'heading',
          text: 'UDP 是什么'
        },
        {
          type: 'paragraph',
          text: 'UDP（User Datagram Protocol，用户数据报协议）是一种无连接、尽力而为、面向报文的传输层协议。发送端不需要先建立连接，直接把报文发出去；协议本身不保证一定送达、不保证顺序、不保证去重，因此开销更小、时延更低。'
        },
        {
          type: 'list',
          items: [
            '<strong>无连接</strong>：不需要像 TCP 一样建立和维护连接状态',
            '<strong>面向报文</strong>：应用发多少，UDP 就按一个独立数据报发送多少',
            '<strong>头部开销小</strong>：首部只有 8 字节，适合对实时性敏感的场景',
            '<strong>协议本身不保证可靠性</strong>：如果业务需要可靠性，通常在应用层自行补偿'
          ]
        }
      ]
    },
    {
      id: 'tcp-vs-udp',
      title: 'TCP 和 UDP 的核心区别',
      content: [
        {
          type: 'heading',
          text: '对比表'
        },
        {
          type: 'table',
          headers: ['维度', 'TCP', 'UDP'],
          rows: [
            ['连接方式', '面向连接', '无连接'],
            ['可靠性', '可靠传输，保证到达顺序和完整性', '尽力而为，不保证到达、不保证顺序'],
            ['数据形式', '字节流', '报文'],
            ['首部开销', '较大，通常 20 字节起', '较小，8 字节'],
            ['传输速度', '相对更慢，控制机制更多', '相对更快，协议开销更低'],
            ['是否有拥塞/流量控制', '有', '协议本身没有'],
            ['典型场景', 'HTTP/HTTPS、MySQL、SSH、文件传输', 'DNS、音视频通话、直播、游戏实时消息']
          ]
        },
        {
          type: 'heading',
          text: '什么时候选 TCP'
        },
        {
          type: 'list',
          items: [
            '不能丢数据，比如订单、支付、数据库同步、文件传输',
            '要求严格顺序，比如消息必须按发送顺序处理',
            '更关注正确性而不是极致低延迟'
          ]
        },
        {
          type: 'heading',
          text: '什么时候选 UDP'
        },
        {
          type: 'list',
          items: [
            '更关注实时性，允许少量丢包，比如语音通话、直播、在线游戏',
            '一问一答、报文短小，比如 DNS 查询',
            '业务可以自己实现重试、纠错、排序、丢包恢复等策略'
          ]
        },
        {
          type: 'heading',
          text: '一句话理解'
        },
        {
          type: 'paragraph',
          text: 'TCP 更像“打电话”，先建立通话，再保证双方稳定交流；UDP 更像“寄明信片”，直接发出，快，但不保证一定到、也不保证按顺序到。'
        }
      ]
    },
    {
      id: 'tcp-handshake',
      title: 'TCP 三次握手',
      children: [
        { id: 'tcp-handshake-process', title: '三次握手过程' },
        { id: 'tcp-handshake-why-three', title: '为什么必须三次' },
        { id: 'tcp-handshake-state', title: '状态变化' }
      ],
      content: [
        {
          type: 'heading',
          id: 'tcp-handshake-process',
          text: '三次握手过程'
        },
        {
          type: 'paragraph',
          text: '三次握手的目标是让通信双方都确认两件事：第一，对方具备发送和接收能力；第二，双方都已经准备好使用某个初始序列号开始通信。'
        },
        {
          type: 'code',
          lang: 'text',
          code: `第一次握手：
客户端先发消息给服务端，说“我想和你建立连接”。
这个请求报文叫 SYN 报文，你可以先把它理解成“发起连接请求”。
如果从报文字段来看，这一步会携带 SYN 标志位，以及客户端自己的初始序列号 seq=x。

第二次握手：
服务端收到后，会回复客户端两层意思：
第一层是“我收到你的请求了”；
第二层是“我也同意建立连接”。
所以服务端发回的是 SYN + ACK 报文。
如果从报文字段来看，这一步会带上服务端自己的初始序列号 seq=y，同时用 ack=x+1 表示“客户端刚才那条请求我已经收到了”。

第三次握手：
客户端再回复服务端，说“我也收到你的回复了，那我们现在就正式开始通信”。
这一步发送的是 ACK 确认报文。
如果从报文字段来看，这一步通常会带上 ack=y+1，表示“服务端发来的建立连接响应，我也已经收到了”。

三次握手完成后，双方都确认了两件事：
1. 对方能正常收发消息；
2. 双方都已经准备好，可以正式传输数据。`
        },
        {
          type: 'heading',
          text: '三次握手时序图'
        },
        {
          type: 'code',
          lang: 'text',
          code: `客户端                              服务端
  |                                   |
  | ---- SYN：我想建立连接 -----------> |
  |                                   |
  | <--- SYN + ACK：收到，也同意 ------ |
  |                                   |
  | ---- ACK：收到，那开始通信 -------> |
  |                                   |
  | ======== 连接建立，开始传输 ======== |
  |                                   |`
        },
        {
          type: 'heading',
          id: 'tcp-handshake-why-three',
          text: '为什么必须是三次，不是两次'
        },
        {
          type: 'list',
          items: [
            '两次握手只能保证客户端知道“服务端收到了我的请求”，但不能保证服务端知道“客户端收到了我的确认”。',
            '第三次握手的本质是客户端告诉服务端：你的确认我已经收到了，你现在可以放心发数据。',
            '如果只有两次，服务端可能会因为旧的、滞留的连接请求而误以为连接已经建立，造成资源浪费甚至错误连接。'
          ]
        },
        {
          type: 'heading',
          id: 'tcp-handshake-state',
          text: '连接建立时的典型状态变化'
        },
        {
          type: 'code',
          lang: 'text',
          code: `客户端：
CLOSED -> SYN_SENT -> ESTABLISHED

服务端：
LISTEN -> SYN_RCVD -> ESTABLISHED`
        },
        {
          type: 'heading',
          text: '握手阶段解决了什么问题'
        },
        {
          type: 'list',
          items: [
            '确认双方的收发能力正常',
            '同步双方的初始序列号，后续可靠传输依赖它',
            '协商一些连接参数，比如窗口大小、MSS、是否支持 SACK 等'
          ]
        }
      ]
    },
    {
      id: 'tcp-wave',
      title: 'TCP 四次挥手',
      children: [
        { id: 'tcp-wave-process', title: '四次挥手过程' },
        { id: 'tcp-wave-why-four', title: '为什么是四次' },
        { id: 'tcp-wave-timewait', title: 'TIME_WAIT 的意义' }
      ],
      content: [
        {
          type: 'heading',
          id: 'tcp-wave-process',
          text: '四次挥手过程'
        },
        {
          type: 'paragraph',
          text: 'TCP 是全双工协议，双方都可以独立发送数据，所以关闭连接时通常需要分别关闭两个方向的数据流。也正因为如此，连接断开通常是四次挥手。'
        },
        {
          type: 'code',
          lang: 'text',
          code: `第一次挥手：
主动关闭方先发消息给对方，说“我这边已经没有数据要发了，准备关闭连接”。
这一步发送的是 FIN 报文，你可以先把它理解成“关闭请求”。
如果从报文字段来看，这一步会携带 FIN 标志位，以及当前的序列号 seq=u。
但要注意，这里只是表示“我不再发送数据了”，并不代表“我也不能接收数据了”。

第二次挥手：
被动关闭方收到后，会先回复一句：“我知道了，你这边可以先停止发送了。”
这一步发送的是 ACK 确认报文。
如果从报文字段来看，这一步会带上 ack=u+1，表示“你刚才发来的关闭请求我已经收到了”。
这时连接还没有完全断开，因为被动关闭方可能还有数据没发完。

第三次挥手：
等被动关闭方也把自己的数据发送完之后，它会再发消息给主动关闭方，说“我这边也没有数据要发了，也准备关闭连接”。
这一步发送的是 FIN 报文。
如果从报文字段来看，这一步会携带 FIN 标志位，以及它自己的序列号 seq=v。

第四次挥手：
主动关闭方收到后，最后再回复一句：“我知道了，你这边也可以关闭了。”
这一步发送的是 ACK 确认报文。
如果从报文字段来看，这一步通常会带上 ack=v+1，表示“你最后发来的关闭请求我已经收到了”。

四次挥手完成后，双方都确认了一件事：
连接的两个方向都已经没有数据要发送了，这条连接可以正式关闭。`
        },
        {
          type: 'heading',
          text: '四次挥手时序图'
        },
        {
          type: 'code',
          lang: 'text',
          code: `主动关闭方                            被动关闭方
    |                                      |
    | ---- FIN：我这边准备关闭 -----------> |
    |                                      |
    | <--- ACK：收到，你先别发了 ---------- |
    |                                      |
    | <--- FIN：我这边也准备关闭 ---------- |
    |                                      |
    | ---- ACK：收到，那就正式关闭 -------> |
    |                                      |
    | ======== 连接关闭流程完成 ============ |
    |                                      |`
        },
        {
          type: 'heading',
          id: 'tcp-wave-why-four',
          text: '为什么通常是四次，不是三次'
        },
        {
          type: 'list',
          items: [
            '收到对方的 FIN 时，只能说明“对方不再发送数据了”，并不代表本方也立刻没有数据可发。',
            '因此 ACK 和 FIN 往往需要拆开：先确认对方要关闭，再等本方数据发完后单独发送 FIN。',
            '在特殊情况下，如果被动关闭方刚好没有数据要发送，第二次和第三次可以合并，但本质上仍然是两个动作。'
          ]
        },
        {
          type: 'heading',
          id: 'tcp-wave-timewait',
          text: 'TIME_WAIT 为什么存在'
        },
        {
          type: 'paragraph',
          text: '主动关闭连接的一方在发送最后一个 ACK 后不会立刻进入 CLOSED，而是进入 TIME_WAIT，通常持续 2MSL。MSL 是报文在网络中的最大生存时间。'
        },
        {
          type: 'list',
          items: [
            '<strong>保证最后一个 ACK 能到达</strong>：如果最后的 ACK 丢失，被动关闭方会重发 FIN，主动关闭方在 TIME_WAIT 期间还能再次发送 ACK。',
            '<strong>让旧连接报文自然消失</strong>：等待足够长时间后，旧连接中的延迟报文基本都会从网络中消失，避免影响后续同四元组的新连接。'
          ]
        },
        {
          type: 'heading',
          text: '连接关闭时的典型状态变化'
        },
        {
          type: 'code',
          lang: 'text',
          code: `主动关闭方：
ESTABLISHED -> FIN_WAIT_1 -> FIN_WAIT_2 -> TIME_WAIT -> CLOSED

被动关闭方：
ESTABLISHED -> CLOSE_WAIT -> LAST_ACK -> CLOSED`
        }
      ]
    },
    {
      id: 'reliability',
      title: 'TCP 为什么可靠，UDP 为什么快',
      content: [
        {
          type: 'heading',
          text: 'TCP 可靠性的核心机制'
        },
        {
          type: 'list',
          items: [
            '<strong>序列号</strong>：每个字节都有编号，保证数据可排序、可去重',
            '<strong>确认应答 ACK</strong>：接收方收到数据后会确认，发送方据此判断是否送达',
            '<strong>超时重传</strong>：在规定时间内没收到 ACK，就重新发送',
            '<strong>滑动窗口</strong>：无需每发一个包都停下来等确认，提高吞吐量',
            '<strong>流量控制</strong>：根据接收方窗口调节发送速度，避免把对方缓冲区打满',
            '<strong>拥塞控制</strong>：避免网络被发送方压垮，典型算法包括慢启动、拥塞避免、快重传、快恢复'
          ]
        },
        {
          type: 'heading',
          text: 'UDP 为什么更快'
        },
        {
          type: 'list',
          items: [
            '没有连接建立和断开的额外往返开销',
            '没有确认重传、滑动窗口、拥塞控制等复杂机制',
            '首部更小，处理逻辑更简单',
            '对实时业务来说，偶发丢包往往比等待重传更可接受'
          ]
        },
        {
          type: 'heading',
          text: 'UDP 不可靠就不能用吗'
        },
        {
          type: 'paragraph',
          text: '不是。UDP 只是把可靠性控制从传输层上移到了应用层。如果业务本身能容忍丢包，或者能在应用层定制自己的重试、纠错、重排策略，那么 UDP 反而更合适。比如音视频通话中，晚到的旧语音包价值很低，很多时候直接丢弃比重传更好。'
        }
      ]
    },
    {
      id: 'common-issues',
      title: '知识点归纳与易错点',
      content: [
        {
          type: 'heading',
          text: '核心知识点归纳'
        },
        {
          type: 'list',
          items: [
            '<strong>TCP 与 UDP 的主要区别</strong>：可以从连接方式、可靠性、传输形式、开销大小、时延特征和适用场景几个维度来理解。',
            '<strong>TCP 三次握手的作用</strong>：本质是确认双方的收发能力正常，并同步初始序列号，为后续可靠传输做准备。',
            '<strong>TCP 四次挥手的原因</strong>：因为 TCP 是全双工协议，两个方向的关闭通常需要分开完成。',
            '<strong>TIME_WAIT 的意义</strong>：既要保证最后一个 ACK 有机会重发，也要避免旧连接中的延迟报文影响新连接。',
            '<strong>UDP 的可靠性扩展</strong>：如果业务需要，应用层可以补充确认、重试、排序、去重、纠错等机制。'
          ]
        },
        {
          type: 'heading',
          text: '理解时容易混淆的点'
        },
        {
          type: 'list',
          items: [
            '不要说 UDP “不安全” 或 “一定会丢包”，更准确的说法是：UDP 协议本身不保证可靠传输。',
            '不要把“面向字节流”和“面向报文”理解成 TCP 一次发送对应一次接收。TCP 会拆包和粘包，应用层需要自行处理消息边界。',
            '不要把四次挥手理解成双方都立刻关闭。第一次 FIN 只表示一方不再发送，不代表不能接收。'
          ]
        }
      ]
    }
  ]
}

export const techDocs: Record<string, TechDocData> = {
  mongodb: mongodbDoc,
  mysql: mysqlDoc,
  docker: dockerDoc,
  go: goDoc,
  redis: redisDoc,
  nginx: nginxDoc,
  postgresql: pgsqlDoc,
  'tcp-udp': tcpUdpDoc
}

// 获取技术文档数据
export function getTechDoc(techId: string): TechDocData | null {
  return techDocs[techId] || null
}

// 获取所有可用的技术栈
export function getAvailableTechStacks(): string[] {
  return Object.keys(techDocs)
}
