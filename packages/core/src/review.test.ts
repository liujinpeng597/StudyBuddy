import { describe, expect, test } from "vitest";
import { normalizeAnswer } from "./contracts";
import {
  normalizeGeneratedQuestionCandidates,
  normalizeQuestionType,
  scoreObjectiveQuestion
} from "./review";

describe("objective scoring", () => {
  test("scores single choice by index", () => {
    expect(
      scoreObjectiveQuestion(
        { type: "single_choice", options: ["A", "B"], correctIndexes: [1], answerKey: "B" },
        "1"
      ).correct
    ).toBe(true);
  });

  test("scores multiple choice as an exact set in any order", () => {
    expect(
      scoreObjectiveQuestion(
        { type: "multiple_choice", options: ["A", "B", "C"], correctIndexes: [0, 2] },
        ["2", "0"]
      ).correct
    ).toBe(true);
    expect(
      scoreObjectiveQuestion(
        { type: "multiple_choice", options: ["A", "B", "C"], correctIndexes: [0, 2] },
        ["0"]
      ).correct
    ).toBe(false);
  });

  test("accepts normalized fill answers", () => {
    expect(normalizeAnswer("  C++   类 ")).toBe("c++ 类");
    expect(
      scoreObjectiveQuestion(
        { type: "fill_blank", options: [], correctIndexes: [], answerKey: ["C++ 类"] },
        " c++   类 "
      ).correct
    ).toBe(true);
  });

  test("normalizes Chinese and snake_case generated question fields", () => {
    expect(normalizeQuestionType("单选题")).toBe("single_choice");
    expect(normalizeQuestionType("multiple-choice")).toBe("multiple_choice");
    const questions = normalizeGeneratedQuestionCandidates({
      questions: [
        {
          type: "单选题",
          question: "虚函数的主要作用是什么？",
          options: ["运行时多态", "常量折叠", "内存回收", "文件读写"],
          answer_key: "A",
          explanation: "虚函数通过动态分派支持运行时多态。",
          source_node_ids: ["11111111-1111-4111-8111-111111111111"]
        }
      ]
    });
    expect(questions).toHaveLength(1);
    expect(questions[0]?.type).toBe("single_choice");
    expect(questions[0]?.correctIndexes).toEqual([0]);
  });
});
