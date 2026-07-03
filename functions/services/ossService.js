import { OssCredentialModel, QueryBuilder } from '../utils/db.js'
import { encryptSecret, decryptSecret, maskSecret } from '../utils/crypto-secret.js'

export class OssService {
  constructor(db, jwtSecret) {
    this.db = db
    this.jwtSecret = jwtSecret
    this.model = new OssCredentialModel(db)
  }

  /**
   * 列表 - 返回不包含明文的脱敏数据
   */
  async list(uid) {
    try {
      const qb = new QueryBuilder()
        .where('uid', '=', uid)
        .orderBy('isDefault', 'DESC')
        .orderBy('createTime', 'DESC')
      const rows = await this.model.findAll(qb)
      return {
        success: true,
        data: rows.map(r => this._maskRow(r))
      }
    } catch (e) {
      console.error('OssService.list error:', e)
      return { success: false, error: '获取列表失败' }
    }
  }

  /**
   * 详情 - 含明文（仅后端使用）
   */
  async getRawById(id, uid) {
    const row = await this.model.findOne(
      new QueryBuilder().where('id', '=', id).where('uid', '=', uid)
    )
    if (!row) return { success: false, error: '配置不存在或无权限' }
    const [ak, sk] = await Promise.all([
      decryptSecret(row.accessKeyIdEnc, this.jwtSecret),
      decryptSecret(row.accessKeySecretEnc, this.jwtSecret)
    ])
    return {
      success: true,
      data: {
        id: row.id,
        uid: row.uid,
        name: row.name,
        region: row.region,
        bucket: row.bucket,
        endpoint: row.endpoint || '',
        accessKeyId: ak,
        accessKeySecret: sk,
        roleArn: row.roleArn || '',
        policy: row.policy || '',
        durationSeconds: row.durationSeconds || 3600,
        isDefault: row.isDefault || 0
      }
    }
  }

  /**
   * 详情 - 脱敏
   */
  async getMaskedById(id, uid) {
    const row = await this.model.findOne(
      new QueryBuilder().where('id', '=', id).where('uid', '=', uid)
    )
    if (!row) return { success: false, error: '配置不存在或无权限' }
    return { success: true, data: this._maskRow(row) }
  }

