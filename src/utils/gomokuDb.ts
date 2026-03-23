/**
 * 五子棋双人对战数据库操作
 * 基于 Supabase Realtime 实现实时通信
 */
import { supabase } from './supabase';

// 游戏状态类型
export type GameStatus = 'waiting' | 'playing' | 'finished';
export type PlayerColor = 'black' | 'white';

// 游戏数据接口
export interface GomokuGame {
  id: string;
  room_id: string;
  board: number[][];
  current_player: PlayerColor;
  black_player: string | null;
  white_player: string | null;
  player_count: number;
  spectator_count: number;
  game_status: GameStatus;
  winner: string | null;
  win_type: string | null;
  last_move_at: string;
  move_history?: string; // 存储落子历史记录的 JSON 字符串
  created_at: string;
  updated_at: string;
}

// 悔棋请求接口
export interface UndoRequest {
  id: string;
  room_id: string;
  requestor: string;
  target: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

// 玩家信息
export interface Player {
  userId: string;
  nickname: string;
  color: PlayerColor | null;
  isOnline: boolean;
}

// 落子记录
export interface Move {
  row: number;
  col: number;
  player: PlayerColor;
  timestamp: number;
}

/**
 * 五子棋数据库操作
 */
export const gomokuDb = {
  /**
   * 创建或获取游戏房间
   */
  async getOrCreateGame(roomId: string): Promise<GomokuGame | null> {
    try {
      // 先尝试获取现有游戏
      const { data: existingGame } = await supabase
        .from('gomoku_games')
        .select('*')
        .eq('room_id', roomId.toUpperCase())
        .single();

      if (existingGame) {
        return existingGame;
      }

      // 创建新游戏
      const { data: newGame, error: createError } = await supabase
        .from('gomoku_games')
        .insert({
          room_id: roomId.toUpperCase(),
          board: JSON.stringify(Array(15).fill(null).map(() => Array(15).fill(0))),
          current_player: 'black',
          black_player: null,
          white_player: null,
          player_count: 0,
          spectator_count: 0,
          game_status: 'waiting',
          winner: null,
          win_type: null,
        })
        .select()
        .single();

      if (createError) throw createError;
      return newGame;
    } catch (error) {
      console.error('获取或创建游戏失败:', error);
      throw error;
    }
  },

  /**
   * 更新游戏状态
   */
  async updateGame(roomId: string, updates: Omit<Partial<GomokuGame>, 'move_history'> & { move_history?: string | null }): Promise<void> {
    try {
      const updateData: any = {
        ...updates,
        updated_at: new Date().toISOString(),
        last_move_at: new Date().toISOString(),
      };

      // 如果 board 存在，转换为 JSON 字符串
      // 创建纯净的数组副本，避免 Vue 响应式属性干扰
      if (updates.board) {
        const cleanBoard = JSON.parse(JSON.stringify(updates.board));
        updateData.board = JSON.stringify(cleanBoard);
      }

      const { error } = await supabase
        .from('gomoku_games')
        .update(updateData)
        .eq('room_id', roomId.toUpperCase());

      if (error) throw error;
    } catch (error) {
      console.error('更新游戏状态失败:', error);
      throw error;
    }
  },

  /**
   * 加入游戏房间（更新玩家数量）
   */
  async joinGame(roomId: string, nickname: string): Promise<GomokuGame | null> {
    try {
      const game = await this.getOrCreateGame(roomId);
      if (!game) return null;

      const updates: Partial<GomokuGame> = {};

      // 判断是否可以作为玩家加入（有空位且游戏未结束）
      const canJoinAsPlayer = game.player_count < 2 &&
        (!game.black_player || !game.white_player) &&
        game.game_status !== 'finished';

      if (canJoinAsPlayer) {
        // 作为玩家加入
        if (!game.black_player) {
          updates.black_player = nickname;
        } else if (!game.white_player) {
          updates.white_player = nickname;
        }
        updates.player_count = (game.player_count || 0) + 1;

        // 如果两个玩家都到齐了，开始游戏
        if (updates.player_count === 2) {
          updates.game_status = 'playing';
        }
      } else {
        // 作为观众加入
        updates.spectator_count = (game.spectator_count || 0) + 1;
      }

      await this.updateGame(roomId, updates);

      // 返回更新后的游戏
      return await this.getOrCreateGame(roomId);
    } catch (error) {
      console.error('加入游戏失败:', error);
      throw error;
    }
  },

  /**
   * 离开游戏房间
   */
  async leaveGame(roomId: string, nickname: string): Promise<void> {
    try {
      const game = await this.getOrCreateGame(roomId);
      if (!game) return;

      const updates: Partial<GomokuGame> = {};

      // 检查是否是玩家
      if (game.black_player === nickname || game.white_player === nickname) {
        if (game.black_player === nickname) {
          updates.black_player = null;
        } else if (game.white_player === nickname) {
          updates.white_player = null;
        }
        updates.player_count = Math.max(0, (game.player_count || 0) - 1);

        // 如果玩家离开，游戏状态变为等待
        if (updates.player_count < 2 && game.game_status === 'playing') {
          updates.game_status = 'waiting';
        }
      } else {
        // 观众离开
        updates.spectator_count = Math.max(0, (game.spectator_count || 0) - 1);
      }

      await this.updateGame(roomId, updates);
    } catch (error) {
      console.error('离开游戏失败:', error);
      throw error;
    }
  },

  /**
   * 落子
   */
  async makeMove(roomId: string, board: number[][], nextPlayer: PlayerColor, moveHistory: Array<{row: number; col: number; player: PlayerColor; number: number}>): Promise<void> {
    try {
      const updateData: any = {
        board,
        current_player: nextPlayer,
        move_history: JSON.stringify(moveHistory),
      };
      await this.updateGame(roomId, updateData);
    } catch (error) {
      console.error('落子失败:', error);
      throw error;
    }
  },

  /**
   * 悔棋
   */
  async undoMove(roomId: string, board: number[][], currentPlayer: PlayerColor): Promise<void> {
    try {
      await this.updateGame(roomId, {
        board,
        current_player: currentPlayer,
      });
    } catch (error) {
      console.error('悔棋失败:', error);
      throw error;
    }
  },

  /**
   * 结束游戏
   */
  async endGame(roomId: string, winner: string, winType: string, finalBoard: number[][]): Promise<void> {
    try {
      await this.updateGame(roomId, {
        game_status: 'finished',
        winner,
        win_type: winType,
        board: finalBoard,
      });
    } catch (error) {
      console.error('结束游戏失败:', error);
      throw error;
    }
  },

  /**
   * 重新开始游戏
   */
  async restartGame(roomId: string): Promise<void> {
    try {
      await this.updateGame(roomId, {
        board: Array(15).fill(null).map(() => Array(15).fill(0)),
        current_player: 'black',
        game_status: 'playing',
        winner: null,
        win_type: null,
        move_history: null, // 清空落子历史记录
      });
    } catch (error) {
      console.error('重新开始游戏失败:', error);
      throw error;
    }
  },

  /**
   * 订阅游戏状态变化
   */
  subscribeToGame(roomId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`gomoku-game-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'gomoku_games',
          filter: `room_id=eq.${roomId.toUpperCase()}`,
        },
        callback
      )
      .subscribe();
  },

  /**
   * 创建悔棋请求
   */
  async createUndoRequest(roomId: string, requestor: string, target: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('gomoku_undo_requests')
        .insert({
          room_id: roomId.toUpperCase(),
          requestor,
          target,
          status: 'pending',
        });

      if (error) throw error;
    } catch (error) {
      console.error('创建悔棋请求失败:', error);
      throw error;
    }
  },

  /**
   * 处理悔棋请求
   */
  async handleUndoRequest(requestId: string, status: 'accepted' | 'rejected'): Promise<void> {
    try {
      const { error } = await supabase
        .from('gomoku_undo_requests')
        .update({ status })
        .eq('id', requestId);

      if (error) throw error;
    } catch (error) {
      console.error('处理悔棋请求失败:', error);
      throw error;
    }
  },

  /**
   * 获取待处理的悔棋请求
   */
  async getPendingUndoRequest(roomId: string, target: string): Promise<UndoRequest | null> {
    try {
      const { data, error } = await supabase
        .from('gomoku_undo_requests')
        .select('*')
        .eq('room_id', roomId.toUpperCase())
        .eq('target', target)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // 没有找到记录
        throw error;
      }
      return data;
    } catch (error) {
      console.error('获取悔棋请求失败:', error);
      return null;
    }
  },

  /**
   * 删除悔棋请求
   */
  async deleteUndoRequest(requestId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('gomoku_undo_requests')
        .delete()
        .eq('id', requestId);

      if (error) throw error;
    } catch (error) {
      console.error('删除悔棋请求失败:', error);
      throw error;
    }
  },

  /**
   * 订阅悔棋请求
   */
  subscribeToUndoRequests(roomId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`gomoku-undo-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'gomoku_undo_requests',
          filter: `room_id=eq.${roomId.toUpperCase()}`,
        },
        callback
      )
      .subscribe();
  },

  /**
   * 广播落子事件（用于实时通知，不存数据库）
   */
  broadcastMove(roomId: string, move: Move, channel: any) {
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'move',
        payload: { room_id: roomId, ...move },
      });
    }
  },

  /**
   * 订阅落子事件（广播）
   */
  subscribeToMoves(roomId: string, callback: (move: Move) => void) {
    const channel = supabase.channel(`gomoku-moves-${roomId}`);

    channel.on('broadcast', { event: 'move' }, (payload: any) => {
      if (payload.payload.room_id === roomId.toUpperCase()) {
        callback(payload.payload);
      }
    });

    return channel.subscribe();
  },

  /**
   * 订阅玩家在线状态（使用 Presence）
   */
  subscribePresence(roomId: string, callbacks: {
    onSync?: (state: any) => void;
    onJoin?: (state: any) => void;
    onLeave?: (state: any) => void;
  }) {
    const channel = supabase.channel(`gomoku-presence-${roomId}`);

    // 订阅 presence 状态变化
    channel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED' && callbacks.onSync) {
        callbacks.onSync(channel.presenceState());
      }
    });

    return channel;
  },

  /**
   * 追踪用户在线状态
   */
  trackUser(channel: any, userId: string, nickname: string, role: 'player' | 'spectator', color: PlayerColor | null) {
    if (channel) {
      channel.track({
        user_id: userId,
        nickname,
        role,
        color,
        online_at: new Date().toISOString(),
      });
    }
  },

  /**
   * 获取当前在线用户
   */
  getPresenceState(channel: any) {
    return channel?.presenceState() || {};
  },

  /**
   * 解析棋盘数据
   */
  parseBoard(boardData: string | number[][]): number[][] {
    const createEmptyBoard = () => Array(15).fill(null).map(() => Array(15).fill(0));

    if (typeof boardData === 'string') {
      try {
        const parsed = JSON.parse(boardData);
        if (!Array.isArray(parsed) || parsed.length === 0) {
          return createEmptyBoard();
        }
        // 确保返回完整的 15x15 数组
        const result: number[][] = [];
        for (let i = 0; i < 15; i++) {
          if (parsed[i] && Array.isArray(parsed[i])) {
            result[i] = [];
            for (let j = 0; j < 15; j++) {
              result[i][j] = (parsed[i][j] === 1 || parsed[i][j] === 2) ? parsed[i][j] : 0;
            }
          } else {
            result[i] = Array(15).fill(0);
          }
        }
        return result;
      } catch {
        return createEmptyBoard();
      }
    }

    if (!Array.isArray(boardData) || boardData.length === 0) {
      return createEmptyBoard();
    }

    // 确保返回完整的 15x15 数组
    const result: number[][] = [];
    for (let i = 0; i < 15; i++) {
      if (boardData[i] && Array.isArray(boardData[i])) {
        result[i] = [];
        for (let j = 0; j < 15; j++) {
          result[i][j] = (boardData[i][j] === 1 || boardData[i][j] === 2) ? boardData[i][j] : 0;
        }
      } else {
        result[i] = Array(15).fill(0);
      }
    }
    return result;
  },
};

export default gomokuDb;
