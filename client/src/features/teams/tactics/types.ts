// src/features/teams/tactics/types.ts

export type Position =
  | "GK" | "CB" | "LB" | "RB" | "LWB" | "RWB"
  | "DMF" | "CMF" | "AMF" | "LMF" | "RMF"
  | "LWF" | "RWF" | "CF" | "SS";

export interface Player {
  id: string;
  name: string;
  rating: number;
  position: Position;
  squadNumber: number;
  photo?: string;
  branchName?: string;
}

export type TeamFormat = "5s" | "6s" | "7s" | "8s" | "9s" | "10s" | "11s";

export type Formation5s = "1-2-1" | "2-2" | "1-1-2" | "2-1-1" | "3-1";
export type Formation6s = "2-2-1" | "2-1-2" | "3-1-1" | "1-3-1";
export type Formation7s = "2-3-1" | "3-2-1" | "2-1-2-1" | "3-1-2" | "1-4-1";
export type Formation8s = "3-3-1" | "2-4-1" | "3-2-2" | "2-3-2";
export type Formation9s = "3-3-2" | "3-4-1" | "4-3-1" | "3-2-3" | "2-4-2";
export type Formation10s = "4-4-1" | "4-3-2" | "3-4-2" | "3-3-3" | "4-2-3";
export type Formation11s =
  | "4-2-3-1" | "4-4-2" | "4-3-3" | "4-3-2-1" | "4-3-1-2"
  | "4-2-1-3" | "4-1-4-1" | "4-1-2-3" | "3-4-3" | "3-2-4-1"
  | "3-2-3-2" | "3-1-4-2" | "5-3-2" | "5-2-2-1" | "5-2-1-2";

export type FormationType =
  | Formation5s
  | Formation6s
  | Formation7s
  | Formation8s
  | Formation9s
  | Formation10s
  | Formation11s;

export interface TacticalSlot {
  id: string;
  role: Position;
  top: number; // % from top of pitch (0 = attacking goal, 100 = own goal)
  left: number; // % from left
}

export interface SavedFormation {
  id: string;
  label: string;
  formationType: FormationType;
  teamFormat?: TeamFormat;
  squad: Record<string, string>;
}

export interface FormatMeta {
  format: TeamFormat;
  label: string;
  pitchName: string;
  playerCount: number;
  formations: FormationType[];
  defaultFormation: FormationType;
}

export const FORMATIONS_BY_FORMAT: Record<TeamFormat, FormatMeta> = {
  "5s": {
    format: "5s",
    label: "5s Futsal / Turf",
    pitchName: "5-a-Side Pitch",
    playerCount: 5,
    formations: ["1-2-1", "2-2", "1-1-2", "2-1-1", "3-1"],
    defaultFormation: "1-2-1",
  },
  "6s": {
    format: "6s",
    label: "6s Turf",
    pitchName: "6-a-Side Pitch",
    playerCount: 6,
    formations: ["2-2-1", "2-1-2", "3-1-1", "1-3-1"],
    defaultFormation: "2-2-1",
  },
  "7s": {
    format: "7s",
    label: "7s Mini Football",
    pitchName: "7-a-Side Arena",
    playerCount: 7,
    formations: ["2-3-1", "3-2-1", "2-1-2-1", "3-1-2", "1-4-1"],
    defaultFormation: "2-3-1",
  },
  "8s": {
    format: "8s",
    label: "8s Intermediate",
    pitchName: "8-a-Side Pitch",
    playerCount: 8,
    formations: ["3-3-1", "2-4-1", "3-2-2", "2-3-2"],
    defaultFormation: "3-3-1",
  },
  "9s": {
    format: "9s",
    label: "9s Youth Academy",
    pitchName: "9-a-Side Ground",
    playerCount: 9,
    formations: ["3-3-2", "3-4-1", "4-3-1", "3-2-3", "2-4-2"],
    defaultFormation: "3-3-2",
  },
  "10s": {
    format: "10s",
    label: "10s Pitch",
    pitchName: "10-a-Side Pitch",
    playerCount: 10,
    formations: ["4-4-1", "4-3-2", "3-4-2", "3-3-3", "4-2-3"],
    defaultFormation: "4-4-1",
  },
  "11s": {
    format: "11s",
    label: "11s Full Regulation",
    pitchName: "11-a-Side Stadium",
    playerCount: 11,
    formations: [
      "4-2-3-1", "4-4-2", "4-3-3", "4-3-2-1", "4-3-1-2",
      "4-2-1-3", "4-1-4-1", "4-1-2-3", "3-4-3", "3-2-4-1",
      "3-2-3-2", "3-1-4-2", "5-3-2", "5-2-2-1", "5-2-1-2",
    ],
    defaultFormation: "4-2-3-1",
  },
};

