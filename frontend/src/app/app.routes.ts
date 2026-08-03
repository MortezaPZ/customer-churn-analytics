import { Routes } from '@angular/router';

import { Dashboard } from './pages/dashboard';

export const routes: Routes = [
  { path: '', component: Dashboard, title: 'Customer Churn Analytics' },
  { path: '**', redirectTo: '' },
];
