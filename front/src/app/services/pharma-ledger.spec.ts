import { TestBed } from '@angular/core/testing';

import { PharmaLedger } from './pharma-ledger';

describe('PharmaLedger', () => {
  let service: PharmaLedger;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PharmaLedger);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
