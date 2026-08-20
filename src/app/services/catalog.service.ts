import { Injectable } from '@angular/core';
import catalogJson from '../../assets/data/units.json';
import {
  CatalogUnit,
  Faction,
  UnitCatalog,
} from '../models/army.models';

export type CatalogRelation = 'native' | 'shared' | 'ally' | 'mercenary';

const SHARED_FACTION_IDS = ['dragonslayers', 'monsters'] as const;

const ALLIED_FACTION_IDS: Record<string, string[]> = {
  orcs: ['goblins', 'trolls'],
  humans: ['halflings'],
  dwarves: ['halflings'],
};

@Injectable({ providedIn: 'root' })
export class CatalogService {
  readonly catalog = catalogJson as UnitCatalog;
  readonly sharedFactionIds: string[] = [...SHARED_FACTION_IDS];

  get factions(): Faction[] {
    return this.catalog.factions;
  }

  get selectableFactions(): Faction[] {
    return this.factions.filter((faction) => !this.isShared(faction.id));
  }

  get sharedFactions(): Faction[] {
    return this.factions.filter((faction) => this.isShared(faction.id));
  }

  get rules() {
    return this.catalog.rules;
  }

  isShared(factionId: string): boolean {
    return this.sharedFactionIds.includes(factionId);
  }

  alliedFactionIds(armyFactionId: string): string[] {
    return ALLIED_FACTION_IDS[armyFactionId] ?? [];
  }

  isAlly(factionId: string, armyFactionId: string): boolean {
    return this.alliedFactionIds(armyFactionId).includes(factionId);
  }

  relation(factionId: string, armyFactionId: string): CatalogRelation {
    if (factionId === armyFactionId) {
      return 'native';
    }
    if (this.isShared(factionId)) {
      return 'shared';
    }
    if (this.isAlly(factionId, armyFactionId)) {
      return 'ally';
    }
    return 'mercenary';
  }

  isAvailableFaction(factionId: string, armyFactionId: string): boolean {
    const kind = this.relation(factionId, armyFactionId);
    return kind === 'native' || kind === 'shared' || kind === 'ally';
  }

  isAvailableWithoutMercenary(unit: CatalogUnit, armyFactionId: string): boolean {
    return this.isAvailableFaction(unit.factionId, armyFactionId);
  }

  factionById(id: string): Faction | undefined {
    return this.factions.find((faction) => faction.id === id);
  }

  unitById(id: string): CatalogUnit | undefined {
    for (const faction of this.factions) {
      const match = faction.units.find((unit) => unit.id === id);
      if (match) {
        return match;
      }
    }
    return undefined;
  }

  unitsForFaction(factionId: string, includeMercenaries = false): CatalogUnit[] {
    const native = this.factionById(factionId)?.units ?? [];
    const shared = this.sharedFactions
      .filter((faction) => faction.id !== factionId)
      .flatMap((faction) => faction.units);
    const allies = this.alliedFactionIds(factionId)
      .map((id) => this.factionById(id))
      .filter((faction): faction is Faction => !!faction)
      .flatMap((faction) => faction.units);
    const available = [...native, ...shared, ...allies];
    if (!includeMercenaries) {
      return available;
    }
    const taken = new Set([factionId, ...this.sharedFactionIds, ...this.alliedFactionIds(factionId)]);
    const mercenaries = this.selectableFactions
      .filter((faction) => !taken.has(faction.id))
      .flatMap((faction) => faction.units);
    return [...available, ...mercenaries];
  }
}
