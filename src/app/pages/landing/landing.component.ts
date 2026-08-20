import { DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
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
}
