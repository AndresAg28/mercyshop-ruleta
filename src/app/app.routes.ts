import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/moderator/moderator.component').then(m => m.ModeratorComponent) },
  { path: 'v/:id', loadComponent: () => import('./features/viewer/viewer.component').then(m => m.ViewerComponent) },
  { path: '**', redirectTo: '' }
];
