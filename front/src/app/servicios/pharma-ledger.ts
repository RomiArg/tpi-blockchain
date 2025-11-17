import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class PharmaLedger {
  // Dejamos la URL base como /api para que use el proxy de Angular
  private apiUrl = '/api'; 

  constructor(private http: HttpClient) {}

  consultarTodos(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/medicamentos`);
  }

  consultarActivo(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/medicamentos/${id}`);
  }

  consultarHistorial(id: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/medicamentos/${id}/historial`);
  }

  crearMedicamento(data: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/medicamentos`, data);
  }

  // --- NUEVAS FUNCIONES AÑADIDAS ---

  /**
   * Llama al endpoint de la API para transferir un medicamento
   * (Usado por Laboratorio y Logística)
   */
  transferir(id: string, nuevoPropietarioMSPID: string): Observable<any> {
    const body = { nuevoPropietarioMSPID };
    return this.http.put<any>(`${this.apiUrl}/medicamentos/${id}/transferir`, body);
  }

  /**
   * Llama al endpoint de la API para recibir un medicamento
   * (Usado por Logística y Salud)
   */
  recibir(id: string, ubicacion: string): Observable<any> {
    const body = { ubicacion };
    return this.http.put<any>(`${this.apiUrl}/medicamentos/${id}/recibir`, body);
  }

  /**
   * Llama al endpoint de la API para despachar un medicamento a un paciente
   * (Usado solo por Salud)
   */
  despachar(id: string, idPaciente: string): Observable<any> {
    const body = { idPaciente };
    return this.http.post<any>(`${this.apiUrl}/medicamentos/${id}/despachar`, body);
  }
}