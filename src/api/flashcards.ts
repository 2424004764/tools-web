// 闪卡复习 API 封装
// 后端：functions/api/flashcards/*

import { functionsRequest } from '@/utils/functionsRequest'

/**
 * 后端统一返回 { success: boolean, data?, error? }。
 * axios 拦截器只在 4xx/5xx 时 reject；如果后端用 2xx 返回 success=false，axios 不会 throw，
 * 这里统一校验：success=false 时主动抛错，让上层 try/catch 接管。
 */
function unwrap<T>(res: { data?: { success?: boolean; data?: T; error?: string } }): T {
  const body = res.data
  if (!body || body.success === false) {
    const msg = body?.error || '请求失败'
    const err: any = new Error(msg)
    err.response = { data: body }
    throw err
  }
  return body.data as T
}

// ============ 类型 ============

export interface FlashcardDeck {
  id: string
  name: string
  description: string
  daily_new_limit: number
  total_cards: number
  due_today: number
  new_cards: number
  created_at: number
  updated_at: number
}

export interface Flashcard {
  id: string
  deck_id: string
  front: string
  back: string
  ease_factor: number
  interval_days: number
  repetitions: number
  due_at: number
  is_suspended: number
  created_at: number
  updated_at: number
}

export interface FlashcardReviewResponse {
  id: string
  ease_factor: number
  interval_days: number
  repetitions: number
  due_at: number
  prev_interval_days: number
  grade: number
  preview: Array<{
    grade: number
    interval_days: number
    due_at: number
    label: string
  }>
}

export interface DueQueueResponse {
  queue: Flashcard[]
  total: number
  review_count: number
  new_count: number
  daily_new_limit: number
  deck: { id: string; name: string }
}

export interface FlashcardStats {
  deck: { id: string; name: string }
  total_cards: number
  suspended_cards: number
  new_cards: number
  learning_cards: number
  mature_cards: number
  due_today: number
  reviews_today: number
  reviews_total: number
  streak_days: number
  reviews_30d: Array<{ day: number; count: number }>
}

// ============ 卡组 ============

export async function fetchDecks(): Promise<FlashcardDeck[]> {
  const res = await functionsRequest.get('/api/flashcards/decks')
  return unwrap<FlashcardDeck[]>(res)
}

export async function createDeck(input: {
  name: string
  description?: string
  daily_new_limit?: number
}): Promise<FlashcardDeck> {
  const res = await functionsRequest.post('/api/flashcards/decks', input)
  return unwrap<FlashcardDeck>(res)
}

export async function fetchDeck(id: string): Promise<FlashcardDeck> {
  const res = await functionsRequest.get(`/api/flashcards/decks/${id}`)
  return unwrap<FlashcardDeck>(res)
}

export async function updateDeck(
  id: string,
  input: Partial<{ name: string; description: string; daily_new_limit: number }>,
): Promise<void> {
  const res = await functionsRequest.put(`/api/flashcards/decks/${id}`, input)
  unwrap<unknown>(res)
}

export async function deleteDeck(id: string): Promise<void> {
  const res = await functionsRequest.delete(`/api/flashcards/decks/${id}`)
  unwrap<unknown>(res)
}

// ============ 卡片 ============

export async function fetchCards(deckId: string): Promise<Flashcard[]> {
  const res = await functionsRequest.get(`/api/flashcards/decks/${deckId}/cards`)
  return unwrap<Flashcard[]>(res)
}

export async function createCard(
  deckId: string,
  input: { front: string; back: string; is_suspended?: boolean },
): Promise<Flashcard> {
  const res = await functionsRequest.post(`/api/flashcards/decks/${deckId}/cards`, input)
  return unwrap<Flashcard>(res)
}

export async function updateCard(
  id: string,
  input: Partial<{ front: string; back: string; is_suspended: boolean }>,
): Promise<void> {
  const res = await functionsRequest.put(`/api/flashcards/cards/${id}`, input)
  unwrap<unknown>(res)
}

export async function deleteCard(id: string): Promise<void> {
  const res = await functionsRequest.delete(`/api/flashcards/cards/${id}`)
  unwrap<unknown>(res)
}

// ============ 复习 ============

export async function fetchDueQueue(
  deckId: string,
  limit = 200,
): Promise<DueQueueResponse> {
  const res = await functionsRequest.get('/api/flashcards/due', {
    params: { deck_id: deckId, limit },
  })
  return unwrap<DueQueueResponse>(res)
}

export async function reviewCard(
  cardId: string,
  grade: 0 | 3 | 4 | 5,
): Promise<FlashcardReviewResponse> {
  const res = await functionsRequest.post(`/api/flashcards/cards/${cardId}/review`, { grade })
  return unwrap<FlashcardReviewResponse>(res)
}

// ============ 统计 ============

export async function fetchStats(deckId: string): Promise<FlashcardStats> {
  const res = await functionsRequest.get(`/api/flashcards/stats/${deckId}`)
  return unwrap<FlashcardStats>(res)
}