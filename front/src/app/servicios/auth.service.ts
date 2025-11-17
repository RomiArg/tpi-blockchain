import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

export type UserRole = 'Laboratorio' | 'Logistica' | 'Salud' | 'Regulador' | null;

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private roleSubject = new BehaviorSubject<UserRole>(null);
  public currentRole$ = this.roleSubject.asObservable();

  constructor(private router: Router) {}

  public login(role: UserRole): void {
    console.log(`AuthService: Iniciando sesión como -> ${role}`);
    this.roleSubject.next(role);
    this.router.navigate(['/home']);
  }

  public logout(): void {
    console.log(`AuthService: Cerrando sesión...`);
    this.roleSubject.next(null);
    this.router.navigate(['/login']);
  }

  public getCurrentRole(): UserRole {
    return this.roleSubject.getValue();
  }

  public isLoggedIn(): boolean {
    return this.getCurrentRole() !== null;
  }

  public isLaboratorio = (): boolean => this.getCurrentRole() === 'Laboratorio';
  public isLogistica = (): boolean => this.getCurrentRole() === 'Logistica';
  public isSalud = (): boolean => this.getCurrentRole() === 'Salud';
  public isRegulador = (): boolean => this.getCurrentRole() === 'Regulador';
}