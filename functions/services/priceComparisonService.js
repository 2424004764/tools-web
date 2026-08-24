import {
  PriceComparisonItemModel,
  PriceComparisonEntryModel,
  QueryBuilder
} from '../utils/db.js'

// 物品状态
export const ITEM_STATUS = {
  COMPARING: 0,     // 比价中
  PURCHASED: 1,     // 已购买
  CANCELLED: 2,     // 已取消
  ARCHIVED: 3       // 已归档
}

export const ITEM_STATUS_LABEL = {
  [ITEM_STATUS.COMPARING]: '比价中',
  [ITEM_STATUS.PURCHASED]: '已购买',
  [ITEM_STATUS.CANCELLED]: '已取消',
  [ITEM_STATUS.ARCHIVED]: '已归档'
}

// 条目状态
export const ENTRY_STATUS = {
  PENDING: 0,       // 待定
  ORDERED: 1,       // 已下单
  RECEIVED: 2,      // 已到货
  CANCELLED: 3      // 已取消
}

export const ENTRY_STATUS_LABEL = {
  [ENTRY_STATUS.PENDING]: '待定',
  [ENTRY_STATUS.ORDERED]: '已下单',
  [ENTRY_STATUS.RECEIVED]: '已到货',
  [ENTRY_STATUS.CANCELLED]: '已取消'
}

const CATEGORY_COLORS = {
  electronics: '#409EFF',
  digital: '#67C23A',
  clothing: '#E6A23C',
  food: '#F56C6C',
  book: '#909399',
  cosmetic: '#C71585',
  home: '#FF69B4',
  toy: '#8A2BE2',
  sports: '#00CED1',
  other: '#32CD32'
}

const DEFAULT_STATISTICS = {
  totalItems: 0,
  comparingCount: 0,
  purchasedCount: 0,
  cancelledCount: 0,
  totalEntries: 0,
  purchasedEntries: 0,
  totalSpent: 0,                 // 已购买物品的总花费
  totalPotentialSaved: 0,        // 已购买物品相对最高价的节省（理论值）
  byCategory: [],                // [{ category, count, totalSpent }]
  cheapestItems: [],             // 比价中最低价 top5
  recentItems: []                // 最近更新的物品
}

// 计算单条目的最终价：unitPrice*quantity - discount + shippingFee
function calcFinalPrice(unitPrice, quantity, shippingFee, discount) {
  const qty = Number(quantity || 1)
  const ship = Number(shippingFee || 0)
  const disc = Number(discount || 0)
  return Number((Number(unitPrice) * qty + ship - disc).toFixed(2))
}

export class PriceComparisonService {
  constructor(db) {
    this.db = db
    this.itemModel = new PriceComparisonItemModel(db)
    this.entryModel = new PriceComparisonEntryModel(db)
  }

  // ===== 物品列表 =====

  async getAllItems(uid, options = {}) {
    try {
      const { status, category, keyword } = options
      const qb = new QueryBuilder().where('uid', '=', uid)
      if (status !== undefined && status !== null && status !== '') {
        qb.where('status', '=', parseInt(status))
      }
      if (category) {
        qb.where('category', '=', category)
      }
      qb.orderBy('updateTime', 'DESC')
      const items = await this.itemModel.findAll(qb)

      let list = items || []
      if (keyword) {
        const k = String(keyword).toLowerCase()
        list = list.filter(i => (i.name && i.name.toLowerCase().includes(k)) ||
                                (i.spec && i.spec.toLowerCase().includes(k)) ||
                                (i.note && i.note.toLowerCase().includes(k)))
      }

      // 关联每个物品的所有条目（含汇总）
      const result = []
      for (const item of list) {
        const entries = await this.getEntriesByItemId(item.id, uid)
        result.push(this.decorateItem(item, entries))
      }
      return { success: true, data: result }
    } catch (error) {
      console.error('priceComparison getAllItems error:', error)
      return { success: false, error: '获取比价物品失败' }
    }
  }

  async getItemById(id, uid) {
    try {
      const item = await this.itemModel.findOne(
        new QueryBuilder().where('id', '=', id).where('uid', '=', uid)
      )
      if (!item) return { success: true, data: null }
      const entries = await this.getEntriesByItemId(id, uid)
      return { success: true, data: this.decorateItem(item, entries) }
    } catch (error) {
      console.error('priceComparison getItemById error:', error)
      return { success: false, error: '获取物品详情失败' }
    }
  }

