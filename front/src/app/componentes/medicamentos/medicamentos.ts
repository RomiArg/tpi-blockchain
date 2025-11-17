// src/app/components/medicamentos/medicamentos.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { finalize, Subscription } from 'rxjs';
import { PharmaLedgerService } from '../../servicios/pharma-ledger';
import { VerHistorialMedicamento } from '../ver-historial-medicamento/ver-historial-medicamento';
import { Medicamento } from '../../interfaces/medicamento';
import { AuthService } from '../../servicios/auth.service';
import { Estado } from '../../interfaces/estado';
import { UserRole } from '../../servicios/auth.service';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CrearMedicamento } from '../crear-medicamento/crear-medicamento';

@Component({
  selector: 'app-medicamentos',
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSortModule,
    MatPaginatorModule,
    MatDialogModule, 
    MatSnackBarModule, 
    MatTooltipModule
  ],
  templateUrl: './medicamentos.html',
  styleUrls: ['./medicamentos.css']
})
export class MedicamentosComponent implements OnInit, OnDestroy {

  cargando = true;
  dataSource: Medicamento[] = [];
  displayedColumns: string[] = ['assetID', 'nombreComercial', 'lote', 'estadoActual', 'propietarioActualID', 'ubicacionActual', 'acciones'];

  currentRole: UserRole = null;
  isLaboratorio = false;
  isLogistica = false;
  isSalud = false;
  isRegulador = false;
  private roleSubscription: Subscription | undefined;

  constructor(
    private pharmaService: PharmaLedgerService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private router: Router,
    public authService: AuthService // <-- (SOLUCIÓN 1: Inyectar AuthService)
  ) {}

ngOnInit(): void {
    this.roleSubscription = this.authService.currentRole$.subscribe(role => {
      this.currentRole = role;
      this.isLaboratorio = (role === 'Laboratorio');
      this.isLogistica = (role === 'Logistica');
      this.isSalud = (role === 'Salud');
      this.isRegulador = (role === 'Regulador');

      if (!role) {
        this.router.navigate(['/']);
      }
    });
    this.onConsultarTodos();
  }

  ngOnDestroy(): void {
    if (this.roleSubscription) {
      this.roleSubscription.unsubscribe();
    }
  }

  onConsultarTodos(): void {
    this.cargando = true;
    this.pharmaService.getAllMedicamentos()
      .pipe(finalize(() => this.cargando = false))
      .subscribe({
        next: (data) => {
          this.dataSource = data;
        },
        error: (err) => this.showError(err) // Ahora 'showError' existe
      });
  }

onTransferir(medicamento: Medicamento): void {
    // (MODIFICADO) Ahora usamos Roles de negocio
    let nuevoPropietarioRole: UserRole = null;
    
    if (medicamento.estadoActual === Estado.CREADO) {
      nuevoPropietarioRole = 'Logistica'; // <-- El rol de destino
    } else if (medicamento.estadoActual === Estado.ALMACENADO_LOGISTICA) {
      nuevoPropietarioRole = 'Salud'; // <-- El rol de destino
    } else {
      this.snackBar.open('Error: El activo no está en un estado válido para transferir.', 'Cerrar', { duration: 3000 });
      return;
    }

    if (!nuevoPropietarioRole) return; // Seguridad

    this.cargando = true;
    // (MODIFICADO) Obtenemos el Rol del actor que firma
    const actorRole = this.authService.getCurrentRole(); 
    if (!actorRole) return; // Seguridad

    // (MODIFICADO) Llamamos a la nueva función del servicio
    this.pharmaService.transferir(medicamento.assetID, nuevoPropietarioRole, actorRole)
      .pipe(finalize(() => this.onConsultarTodos()))
      .subscribe({
        next: () => this.snackBar.open(`Activo ${medicamento.assetID} transferido a ${nuevoPropietarioRole}`, 'OK', { duration: 3000 }),
        error: (err) => this.showError(err)
      });
  }

  onRecibir(medicamento: Medicamento): void {
    let ubicacion = '';
    
    if (medicamento.estadoActual === Estado.EN_TRANSITO_LAB_A_LOGISTICA) {
      ubicacion = 'Centro de Distribución';
    } else if (medicamento.estadoActual === Estado.EN_TRANSITO_LOGISTICA_A_SALUD) {
      ubicacion = 'Farmacia Hospital';
    } else {
      this.snackBar.open('Error: El activo no está en un estado válido para recibir.', 'Cerrar', { duration: 3000 });
      return;
    }

    this.cargando = true;
    // (MODIFICADO) Obtenemos el Rol del actor que firma
    const actorRole = this.authService.getCurrentRole();
    if (!actorRole) return; // Seguridad

    // (MODIFICADO) Llamamos a la nueva función del servicio
    this.pharmaService.recibir(medicamento.assetID, ubicacion, actorRole)
      .pipe(finalize(() => this.onConsultarTodos()))
      .subscribe({
        next: () => this.snackBar.open(`Activo ${medicamento.assetID} recibido en ${ubicacion}`, 'OK', { duration: 3000 }),
        error: (err) => this.showError(err)
      });
  }

