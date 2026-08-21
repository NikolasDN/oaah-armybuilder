import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CatalogService } from '../../services/catalog.service';
import { StorageService } from '../../services/storage.service';
import { ValidationService } from '../../services/validation.service';
import { SavedArmy } from '../../models/army.models';

@Component({
  selector: 'app-landing',
  imports: [RouterLink, DatePipe],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent {
  private readonly catalog = inject(CatalogService);
  private readonly storage = inject(StorageService);
  private readonly validation = inject(ValidationService);
  private readonly router = inject(Router);

  readonly factions = this.catalog.selectableFactions;
  readonly armies = this.storage.armies;
  readonly hasArmies = computed(() => this.armies().length > 0);
  readonly importMessage = signal('');

  factionName(id: string): string {
    return this.catalog.factionById(id)?.name ?? id;
  }

  factionColor(id: string): string {
    return this.catalog.factionById(id)?.color ?? '#c4a35a';
  }

  summary(army: SavedArmy): string {
    const result = this.validation.validate(army);
    const status = result.valid ? 'Legal' : 'Illegal';
    const units = result.unitCount === 1 ? '1 unit' : `${result.unitCount} units`;
    return `${result.totalPoints} / ${army.budget} pts · ${units} · ${status}`;
  }

  isLegal(army: SavedArmy): boolean {
    return this.validation.validate(army).valid;
  }

  startArmy(factionId: string): void {
    const army = this.storage.create(factionId);
    void this.router.navigate(['/army', army.id]);
  }

  duplicateArmy(event: Event, id: string): void {
    event.stopPropagation();
    const copy = this.storage.duplicate(id);
    if (copy) {
      void this.router.navigate(['/army', copy.id]);
    }
  }

  deleteArmy(event: Event, army: SavedArmy): void {
    event.stopPropagation();
    const confirmed = window.confirm(`Delete “${army.name}”? This cannot be undone.`);
    if (confirmed) {
      this.storage.remove(army.id);
    }
  }

  exportArmy(event: Event, army: SavedArmy): void {
    event.stopPropagation();
    this.storage.exportArmy(army);
  }

  exportAll(): void {
    this.storage.exportAll();
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
        const label = imported.length === 1 ? imported[0].name : `${imported.length} army lists`;
        this.importMessage.set(`Imported ${label}.`);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Could not import that file.';
        this.importMessage.set(message);
      });
  }
}