  async createItem(data, uid) {
    try {
      const item = await this.itemModel.create({
        uid,
        name: data.name.trim(),
        category: data.category || null,
        spec: data.spec || null,
        note: data.note || '',
        status: data.status === undefined ? ITEM_STATUS.COMPARING : data.status,
        chosenEntryId: data.chosenEntryId || null
      })
      return { success: true, data: { id: item.id, message: '物品创建成功' } }
    } catch (error) {
      console.error('priceComparison createItem error:', error)
      return { success: false, error: '创建物品失败' }
    }
  }

  async updateItem(id, data, uid) {
    try {
      const updateData = {}
      if (data.name !== undefined) updateData.name = data.name.trim()
      if (data.category !== undefined) updateData.category = data.category || null
      if (data.spec !== undefined) updateData.spec = data.spec || null
      if (data.note !== undefined) updateData.note = data.note
      if (data.status !== undefined) updateData.status = data.status
      if (data.chosenEntryId !== undefined) updateData.chosenEntryId = data.chosenEntryId || null

      const ok = await this.itemModel.updateWithQuery(
        updateData,
        new QueryBuilder().where('id', '=', id).where('uid', '=', uid)
      )
      return { success: true, data: { updated: ok, message: ok ? '物品更新成功' : '物品不存在或无权限' } }
    } catch (error) {
      console.error('priceComparison updateItem error:', error)
      return { success: false, error: '更新物品失败' }
    }
  }

  async deleteItem(id, uid) {
    try {
      // 级联删除该物品的所有条目
      await this.entryModel.deleteWithQuery(
        new QueryBuilder().where('itemId', '=', id).where('uid', '=', uid)
      )
      const ok = await this.itemModel.deleteWithQuery(
        new QueryBuilder().where('id', '=', id).where('uid', '=', uid)
      )
      return { success: true, data: { deleted: ok, message: ok ? '物品及条目已删除' : '物品不存在或无权限' } }
    } catch (error) {
      console.error('priceComparison deleteItem error:', error)
      return { success: false, error: '删除物品失败' }
    }
  }

  // ===== 条目 =====

  async getEntries(itemId, uid) {
    try {
      const qb = new QueryBuilder().where('uid', '=', uid)
      if (itemId) qb.where('itemId', '=', itemId)
      qb.orderBy('finalPrice', 'ASC')
      const entries = await this.entryModel.findAll(qb)
      return { success: true, data: entries || [] }
    } catch (error) {
      console.error('priceComparison getEntries error:', error)
      return { success: false, error: '获取比价条目失败' }
    }
  }

  async getEntryById(id, uid) {
    try {
      const entry = await this.entryModel.findOne(
        new QueryBuilder().where('id', '=', id).where('uid', '=', uid)
      )
      return { success: true, data: entry || null }
    } catch (error) {
      console.error('priceComparison getEntryById error:', error)
      return { success: false, error: '获取条目详情失败' }
    }
  }

  async createEntry(data, uid) {
    try {
      // 校验物品归属
      const item = await this.itemModel.findOne(
        new QueryBuilder().where('id', '=', data.itemId).where('uid', '=', uid)
      )
      if (!item) return { success: false, error: '所属物品不存在或无权限' }

      const unitPrice = Number(data.unitPrice)
      const quantity = data.quantity || 1
      const shippingFee = Number(data.shippingFee || 0)
      const discount = Number(data.discount || 0)
      const finalPrice = data.finalPrice !== undefined && data.finalPrice !== null
        ? Number(data.finalPrice)
        : calcFinalPrice(unitPrice, quantity, shippingFee, discount)

      const entry = await this.entryModel.create({
        uid,
        itemId: data.itemId,
        platform: data.platform.trim(),
        unitPrice,
        shippingFee,
        discount,
        finalPrice,
        quantity,
        currency: data.currency || 'CNY',
        status: data.status === undefined ? ENTRY_STATUS.PENDING : data.status,
        purchaseDate: data.purchaseDate || null,
        link: data.link || null,
        seller: data.seller || null,
        note: data.note || '',
        isChosen: data.isChosen ? 1 : 0
      })

      // 若该条目标记为最终选定，同步更新物品 chosenEntryId / status
      if (data.isChosen) {
        await this.markItemChosen(data.itemId, entry.id, uid, item)
      }

      // 触发物品的 updateTime
      await this.touchItem(data.itemId, uid)

      return { success: true, data: { id: entry.id, message: '比价条目创建成功' } }
    } catch (error) {
      console.error('priceComparison createEntry error:', error)
      return { success: false, error: '创建比价条目失败' }
    }
  }