  onDespachar(medicamento: Medicamento): void {
    const idPaciente = prompt('Ingrese el ID/Identificador del Paciente:', 'PACIENTE-001');
    if (!idPaciente) {
      this.snackBar.open('Acción cancelada', 'Cerrar', { duration: 2000 });
      return;
    }

    this.cargando = true;
    // (MODIFICADO) Obtenemos el Rol del actor que firma
    const actorRole = this.authService.getCurrentRole();
    if (!actorRole) return; // Seguridad

    // (MODIFICADO) Llamamos a la nueva función del servicio
    this.pharmaService.despachar(medicamento.assetID, idPaciente, actorRole)
      .pipe(finalize(() => this.onConsultarTodos()))
      .subscribe({
        next: () => this.snackBar.open(`Activo ${medicamento.assetID} despachado a ${idPaciente}`, 'OK', { duration: 3000 }),
        error: (err) => this.showError(err)
      });
  }

  // --- Lógica de Navegación ---
  // (MODIFICADO) onVerHistorial debe pasar el objeto completo
  onVerHistorial(medicamento: Medicamento): void {
    this.dialog.open(VerHistorialMedicamento, {
      width: '80%',
      data: medicamento // <-- Pasa el objeto completo
    });
  }
  
irACrear(): void {
  const dialogRef = this.dialog.open(CrearMedicamento, {
    width: '80%',
  });

  dialogRef.afterClosed().subscribe((resultado) => {
    // Si el resultado es exitoso (puedes ajustar la condición según tu lógica)
    if (resultado === 'creado') {
      this.onConsultarTodos();
    }
  });
}

  onLogout(): void {
    this.authService.logout();
  }

  // --- Helpers de Visibilidad (Tu lógica aquí es correcta) ---

  showTransferir(med: Medicamento): boolean {
    console.log(this.isLaboratorio, med.estadoActual, this.isLogistica, Estado.CREADO);
    if (this.isLaboratorio && med.estadoActual === Estado.CREADO) return true;
    if (this.isLogistica && med.estadoActual === Estado.ALMACENADO_LOGISTICA) return true;
    return false;
  }

  showRecibir(med: Medicamento): boolean {
    if (this.isLogistica && med.estadoActual === Estado.EN_TRANSITO_LAB_A_LOGISTICA) return true;
    if (this.isSalud && med.estadoActual === Estado.EN_TRANSITO_LOGISTICA_A_SALUD) return true;
    return false;
  }

  showDespachar(med: Medicamento): boolean {
    return this.isSalud && med.estadoActual === Estado.RECIBIDO_SALUD;
  }

  // --- Helpers de UI (Estilos) ---
  
  /**
   * (SOLUCIÓN 2: Añadir la función 'showError' que faltaba)
   */
  private showError(err: any): void {
    console.error(err);
    this.snackBar.open(`Error: ${err.error?.error || err.message || 'Error desconocido'}`, 'Cerrar', { duration: 5000 });
  }

  getEstadoClass(estado: Estado): string {
    switch (estado) {
      case Estado.CREADO: return 'bg-primary';
      case Estado.EN_TRANSITO_LAB_A_LOGISTICA: return 'bg-warning text-dark';
      case Estado.ALMACENADO_LOGISTICA: return 'bg-info text-dark';
      case Estado.EN_TRANSITO_LOGISTICA_A_SALUD: return 'bg-warning text-dark';
      case Estado.RECIBIDO_SALUD: return 'bg-success';
      case Estado.DESPACHADO_PACIENTE: return 'bg-secondary';
      default: return 'bg-light text-dark';
    }
  }

  getPropietarioNombre(id: string): string {
  switch (id) {
    case 'Admin@org1.example.com': return 'Laboratorio';
    case 'Admin@org2.example.com': return 'Logistica';
    case 'User1@org2.example.com': return 'Hospital';
    default: return id;
  }
}

estadoNombre(estado: string): string {
  switch (estado) {
    case 'CREADO': return 'Creado';
    case 'EN_TRANSITO_LAB_A_LOGISTICA': return 'En tránsito a Logística';
    case 'ALMACENADO_LOGISTICA': return 'Almacenado en Logística';
    case 'EN_TRANSITO_LOGISTICA_A_SALUD': return 'En tránsito a Hospital';
    case 'RECIBIDO_SALUD': return 'Recibido en Hospital';
    case 'DESPACHADO_PACIENTE': return 'Despachado a Paciente';
    default: return estado;
  }
}


  getRoleClass(): string {
    switch (this.currentRole) {
      case 'Laboratorio': return 'bg-primary';
      case 'Logistica': return 'bg-info text-dark';
      case 'Salud': return 'bg-success';
      case 'Regulador': return 'bg-secondary';
      default: return 'bg-light text-dark';
    }
  }
  
  getRoleIcon(): string {
     switch (this.currentRole) {
      case 'Laboratorio': return 'fas fa-flask';
      case 'Logistica': return 'fas fa-truck';
      case 'Salud': return 'fas fa-hospital';
      case 'Regulador': return 'fas fa-clipboard-check';
      default: return 'fas fa-question-circle';
    }
  }
}