import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class PharmaLedger {
  private apiUrl = '/api';

  constructor(private http: HttpClient) {}

  consultarActivo(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/medicamentos/${id}`);
  }

  consultarHistorial(id: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/medicamentos/${id}/historial`);
  }

  crearMedicamento(data: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/medicamentos`, data);
  }
}