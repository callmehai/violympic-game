import { ScoringService, QuestionRow } from '../types';
import { config } from '../config';

// Service tính điểm thuần (pure), không phụ thuộc db.
export const scoringService: ScoringService = {
  // Điểm cơ bản của 1 câu: ưu tiên points cấu hình sẵn trên câu hỏi (>0),
  // nếu không thì lấy theo độ khó, fallback cuối cùng là 10.
  questionPoints(q: QuestionRow): number {
    if (q.points > 0) return q.points;
    return config.difficultyPoints[q.difficulty] ?? 10;
  },

  // Thưởng tốc độ: chỉ áp dụng khi tính năng bật (bonus > 0) và thời gian
  // trả lời hợp lệ (>=0) nằm trong ngưỡng nhanh; ngược lại không thưởng.
  fastAnswerBonus(timeTakenMs: number): number {
    if (
      config.fastAnswerBonus > 0 &&
      timeTakenMs >= 0 &&
      timeTakenMs <= config.fastAnswerMs
    ) {
      return config.fastAnswerBonus;
    }
    return 0;
  },

  // Điểm bonus theo hạng chung cuộc: duyệt các tier, trả points của tier
  // đầu tiên mà rank rơi vào khoảng [rankFrom, rankTo]; ngoài tier trả 0.
  bonusForRank(rank: number): number {
    for (const tier of config.bonusTiers) {
      if (rank >= tier.rankFrom && rank <= tier.rankTo) {
        return tier.points;
      }
    }
    return 0;
  },
};
