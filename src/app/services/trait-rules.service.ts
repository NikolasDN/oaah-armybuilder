import { Injectable } from '@angular/core';
import rulesJson from '../../assets/data/trait-rules.json';
import { FeaturedTraitRule, Trait, TraitRuleEntry } from '../models/army.models';

interface TraitRulesFile {
  source: string;
  entries: TraitRuleEntry[];
}

@Injectable({ providedIn: 'root' })
export class TraitRulesService {
  private readonly entries = (rulesJson as TraitRulesFile).entries;
  private readonly byAlias = new Map<string, TraitRuleEntry>();

  constructor() {
    for (const entry of this.entries) {
      for (const alias of entry.aliases) {
        this.byAlias.set(this.normalize(alias), entry);
      }
    }
  }

  featured(traits: Trait[]): FeaturedTraitRule[] {
    const grouped = new Map<string, FeaturedTraitRule>();
    for (const trait of traits) {
      const rule = this.lookup(trait.name);
      const key = rule?.name ?? trait.name;
      const existing = grouped.get(key);
      const label = trait.raw || trait.name;
      if (existing) {
        if (!existing.labels.includes(label)) {
          existing.labels.push(label);
        }
        continue;
      }
      grouped.set(key, {
        name: rule?.name ?? trait.name,
        kind: rule?.kind ?? 'trait',
        labels: [label],
        text: rule?.text ?? 'No separate Trait entry appears in the rulebook for this profile.',
      });
    }
    return [...grouped.values()]
      .map((item) => ({ ...item, labels: [...item.labels].sort((a, b) => a.localeCompare(b)) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  private lookup(name: string): TraitRuleEntry | undefined {
    for (const candidate of this.candidates(name)) {
      const match = this.byAlias.get(candidate);
      if (match) {
        return match;
      }
    }
    return undefined;
  }

  private candidates(name: string): string[] {
    const normalized = this.normalize(name);
    return [
      normalized,
      normalized.replace(/^spell:\s*/, ''),
      normalized.replace(/\s+level\s+\d+$/, ''),
      normalized.replace(/\s+x\d+$/, ''),
      normalized.replace(/\s+\d+$/, ''),
    ];
  }

  private normalize(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
  }
}
