import { CommonModule } from '@angular/common';
import { provideZonelessChangeDetection } from '@angular/core';
import { Directive } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AppComponent } from './app.component';
import { JobsService } from './services/jobs.service';

@Directive({ selector: 'canvas[baseChart]' })
class FakeBaseChartDirective {}

class JobsServiceStub {
  jobs$ = of([]);
}

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: JobsService, useClass: JobsServiceStub },
      ],
    })
      .overrideComponent(AppComponent, {
        set: { imports: [CommonModule, FakeBaseChartDirective] },
      })
      .compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render title', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('h1')?.textContent).toContain('Job Postings');
  });
});