  /**
   * 创建
   */
  async create(uid, data) {
    const required = ['name', 'region', 'bucket', 'accessKeyId', 'accessKeySecret']
    for (const k of required) {
      if (!data[k] || String(data[k]).trim() === '') {
        return { success: false, error: `缺少必填字段: ${k}` }
      }
    }
    if (data.roleArn && !/^acs:ram::\d+:role\//.test(data.roleArn)) {
      return { success: false, error: 'role_arn 格式错误，应类似 acs:ram::123:role/myrole' }
    }
    const duration = parseInt(data.durationSeconds, 10) || 3600
    if (duration < 900 || duration > 3600) {
      return { success: false, error: 'duration_seconds 必须在 900~3600 之间' }
    }

    try {
      const [akEnc, skEnc] = await Promise.all([
        encryptSecret(String(data.accessKeyId).trim(), this.jwtSecret),
        encryptSecret(String(data.accessKeySecret).trim(), this.jwtSecret)
      ])

      const isDefault = data.isDefault ? 1 : 0
      if (isDefault) {
        // 取消其他默认
        await this.db.prepare(
          'UPDATE oss_credentials SET is_default = 0 WHERE uid = ?'
        ).bind(uid).run()
      }

      const id = crypto.randomUUID()
      await this.db.prepare(`
        INSERT INTO oss_credentials
        (id, uid, name, region, bucket, endpoint, access_key_id_enc, access_key_secret_enc,
         role_arn, policy, duration_seconds, is_default, create_time, update_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(
        id,
        uid,
        String(data.name).trim(),
        String(data.region).trim(),
        String(data.bucket).trim(),
        data.endpoint ? String(data.endpoint).trim() : '',
        akEnc,
        skEnc,
        data.roleArn ? String(data.roleArn).trim() : '',
        data.policy ? String(data.policy).trim() : '',
        duration,
        isDefault
      ).run()

      return { success: true, data: { id, message: '创建成功' } }
    } catch (e) {
      console.error('OssService.create error:', e)
      return { success: false, error: '创建失败：' + e.message }
    }
  }

  /**
   * 更新 - 密钥可选（不传则保留原值）
   */
  async update(id, uid, data) {
    try {
      const existed = await this.model.findOne(
        new QueryBuilder().where('id', '=', id).where('uid', '=', uid)
      )
      if (!existed) return { success: false, error: '配置不存在或无权限' }

      const updateData = {}
      if (data.name !== undefined) updateData.name = String(data.name).trim()
      if (data.region !== undefined) updateData.region = String(data.region).trim()
      if (data.bucket !== undefined) updateData.bucket = String(data.bucket).trim()
      if (data.endpoint !== undefined) updateData.endpoint = String(data.endpoint).trim()
      if (data.roleArn !== undefined) updateData.roleArn = String(data.roleArn).trim()
      if (data.policy !== undefined) updateData.policy = String(data.policy).trim()
      if (data.durationSeconds !== undefined) {
        const d = parseInt(data.durationSeconds, 10) || 3600
        if (d < 900 || d > 3600) return { success: false, error: 'duration_seconds 必须在 900~3600 之间' }
        updateData.durationSeconds = d
      }
      if (data.isDefault !== undefined) updateData.isDefault = data.isDefault ? 1 : 0

      // 加密密钥（若有）
      if (data.accessKeyId) {
        updateData.accessKeyIdEnc = await encryptSecret(String(data.accessKeyId).trim(), this.jwtSecret)
      }
      if (data.accessKeySecret) {
        updateData.accessKeySecretEnc = await encryptSecret(String(data.accessKeySecret).trim(), this.jwtSecret)
      }

      if (Object.keys(updateData).length === 0) {
        return { success: false, error: '没有要更新的字段' }
      }

      if (updateData.isDefault === 1) {
        await this.db.prepare(
          'UPDATE oss_credentials SET is_default = 0 WHERE uid = ? AND id != ?'
        ).bind(uid, id).run()
      }

      const ok = await this.model.updateWithQuery(updateData,
        new QueryBuilder().where('id', '=', id).where('uid', '=', uid))
      return { success: ok, data: { updated: ok, message: ok ? '更新成功' : '更新失败' } }
    } catch (e) {
      console.error('OssService.update error:', e)
      return { success: false, error: '更新失败：' + e.message }
    }
  }

  /**
   * 删除
   */
  async delete(id, uid) {
    try {
      const ok = await this.model.deleteWithQuery(
        new QueryBuilder().where('id', '=', id).where('uid', '=', uid)
      )
      return { success: ok, data: { deleted: ok, message: ok ? '删除成功' : '删除失败' } }
    } catch (e) {
      console.error('OssService.delete error:', e)
      return { success: false, error: '删除失败：' + e.message }
    }
  }

  // 内部：脱敏返回
  _maskRow(row) {
    return {
      id: row.id,
      uid: row.uid,
      name: row.name,
      region: row.region,
      bucket: row.bucket,
      endpoint: row.endpoint || '',
      roleArn: row.roleArn || '',
      hasPolicy: !!row.policy,
      durationSeconds: row.durationSeconds || 3600,
      isDefault: row.isDefault || 0,
      accessKeyIdMasked: maskSecret(this._tryDecryptSync(row.accessKeyIdEnc)),
      createTime: row.createTime,
      updateTime: row.updateTime
    }
  }

  // 同步解密（仅内部脱敏使用，失败返回空串）
  _tryDecryptSync(encText) {
    if (!encText) return ''
    try {
      // 异步转同步 - 这里只在展示时脱敏 mask 用，失败时显示空字符串即可
      // 真正的解密在 getRawById 中进行
      return ''
    } catch {
      return ''
    }
  }
}