export const getFormatForFormation = (formation: FormationType): TeamFormat => {
  for (const [fmt, meta] of Object.entries(FORMATIONS_BY_FORMAT)) {
    if ((meta.formations as string[]).includes(formation)) {
      return fmt as TeamFormat;
    }
  }
  return "11s";
};

// Coordinates: own goal (GK) at the bottom, attacking third at the top.
export const FORMATION_PRESETS: Record<FormationType, TacticalSlot[]> = {
  // ─── 5-A-SIDE (5 players) ───────────────────────────────────────────────────
  "1-2-1": [
    { id: "gk", role: "GK", top: 88, left: 50 },
    { id: "cb", role: "CB", top: 68, left: 50 },
    { id: "lmf", role: "LMF", top: 44, left: 24 },
    { id: "rmf", role: "RMF", top: 44, left: 76 },
    { id: "cf", role: "CF", top: 18, left: 50 },
  ],
  "2-2": [
    { id: "gk", role: "GK", top: 88, left: 50 },
    { id: "lcb", role: "CB", top: 68, left: 34 },
    { id: "rcb", role: "CB", top: 68, left: 66 },
    { id: "lcf", role: "CF", top: 22, left: 34 },
    { id: "rcf", role: "CF", top: 22, left: 66 },
  ],
  "1-1-2": [
    { id: "gk", role: "GK", top: 88, left: 50 },
    { id: "cb", role: "CB", top: 70, left: 50 },
    { id: "cmf", role: "CMF", top: 46, left: 50 },
    { id: "lcf", role: "CF", top: 20, left: 34 },
    { id: "rcf", role: "CF", top: 20, left: 66 },
  ],
  "2-1-1": [
    { id: "gk", role: "GK", top: 88, left: 50 },
    { id: "lcb", role: "CB", top: 68, left: 34 },
    { id: "rcb", role: "CB", top: 68, left: 66 },
    { id: "cmf", role: "CMF", top: 44, left: 50 },
    { id: "cf", role: "CF", top: 18, left: 50 },
  ],
  "3-1": [
    { id: "gk", role: "GK", top: 88, left: 50 },
    { id: "lb", role: "LB", top: 66, left: 22 },
    { id: "cb", role: "CB", top: 70, left: 50 },
    { id: "rb", role: "RB", top: 66, left: 78 },
    { id: "cf", role: "CF", top: 20, left: 50 },
  ],

  // ─── 6-A-SIDE (6 players) ───────────────────────────────────────────────────
  "2-2-1": [
    { id: "gk", role: "GK", top: 88, left: 50 },
    { id: "lcb", role: "CB", top: 68, left: 34 },
    { id: "rcb", role: "CB", top: 68, left: 66 },
    { id: "lmf", role: "LMF", top: 44, left: 28 },
    { id: "rmf", role: "RMF", top: 44, left: 72 },
    { id: "cf", role: "CF", top: 18, left: 50 },
  ],
  "2-1-2": [
    { id: "gk", role: "GK", top: 88, left: 50 },
    { id: "lcb", role: "CB", top: 68, left: 34 },
    { id: "rcb", role: "CB", top: 68, left: 66 },
    { id: "cmf", role: "CMF", top: 46, left: 50 },
    { id: "lcf", role: "CF", top: 20, left: 34 },
    { id: "rcf", role: "CF", top: 20, left: 66 },
  ],
  "3-1-1": [
    { id: "gk", role: "GK", top: 88, left: 50 },
    { id: "lb", role: "LB", top: 66, left: 20 },
    { id: "cb", role: "CB", top: 70, left: 50 },
    { id: "rb", role: "RB", top: 66, left: 80 },
    { id: "cmf", role: "CMF", top: 44, left: 50 },
    { id: "cf", role: "CF", top: 18, left: 50 },
  ],
  "1-3-1": [
    { id: "gk", role: "GK", top: 88, left: 50 },
    { id: "cb", role: "CB", top: 70, left: 50 },
    { id: "lmf", role: "LMF", top: 44, left: 22 },
    { id: "cmf", role: "CMF", top: 46, left: 50 },
    { id: "rmf", role: "RMF", top: 44, left: 78 },
    { id: "cf", role: "CF", top: 18, left: 50 },
  ],

  // ─── 7-A-SIDE (7 players) ───────────────────────────────────────────────────
  "2-3-1": [
    { id: "gk", role: "GK", top: 88, left: 50 },
    { id: "lcb", role: "CB", top: 68, left: 34 },
    { id: "rcb", role: "CB", top: 68, left: 66 },
    { id: "lmf", role: "LMF", top: 44, left: 20 },
    { id: "cmf", role: "CMF", top: 46, left: 50 },
    { id: "rmf", role: "RMF", top: 44, left: 80 },
    { id: "cf", role: "CF", top: 18, left: 50 },
  ],
  "3-2-1": [
    { id: "gk", role: "GK", top: 88, left: 50 },
    { id: "lb", role: "LB", top: 66, left: 20 },
    { id: "cb", role: "CB", top: 70, left: 50 },
    { id: "rb", role: "RB", top: 66, left: 80 },
    { id: "cmf1", role: "CMF", top: 46, left: 35 },
    { id: "cmf2", role: "CMF", top: 46, left: 65 },
    { id: "cf", role: "CF", top: 18, left: 50 },
  ],
  "2-1-2-1": [
    { id: "gk", role: "GK", top: 88, left: 50 },
    { id: "lcb", role: "CB", top: 70, left: 34 },
    { id: "rcb", role: "CB", top: 70, left: 66 },
    { id: "dmf", role: "DMF", top: 54, left: 50 },
    { id: "amf1", role: "AMF", top: 34, left: 32 },
    { id: "amf2", role: "AMF", top: 34, left: 68 },
    { id: "cf", role: "CF", top: 16, left: 50 },
  ],
  "3-1-2": [
    { id: "gk", role: "GK", top: 88, left: 50 },
    { id: "lb", role: "LB", top: 66, left: 20 },
    { id: "cb", role: "CB", top: 70, left: 50 },
    { id: "rb", role: "RB", top: 66, left: 80 },
    { id: "cmf", role: "CMF", top: 46, left: 50 },
    { id: "lcf", role: "CF", top: 18, left: 35 },
    { id: "rcf", role: "CF", top: 18, left: 65 },
  ],
  "1-4-1": [
    { id: "gk", role: "GK", top: 88, left: 50 },
    { id: "cb", role: "CB", top: 70, left: 50 },
    { id: "lmf", role: "LMF", top: 44, left: 16 },
    { id: "cmf1", role: "CMF", top: 46, left: 38 },
    { id: "cmf2", role: "CMF", top: 46, left: 62 },
    { id: "rmf", role: "RMF", top: 44, left: 84 },
    { id: "cf", role: "CF", top: 18, left: 50 },
  ],

  // ─── 8-A-SIDE (8 players) ───────────────────────────────────────────────────
  "3-3-1": [
    { id: "gk", role: "GK", top: 88, left: 50 },
    { id: "lb", role: "LB", top: 68, left: 18 },
    { id: "cb", role: "CB", top: 70, left: 50 },
    { id: "rb", role: "RB", top: 68, left: 82 },
    { id: "lmf", role: "LMF", top: 44, left: 20 },
    { id: "cmf", role: "CMF", top: 46, left: 50 },
    { id: "rmf", role: "RMF", top: 44, left: 80 },
    { id: "cf", role: "CF", top: 18, left: 50 },
  ],
  "2-4-1": [
    { id: "gk", role: "GK", top: 88, left: 50 },
    { id: "lcb", role: "CB", top: 70, left: 34 },
    { id: "rcb", role: "CB", top: 70, left: 66 },
    { id: "lmf", role: "LMF", top: 44, left: 16 },
    { id: "cmf1", role: "CMF", top: 46, left: 38 },
    { id: "cmf2", role: "CMF", top: 46, left: 62 },
    { id: "rmf", role: "RMF", top: 44, left: 84 },
    { id: "cf", role: "CF", top: 18, left: 50 },
  ],
  "3-2-2": [
    { id: "gk", role: "GK", top: 88, left: 50 },
    { id: "lb", role: "LB", top: 68, left: 18 },
    { id: "cb", role: "CB", top: 70, left: 50 },
    { id: "rb", role: "RB", top: 68, left: 82 },
    { id: "cmf1", role: "CMF", top: 46, left: 34 },
    { id: "cmf2", role: "CMF", top: 46, left: 66 },
    { id: "lcf", role: "CF", top: 18, left: 34 },
    { id: "rcf", role: "CF", top: 18, left: 66 },
  ],
  "2-3-2": [
    { id: "gk", role: "GK", top: 88, left: 50 },
    { id: "lcb", role: "CB", top: 70, left: 34 },
    { id: "rcb", role: "CB", top: 70, left: 66 },
    { id: "lmf", role: "LMF", top: 44, left: 20 },
    { id: "cmf", role: "CMF", top: 46, left: 50 },
    { id: "rmf", role: "RMF", top: 44, left: 80 },
    { id: "lcf", role: "CF", top: 18, left: 34 },
    { id: "rcf", role: "CF", top: 18, left: 66 },
  ],

  // ─── 9-A-SIDE (9 players) ───────────────────────────────────────────────────
  "3-3-2": [
    { id: "gk", role: "GK", top: 88, left: 50 },
    { id: "lb", role: "LB", top: 68, left: 18 },
    { id: "cb", role: "CB", top: 70, left: 50 },
    { id: "rb", role: "RB", top: 68, left: 82 },
    { id: "lmf", role: "LMF", top: 44, left: 20 },
    { id: "cmf", role: "CMF", top: 46, left: 50 },
    { id: "rmf", role: "RMF", top: 44, left: 80 },
    { id: "lcf", role: "CF", top: 18, left: 34 },
    { id: "rcf", role: "CF", top: 18, left: 66 },
  ],
  "3-4-1": [
    { id: "gk", role: "GK", top: 88, left: 50 },
    { id: "lb", role: "LB", top: 68, left: 18 },
    { id: "cb", role: "CB", top: 70, left: 50 },
    { id: "rb", role: "RB", top: 68, left: 82 },
    { id: "lmf", role: "LMF", top: 44, left: 16 },
    { id: "cmf1", role: "CMF", top: 46, left: 38 },
    { id: "cmf2", role: "CMF", top: 46, left: 62 },
    { id: "rmf", role: "RMF", top: 44, left: 84 },
    { id: "cf", role: "CF", top: 18, left: 50 },
  ],
  "4-3-1": [
    { id: "gk", role: "GK", top: 88, left: 50 },
    { id: "lb", role: "LB", top: 68, left: 15 },
    { id: "cb1", role: "CB", top: 70, left: 38 },
    { id: "cb2", role: "CB", top: 70, left: 62 },
    { id: "rb", role: "RB", top: 68, left: 85 },
    { id: "lmf", role: "LMF", top: 44, left: 22 },
    { id: "cmf", role: "CMF", top: 46, left: 50 },
    { id: "rmf", role: "RMF", top: 44, left: 78 },
    { id: "cf", role: "CF", top: 18, left: 50 },
  ],
  "3-2-3": [
    { id: "gk", role: "GK", top: 88, left: 50 },
    { id: "lb", role: "LB", top: 68, left: 18 },
    { id: "cb", role: "CB", top: 70, left: 50 },
    { id: "rb", role: "RB", top: 68, left: 82 },
    { id: "cmf1", role: "CMF", top: 48, left: 35 },
    { id: "cmf2", role: "CMF", top: 48, left: 65 },
    { id: "lwf", role: "LWF", top: 18, left: 20 },
    { id: "cf", role: "CF", top: 16, left: 50 },
    { id: "rwf", role: "RWF", top: 18, left: 80 },
  ],
  "2-4-2": [
    { id: "gk", role: "GK", top: 88, left: 50 },
    { id: "lcb", role: "CB", top: 70, left: 34 },
    { id: "rcb", role: "CB", top: 70, left: 66 },
    { id: "lmf", role: "LMF", top: 44, left: 16 },
    { id: "cmf1", role: "CMF", top: 46, left: 38 },
    { id: "cmf2", role: "CMF", top: 46, left: 62 },
    { id: "rmf", role: "RMF", top: 44, left: 84 },
    { id: "lcf", role: "CF", top: 18, left: 34 },
    { id: "rcf", role: "CF", top: 18, left: 66 },
  ],

  // ─── 10-A-SIDE (10 players) ─────────────────────────────────────────────────
  "4-4-1": [
    { id: "gk", role: "GK", top: 88, left: 50 },
    { id: "lb", role: "LB", top: 68, left: 15 },
    { id: "cb1", role: "CB", top: 70, left: 38 },
    { id: "cb2", role: "CB", top: 70, left: 62 },
    { id: "rb", role: "RB", top: 68, left: 85 },
    { id: "lmf", role: "LMF", top: 44, left: 16 },
    { id: "cmf1", role: "CMF", top: 46, left: 38 },
    { id: "cmf2", role: "CMF", top: 46, left: 62 },
    { id: "rmf", role: "RMF", top: 44, left: 84 },
    { id: "cf", role: "CF", top: 18, left: 50 },
  ],
  "4-3-2": [
    { id: "gk", role: "GK", top: 88, left: 50 },
    { id: "lb", role: "LB", top: 68, left: 15 },
    { id: "cb1", role: "CB", top: 70, left: 38 },
    { id: "cb2", role: "CB", top: 70, left: 62 },
    { id: "rb", role: "RB", top: 68, left: 85 },
    { id: "lmf", role: "LMF", top: 46, left: 22 },
    { id: "cmf", role: "CMF", top: 48, left: 50 },
    { id: "rmf", role: "RMF", top: 46, left: 78 },
    { id: "lcf", role: "CF", top: 18, left: 35 },
    { id: "rcf", role: "CF", top: 18, left: 65 },
  ],
  "3-4-2": [
    { id: "gk", role: "GK", top: 88, left: 50 },
    { id: "lb", role: "LB", top: 68, left: 18 },
    { id: "cb", role: "CB", top: 70, left: 50 },
    { id: "rb", role: "RB", top: 68, left: 82 },
    { id: "lmf", role: "LMF", top: 44, left: 16 },
    { id: "cmf1", role: "CMF", top: 46, left: 38 },
    { id: "cmf2", role: "CMF", top: 46, left: 62 },
    { id: "rmf", role: "RMF", top: 44, left: 84 },
    { id: "lcf", role: "CF", top: 18, left: 35 },
    { id: "rcf", role: "CF", top: 18, left: 65 },
  ],
  "3-3-3": [
    { id: "gk", role: "GK", top: 88, left: 50 },
    { id: "lb", role: "LB", top: 68, left: 18 },
    { id: "cb", role: "CB", top: 70, left: 50 },
    { id: "rb", role: "RB", top: 68, left: 82 },
    { id: "lmf", role: "LMF", top: 46, left: 22 },
    { id: "cmf", role: "CMF", top: 48, left: 50 },
    { id: "rmf", role: "RMF", top: 46, left: 78 },
    { id: "lwf", role: "LWF", top: 18, left: 20 },
    { id: "cf", role: "CF", top: 16, left: 50 },
    { id: "rwf", role: "RWF", top: 18, left: 80 },
  ],
  "4-2-3": [
    { id: "gk", role: "GK", top: 88, left: 50 },
    { id: "lb", role: "LB", top: 68, left: 15 },
    { id: "cb1", role: "CB", top: 70, left: 38 },
    { id: "cb2", role: "CB", top: 70, left: 62 },
    { id: "rb", role: "RB", top: 68, left: 85 },
    { id: "cmf1", role: "CMF", top: 48, left: 35 },
    { id: "cmf2", role: "CMF", top: 48, left: 65 },
    { id: "lwf", role: "LWF", top: 18, left: 20 },
    { id: "cf", role: "CF", top: 16, left: 50 },
    { id: "rwf", role: "RWF", top: 18, left: 80 },
  ],

  // ─── 11-A-SIDE (11 players) ─────────────────────────────────────────────────
  "4-2-3-1": [
    { id: "gk", role: "GK", top: 88, left: 50 },
    { id: "lb", role: "LB", top: 68, left: 15 },
    { id: "cb1", role: "CB", top: 70, left: 38 },
    { id: "cb2", role: "CB", top: 70, left: 62 },
    { id: "rb", role: "RB", top: 68, left: 85 },
    { id: "dmf1", role: "DMF", top: 51, left: 35 },
    { id: "dmf2", role: "DMF", top: 51, left: 65 },
    { id: "lmf", role: "LMF", top: 34, left: 18 },
    { id: "amf", role: "AMF", top: 32, left: 50 },
    { id: "rmf", role: "RMF", top: 34, left: 82 },
    { id: "cf", role: "CF", top: 14, left: 50 },
  ],
  "4-4-2": [
    { id: "gk", role: "GK", top: 88, left: 50 },
    { id: "lb", role: "LB", top: 68, left: 15 },
    { id: "cb1", role: "CB", top: 70, left: 38 },
    { id: "cb2", role: "CB", top: 70, left: 62 },
    { id: "rb", role: "RB", top: 68, left: 85 },
    { id: "lmf", role: "LMF", top: 44, left: 15 },
    { id: "cmf1", role: "CMF", top: 48, left: 38 },
    { id: "cmf2", role: "CMF", top: 48, left: 62 },
    { id: "rmf", role: "RMF", top: 44, left: 85 },
    { id: "cf1", role: "CF", top: 16, left: 38 },
    { id: "cf2", role: "CF", top: 16, left: 62 },
  ],
  "4-3-3": [
    { id: "gk", role: "GK", top: 88, left: 50 },
    { id: "lb", role: "LB", top: 68, left: 15 },
    { id: "cb1", role: "CB", top: 70, left: 38 },
    { id: "cb2", role: "CB", top: 70, left: 62 },
    { id: "rb", role: "RB", top: 68, left: 85 },
    { id: "dmf", role: "DMF", top: 51, left: 50 },
    { id: "cmf1", role: "CMF", top: 44, left: 26 },
    { id: "cmf2", role: "CMF", top: 44, left: 74 },
    { id: "lwf", role: "LWF", top: 16, left: 18 },
    { id: "rwf", role: "RWF", top: 16, left: 82 },
    { id: "cf", role: "CF", top: 12, left: 50 },
  ],
  "4-3-2-1": [
    { id: "gk", role: "GK", top: 88, left: 50 },
    { id: "lb", role: "LB", top: 68, left: 15 },
    { id: "cb1", role: "CB", top: 70, left: 38 },
    { id: "cb2", role: "CB", top: 70, left: 62 },
    { id: "rb", role: "RB", top: 68, left: 85 },
    { id: "cmf1", role: "CMF", top: 48, left: 25 },
    { id: "dmf", role: "DMF", top: 51, left: 50 },
    { id: "cmf2", role: "CMF", top: 48, left: 75 },
    { id: "amf1", role: "AMF", top: 30, left: 35 },
    { id: "amf2", role: "AMF", top: 30, left: 65 },
    { id: "cf", role: "CF", top: 12, left: 50 },
  ],
  "4-3-1-2": [
    { id: "gk", role: "GK", top: 88, left: 50 },
    { id: "lb", role: "LB", top: 68, left: 15 },
    { id: "cb1", role: "CB", top: 70, left: 38 },
    { id: "cb2", role: "CB", top: 70, left: 62 },
    { id: "rb", role: "RB", top: 68, left: 85 },
    { id: "cmf1", role: "CMF", top: 48, left: 25 },
    { id: "dmf", role: "DMF", top: 51, left: 50 },
    { id: "cmf2", role: "CMF", top: 48, left: 75 },
    { id: "amf", role: "AMF", top: 32, left: 50 },
    { id: "cf1", role: "CF", top: 14, left: 38 },
    { id: "cf2", role: "CF", top: 14, left: 62 },
  ],
  "4-2-1-3": [
    { id: "gk", role: "GK", top: 88, left: 50 },
    { id: "lb", role: "LB", top: 68, left: 15 },
    { id: "cb1", role: "CB", top: 70, left: 38 },
    { id: "cb2", role: "CB", top: 70, left: 62 },
    { id: "rb", role: "RB", top: 68, left: 85 },
    { id: "dmf1", role: "DMF", top: 51, left: 35 },
    { id: "dmf2", role: "DMF", top: 51, left: 65 },
    { id: "amf", role: "AMF", top: 32, left: 50 },
    { id: "lwf", role: "LWF", top: 16, left: 18 },
    { id: "rwf", role: "RWF", top: 16, left: 82 },
    { id: "cf", role: "CF", top: 12, left: 50 },
  ],
  "4-1-4-1": [
    { id: "gk", role: "GK", top: 88, left: 50 },
    { id: "lb", role: "LB", top: 68, left: 15 },
    { id: "cb1", role: "CB", top: 70, left: 38 },
    { id: "cb2", role: "CB", top: 70, left: 62 },
    { id: "rb", role: "RB", top: 68, left: 85 },
    { id: "dmf", role: "DMF", top: 51, left: 50 },
    { id: "lmf", role: "LMF", top: 30, left: 15 },
    { id: "cmf1", role: "CMF", top: 32, left: 38 },
    { id: "cmf2", role: "CMF", top: 32, left: 62 },
    { id: "rmf", role: "RMF", top: 30, left: 85 },
    { id: "cf", role: "CF", top: 14, left: 50 },
  ],
  "4-1-2-3": [
    { id: "gk", role: "GK", top: 88, left: 50 },
    { id: "lb", role: "LB", top: 68, left: 15 },
    { id: "cb1", role: "CB", top: 70, left: 38 },
    { id: "cb2", role: "CB", top: 70, left: 62 },
    { id: "rb", role: "RB", top: 68, left: 85 },
    { id: "dmf", role: "DMF", top: 51, left: 50 },
    { id: "cmf1", role: "CMF", top: 34, left: 33 },
    { id: "cmf2", role: "CMF", top: 34, left: 67 },
    { id: "lwf", role: "LWF", top: 16, left: 18 },
    { id: "rwf", role: "RWF", top: 16, left: 82 },
    { id: "cf", role: "CF", top: 12, left: 50 },
  ],
  "3-4-3": [
    { id: "gk", role: "GK", top: 88, left: 50 },
    { id: "cb1", role: "CB", top: 68, left: 25 },
    { id: "cb2", role: "CB", top: 70, left: 50 },
    { id: "cb3", role: "CB", top: 68, left: 75 },
    { id: "lmf", role: "LMF", top: 48, left: 15 },
    { id: "cmf1", role: "CMF", top: 50, left: 38 },
    { id: "cmf2", role: "CMF", top: 50, left: 62 },
    { id: "rmf", role: "RMF", top: 48, left: 85 },
    { id: "lwf", role: "LWF", top: 18, left: 20 },
    { id: "rwf", role: "RWF", top: 18, left: 80 },
    { id: "cf", role: "CF", top: 12, left: 50 },
  ],
  "3-2-4-1": [
    { id: "gk", role: "GK", top: 88, left: 50 },
    { id: "cb1", role: "CB", top: 68, left: 25 },
    { id: "cb2", role: "CB", top: 70, left: 50 },
    { id: "cb3", role: "CB", top: 68, left: 75 },
    { id: "dmf1", role: "DMF", top: 51, left: 35 },
    { id: "dmf2", role: "DMF", top: 51, left: 65 },
    { id: "lmf", role: "LMF", top: 32, left: 15 },
    { id: "amf1", role: "AMF", top: 34, left: 38 },
    { id: "amf2", role: "AMF", top: 34, left: 62 },
    { id: "rmf", role: "RMF", top: 32, left: 85 },
    { id: "cf", role: "CF", top: 14, left: 50 },
  ],
  "3-2-3-2": [
    { id: "gk", role: "GK", top: 88, left: 50 },
    { id: "cb1", role: "CB", top: 68, left: 25 },
    { id: "cb2", role: "CB", top: 70, left: 50 },
    { id: "cb3", role: "CB", top: 68, left: 75 },
    { id: "dmf1", role: "DMF", top: 51, left: 35 },
    { id: "dmf2", role: "DMF", top: 51, left: 65 },
    { id: "lmf", role: "LMF", top: 32, left: 15 },
    { id: "amf", role: "AMF", top: 34, left: 50 },
    { id: "rmf", role: "RMF", top: 32, left: 85 },
    { id: "cf1", role: "CF", top: 14, left: 38 },
    { id: "cf2", role: "CF", top: 14, left: 62 },
  ],
  "3-1-4-2": [
    { id: "gk", role: "GK", top: 88, left: 50 },
    { id: "cb1", role: "CB", top: 68, left: 25 },
    { id: "cb2", role: "CB", top: 70, left: 50 },
    { id: "cb3", role: "CB", top: 68, left: 75 },
    { id: "dmf", role: "DMF", top: 51, left: 50 },
    { id: "lmf", role: "LMF", top: 32, left: 15 },
    { id: "cmf1", role: "CMF", top: 34, left: 38 },
    { id: "cmf2", role: "CMF", top: 34, left: 62 },
    { id: "rmf", role: "RMF", top: 32, left: 85 },
    { id: "cf1", role: "CF", top: 14, left: 38 },
    { id: "cf2", role: "CF", top: 14, left: 62 },
  ],
  "5-3-2": [
    { id: "gk", role: "GK", top: 88, left: 50 },
    { id: "lwb", role: "LWB", top: 62, left: 12 },
    { id: "cb1", role: "CB", top: 68, left: 30 },
    { id: "cb2", role: "CB", top: 70, left: 50 },
    { id: "cb3", role: "CB", top: 68, left: 70 },
    { id: "rwb", role: "RWB", top: 62, left: 88 },
    { id: "cmf1", role: "CMF", top: 44, left: 28 },
    { id: "dmf", role: "DMF", top: 46, left: 50 },
    { id: "cmf2", role: "CMF", top: 44, left: 72 },
    { id: "cf1", role: "CF", top: 16, left: 38 },
    { id: "cf2", role: "CF", top: 16, left: 62 },
  ],
  "5-2-2-1": [
    { id: "gk", role: "GK", top: 88, left: 50 },
    { id: "lwb", role: "LWB", top: 62, left: 12 },
    { id: "cb1", role: "CB", top: 68, left: 30 },
    { id: "cb2", role: "CB", top: 70, left: 50 },
    { id: "cb3", role: "CB", top: 68, left: 70 },
    { id: "rwb", role: "RWB", top: 62, left: 88 },
    { id: "cmf1", role: "CMF", top: 50, left: 35 },
    { id: "cmf2", role: "CMF", top: 50, left: 65 },
    { id: "amf1", role: "AMF", top: 32, left: 33 },
    { id: "amf2", role: "AMF", top: 32, left: 67 },
    { id: "cf", role: "CF", top: 14, left: 50 },
  ],
  "5-2-1-2": [
    { id: "gk", role: "GK", top: 88, left: 50 },
    { id: "lwb", role: "LWB", top: 62, left: 12 },
    { id: "cb1", role: "CB", top: 68, left: 30 },
    { id: "cb2", role: "CB", top: 70, left: 50 },
    { id: "cb3", role: "CB", top: 68, left: 70 },
    { id: "rwb", role: "RWB", top: 62, left: 88 },
    { id: "cmf1", role: "CMF", top: 50, left: 35 },
    { id: "cmf2", role: "CMF", top: 50, left: 65 },
    { id: "amf", role: "AMF", top: 32, left: 50 },
    { id: "cf1", role: "CF", top: 14, left: 38 },
    { id: "cf2", role: "CF", top: 14, left: 62 },
  ],
};

