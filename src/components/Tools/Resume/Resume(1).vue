/* 在现有的移动端媒体查询中添加 */
@media (max-width: 870px) {
  @media (hover: none) and (pointer: coarse) {
    .preview-container {
      min-width: auto !important;  /* 移除固定宽度 */
      width: 100% !important;
      max-width: 100vw !important;
    }
    
    .resume-preview {
      transform: scale(calc(100vw / 794)) !important;
      transform-origin: center top !important;
      max-width: 100vw !important;
    }
  }
}