  async updateEntry(id, data, uid) {
    try {
      const existing = await this.entryModel.findOne(
        new QueryBuilder().where('id', '=', id).where('uid', '=', uid)
      )
      if (!existing) return { success: false, error: '条目不存在或无权限' }

      const updateData = {}
      if (data.platform !== undefined) updateData.platform = data.platform.trim()
      if (data.unitPrice !== undefined) updateData.unitPrice = Number(data.unitPrice)
      if (data.shippingFee !== undefined) updateData.shippingFee = Number(data.shippingFee || 0)
      if (data.discount !== undefined) updateData.discount = Number(data.discount || 0)
      if (data.quantity !== undefined) updateData.quantity = data.quantity
      if (data.finalPrice !== undefined && data.finalPrice !== null) {
        updateData.finalPrice = Number(data.finalPrice)
      } else if (updateData.unitPrice !== undefined || updateData.shippingFee !== undefined ||
                 updateData.discount !== undefined || updateData.quantity !== undefined) {
        // 自动重算
        const unitPrice = updateData.unitPrice !== undefined ? updateData.unitPrice : existing.unitPrice
        const qty = updateData.quantity !== undefined ? updateData.quantity : existing.quantity
        const ship = updateData.shippingFee !== undefined ? updateData.shippingFee : existing.shippingFee
        const disc = updateData.discount !== undefined ? updateData.discount : existing.discount
        updateData.finalPrice = calcFinalPrice(unitPrice, qty, ship, disc)
      }
      if (data.currency !== undefined) updateData.currency = data.currency || 'CNY'
      if (data.status !== undefined) updateData.status = data.status
      if (data.purchaseDate !== undefined) updateData.purchaseDate = data.purchaseDate || null
      if (data.link !== undefined) updateData.link = data.link || null
      if (data.seller !== undefined) updateData.seller = data.seller || null
      if (data.note !== undefined) updateData.note = data.note
      if (data.isChosen !== undefined) updateData.isChosen = data.isChosen ? 1 : 0

      const ok = await this.entryModel.updateWithQuery(
        updateData,
        new QueryBuilder().where('id', '=', id).where('uid', '=', uid)
      )

      // 处理"最终选定"切换：若本次标记为选定，需要取消同物品其它条目的 isChosen，并更新物品
      if (data.isChosen === true) {
        await this.entryModel.updateWithQuery(
          { isChosen: 0 },
          new QueryBuilder().where('itemId', '=', existing.itemId).where('id', '!=', id).where('uid', '=', uid)
        )
        const item = await this.itemModel.findOne(
          new QueryBuilder().where('id', '=', existing.itemId).where('uid', '=', uid)
        )
        if (item) {
          await this.markItemChosen(existing.itemId, id, uid, item)
        }
      } else if (data.isChosen === false && existing.isChosen === 1) {
        // 取消选定
        const item = await this.itemModel.findOne(
          new QueryBuilder().where('id', '=', existing.itemId).where('uid', '=', uid)
        )
        if (item && item.chosenEntryId === id) {
          await this.itemModel.updateWithQuery(
            { chosenEntryId: null },
            new QueryBuilder().where('id', '=', existing.itemId).where('uid', '=', uid)
          )
        }
      }

      await this.touchItem(existing.itemId, uid)

      return { success: true, data: { updated: ok, message: ok ? '条目更新成功' : '条目不存在或无权限' } }
    } catch (error) {
      console.error('priceComparison updateEntry error:', error)
      return { success: false, error: '更新条目失败' }
    }
  }

