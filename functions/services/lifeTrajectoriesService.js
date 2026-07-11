import { Model, QueryBuilder } from '../utils/db.js'

// 人生轨迹模型
export class LifeTrajectoryModel extends Model {
  constructor(db) {
    super(db)
    this.config = {
      tableName: 'life_trajectories',
      fields: {
        id: { type: 'string', primaryKey: true },
        uid: { type: 'string' },
        content: { type: 'text' },
        mood: { type: 'string' },
        createTime: { type: 'datetime', dbField: 'create_time' },
      },
    }
  }
}

// 人生轨迹服务
export class LifeTrajectoriesService {
  constructor(db) {
    this.model = new LifeTrajectoryModel(db)
  }

  // 获取最新的人生轨迹列表（所有人可见，按时间倒序）
  async list(pager) {
    try {
      const queryBuilder = new QueryBuilder().orderBy('createTime', 'DESC')
      pager.applyTo(queryBuilder)
      const total = await this.model.count()
      const data = await this.model.findAll(queryBuilder)
      return { success: true, data: pager.createResult(data, total) }
    } catch (error) {
      console.error('获取人生轨迹列表失败:', error)
      return { success: false, error: '获取列表失败' }
    }
  }

  // 发布一条新轨迹
  async create(data, uid) {
    try {
      const result = await this.model.create({
        uid,
        content: data.content.trim(),
        mood: (data.mood || '🌱').trim(),
      })
      return { success: true, data: { id: result.id, message: '发布成功' } }
    } catch (error) {
      console.error('发布人生轨迹失败:', error)
      return { success: false, error: '发布失败' }
    }
  }

  // 删除一条轨迹（只能删除自己的）
  async remove(id, uid) {
    try {
      const queryBuilder = new QueryBuilder()
        .where('id', '=', id)
        .where('uid', '=', uid)
      const deleted = await this.model.deleteWithQuery(queryBuilder)
      return {
        success: true,
        data: {
          deleted,
          message: deleted ? '删除成功' : '记录不存在或无权限',
        },
      }
    } catch (error) {
      console.error('删除人生轨迹失败:', error)
      return { success: false, error: '删除失败' }
    }
  }
}
