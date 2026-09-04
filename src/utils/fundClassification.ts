import type { FundClassification } from "../db/db";

const classificationRules: { classification: FundClassification; pattern: RegExp }[] = [
  { classification: "multi-cap", pattern: /multi[\s-]*cap|multicap/i },
  { classification: "flexi-cap", pattern: /flexi[\s-]*cap|flexicap/i },
  { classification: "large-cap", pattern: /large[\s-]*cap|largecap|blue[\s-]*chip|bluechip/i },
  { classification: "mid-cap", pattern: /mid[\s-]*cap|midcap/i },
  { classification: "small-cap", pattern: /small[\s-]*cap|smallcap/i },
];

export function inferFundClassification(name: string): FundClassification | undefined {
  const matches = classificationRules.filter(({ pattern }) => pattern.test(name));
  return matches.length === 1 ? matches[0].classification : undefined;
}