  async deleteEntry(id, uid) {
    try {
      const entry = await this.entryModel.findOne(
        new QueryBuilder().where('id', '=', id).where('uid', '=', uid)
      )
      if (!entry) return { success: false, error: '条目不存在或无权限' }

      const ok = await this.entryModel.deleteWithQuery(
        new QueryBuilder().where('id', '=', id).where('uid', '=', uid)
      )

      // 若删除的是当前选定的，清空物品的 chosenEntryId
      const item = await this.itemModel.findOne(
        new QueryBuilder().where('id', '=', entry.itemId).where('uid', '=', uid)
      )
      if (item && item.chosenEntryId === id) {
        await this.itemModel.updateWithQuery(
          { chosenEntryId: null },
          new QueryBuilder().where('id', '=', entry.itemId).where('uid', '=', uid)
        )
      }
      if (item) await this.touchItem(entry.itemId, uid)

      return { success: true, data: { deleted: ok, message: ok ? '条目已删除' : '条目不存在或无权限' } }
    } catch (error) {
      console.error('priceComparison deleteEntry error:', error)
      return { success: false, error: '删除条目失败' }
    }
  }

  // ===== 统计 =====

  async getStatistics(uid) {
    try {
      const items = await this.itemModel.findAll(
        new QueryBuilder().where('uid', '=', uid)
      )
      const allEntries = await this.entryModel.findAll(
        new QueryBuilder().where('uid', '=', uid)
      )

      if (items.length === 0 && allEntries.length === 0) {
        return { success: true, data: { ...DEFAULT_STATISTICS } }
      }

      let comparingCount = 0
      let purchasedCount = 0
      let cancelledCount = 0
      const purchasedEntries = []
      const cheapestItems = []      // 比价中且有多个平台价的物品（最低价 + 最高价 + 价差）
      const recentItems = []        // 最近更新 5 条
      const categoryMap = new Map() // category -> { count, totalSpent }

      for (const item of items) {
        if (item.status === ITEM_STATUS.COMPARING) comparingCount++
        else if (item.status === ITEM_STATUS.PURCHASED) purchasedCount++
        else if (item.status === ITEM_STATUS.CANCELLED) cancelledCount++

        const itemEntries = allEntries.filter(e => e.itemId === item.id)
        if (itemEntries.length >= 2 && item.status === ITEM_STATUS.COMPARING) {
          const sorted = [...itemEntries].sort((a, b) => a.finalPrice - b.finalPrice)
          cheapestItems.push({
            id: item.id,
            name: item.name,
            category: item.category,
            minPrice: sorted[0].finalPrice,
            maxPrice: sorted[sorted.length - 1].finalPrice,
            diff: sorted[sorted.length - 1].finalPrice - sorted[0].finalPrice,
            platformCount: itemEntries.length
          })
        }

        recentItems.push({
          id: item.id,
          name: item.name,
          category: item.category,
          status: item.status,
          updateTime: item.updateTime
        })

        if (item.status === ITEM_STATUS.PURCHASED) {
          const chosenId = item.chosenEntryId
          const chosenEntry = itemEntries.find(e => e.id === chosenId)
          if (chosenEntry) {
            purchasedEntries.push(chosenEntry)
            const cat = item.category || '其他'
            const cur = categoryMap.get(cat) || { category: cat, count: 0, totalSpent: 0 }
            cur.count += 1
            cur.totalSpent += Number(chosenEntry.finalPrice || 0)
            categoryMap.set(cat, cur)
          }
        }
      }

      const totalSpent = purchasedEntries.reduce((s, e) => s + Number(e.finalPrice || 0), 0)

      // 理论节省：每个已购买物品相对其同物品其他未选条目的差额之和（视为"假如选最高价会多花多少"）
      let totalPotentialSaved = 0
      for (const item of items) {
        if (item.status !== ITEM_STATUS.PURCHASED) continue
        const itemEntries = allEntries.filter(e => e.itemId === item.id)
        if (itemEntries.length < 2) continue
        const chosen = itemEntries.find(e => e.id === item.chosenEntryId)
        if (!chosen) continue
        const others = itemEntries.filter(e => e.id !== chosen.id)
        const maxOther = Math.max(...others.map(o => Number(o.finalPrice || 0)))
        if (maxOther > Number(chosen.finalPrice)) {
          totalPotentialSaved += (maxOther - Number(chosen.finalPrice))
        }
      }

      // top5 最低价（按价差降序）
      cheapestItems.sort((a, b) => b.diff - a.diff)
      const topCheapest = cheapestItems.slice(0, 5)

      recentItems.sort((a, b) => String(b.updateTime).localeCompare(String(a.updateTime)))
      const recent = recentItems.slice(0, 5).map(i => ({
        id: i.id,
        name: i.name,
        category: i.category,
        status: i.status,
        statusLabel: ITEM_STATUS_LABEL[i.status] || '未知',
        updateTime: i.updateTime
      }))

      const byCategory = Array.from(categoryMap.values())
        .map(c => ({ ...c, totalSpent: Number(c.totalSpent.toFixed(2)) }))
        .sort((a, b) => b.totalSpent - a.totalSpent)

      return {
        success: true,
        data: {
          totalItems: items.length,
          comparingCount,
          purchasedCount,
          cancelledCount,
          totalEntries: allEntries.length,
          purchasedEntries: purchasedEntries.length,
          totalSpent: Number(totalSpent.toFixed(2)),
          totalPotentialSaved: Number(totalPotentialSaved.toFixed(2)),
          byCategory,
          cheapestItems: topCheapest,
          recentItems: recent
        }
      }
    } catch (error) {
      console.error('priceComparison getStatistics error:', error)
      return { success: false, error: '获取统计数据失败' }
    }
  }

