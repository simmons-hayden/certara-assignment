import { Component, OnInit, ViewChild, inject, DestroyRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartEvent, ChartOptions, ActiveElement } from 'chart.js';
import { JobsService } from './services/jobs.service';
import { JobDescription } from './models/job-description';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

/* Chart colors (mirror CSS tokens) */
const ACCENT = '#7c3aed';
const ACCENT_BG   = '#7C3AEDB2';
const ACCENT_HOVER= '#7C3AEDE6';
const GRID_MUTED  = '#64748B33';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
  /* Dependency inection */
  private readonly jobsService = inject(JobsService);
  private readonly destroyRef = inject(DestroyRef);

  /* Chart ref for possible updates */
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;

  /* Job data */
  jobs: JobDescription[] = [];
  groupedJobs: Record<string, JobDescription[]> = {};
  months: string[] = []; // all of sorted YYYY-MM keys

  /* Year tabination (for mobile) */
  years: string[] = [];
  yearMonths: Record<string, string[]> = {};
  activeYear: string | null = null;

  /* UI state */
  selectedMonth: string | null = null;

  /* Loading and hopefully avoiding flicker */
  loading = false;
  showLoadingUI = false;
  hasLoadedOnce = false;
  private loadingTimer: ReturnType<typeof setTimeout> | null = null;

  /* Skeletons */
  chartSkeletonBars = Array.from({ length: 12 });
  tableSkeletonRows = Array.from({ length: 8 });

  error: string | null = null;

  /* Chart */
  chartHeight = 320;  // fixed on desktop; computed on mobile
  private isMobile = false;

  barChartType: 'bar' = 'bar';
  barChartOptions: ChartOptions<'bar'> = {}; // built in computeResponsive()
  barChartData: ChartData<'bar', number[], string> = {
    labels: [],
    datasets: [{ data: [], label: 'Job Count' }],
  };

  /* Month label formatter ex. Jan 2025) */
  private readonly monthFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: 'numeric',
  });
  private formatMonthKey(key: string): string {
    const [y, m] = key.split('-').map(Number);
    return y && m ? this.monthFormatter.format(new Date(y, m - 1, 1)) : key;
  }

  /* Tick > label removed */
  private labelByTick(value: unknown, index: number): string {
    const labels = (this.barChartData.labels ?? []) as string[];
    if (typeof value === 'number' && labels[value] != null) return labels[value];
    if (typeof value === 'string') return value;
    return labels[index] ?? '';
  }

  /* Template convenience */
  get isMobileView(): boolean { return this.isMobile; }

  /* Lifecycle */
  ngOnInit(): void {
    this.computeResponsive(); // initialize options for current viewport
    this.fetchJobsViaService();
  }

  /* Recompute layout/options */
  @HostListener('window:resize')
  onResize(): void {
    this.computeResponsive();
  }

  /* Loading toggles with small delay to avoid flicker */
  private startLoading(): void {
    this.loading = true;
    if (this.loadingTimer) clearTimeout(this.loadingTimer);
    this.loadingTimer = setTimeout(() => { this.showLoadingUI = true; }, 150);
  }
  private stopLoading(): void {
    this.loading = false;
    if (this.loadingTimer) clearTimeout(this.loadingTimer);
    this.loadingTimer = null;
    this.showLoadingUI = false;
  }

  /* Fetch jobs and build chart/groups */
  private fetchJobsViaService(): void {
    this.startLoading();
    this.error = null;

    this.jobsService.jobs$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (jobs) => {
          this.jobs = jobs;
          this.groupJobsByMonth();
          this.setupChart();
          this.hasLoadedOnce = true;
          this.stopLoading();
        },
        error: (err) => {
          console.error(err);
          this.error = 'Failed to load jobs. Please try again.';
          this.stopLoading();
        },
      });
  }

  /* ISO -> "YYYY-MM" for grouping */
  private monthKeyOrNull(iso?: string | null): string | null {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  /* Group jobs by month key, then partition years */
  private groupJobsByMonth(): void {
    const grouped: Record<string, JobDescription[]> = {};
    for (const job of this.jobs) {
      const key = this.monthKeyOrNull(job?.websiteDatePublished);
      if (!key) continue;
      (grouped[key] ||= []).push(job);
    }
    this.groupedJobs = grouped;

    const months = Object.keys(this.groupedJobs).sort();
    this.months = months;

    const ymap: Record<string, string[]> = {};
    for (const m of months) {
      const y = m.slice(0, 4);
      (ymap[y] ||= []).push(m);
    }
    for (const y of Object.keys(ymap)) ymap[y].sort();

    this.yearMonths = ymap;
    this.years = Object.keys(ymap).sort(); // asc; latest is last

    if (!this.activeYear && this.years.length) {
      this.activeYear = this.years[this.years.length - 1];
    }
  }

  /* Build chart data for a set of months */
  private buildChartData(monthKeys: string[]): ChartData<'bar', number[], string> {
    const counts = monthKeys.map((m) => this.groupedJobs[m]?.length ?? 0);
    return {
      labels: monthKeys,
      datasets: [{
        data: counts,
        label: 'Job Count',
        backgroundColor: ACCENT_BG,
        hoverBackgroundColor: ACCENT_HOVER,
        borderColor: ACCENT,
      }],
    };
  }

  /* Build chart data + options; on mobile use the active year's months only */
  private setupChart(): void {
    const monthKeys = (this.isMobile && this.activeYear)
      ? (this.yearMonths[this.activeYear] ?? [])
      : this.months;

    this.barChartData = this.buildChartData(monthKeys);
    this.computeResponsive(); // sets axis, ticks, height based on current data
  }

  /* Flip to horizontal bars on mobile; rotate labels on desktop */
  private computeResponsive(): void {
    this.isMobile = typeof matchMedia !== 'undefined' && matchMedia('(max-width: 640px)').matches;

    const monthKeys = (this.isMobile && this.activeYear)
      ? (this.yearMonths[this.activeYear] ?? [])
      : this.months;

    const currentLabels = (this.barChartData.labels ?? []) as string[];
    const needRebuild = currentLabels.length !== monthKeys.length ||
                        currentLabels.some((l, i) => l !== monthKeys[i]);
    if (needRebuild) this.barChartData = this.buildChartData(monthKeys);

    // Height: dynamic only on mobile
    this.chartHeight = this.isMobile
      ? Math.max(220, 40 + Math.max(1, monthKeys.length) * (40 + 10))
      : 320;

    const mobileScales: ChartOptions<'bar'>['scales'] = {
      x: { beginAtZero: true, grid: { color: GRID_MUTED }, ticks: { stepSize: 1 } },
      y: {
        grid: { display: false },
        ticks: {
          autoSkip: false,
          callback: (value, index) => this.formatMonthKey(this.labelByTick(value, index as number)),
        },
      },
    };

    // Desktop: show all labels, rotated
    const desktopScales: ChartOptions<'bar'>['scales'] = {
      x: {
        grid: { display: false },
        offset: true,
        ticks: {
          source: 'labels',
          autoSkip: false,
          minRotation: 45,
          maxRotation: 60,
          padding: 6,
          font: { weight: 'bold' },
          callback: (value, index) =>
            this.formatMonthKey(this.labelByTick(value, index as number)),
        },
      },
      y: {
        beginAtZero: true,
        grid: { color: GRID_MUTED },
        ticks: { stepSize: 1 },
      },
    };

    this.barChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: this.isMobile ? 'y' : 'x',
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          intersect: false,
          mode: 'index',
          padding: 10,
          callbacks: {
            title: (items) => this.formatMonthKey(String(items?.[0]?.label ?? '')),
          },
        },
      },
      // extra bottom padding on desktop so rotated labels don’t clip
      layout: this.isMobile
        ? { padding: { left: 4, right: 8, top: 2, bottom: 2 } }
        : { padding: { left: 4, right: 8, top: 2, bottom: 26 } },
      scales: this.isMobile ? mobileScales : desktopScales,
      elements: { bar: { borderWidth: 1, borderRadius: 6, borderSkipped: false } },
    };

    const ds = this.barChartData.datasets?.[0] as any;
    if (ds) {
      if (this.isMobile) {
        ds.barThickness = 40;
        ds.maxBarThickness = 42;
        ds.categoryPercentage = 0.8;
        ds.barPercentage = 0.9;
      } else {
        ds.barThickness = undefined;
        ds.maxBarThickness = 28;
        ds.categoryPercentage = 0.9;
        ds.barPercentage = 0.9;
      }
    }

    this.chart?.update();
  }

  /* Change active year (mobile); drop month if it’s from another year */
  setActiveYear(year: string): void {
    if (year === this.activeYear) return;
    this.activeYear = year;

    if (this.selectedMonth && !this.selectedMonth.startsWith(`${year}-`)) {
      this.selectedMonth = null;
    }

    this.setupChart();
  }

  /* Chart click with some accessibility help */
  onChartClick(args: { event?: ChartEvent; active?: object[] }): void {
    const chart = this.chart?.chart;
    const ev = args.event?.native as MouseEvent | undefined;
    if (!chart || !ev) return;

    const hits = chart.getElementsAtEventForMode(ev, 'index', { intersect: false }, true) as ActiveElement[];
    if (!hits?.length) return;

    const idx = hits[0].index;
    const label = chart.data.labels?.[idx] as string | undefined;
    if (label) this.handleBarClick(label);
  }

  handleBarClick(month: string): void {
    this.selectedMonth = month;
  }

  /* Jobs table for selected month (sorted desc by publish date) */
  get jobsForSelectedMonth(): JobDescription[] {
    if (!this.selectedMonth) return [];
    const list = this.groupedJobs[this.selectedMonth] ?? [];
    return [...list].sort((a, b) => {
      const ta = new Date(a.websiteDatePublished ?? '').getTime();
      const tb = new Date(b.websiteDatePublished ?? '').getTime();
      return (isNaN(tb) ? 0 : tb) - (isNaN(ta) ? 0 : ta);
    });
  }

  /* Pretty month label for chip/table title */
  get selectedMonthPretty(): string | null {
    if (!this.selectedMonth) return null;
    return this.formatMonthKey(this.selectedMonth);
  }

  /* Whether we’re refetching while a month is selected (controls table skeleton) */
  get isRefetchingSelectedMonth(): boolean {
    return this.loading && !!this.selectedMonth && this.hasLoadedOnce;
  }
}
