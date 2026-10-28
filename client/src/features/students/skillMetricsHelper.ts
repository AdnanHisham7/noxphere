import { AcademySessionType } from "../academies/types";

export const DEFAULT_SESSION_TYPES: AcademySessionType[] = [
  {
    id: "technical",
    name: "Technical",
    description: "Ball mastery, passing accuracy, receiving, and finishing drills",
    submetrics: ["Dribbling", "Passing", "Receiving", "Finishing"],
  },
  {
    id: "physical",
    name: "Physical",
    description: "Athleticism, stamina, speed, agility, strength, balance, and endurance",
    submetrics: ["Speed", "Agility", "Strength", "Balance", "Endurance"],
  },
  {
    id: "tactical",
    name: "Tactical",
    description: "Game awareness, decision making, off-ball movement, and positioning",
    submetrics: ["Game Awareness", "Decision Making", "Off Ball Movement", "Positioning"],
  },
  {
    id: "psychological",
    name: "Psychological",
    description: "Discipline, confidence, concentration, and coachability",
    submetrics: ["Discipline", "Confidence", "Concentration", "Coachability"],
  },
  {
    id: "social",
    name: "Social",
    description: "Communication, team work, leadership, and mutual respect",
    submetrics: ["Communication", "Team Work", "Leadership", "Respect"],
  },
  {
    id: "match",
    name: "Match",
    description: "Competitive matchday execution, tactical impact, effort, and fair play",
    submetrics: ["Impact", "Tactical Execution", "Effort", "Fair Play"],
  },
];

export interface SubmetricScore {
  parameter: string;
  score: number;
  count: number;
}

export interface MajorSkillCategory {
  category: string;
  parameter: string; // for charts using dataKey="parameter"
  score: number;
  count: number;
  submetrics: SubmetricScore[];
}

export function computeMajorAndSubmetricSkills(
  performances: Array<{
    overallScore?: number;
    overallRating?: number;
    sessionType?: string;
    skillScores?: Array<{ parameter: string; score: number }>;
  }>,
  configuredSessionTypes?: AcademySessionType[],
): {
  majorSkills: MajorSkillCategory[];
  allSubmetrics: SubmetricScore[];
} {
  const sessionTypes =
    configuredSessionTypes && configuredSessionTypes.length > 0
      ? configuredSessionTypes
      : DEFAULT_SESSION_TYPES;

  // Build a lookup: lower-cased submetric name -> session type name
  const submetricToCategory = new Map<string, string>();
  for (const st of sessionTypes) {
    for (const sub of st.submetrics || []) {
      submetricToCategory.set(sub.toLowerCase().trim(), st.name);
    }
  }

  // categoryName -> { submetricName -> { sum, count } }
  const categoryMap = new Map<string, Map<string, { sum: number; count: number }>>();

  // Also global submetrics map
  const globalSubmetrics = new Map<string, { sum: number; count: number }>();

  for (const p of performances) {
    const perfSessionType = p.sessionType?.trim();
    for (const s of p.skillScores || []) {
      if (!s || typeof s.score !== "number" || isNaN(s.score)) continue;
      const param = s.parameter.trim();
      const paramLower = param.toLowerCase();

      // Determine category
      let category = perfSessionType;
      if (!category) {
        category = submetricToCategory.get(paramLower);
      }
      if (!category) {
        // Fallback keyword detection
        if (
          paramLower.includes("speed") ||
          paramLower.includes("agility") ||
          paramLower.includes("strength") ||
          paramLower.includes("balance") ||
          paramLower.includes("endurance") ||
          paramLower.includes("stamina") ||
          paramLower.includes("physical")
        ) {
          category = "Physical";
        } else if (
          paramLower.includes("dribbl") ||
          paramLower.includes("pass") ||
          paramLower.includes("receiv") ||
          paramLower.includes("finish") ||
          paramLower.includes("shoot") ||
          paramLower.includes("touch") ||
          paramLower.includes("technic")
        ) {
          category = "Technical";
        } else if (
          paramLower.includes("position") ||
          paramLower.includes("decision") ||
          paramLower.includes("vision") ||
          paramLower.includes("aware") ||
          paramLower.includes("tactic")
        ) {
          category = "Tactical";
        } else if (
          paramLower.includes("focus") ||
          paramLower.includes("discipl") ||
          paramLower.includes("work ethic") ||
          paramLower.includes("communicat") ||
          paramLower.includes("mental") ||
          paramLower.includes("attitude")
        ) {
          category = "Mental";
        } else if (
          paramLower.includes("match") ||
          paramLower.includes("game") ||
          paramLower.includes("team play") ||
          paramLower.includes("composure")
        ) {
          category = "Match";
        } else {
          category = "Technical";
        }
      }

      // Record in global submetrics
      const gBucket = globalSubmetrics.get(param) ?? { sum: 0, count: 0 };
      gBucket.sum += s.score;
      gBucket.count += 1;
      globalSubmetrics.set(param, gBucket);

      // Record in category
      if (!categoryMap.has(category)) {
        categoryMap.set(category, new Map());
      }
      const subMap = categoryMap.get(category)!;
      const subBucket = subMap.get(param) ?? { sum: 0, count: 0 };
      subBucket.sum += s.score;
      subBucket.count += 1;
      subMap.set(param, subBucket);
    }
  }

  // Construct majorSkills
  const majorSkills: MajorSkillCategory[] = [];

  // First add configured sessionTypes so order matches the academy's preference
  const seenCategories = new Set<string>();
  for (const st of sessionTypes) {
    seenCategories.add(st.name);
    const subMap = categoryMap.get(st.name);
    if (!subMap || subMap.size === 0) continue;

    const submetricsList: SubmetricScore[] = [];
    let totalScoreSum = 0;
    let totalScoreCount = 0;

    for (const [param, val] of subMap.entries()) {
      const avg = Math.round((val.sum / val.count) * 10) / 10;
      submetricsList.push({
        parameter: param,
        score: avg,
        count: val.count,
      });
      totalScoreSum += val.sum;
      totalScoreCount += val.count;
    }

    const categoryAvg =
      totalScoreCount > 0
        ? Math.round((totalScoreSum / totalScoreCount) * 10) / 10
        : 0;

    majorSkills.push({
      category: st.name,
      parameter: st.name,
      score: categoryAvg,
      count: totalScoreCount,
      submetrics: submetricsList.sort((a, b) => b.score - a.score),
    });
  }

  // Check any extra categories from performance records not in configured list
  for (const [catName, subMap] of categoryMap.entries()) {
    if (seenCategories.has(catName)) continue;
    const submetricsList: SubmetricScore[] = [];
    let totalScoreSum = 0;
    let totalScoreCount = 0;

    for (const [param, val] of subMap.entries()) {
      const avg = Math.round((val.sum / val.count) * 10) / 10;
      submetricsList.push({
        parameter: param,
        score: avg,
        count: val.count,
      });
      totalScoreSum += val.sum;
      totalScoreCount += val.count;
    }

    const categoryAvg =
      totalScoreCount > 0
        ? Math.round((totalScoreSum / totalScoreCount) * 10) / 10
        : 0;

    majorSkills.push({
      category: catName,
      parameter: catName,
      score: categoryAvg,
      count: totalScoreCount,
      submetrics: submetricsList.sort((a, b) => b.score - a.score),
    });
  }

  const allSubmetrics: SubmetricScore[] = Array.from(
    globalSubmetrics.entries(),
  ).map(([param, val]) => ({
    parameter: param,
    score: Math.round((val.sum / val.count) * 10) / 10,
    count: val.count,
  }));

  return { majorSkills, allSubmetrics };
}