  // ===== 内部辅助 =====

  async getEntriesByItemId(itemId, uid) {
    const list = await this.entryModel.findAll(
      new QueryBuilder().where('itemId', '=', itemId).where('uid', '=', uid).orderBy('finalPrice', 'ASC')
    )
    return list || []
  }

  // 装饰物品：附加 entries、minPrice、maxPrice、priceDiff、priceSpread
  decorateItem(item, entries) {
    const list = entries || []
    const chosen = list.find(e => e.isChosen === 1) || null
    let minPrice = null, maxPrice = null, priceDiff = null
    if (list.length > 0) {
      const prices = list.map(e => Number(e.finalPrice || 0))
      minPrice = Math.min(...prices)
      maxPrice = Math.max(...prices)
      priceDiff = list.length > 1 ? Number((maxPrice - minPrice).toFixed(2)) : 0
    }
    return {
      ...item,
      entries: list,
      chosenEntry: chosen,
      entryCount: list.length,
      minPrice,
      maxPrice,
      priceDiff
    }
  }

  // 标记物品为已选某条目：更新 chosenEntryId，且若条目状态为已下单/已到货则把物品设为已购买
  async markItemChosen(itemId, entryId, uid, item) {
    try {
      const newItemStatus = item.status === ITEM_STATUS.CANCELLED || item.status === ITEM_STATUS.ARCHIVED
        ? item.status
        : ITEM_STATUS.PURCHASED
      await this.itemModel.updateWithQuery(
        { chosenEntryId: entryId, status: newItemStatus },
        new QueryBuilder().where('id', '=', itemId).where('uid', '=', uid)
      )
    } catch (error) {
      console.error('markItemChosen error:', error)
    }
  }

  // 触发 updateTime（强制 sort 时新条目排到前面）
  async touchItem(itemId, uid) {
    try {
      await this.db.prepare('UPDATE price_comparison_items SET update_time = CURRENT_TIMESTAMP WHERE id = ? AND uid = ?')
        .bind(itemId, uid).run()
    } catch (error) {
      // 静默失败，不影响主体流程
    }
  }
}

export const CATEGORY_LIST = [
  { value: 'electronics', label: '数码电器', color: CATEGORY_COLORS.electronics },
  { value: 'digital', label: '3C 数码', color: CATEGORY_COLORS.digital },
  { value: 'clothing', label: '服饰鞋帽', color: CATEGORY_COLORS.clothing },
  { value: 'food', label: '食品生鲜', color: CATEGORY_COLORS.food },
  { value: 'book', label: '图书音像', color: CATEGORY_COLORS.book },
  { value: 'cosmetic', label: '美妆护肤', color: CATEGORY_COLORS.cosmetic },
  { value: 'home', label: '家居日用', color: CATEGORY_COLORS.home },
  { value: 'toy', label: '玩具模型', color: CATEGORY_COLORS.toy },
  { value: 'sports', label: '运动户外', color: CATEGORY_COLORS.sports },
  { value: 'other', label: '其他', color: CATEGORY_COLORS.other }
]

export const CATEGORY_COLOR_MAP = CATEGORY_COLORS