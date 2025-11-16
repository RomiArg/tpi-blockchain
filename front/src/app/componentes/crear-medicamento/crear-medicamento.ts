import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { PharmaLedger } from '../../servicios/pharma-ledger';
import { MatSnackBar } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-crear-medicamento',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './crear-medicamento.html',
  styleUrl: './crear-medicamento.css',
})
export class CrearMedicamento {
  formulario: FormGroup;
  cargando: boolean = false;

  constructor(
    private fb: FormBuilder,
    private pharmaService: PharmaLedger,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<CrearMedicamento>
  ) {
    this.formulario = this.fb.group({
      assetID: [`MED-${Date.now()}`, Validators.required],
      nombreComercial: ['MedicamentoOncologico-C', Validators.required],
      lote: ['LOTE-789', Validators.required],
      fechaFabricacion: ['2025-01-01T12:00:00Z', Validators.required],
      fechaVencimiento: ['2026-01-01T12:00:00Z', Validators.required],
    });
  }

  onCrearMedicamento(): void {
    if (this.formulario.invalid) {
      return;
    }

    this.cargando = true;
    this.pharmaService.crearMedicamento(this.formulario.value)
      .pipe(finalize(() => this.cargando = false))
      .subscribe({
        next: (res) => {
          this.snackBar.open(`Medicamento ${res.assetID} creado con éxito`, 'Cerrar', { duration: 3000 });
          // Cierra el diálogo y devuelve el nuevo activo
          this.dialogRef.close()
        },
        error: (err) => {
          this.snackBar.open(`Error: ${err.error?.error || err.message}`, 'Cerrar', { duration: 5000 });
        }
      });
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
