import { Routes } from '@angular/router';
import { Medicamentos } from './componentes/medicamentos/medicamentos';
import { Home } from './componentes/home/home';

export const routes: Routes = [
    { path: '', component: Home },
    { path: 'medicamentos', component: Medicamentos },
    { path: '**', redirectTo: '' }
];
