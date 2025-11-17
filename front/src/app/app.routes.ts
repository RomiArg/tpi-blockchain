// src/app/app-routing.module.ts
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

// (NUEVO) Importar componentes y el guard
import { LoginComponent } from './componentes/login/login';
import { Home } from './componentes/home/home';
import { MedicamentosComponent } from './componentes/medicamentos/medicamentos';
import { CrearMedicamento } from './componentes/crear-medicamento/crear-medicamento';
import { AuthGuard } from './auth-guard';

export const routes: Routes = [
  // (NUEVO) Ruta de Login, es pública
  { path: 'login', component: LoginComponent },

  // (MODIFICADO) Todas las rutas de tu app AHORA están protegidas por el AuthGuard
  { 
    path: 'home', 
    component: Home,
    canActivate: [AuthGuard] // <-- El guardia
  },
  { 
    path: 'medicamentos', 
    component: MedicamentosComponent,
    canActivate: [AuthGuard] // <-- El guardia
  },
  { 
    path: 'crear-medicamento', 
    component: CrearMedicamento,
    canActivate: [AuthGuard] // <-- El guardia
  },

  // (MODIFICADO) Redirecciones
  { path: '', redirectTo: '/home', pathMatch: 'full' }, // La ruta por defecto es 'home' (que será protegida)
  { path: '**', redirectTo: '/home' } // Cualquier otra ruta redirige a 'home'
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }