import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CatalogUnit, SavedArmy, UnitKind } from '../../models/army.models';
import { CatalogService } from '../../services/catalog.service';
import { StorageService } from '../../services/storage.service';
import { TraitRulesService } from '../../services/trait-rules.service';
import { ValidationService } from '../../services/validation.service';

@Component({
  selector: 'app-army-builder',
  imports: [FormsModule, RouterLink, DecimalPipe],
  templateUrl: './army-builder.component.html',
  styleUrl: './army-builder.component.scss',
})
export class ArmyBuilderComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly catalog = inject(CatalogService);
  private readonly storage = inject(StorageService);
  private readonly validation = inject(ValidationService);
  private readonly traitRules = inject(TraitRulesService);

  readonly rules = this.catalog.rules;
  readonly army = signal<SavedArmy | null>(null);
  readonly query = signal('');
  readonly kindFilter = signal<UnitKind | 'all'>('all');
  readonly showMercenaries = signal(false);
  readonly saveFlash = signal('');

  readonly faction = computed(() => {
    const army = this.army();
    return army ? this.catalog.factionById(army.factionId) : undefined;
  });

  readonly result = computed(() => {
    const army = this.army();
    return army ? this.validation.validate(army) : null;
  });

  readonly errors = computed(() => this.result()?.issues.filter((issue) => issue.severity === 'error') ?? []);
  readonly warnings = computed(() => this.result()?.issues.filter((issue) => issue.severity === 'warning') ?? []);
  readonly featuredTraits = computed(() => {
    const resolved = this.result()?.resolved ?? [];
    return this.traitRules.featured(resolved.flatMap((item) => item.unit.traits));
  });

  readonly visibleUnits = computed(() => {
    const army = this.army();
    if (!army) {
      return [];
    }
    const needle = this.query().trim().toLowerCase();
    const kind = this.kindFilter();
    return this.catalog.unitsForFaction(army.factionId, this.showMercenaries()).filter((unit) => {
      if (kind !== 'all' && unit.kind !== kind) {
        return false;
      }
      if (!needle) {
        return true;
      }
      const haystack = [
        unit.name,
        unit.factionId,
        ...unit.traits.map((trait) => trait.raw),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  });

  readonly groupedUnits = computed(() => {
    const army = this.army();
    if (!army) {
      return [];
    }
    const groups = new Map<string, CatalogUnit[]>();
    for (const unit of this.visibleUnits()) {
      const key = unit.factionId;
      const list = groups.get(key) ?? [];
      list.push(unit);
      groups.set(key, list);
    }
    return [...groups.entries()]
      .map(([factionId, units]) => ({
        factionId,
        name: this.catalog.factionById(factionId)?.name ?? factionId,
        relation: this.catalog.relation(factionId, army.factionId),
        native: this.catalog.isAvailableFaction(factionId, army.factionId),
        units,
      }))
      .sort(
        (a, b) =>
          this.groupRank(a.factionId, army.factionId) - this.groupRank(b.factionId, army.factionId)
      );
  });

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    const army = id ? this.storage.byId(id) : undefined;
    if (!army) {
      void this.router.navigateByUrl('/');
      return;
    }
    this.army.set(army);
  }

  factionName(id: string): string {
    return this.catalog.factionById(id)?.name ?? id;
  }

  private groupRank(factionId: string, armyFactionId: string): number {
    if (factionId === armyFactionId) {
      return 0;
    }
    const sharedIndex = this.catalog.sharedFactionIds.indexOf(factionId);
    if (sharedIndex >= 0) {
      return 1 + sharedIndex;
    }
    const allyIndex = this.catalog.alliedFactionIds(armyFactionId).indexOf(factionId);
    if (allyIndex >= 0) {
      return 20 + allyIndex;
    }
    return 100;
  }

  kindLabel(kind: UnitKind): string {
    switch (kind) {
      case 'character':
        return 'Character';
      case 'monster':
        return 'Monster';
      case 'war-engine':
        return 'War engine';
      default:
        return 'Troop';
    }
  }

  qualityLabel(quality: number): string {
    return `Q${quality}+`;
  }

  unitCost(unit: CatalogUnit, mercenary: boolean): number {
    return this.validation.entryPoints(unit.cost, 1, mercenary);
  }

  patch(partial: Partial<SavedArmy>): void {
    const current = this.army();
    if (!current) {
      return;
    }
    const next = this.storage.save({ ...current, ...partial });
    this.army.set(next);
    this.saveFlash.set('Saved');
    window.setTimeout(() => this.saveFlash.set(''), 1200);
  }

  addUnit(unit: CatalogUnit, mercenary: boolean): void {
    const current = this.army();
    if (!current) {
      return;
    }
    this.patch({
      entries: [
        ...current.entries,
        {
          id: crypto.randomUUID(),
          unitId: unit.id,
          stands: unit.defaultStands,
          mercenary,
        },
      ],
    });
  }

  setStands(entryId: string, stands: number): void {
    const current = this.army();
    if (!current) {
      return;
    }
    this.patch({
      entries: current.entries.map((entry) =>
        entry.id === entryId ? { ...entry, stands: Number(stands) || entry.stands } : entry
      ),
    });
  }

  removeEntry(entryId: string): void {
    const current = this.army();
    if (!current) {
      return;
    }
    this.patch({
      entries: current.entries.filter((entry) => entry.id !== entryId),
    });
  }

  printRoster(): void {
    window.print();
  }

  exportArmy(): void {
    const current = this.army();
    if (current) {
      this.storage.exportArmy(current);
    }
  }

  importFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    file
      .text()
      .then((raw) => {
        const imported = this.storage.importFromText(raw);
        void this.router.navigate(['/army', imported[0].id]);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Could not import that file.';
        window.alert(message);
      });
  }

  deleteArmy(): void {
    const current = this.army();
    if (!current) {
      return;
    }
    if (window.confirm(`Delete “${current.name}”? This cannot be undone.`)) {
      this.storage.remove(current.id);
      void this.router.navigateByUrl('/');
    }
  }

  limitedRatio(): number {
    const result = this.result();
    if (!result || result.limitedCap === 0) {
      return 0;
    }
    return Math.min(100, (result.limitedPoints / result.limitedCap) * 100);
  }

  personalityRatio(): number {
    const result = this.result();
    if (!result || result.personalityCap === 0) {
      return 0;
    }
    return Math.min(100, (result.personalityPoints / result.personalityCap) * 100);
  }

  totalRatio(): number {
    const army = this.army();
    const result = this.result();
    if (!army || !result || army.budget === 0) {
      return 0;
    }
    return Math.min(100, (result.totalPoints / army.budget) * 100);
  }
}
