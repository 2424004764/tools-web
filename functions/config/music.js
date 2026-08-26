// 音乐播放列表的运行时配置（不需要走 DB、不需要 admin UI）
// 改完部署后即生效（无需迁移）。

/** 每多少 MB = 1 积分（最低 1 积分，余数不计费） */
export const MUSIC_MB_PER_CREDIT = 2

/** 每个用户终身累计的免费上传额度（字节） */
export const MUSIC_FREE_QUOTA_BYTES = 30 * 1024 * 1024