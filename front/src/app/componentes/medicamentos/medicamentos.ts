import { Component, OnInit, ViewChild } from '@angular/core';
import { Medicamento } from '../../interfaces/medicamento';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { EstadoMap } from '../../interfaces/estado';
import { MatDialog } from '@angular/material/dialog';
import { PharmaLedger } from '../../servicios/pharma-ledger';
import { finalize } from 'rxjs';
import { CrearMedicamento } from '../crear-medicamento/crear-medicamento';
import { VerHistorialMedicamento } from '../ver-historial-medicamento/ver-historial-medicamento';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-medicamentos',
  standalone: true,
  imports: [
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSortModule,
    MatPaginatorModule
  ],
  templateUrl: './medicamentos.html',
  styleUrl: './medicamentos.css',
})
export class Medicamentos implements OnInit {
  cargando: boolean = false;
  estadoMap = EstadoMap;

  // --- Configuración de la Tabla ---
  columnas: string[] = ['assetID', 'nombreComercial', 'lote', 'estadoActual', 'propietarioActual', 'actions'];
  medicamentos = new MatTableDataSource<Medicamento>([]);

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private pharmaService: PharmaLedger,
    public dialog: MatDialog
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
}