// Broad category grouping used for aptitude scoring when a player is
// placed outside their natural position.
export const ROLE_MAP: Record<string, Position[]> = {
  GK: ["GK"],
  DEF: ["CB", "RB", "LB", "RWB", "LWB"],
  MID: ["DMF", "CMF", "AMF", "RMF", "LMF"],
  FWD: ["CF", "SS", "RWF", "LWF"],
};

export const getAptitudeMultiplier = (playerPos: Position, slotRole: Position): number => {
  if (playerPos === slotRole) return 1.0;
  const playerCat = Object.keys(ROLE_MAP).find((cat) => ROLE_MAP[cat].includes(playerPos));
  const slotCat = Object.keys(ROLE_MAP).find((cat) => ROLE_MAP[cat].includes(slotRole));
  if (playerCat === slotCat) return 0.9;
  return 0.5;
};

export const autopickSquad = (formation: FormationType, players: Player[]): Record<string, string> => {
  const slots = FORMATION_PRESETS[formation] || FORMATION_PRESETS["4-2-3-1"];
  const sortedPlayers = [...players].sort((a, b) => b.rating - a.rating);
  const selectedIds = new Set<string>();
  const newSquad: Record<string, string> = {};

  slots.forEach((slot) => {
    let bestMatch = sortedPlayers.find((p) => !selectedIds.has(p.id) && p.position === slot.role);

    if (!bestMatch) {
      const slotCat = Object.keys(ROLE_MAP).find((cat) => ROLE_MAP[cat].includes(slot.role));
      bestMatch = sortedPlayers.find(
        (p) =>
          !selectedIds.has(p.id) &&
          Object.keys(ROLE_MAP).find((cat) => ROLE_MAP[cat].includes(p.position)) === slotCat,
      );
    }

    if (!bestMatch) {
      bestMatch = sortedPlayers.find((p) => !selectedIds.has(p.id));
    }

    if (bestMatch) {
      newSquad[slot.id] = bestMatch.id;
      selectedIds.add(bestMatch.id);
    }
  });

  return newSquad;
};