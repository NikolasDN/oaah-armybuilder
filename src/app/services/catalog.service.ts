import { Injectable } from '@angular/core';
import catalogJson from '../../assets/data/units.json';
import {
  CatalogUnit,
  Faction,
  UnitCatalog,
} from '../models/army.models';

const SHARED_FACTION_IDS = ['dragonslayers', 'monsters'] as const;

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

  isAvailableFaction(factionId: string, armyFactionId: string): boolean {
    return factionId === armyFactionId || this.isShared(factionId);
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
    const available = [...native, ...shared];
    if (!includeMercenaries) {
      return available;
    }
    const mercenaries = this.selectableFactions
      .filter((faction) => faction.id !== factionId)
      .flatMap((faction) => faction.units);
    return [...available, ...mercenaries];
  }
}
