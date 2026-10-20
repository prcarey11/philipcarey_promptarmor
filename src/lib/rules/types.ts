export interface FlagInput {
  source: "rule" | "llm" | "human";
  location: string;
  problem: string;
  rule: string;
  fix: string;
}
