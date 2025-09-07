import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, shareReplay, catchError } from 'rxjs/operators';
import { Observable, throwError } from 'rxjs';
import { JobDescription } from '../models/job-description';

interface SearchResponse {
  searches: JobDescription[];
}

@Injectable({ providedIn: 'root' })
export class JobsService {
  private http = inject(HttpClient);

  private readonly url = 'https://dsg-api-test.k2-app.com/ats/search/all'

  /** Cached, shared stream of jobs (one network call, shared across subscribers). */
  readonly jobs$: Observable<JobDescription[]> = this.http.get<SearchResponse>(this.url).pipe(
    map(res => res?.searches ?? []),
    shareReplay({ bufferSize: 1, refCount: true }),
    catchError(err => {
      // Throw a clean error upstream
      return throwError(() => err);
    })
  );
}
