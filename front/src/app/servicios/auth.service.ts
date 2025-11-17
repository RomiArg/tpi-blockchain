// src/app/auth.service.ts
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

// Definimos los 4 roles de negocio
export type UserRole = 'Laboratorio' | 'Logistica' | 'Salud' | 'Regulador' | null;

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  
  private roleSubject = new BehaviorSubject<UserRole>(null);
  public currentRole$ = this.roleSubject.asObservable();

  constructor(private router: Router) {}

  /**
   * Inicia sesión: Guarda el rol y redirige al Home.
   */
  public login(role: UserRole): void {
    console.log(`AuthService: Iniciando sesión como -> ${role}`);
    this.roleSubject.next(role);
    this.router.navigate(['/home']); // Redirige al home DESPUÉS de loguear
  }

  /**
   * Cierra sesión: Limpia el rol y redirige al Login.
   */
  public logout(): void {
    console.log(`AuthService: Cerrando sesión...`);
    this.roleSubject.next(null);
    this.router.navigate(['/login']); // Redirige al login
  }

  /**
   * Devuelve el valor actual del rol (para chequeos síncronos)
   */
  public getCurrentRole(): UserRole {
    return this.roleSubject.getValue();
  }

  /**
   * Helper para el AuthGuard
   */
  public isLoggedIn(): boolean {
    return this.getCurrentRole() !== null;
  }

  // --- Helpers para usar en el *ngIf de los HTML ---
  public isLaboratorio = (): boolean => this.getCurrentRole() === 'Laboratorio';
  public isLogistica = (): boolean => this.getCurrentRole() === 'Logistica';
  public isSalud = (): boolean => this.getCurrentRole() === 'Salud';
  public isRegulador = (): boolean => this.getCurrentRole() === 'Regulador';
}