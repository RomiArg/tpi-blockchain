// src/app/services/pharma-ledger.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Medicamento } from '../interfaces/medicamento';
import { HistorialMedicamento } from '../interfaces/historial-medicamento';
import { UserRole } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class PharmaLedgerService {

  private apiUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) { }

  getAllMedicamentos(): Observable<Medicamento[]> {
    return this.http.get<Medicamento[]>(`${this.apiUrl}/medicamentos`);
  }

  getHistorial(id: string): Observable<HistorialMedicamento[]> {
    return this.http.get<HistorialMedicamento[]>(`${this.apiUrl}/medicamentos/${id}/historial`);
  }

  crearMedicamento(medData: any): Observable<any> {
    // La API de crear no necesita 'actorMSPID' en el body,
    // ya que el backend usa Org1 por defecto. Esto está bien.
    return this.http.post(`${this.apiUrl}/medicamentos`, medData);
  }

  /**
   * (MODIFICADO) Acepta 3 argumentos y pasa 'actorMSPID' al body
   */
  transferir(id: string, nuevoPropietarioRole: UserRole, actorRole: UserRole): Observable<any> {
    const body = {
      nuevoPropietarioRole: nuevoPropietarioRole,
      actorRole: actorRole
    };
    return this.http.put(`${this.apiUrl}/medicamentos/${id}/transferir`, body);
  }

  /**
   * (MODIFICADO) Acepta Rol, no MSPID
   */
  recibir(id: string, ubicacion: string, actorRole: UserRole): Observable<any> {
    const body = {
      ubicacion: ubicacion,
      actorRole: actorRole
    };
    return this.http.put(`${this.apiUrl}/medicamentos/${id}/recibir`, body);
  }

  /**
   * (MODIFICADO) Acepta Rol, no MSPID
   */
  despachar(id: string, idPaciente: string, actorRole: UserRole): Observable<any> {
    const body = {
      idPaciente: idPaciente,
      actorRole: actorRole
    };
    return this.http.post(`${this.apiUrl}/medicamentos/${id}/despachar`, body);
  }
}