-- 插入初始AI应用数据（系统应用）
INSERT INTO ai_apps (id, name, icon, title, description, category, gradient_from, gradient_to, border_color, sort_order, status, app_type, uid, system_prompt, create_time, update_time) VALUES
('dream-analysis', 'dream-analysis', '🌙', 'AI解梦', '弗洛伊德+周公双体系解析，探索潜意识的奥秘', 'life', 'purple-50', 'blue-50', 'purple-400', 1, 1, 'system', '', '', datetime('now'), datetime('now')),
('city-guide', 'city-guide', '🏛️', '城市指南', '深度了解城市历史文化，发现必去景点', 'travel', 'green-50', 'emerald-50', 'green-400', 2, 1, 'system', '', '', datetime('now'), datetime('now')),
('pet-avatar', 'pet-avatar', '🐱', '宠物头像制作', '上传宠物照片，AI生成动漫风格头像', 'image', 'pink-50', 'rose-50', 'pink-400', 3, 1, 'system', '', '', datetime('now'), datetime('now')),
('blessings-generator', 'blessings-generator', '💝', '祝福语生成器', '为不同场合和对象，生成温馨真挚的祝福', 'text', 'red-50', 'pink-50', 'red-400', 4, 1, 'system', '', '', datetime('now'), datetime('now')),
('copywriting-assistant', 'copywriting-assistant', '📧', '智能文案助手', '为营销、社交媒体生成吸引人的文案', 'text', 'blue-50', 'indigo-50', 'blue-400', 5, 1, 'system', '', '', datetime('now'), datetime('now')),
('id-photo', 'id-photo', '👤', 'AI证件照', '上传照片，AI生成标准证件照', 'image', 'sky-50', 'cyan-50', 'sky-400', 6, 1, 'system', '', '', datetime('now'), datetime('now')),
('additive-hazard', 'additive-hazard', '⚠️', '添加剂危害查询', '查询食品添加剂的危害、成分和使用信息', 'health', 'orange-50', 'amber-50', 'orange-400', 7, 1, 'system', '', '', datetime('now'), datetime('now')),
('medicine-guide', 'medicine-guide', '💊', '药品说明书解读', '拍照上传或输入，通俗易懂的用药指导', 'health', 'green-50', 'teal-50', 'green-400', 8, 1, 'system', '', '', datetime('now'), datetime('now')),
('contract-risk', 'contract-risk', '🔍', '合同风险检测', '识别合同中的风险条款和不平等内容', 'legal', 'red-50', 'rose-50', 'red-400', 9, 1, 'system', '', '', datetime('now'), datetime('now')),
('food-calorie', 'food-calorie', '🍽️', '食物热量识别', '查询食物热量、营养成分和健康建议', 'health', 'yellow-50', 'lime-50', 'yellow-400', 10, 1, 'system', '', '', datetime('now'), datetime('now'));
