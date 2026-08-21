export type UnitKind = 'troop' | 'character' | 'monster' | 'war-engine';

export interface Trait {
  name: string;
  raw: string;
  limited: boolean;
  personality: boolean;
  rare: number | null;
}

export interface CatalogUnit {
  id: string;
  name: string;
  factionId: string;
  cost: number;
  quality: number;
  attack: number;
  defense: number;
  traits: Trait[];
  kind: UnitKind;
  limited: boolean;
  personality: boolean;
  minStands: number;
  maxStands: number;
  defaultStands: number;
}

export interface Faction {
  id: string;
  name: string;
  color: string;
  suggestedHomeTerrain: string;
  shared: boolean;
  units: CatalogUnit[];
}

export interface CatalogRules {
  limitedCap: number;
  personalityCap: number;
  q3IsLimited: boolean;
  q2IsPersonality: boolean;
  q2IsRare1: boolean;
  mercenaryDiscount: number;
  defaultBudget: number;
  budgetPresets: number[];
  homeTerrains: string[];
}

export interface UnitCatalog {
  source: string;
  rules: CatalogRules;
  factions: Faction[];
}

export interface RosterEntry {
  id: string;
  unitId: string;
  stands: number;
  mercenary: boolean;
}

export interface SavedArmy {
  id: string;
  name: string;
  factionId: string;
  budget: number;
  homeTerrain: string;
  entries: RosterEntry[];
  createdAt: string;
  updatedAt: string;
}

export type IssueSeverity = 'error' | 'warning';

export interface ValidationIssue {
  severity: IssueSeverity;
  message: string;
}

export interface RareUsage {
  trait: string;
  used: number;
  max: number;
}

export interface ResolvedEntry {
  entry: RosterEntry;
  unit: CatalogUnit;
  points: number;
  countsAsLimited: boolean;
  countsAsPersonality: boolean;
}

export interface TraitRuleEntry {
  name: string;
  kind: 'trait' | 'spell';
  text: string;
  aliases: string[];
}

export interface FeaturedTraitRule {
  name: string;
  kind: 'trait' | 'spell';
  labels: string[];
  text: string;
}

export interface ValidationResult {
  totalPoints: number;
  limitedPoints: number;
  personalityPoints: number;
  limitedCap: number;
  personalityCap: number;
  remaining: number;
  standCount: number;
  unitCount: number;
  issues: ValidationIssue[];
  rareUsage: RareUsage[];
  valid: boolean;
  resolved: ResolvedEntry[];
}
