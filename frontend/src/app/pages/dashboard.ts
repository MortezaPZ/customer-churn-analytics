import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ConfusionMatrix } from '../components/confusion-matrix';
import { FeatureImportanceChart } from '../components/feature-importance-chart';
import { PredictionsTable } from '../components/predictions-table';
import { RiskSegments } from '../components/risk-segments';
import { RocCurveChart } from '../components/roc-curve-chart';
import { StatTile } from '../components/stat-tile';
import { TrainRequest, UploadPanel } from '../components/upload-panel';
import { ApiService } from '../core/api.service';
import { Dataset, PredictionRow, SegmentReport, TrainingRun } from '../core/models';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ConfusionMatrix,
    FeatureImportanceChart,
    PredictionsTable,
    RiskSegments,
    RocCurveChart,
    StatTile,
    UploadPanel,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly api = inject(ApiService);

  protected readonly datasets = signal<Dataset[]>([]);
  protected readonly run = signal<TrainingRun | null>(null);
  protected readonly segments = signal<SegmentReport | null>(null);
  protected readonly predictions = signal<PredictionRow[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  /** Seeded from the OS so the first toggle actually changes something. */
  protected readonly theme = signal<'light' | 'dark'>(
    window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  );

  protected readonly hasRun = computed(() => this.run()?.status === 'completed');

  protected readonly recallCaption = computed(() => {
    const recall = this.run()?.recall;
    if (recall === null || recall === undefined) return '';
    return `catches ${(recall * 100).toFixed(0)}% of churners`;
  });

  constructor() {
    this.loadDatasets();
  }

  protected toggleTheme(): void {
    const next = this.theme() === 'light' ? 'dark' : 'light';
    this.theme.set(next);
    document.documentElement.setAttribute('data-theme', next);
  }

  protected onUpload({ file, targetColumn }: { file: File; targetColumn: string }): void {
    this.busy.set(true);
    this.error.set('');
    this.api.uploadDataset(file, targetColumn).subscribe({
      next: (dataset) => {
        this.datasets.update((current) => [dataset, ...current]);
        this.busy.set(false);
      },
      error: (err) => this.fail(err),
    });
  }

  protected onTrain({ datasetId, algorithm }: TrainRequest): void {
    this.busy.set(true);
    this.error.set('');
    this.api.train(datasetId, algorithm).subscribe({
      next: (run) => {
        this.run.set(run);
        this.loadRunDetail(run.id);
      },
      error: (err) => this.fail(err),
    });
  }

  private loadDatasets(): void {
    this.api.listDatasets().subscribe({
      next: (page) => this.datasets.set(page.results),
      error: (err) => this.fail(err),
    });
  }

  private loadRunDetail(runId: number): void {
    this.api.getSegments(runId).subscribe({
      next: (report) => this.segments.set(report),
      error: (err) => this.fail(err),
    });
    this.api.getPredictions(runId, 50).subscribe({
      next: (page) => {
        this.predictions.set(page.results);
        this.busy.set(false);
      },
      error: (err) => this.fail(err),
    });
  }

  private fail(err: HttpErrorResponse): void {
    this.busy.set(false);
    this.error.set(
      err.error?.detail ??
        err.error?.file?.[0] ??
        'Something went wrong. Is the API running on port 8000?',
    );
  }

  protected percent(value: number | null | undefined): string {
    return value === null || value === undefined ? '—' : `${(value * 100).toFixed(1)}%`;
  }

  protected decimal(value: number | null | undefined): string {
    return value === null || value === undefined ? '—' : value.toFixed(3);
  }
}
