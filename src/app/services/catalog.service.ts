import { Injectable } from '@angular/core';
import catalogJson from '../../assets/data/units.json';
import {
  CatalogUnit,
  Faction,
  UnitCatalog,
} from '../models/army.models';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  readonly catalog = catalogJson as UnitCatalog;

  get factions(): Faction[] {
    return this.catalog.factions;
  }

  get rules() {
    return this.catalog.rules;
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
    if (!includeMercenaries) {
      return this.factionById(factionId)?.units ?? [];
    }
    const native = this.factionById(factionId)?.units ?? [];
    const mercenaries = this.factions
      .filter((faction) => faction.id !== factionId)
      .flatMap((faction) => faction.units);
    return [...native, ...mercenaries];
  }
}
