// src/app/login/login.component.ts
import { Component } from '@angular/core';
import { AuthService, UserRole } from '../../servicios/auth.service'; // Asegúrate que la ruta sea correcta

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent {

  constructor(private authService: AuthService) { }

  loginAs(role: UserRole): void {
    if (role) {
      this.authService.login(role);
    }
  }
}