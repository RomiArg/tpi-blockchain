import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VerHistorialMedicamento } from './ver-historial-medicamento';

describe('VerHistorialMedicamento', () => {
  let component: VerHistorialMedicamento;
  let fixture: ComponentFixture<VerHistorialMedicamento>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VerHistorialMedicamento]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VerHistorialMedicamento);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
