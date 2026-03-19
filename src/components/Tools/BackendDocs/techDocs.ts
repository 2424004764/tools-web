// 技术文档数据管理
export interface TechDocData {
  name: string
  icon: string
  color: string
  chapters: {
    id: string
    title: string
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
          text: 'MySQL 是最流行的开源关系型数据库管理系统，由 Oracle 公司维护。'
        },
        {
          type: 'heading',
          text: '核心特点'
        },
        {
          type: 'list',
          items: [
            '<strong>关系型数据库</strong>：基于表结构的数据存储',
            '<strong>ACID 事务</strong>：保证数据一致性和完整性',
            '<strong>高性能</strong>：优化的查询引擎和索引系统',
            '<strong>可扩展性</strong>：支持读写分离和分库分表',
            '<strong>丰富的生态</strong>：广泛的工具和社区支持',
            '<strong>多存储引擎</strong>：InnoDB、MyISAM 等多种引擎'
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
          text: '安装 MySQL'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# Ubuntu/Debian
sudo apt update
sudo apt install mysql-server

# CentOS/RHEL
sudo yum install mysql-server
sudo systemctl start mysqld

# macOS (使用 Homebrew)
brew install mysql
brew services start mysql

# Docker
docker run --name mysql -e MYSQL_ROOT_PASSWORD=password -d mysql:8.0`
        },
        {
          type: 'heading',
          text: '基本配置'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# 编辑配置文件
sudo vim /etc/mysql/mysql.conf.d/mysqld.cnf

# 常用配置项
[mysqld]
# 端口
port = 3306

# 数据目录
datadir = /var/lib/mysql

# 字符集
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci

# InnoDB 配置
innodb_buffer_pool_size = 1G
innodb_log_file_size = 256M

# 最大连接数
max_connections = 100`
        }
      ]
    },
    {
      id: 'basic-operations',
      title: '基本操作',
      content: [
        {
          type: 'heading',
          text: '连接数据库'
        },
        {
          type: 'code',
          lang: 'bash',
          code: `# 连接本地数据库
mysql -u root -p

# 连接远程数据库
mysql -h 192.168.1.100 -u username -p

# 指定数据库连接
mysql -u root -p database_name`
        },
        {
          type: 'heading',
          text: '数据库操作'
        },
        {
          type: 'code',
          lang: 'sql',
          code: `-- 创建数据库
CREATE DATABASE mydb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 查看所有数据库
SHOW DATABASES;

-- 选择数据库
USE mydb;

-- 删除数据库
DROP DATABASE mydb;`
        },
        {
          type: 'heading',
          text: '表操作'
        },
        {
          type: 'code',
          lang: 'sql',
          code: `-- 创建表
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 查看表结构
DESCRIBE users;
SHOW CREATE TABLE users;

-- 修改表结构
ALTER TABLE users ADD COLUMN age INT;
ALTER TABLE users MODIFY COLUMN email VARCHAR(150);

-- 删除表
DROP TABLE users;`
        }
      ]
    }
  ]
}

// 技术文档数据映射
export const techDocs: Record<string, TechDocData> = {
  mongodb: mongodbDoc,
  mysql: mysqlDoc
}

// 获取技术文档数据
export function getTechDoc(techId: string): TechDocData | null {
  return techDocs[techId] || null
}

// 获取所有可用的技术栈
export function getAvailableTechStacks(): string[] {
  return Object.keys(techDocs)
}