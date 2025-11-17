import { Component, OnInit, ViewChild } from '@angular/core';
import { Medicamento } from '../../interfaces/medicamento';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { Estado, EstadoMap } from '../../interfaces/estado'; 
import { MatDialog, MatDialogModule } from '@angular/material/dialog'; 
import { PharmaLedger } from '../../servicios/pharma-ledger';
import { finalize } from 'rxjs';
import { CrearMedicamento } from '../crear-medicamento/crear-medicamento';
import { VerHistorialMedicamento } from '../ver-historial-medicamento/ver-historial-medicamento';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { CommonModule } from '@angular/common'; 
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar'; 

@Component({
  selector: 'app-medicamentos',
  standalone: true,
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
  ],
  templateUrl: './medicamentos.html',
  styleUrl: './medicamentos.css',
})
export class Medicamentos implements OnInit {
  cargando: boolean = true; 
  estadoMap = EstadoMap;
  estado = Estado; 

  // --- Configuración de la Tabla ---
  columnas: string[] = ['assetID', 'nombreComercial', 'lote', 'estadoActual', 'propietarioActual', 'actions'];
  medicamentos = new MatTableDataSource<Medicamento>([]);

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private pharmaService: PharmaLedger,
    public dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    // Cargar la lista al iniciar
    this.onConsultarTodos();
  }

  onConsultarTodos(): void {
    this.cargando = true;
    this.pharmaService.consultarTodos()
      .pipe(finalize(() => this.cargando = false))
      .subscribe({
        next: (res) => {
          this.medicamentos.data = res;
          this.medicamentos.paginator = this.paginator;
          this.medicamentos.sort = this.sort;
        },
        error: (err) => {
          console.error('Error al cargar la lista', err);
          this.snackBar.open(`Error al cargar medicamentos: ${err.message}`, 'Cerrar', { duration: 5000 });
        }
      });
  }

  // --- Funciones de Diálogos ---

  openCreateDialog(): void {
    const dialogRef = this.dialog.open(CrearMedicamento, {
      width: '500px',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      // Si el diálogo se cerró con éxito (no solo 'cancelar')
      if (result) { 
        this.onConsultarTodos();
      }
    });
  }

  openHistoryDialog(medicamento: Medicamento): void {
    this.dialog.open(VerHistorialMedicamento, {
      width: '700px',
      data: medicamento
    });
  }

  /**
   * Llama al servicio para TRANSFERIR un activo.
   * La lógica decide a quién transferirlo basado en el estado actual.
   */
  onTransferir(medicamento: Medicamento): void {
    let nuevoPropietarioMSPID = '';

    if (medicamento.estadoActual === Estado.CREADO) {
      nuevoPropietarioMSPID = 'Org1MSP'; // Org1 transfiere (Laboratorio)
    } else if (medicamento.estadoActual === Estado.ALMACENADO_LOGISTICA) {
      nuevoPropietarioMSPID = 'Org2MSP'; // Org2 recibe (Salud)
    } else {
      this.snackBar.open('Error: El activo no está en un estado válido para transferir.', 'Cerrar', { duration: 3000 });
      return;
    }
    
    this.cargando = true;
    this.pharmaService.transferir(medicamento.assetID, nuevoPropietarioMSPID)
      .pipe(finalize(() => this.onConsultarTodos())) 
      .subscribe({
        next: () => this.snackBar.open(`Activo ${medicamento.assetID} transferido a ${nuevoPropietarioMSPID}`, 'OK', { duration: 3000 }),
        error: (err) => this.snackBar.open(`Error al transferir: ${err.error?.error || err.message}`, 'Cerrar', { duration: 5000 })
      });
  }

  /**
   * Llama al servicio para RECIBIR un activo.
   * La lógica decide la ubicación basada en el estado actual.
   */
  onRecibir(medicamento: Medicamento): void {
    let ubicacion = '';

    if (medicamento.estadoActual === Estado.EN_TRANSITO_LAB_A_LOGISTICA) {
      ubicacion = 'Centro de Distribución'; // Ubicación para OrgLogistica
    } else if (medicamento.estadoActual === Estado.EN_TRANSITO_LOGISTICA_A_SALUD) {
      ubicacion = 'Farmacia Hospital'; // Ubicación para OrgSalud
    } else {
      this.snackBar.open('Error: El activo no está en un estado válido para recibir.', 'Cerrar', { duration: 3000 });
      return;
    }

    this.cargando = true;
    this.pharmaService.recibir(medicamento.assetID, ubicacion)
      .pipe(finalize(() => this.onConsultarTodos()))
      .subscribe({
        next: () => this.snackBar.open(`Activo ${medicamento.assetID} recibido en ${ubicacion}`, 'OK', { duration: 3000 }),
        error: (err) => this.snackBar.open(`Error al recibir: ${err.error?.error || err.message}`, 'Cerrar', { duration: 5000 })
      });
  }

  /**
   * Llama al servicio para DESPACHAR un activo a un paciente.
   */
  onDespachar(medicamento: Medicamento): void {
    // Pedimos al usuario (ej. farmacéutico) el ID del paciente
    const idPaciente = prompt('Ingrese el ID/Identificador del Paciente:', 'PACIENTE-001');
    
    if (!idPaciente) { // Si el usuario presiona "cancelar"
      this.snackBar.open('Despacho cancelado.', 'Cerrar', { duration: 2000 });
      return;
    }

    this.cargando = true;
    this.pharmaService.despachar(medicamento.assetID, idPaciente)
      .pipe(finalize(() => this.onConsultarTodos()))
      .subscribe({
        next: () => this.snackBar.open(`Activo ${medicamento.assetID} despachado a ${idPaciente}`, 'OK', { duration: 3000 }),
        error: (err) => this.snackBar.open(`Error al despachar: ${err.error?.error || err.message}`, 'Cerrar', { duration: 5000 })
      });
  }
}