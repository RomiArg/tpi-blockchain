import { Component, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { PharmaLedger } from './services/pharma-ledger';
import { finalize } from 'rxjs';
import { CommonModule, JsonPipe } from '@angular/common';

@Component({
  selector: 'app-root',
  imports: [JsonPipe, CommonModule, ReactiveFormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('front');
  crearForm: FormGroup;
  consultarForm: FormGroup;

  resultadoConsulta: any = null;
  resultadoHistorial: any = null;
  errorConsulta: string = '';
  loadingConsulta: boolean = false;

  resultadoCreacion: any = null;
  errorCreacion: string = '';
  loadingCreacion: boolean = false;

  constructor(
    private fb: FormBuilder,
    private pharmaLedgerService: PharmaLedger
  ) {
    // Formulario para crear
    this.crearForm = this.fb.group({
      assetID: [`MED-${Date.now()}`, Validators.required],
      nombreComercial: ['MedicamentoOncologico-B', Validators.required],
      lote: ['LOTE-456', Validators.required],
      fechaFabricacion: ['2025-01-01T12:00:00Z', Validators.required],
      fechaVencimiento: ['2026-01-01T12:00:00Z', Validators.required],
    });

    // Formulario para consultar
    this.consultarForm = this.fb.group({
      assetID: ['', Validators.required],
    });
  }

  onCrearMedicamento() {
    if (this.crearForm.invalid) return;

    this.loadingCreacion = true;
    this.errorCreacion = '';
    this.resultadoCreacion = null;

    this.pharmaLedgerService.crearMedicamento(this.crearForm.value)
      .pipe(finalize(() => this.loadingCreacion = false))
      .subscribe({
        next: (res) => {
          this.resultadoCreacion = res;
          // Rellenar el campo de consulta con el ID recién creado
          this.consultarForm.patchValue({ assetID: res.assetID });
          // Generar un nuevo ID para el próximo
          this.crearForm.patchValue({ assetID: `MED-${Date.now()}` });
        },
        error: (err) => {
          this.errorCreacion = err.error?.error || err.message;
        }
      });
  }

  onConsultarActivo() {
    if (this.consultarForm.invalid) return;

    const id = this.consultarForm.value.assetID;
    this.loadingConsulta = true;
    this.errorConsulta = '';
    this.resultadoConsulta = null;
    this.resultadoHistorial = null;

    // Consulta de activo
    this.pharmaLedgerService.consultarActivo(id)
      .pipe(finalize(() => this.loadingConsulta = false))
      .subscribe({
        next: (res) => {
          this.resultadoConsulta = res;
        },
        error: (err) => {
          this.errorConsulta = err.error?.error || err.message;
        }
      });

    // Consulta de historial
    this.pharmaLedgerService.consultarHistorial(id).subscribe({
      next: (res) => {
        this.resultadoHistorial = res;
      }
    });
  }
}