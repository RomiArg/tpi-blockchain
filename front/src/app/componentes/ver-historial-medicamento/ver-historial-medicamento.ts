import { Component, Inject, OnInit } from '@angular/core';
import { finalize, Observable } from 'rxjs';
import { HistorialMedicamento } from '../../interfaces/historial-medicamento';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { PharmaLedgerService } from '../../servicios/pharma-ledger';
import { Medicamento } from '../../interfaces/medicamento';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatListModule } from '@angular/material/list';
import { MatCardModule } from '@angular/material/card';
import { AsyncPipe, DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Estado } from '../../interfaces/estado';

@Component({
  selector: 'app-ver-historial-medicamento',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatListModule,
    MatCardModule,
    DatePipe,
    AsyncPipe,
    MatIconModule
  ],
  templateUrl: './ver-historial-medicamento.html',
  styleUrl: './ver-historial-medicamento.css',
})
export class VerHistorialMedicamento implements OnInit {
  historial!: Observable<HistorialMedicamento[]>;
  cargando: boolean = true;
  estado = Estado;

  constructor(
    public dialogRef: MatDialogRef<VerHistorialMedicamento>,
    @Inject(MAT_DIALOG_DATA) public data: Medicamento,
    private pharmaService: PharmaLedgerService
  ) { }

  ngOnInit(): void {
    // Buscamos el historial en cuanto se abre el diálogo
    this.historial = this.pharmaService.getHistorial(this.data.assetID)
      .pipe(finalize(() => this.cargando = false));
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

  onClose(): void {
    this.dialogRef.close();
  }
}
