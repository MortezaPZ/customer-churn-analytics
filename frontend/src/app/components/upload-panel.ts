import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Algorithm, Dataset } from '../core/models';

export interface TrainRequest {
  datasetId: number;
  algorithm: Algorithm;
}

const ALGORITHMS: { value: Algorithm; label: string }[] = [
  { value: 'gradient_boosting', label: 'Gradient Boosting' },
  { value: 'random_forest', label: 'Random Forest' },
  { value: 'logistic_regression', label: 'Logistic Regression' },
];

@Component({
  selector: 'app-upload-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <div class="panel">
      <div class="row">
        <label class="field">
          <span class="field__label">Customer CSV</span>
          <input
            type="file"
            accept=".csv"
            [disabled]="busy()"
            (change)="onFileChosen($event)"
          />
        </label>

        <label class="field field--narrow">
          <span class="field__label">Target column</span>
          <input type="text" [(ngModel)]="targetColumn" [disabled]="busy()" />
        </label>

        <label class="field field--narrow">
          <span class="field__label">Model</span>
          <select [(ngModel)]="algorithm" [disabled]="busy()">
            @for (option of algorithms; track option.value) {
              <option [value]="option.value">{{ option.label }}</option>
            }
          </select>
        </label>

        <button
          type="button"
          class="primary"
          [disabled]="!datasets().length || busy()"
          (click)="requestTrain()"
        >
          {{ busy() ? 'Working…' : 'Train model' }}
        </button>
      </div>

      @if (datasets().length) {
        <label class="field">
          <span class="field__label">Dataset</span>
          <select [(ngModel)]="selectedId" [disabled]="busy()">
            @for (dataset of datasets(); track dataset.id) {
              <option [value]="dataset.id">
                {{ dataset.name }} — {{ dataset.row_count }} rows,
                {{ (dataset.churn_rate * 100).toFixed(1) }}% churn
              </option>
            }
          </select>
        </label>
      }

      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
    </div>
  `,
  styles: `
    .panel {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    /* Filters sit in one row above the charts. */
    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 14px;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 5px;
      min-width: 0;
    }
    /* Scoped to the row: in the column-direction panel a flex-basis would be
       read as a height and stretch the field. */
    .row > .field {
      flex: 1 1 220px;
    }
    .row > .field--narrow {
      flex: 0 1 180px;
    }
    .field__label {
      font-size: 11px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-muted);
    }
    input,
    select {
      font: inherit;
      font-size: 13px;
      padding: 8px 10px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--page-plane);
      color: var(--text-primary);
      min-width: 0;
    }
    input:focus-visible,
    select:focus-visible {
      outline: 2px solid var(--series-1);
      outline-offset: 1px;
    }
    .primary {
      background: var(--series-1);
      color: #ffffff;
      border: none;
      border-radius: 6px;
      padding: 9px 20px;
      font-size: 13px;
      font-weight: 500;
      white-space: nowrap;
    }
    .primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .error {
      margin: 0;
      font-size: 13px;
      color: var(--status-critical);
    }
  `,
})
export class UploadPanel {
  readonly datasets = input.required<Dataset[]>();
  readonly busy = input(false);
  readonly error = input<string>('');

  readonly upload = output<{ file: File; targetColumn: string }>();
  readonly train = output<TrainRequest>();

  protected readonly algorithms = ALGORITHMS;
  protected targetColumn = 'Churn';
  protected algorithm: Algorithm = 'gradient_boosting';

  private chosenId: number | null = null;

  /** Falls back to the newest dataset so the picker is never blank. */
  protected get selectedId(): number | null {
    return this.chosenId ?? this.datasets()[0]?.id ?? null;
  }

  protected set selectedId(value: number | null) {
    this.chosenId = value === null ? null : Number(value);
  }

  protected onFileChosen(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.upload.emit({ file, targetColumn: this.targetColumn });
    }
    // Let the same file be re-selected after a failed upload.
    input.value = '';
  }

  protected requestTrain(): void {
    const datasetId = Number(this.selectedId);
    if (datasetId) {
      this.train.emit({ datasetId, algorithm: this.algorithm });
    }
  }
}
