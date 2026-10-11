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

/** 子站上传凭证单文件上限（500MB，防呆值；真实上限仍受用户剩余额度约束）。
 *  R2 单次 PUT 上限约 5GiB，大文件分片暂不支持，后续需要再扩展凭证接口 */
export const SUBSITE_UPLOAD_MAX_BYTES = 500 * 1024 * 1024

/** 子站上传记录过期时间（秒）：超时仍未实扣的 pending 记录由 tools-web-worker 定时任务标为 expired */
export const SUBSITE_UPLOAD_EXPIRE_SECONDS = 48 * 3600
