// 食物记录（今日吃啥）API 封装
// 后端：functions/api/food-log/index.js

import { functionsRequest } from '@/utils/functionsRequest'

/** 食物时段 */
export type FoodMeal = 'breakfast' | 'lunch' | 'dinner' | 'snack'

/** 食物分类 */
export type FoodCategory =
  | 'staple' | 'meat' | 'vegetable' | 'fruit' | 'dairy'
  | 'drink' | 'dessert' | 'snack' | 'other'

/** 一条食物记录 */
export interface FoodLogItem {
  id: string
  uid: string
  name: string
  meal: FoodMeal
  category: FoodCategory
  quantity: string | null
  calories: number | null
  note: string | null
  /** 秒级时间戳 */
  eatenAt: number
  /** ISO 时间字符串（DB 返回的 SQLite 当前时间） */
  createdAt: string
}

/** 列表接口返回的汇总（某时间范围内） */
export interface FoodLogSummary {
  count: number
  totalCalories: number
  byMeal: Record<FoodMeal, number>
  rangeStart: number
  rangeEnd: number
}

export interface FoodLogListResult {
  items: FoodLogItem[]
  summary: FoodLogSummary
}

export interface FoodLogListParams {
  /** 秒级时间戳；不传默认今天 00:00 */
  startAt?: number
  /** 秒级时间戳；不传默认明天 00:00 */
  endAt?: number
  meal?: FoodMeal
}

export async function fetchFoodLog(params: FoodLogListParams = {}): Promise<FoodLogListResult> {
  const query: Record<string, string | number> = {}
  if (params.startAt != null) query.startAt = params.startAt
  if (params.endAt != null) query.endAt = params.endAt
  if (params.meal) query.meal = params.meal
  const res = await functionsRequest.get('/api/food-log', { params: query })
  return res.data?.data as FoodLogListResult
}

export interface CreateFoodLogInput {
  name: string
  meal?: FoodMeal
  category?: FoodCategory
  quantity?: string
  calories?: number
  note?: string
  /** 秒级时间戳；不传默认后端当前时间 */
  eatenAt?: number
}

export async function createFoodLog(input: CreateFoodLogInput): Promise<FoodLogItem> {
  const res = await functionsRequest.post('/api/food-log', input)
  return res.data?.data as FoodLogItem
}

export type UpdateFoodLogInput = Partial<CreateFoodLogInput>

export async function updateFoodLog(id: string, input: UpdateFoodLogInput): Promise<void> {
  await functionsRequest.put('/api/food-log', input, { params: { id } })
}

export async function deleteFoodLog(id: string): Promise<void> {
  await functionsRequest.delete('/api/food-log', { params: { id } })
}

// ============ 时段 + 分类 的中文 label（UI 展示）============
export const MEAL_LABELS: Record<FoodMeal, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '加餐',
}

export const CATEGORY_LABELS: Record<FoodCategory, string> = {
  staple: '主食',
  meat: '肉蛋',
  vegetable: '蔬菜',
  fruit: '水果',
  dairy: '奶制品',
  drink: '饮料',
  dessert: '甜品',
  snack: '零食',
  other: '其他',
}

// 默认「今天」时间范围（秒级时间戳）
export function todayRange(): { startAt: number; endAt: number } {
  const now = new Date()
  const startAt = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000)
  const endAt = startAt + 86400
  return { startAt, endAt }
}