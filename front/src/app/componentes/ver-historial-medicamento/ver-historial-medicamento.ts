import { Component, Inject, OnInit } from '@angular/core';
import { finalize, Observable } from 'rxjs';
import { HistorialMedicamento } from '../../interfaces/historial-medicamento';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { EstadoMap } from '../../interfaces/estado';
import { PharmaLedger } from '../../servicios/pharma-ledger';
import { Medicamento } from '../../interfaces/medicamento';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatListModule } from '@angular/material/list';
import { MatCardModule } from '@angular/material/card';
import { AsyncPipe, DatePipe } from '@angular/common';

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
    AsyncPipe
  ],
  templateUrl: './ver-historial-medicamento.html',
  styleUrl: './ver-historial-medicamento.css',
})
export class VerHistorialMedicamento implements OnInit {
  historial!: Observable<HistorialMedicamento[]>;
  cargando: boolean = true;
  estadoMap = EstadoMap;

  constructor(
    public dialogRef: MatDialogRef<VerHistorialMedicamento>,
    @Inject(MAT_DIALOG_DATA) public data: Medicamento,
    private pharmaService: PharmaLedger
  ) { }

  ngOnInit(): void {
    // Buscamos el historial en cuanto se abre el diálogo
    this.historial = this.pharmaService.consultarHistorial(this.data.assetID)
      .pipe(finalize(() => this.cargando = false));
  }

  onClose(): void {
    this.dialogRef.close();
  }
}
