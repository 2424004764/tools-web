// 统一存储额度的运行时配置（不需要走 DB、不需要 admin UI）
// 改完部署后即生效（无需迁移）。

/** 每 1 积分可购买的存储字节数（100MB） */
export const STORAGE_BYTES_PER_CREDIT = 100 * 1024 * 1024

/** 单次最少购买单元（1 积分 = 100MB） */
export const STORAGE_MIN_UNITS = 1

/** 单次最多购买单元（防止误操作一次扣光积分） */
export const STORAGE_MAX_UNITS = 100

/** 上传预留有效期（秒）：签名后未 confirm 的预留，超过该时间视为失效，不再占用额度 */
export const STORAGE_RESERVATION_TTL_SECONDS = 3600

/** 预留清扫：超过该时间（秒）的预留行在任意用户 reserve 时被顺带删除 */
export const STORAGE_RESERVATION_SWEEP_SECONDS = 86400
