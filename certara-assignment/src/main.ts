import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { AppComponent } from './app/app.component';
import 'zone.js';

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(),
    provideCharts(withDefaultRegisterables()),
  ],
}).catch(err => console.error(err));