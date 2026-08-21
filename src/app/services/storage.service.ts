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

  exportArmy(army: SavedArmy): void {
    this.download(
      {
        format: 'oaah-army',
        version: 1,
        army,
      },
      `${this.fileSlug(army.name)}.json`
    );
  }

  exportAll(): void {
    this.download(
      {
        format: 'oaah-armies',
        version: 1,
        armies: this.armies(),
      },
      'oaah-armies.json'
    );
  }

  importFromText(raw: string): SavedArmy[] {
    const parsed: unknown = JSON.parse(raw);
    const imported = this.parseImport(parsed).map((army) => this.cloneImported(army));
    if (imported.length === 0) {
      throw new Error('No army lists found in that file.');
    }
    this.persist([...imported, ...this.armies()]);
    return imported;
  }

  private parseImport(parsed: unknown): SavedArmy[] {
    if (Array.isArray(parsed)) {
      return parsed.map((item) => this.normalizeArmy(item)).filter((item): item is SavedArmy => !!item);
    }
    if (!parsed || typeof parsed !== 'object') {
      return [];
    }
    const record = parsed as Record<string, unknown>;
    if (record['format'] === 'oaah-armies' && Array.isArray(record['armies'])) {
      return this.parseImport(record['armies']);
    }
    if (record['format'] === 'oaah-army' && record['army']) {
      const army = this.normalizeArmy(record['army']);
      return army ? [army] : [];
    }
    const army = this.normalizeArmy(record);
    return army ? [army] : [];
  }

  private normalizeArmy(value: unknown): SavedArmy | null {
    if (!value || typeof value !== 'object') {
      return null;
    }
    const record = value as Record<string, unknown>;
    const name = typeof record['name'] === 'string' ? record['name'].trim() : '';
    const factionId = typeof record['factionId'] === 'string' ? record['factionId'] : '';
    const budget = Number(record['budget']);
    if (!name || !factionId || !Number.isFinite(budget) || budget <= 0) {
      return null;
    }
    const entries = Array.isArray(record['entries'])
      ? record['entries'].flatMap((entry) => {
          const item = this.normalizeEntry(entry);
          return item ? [item] : [];
        })
      : [];
    const now = new Date().toISOString();
    return {
      id: typeof record['id'] === 'string' ? record['id'] : crypto.randomUUID(),
      name,
      factionId,
      budget,
      homeTerrain: typeof record['homeTerrain'] === 'string' ? record['homeTerrain'] : 'Plains',
      entries,
      createdAt: typeof record['createdAt'] === 'string' ? record['createdAt'] : now,
      updatedAt: typeof record['updatedAt'] === 'string' ? record['updatedAt'] : now,
    };
  }

  private normalizeEntry(value: unknown): SavedArmy['entries'][number] | null {
    if (!value || typeof value !== 'object') {
      return null;
    }
    const record = value as Record<string, unknown>;
    const unitId = typeof record['unitId'] === 'string' ? record['unitId'] : '';
    const stands = Number(record['stands']);
    if (!unitId || !Number.isFinite(stands) || stands <= 0) {
      return null;
    }
    return {
      id: typeof record['id'] === 'string' ? record['id'] : crypto.randomUUID(),
      unitId,
      stands,
      mercenary: Boolean(record['mercenary']),
    };
  }

  private cloneImported(army: SavedArmy): SavedArmy {
    const now = new Date().toISOString();
    return {
      ...army,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      entries: army.entries.map((entry) => ({ ...entry, id: crypto.randomUUID() })),
    };
  }

  private download(payload: unknown, filename: string): void {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  private fileSlug(name: string): string {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return slug || 'oaah-army';
  }
}
