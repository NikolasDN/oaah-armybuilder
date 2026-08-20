import { Routes } from '@angular/router';
import { LandingComponent } from './pages/landing/landing.component';
import { ArmyBuilderComponent } from './pages/army-builder/army-builder.component';

export const routes: Routes = [
  { path: '', component: LandingComponent },
  { path: 'army/:id', component: ArmyBuilderComponent },
  { path: '**', redirectTo: '' },
];
