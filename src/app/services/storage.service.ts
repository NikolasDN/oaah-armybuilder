import { Injectable, signal } from '@angular/core';
import { SavedArmy } from '../models/army.models';
import { CatalogService } from './catalog.service';

const STORAGE_KEY = 'oaah-armies';

@Injectable({ providedIn: 'root' })
export class StorageService {
  readonly armies = signal<SavedArmy[]>(this.read());

  constructor(private readonly catalog: CatalogService) {}

  private read(): SavedArmy[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw) as SavedArmy[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private persist(armies: SavedArmy[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(armies));
    this.armies.set(armies);
  }

  byId(id: string): SavedArmy | undefined {
    return this.armies().find((army) => army.id === id);
  }

  create(factionId: string): SavedArmy {
    const faction = this.catalog.factionById(factionId);
    const now = new Date().toISOString();
    const army: SavedArmy = {
      id: crypto.randomUUID(),
      name: faction ? `${faction.name} host` : 'New army',
      factionId,
      budget: this.catalog.rules.defaultBudget,
      homeTerrain: faction?.suggestedHomeTerrain ?? 'Plains',
      entries: [],
      createdAt: now,
      updatedAt: now,
    };
    this.persist([army, ...this.armies()]);
    return army;
  }

  save(army: SavedArmy): SavedArmy {
    const updated: SavedArmy = { ...army, updatedAt: new Date().toISOString() };
    const armies = this.armies();
    const index = armies.findIndex((item) => item.id === updated.id);
    if (index === -1) {
      this.persist([updated, ...armies]);
    } else {
      const next = [...armies];
      next[index] = updated;
      this.persist(next);
    }
    return updated;
  }

  duplicate(id: string): SavedArmy | undefined {
    const source = this.byId(id);
    if (!source) {
      return undefined;
    }
    const now = new Date().toISOString();
    const copy: SavedArmy = {
      ...source,
      id: crypto.randomUUID(),
      name: `${source.name} (copy)`,
      createdAt: now,
      updatedAt: now,
      entries: source.entries.map((entry) => ({ ...entry, id: crypto.randomUUID() })),
    };
    this.persist([copy, ...this.armies()]);
    return copy;
  }

  remove(id: string): void {
    this.persist(this.armies().filter((army) => army.id !== id));
  }
}
