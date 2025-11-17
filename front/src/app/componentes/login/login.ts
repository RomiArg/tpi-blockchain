import { Component } from '@angular/core';
import { AuthService, UserRole } from '../../servicios/auth.service';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    MatIconModule,
    MatCardModule,
    MatButtonModule
  ],
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