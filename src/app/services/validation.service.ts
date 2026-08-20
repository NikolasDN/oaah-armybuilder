import { Injectable } from '@angular/core';
import {
  RareUsage,
  ResolvedEntry,
  SavedArmy,
  ValidationIssue,
  ValidationResult,
} from '../models/army.models';
import { CatalogService } from './catalog.service';

@Injectable({ providedIn: 'root' })
export class ValidationService {
  constructor(private readonly catalog: CatalogService) {}

  entryPoints(unitCost: number, stands: number, mercenary: boolean): number {
    const base = unitCost * stands;
    if (!mercenary) {
      return base;
    }
    return Math.max(1, Math.round(base * (1 - this.catalog.rules.mercenaryDiscount)));
  }

  validate(army: SavedArmy): ValidationResult {
    const rules = this.catalog.rules;
    const issues: ValidationIssue[] = [];
    const resolved: ResolvedEntry[] = [];
    const rareMap = new Map<string, { used: number; max: number }>();
    let q2Units = 0;
    let generalCount = 0;
    let animalUnits = 0;

    for (const entry of army.entries) {
      const unit = this.catalog.unitById(entry.unitId);
      if (!unit) {
        issues.push({
          severity: 'error',
          message: `A roster entry references a missing unit profile (${entry.unitId}).`,
        });
        continue;
      }

      if (entry.stands < unit.minStands || entry.stands > unit.maxStands) {
        const label =
          unit.minStands === unit.maxStands
            ? `${unit.name} must be taken as ${unit.minStands} stand.`
            : `${unit.name} must have between ${unit.minStands} and ${unit.maxStands} stands.`;
        issues.push({ severity: 'error', message: label });
      }

      const points = this.entryPoints(unit.cost, entry.stands, entry.mercenary);
      const countsAsPersonality = unit.personality;
      const countsAsLimited = unit.limited || entry.mercenary || countsAsPersonality;

      resolved.push({
        entry,
        unit,
        points,
        countsAsLimited,
        countsAsPersonality,
      });

      if (unit.quality <= 2) {
        q2Units += 1;
      }
      if (unit.traits.some((trait) => /^general$/i.test(trait.name))) {
        generalCount += 1;
      }
      if (unit.traits.some((trait) => /^animal$/i.test(trait.name))) {
        animalUnits += 1;
      }

      for (const trait of unit.traits) {
        if (trait.rare == null) {
          continue;
        }
        const current = rareMap.get(trait.name) ?? { used: 0, max: trait.rare };
        current.used += 1;
        current.max = Math.min(current.max, trait.rare);
        rareMap.set(trait.name, current);
      }
    }

    const totalPoints = resolved.reduce((sum, item) => sum + item.points, 0);
    const limitedPoints = resolved
      .filter((item) => item.countsAsLimited)
      .reduce((sum, item) => sum + item.points, 0);
    const personalityPoints = resolved
      .filter((item) => item.countsAsPersonality)
      .reduce((sum, item) => sum + item.points, 0);
    const limitedCap = Math.floor(army.budget * rules.limitedCap);
    const personalityCap = Math.floor(army.budget * rules.personalityCap);

    if (totalPoints > army.budget) {
      issues.push({
        severity: 'error',
        message: `Army costs ${totalPoints} points, which exceeds the ${army.budget} point budget.`,
      });
    }

    if (limitedPoints > limitedCap) {
      issues.push({
        severity: 'error',
        message: `Limited and Personality troops cost ${limitedPoints} points. You may spend at most ${limitedCap} points (50% of the budget) on Limited (L) or Personality (P) troops. Personality costs count toward this Limited total.`,
      });
    }

    if (personalityPoints > personalityCap) {
      issues.push({
        severity: 'error',
        message: `Personality troops cost ${personalityPoints} points. You may spend at most ${personalityCap} points (33% of the budget) on Personality (P) troops, including Q2+ units.`,
      });
    }

    if (rules.q2IsRare1 && q2Units > 1) {
      issues.push({
        severity: 'error',
        message: `Q2+ troops are Personalities and Rare 1. This army has ${q2Units} Q2+ units; only one is allowed.`,
      });
    }

    for (const [trait, usage] of rareMap) {
      if (usage.used > usage.max) {
        issues.push({
          severity: 'error',
          message: `${trait} is Rare ${usage.max}. This army has ${usage.used} units with that Trait.`,
        });
      }
    }

    for (const item of resolved) {
      if (item.entry.mercenary && item.unit.factionId === army.factionId) {
        issues.push({
          severity: 'error',
          message: `${item.unit.name} belongs to this army list and cannot be taken as a mercenary.`,
        });
      }
    }

    if (resolved.length === 0) {
      issues.push({
        severity: 'warning',
        message: 'The roster is empty. Add units from the army list to begin.',
      });
    } else if (resolved.length < 5) {
      issues.push({
        severity: 'warning',
        message: 'A typical game uses 5–8 units plus 2–5 characters. This roster is still quite small.',
      });
    }

    if (resolved.length > 0 && generalCount === 0) {
      issues.push({
        severity: 'warning',
        message: 'No General is present. A typical army includes one General (Personality, Rare 1).',
      });
    }

    if (resolved.length > 0 && animalUnits === resolved.length) {
      issues.push({
        severity: 'warning',
        message: 'If an army has only Animal units on the table, that player loses the game.',
      });
    }

    const rareUsage: RareUsage[] = [...rareMap.entries()]
      .map(([trait, usage]) => ({ trait, used: usage.used, max: usage.max }))
      .sort((a, b) => a.trait.localeCompare(b.trait));

    return {
      totalPoints,
      limitedPoints,
      personalityPoints,
      limitedCap,
      personalityCap,
      remaining: army.budget - totalPoints,
      standCount: resolved.reduce((sum, item) => sum + item.entry.stands, 0),
      unitCount: resolved.length,
      issues,
      rareUsage,
      valid: issues.every((issue) => issue.severity !== 'error'),
      resolved,
    };
  }
}
