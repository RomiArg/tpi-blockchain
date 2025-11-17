// src/app/auth.guard.ts
import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from './servicios/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(): boolean {
    // Si el AuthService dice que el usuario está logueado...
    if (this.authService.isLoggedIn()) {
      return true; // ...permite el acceso a la ruta.
    }

    // Si no...
    console.warn('AuthGuard: Acceso denegado. Redirigiendo a /login');
    this.router.navigate(['/login']); // ...redirige al login.
    return false; // ...y bloquea la ruta actual.
  }
}