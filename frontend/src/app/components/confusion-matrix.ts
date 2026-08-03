import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

interface Cell {
  label: string;
  count: number;
  share: number;
  step: string;
  ink: string;
  meaning: string;
}

/**
 * The 2x2 outcome grid, shaded on the sequential blue ramp. Counts are printed
 * in every cell, so the shading is reinforcement rather than the only encoding.
 */
@Component({
  selector: 'app-confusion-matrix',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="chart">
      <figcaption>
        <div class="card__title">Confusion matrix</div>
        <div class="card__subtitle">Holdout set — where the model was right and wrong</div>
      </figcaption>

      @if (cells().length) {
        <div class="grid">
          <div class="corner"></div>
          <div class="head">Predicted stay</div>
          <div class="head">Predicted churn</div>

          <div class="side">Actually stayed</div>
          @for (cell of cells().slice(0, 2); track cell.label) {
            <div
              class="cell"
              [style.background]="cell.step"
              [style.color]="cell.ink"
              [title]="cell.meaning"
            >
              <span class="cell__count tabular">{{ cell.count }}</span>
              <span class="cell__share tabular">{{ (cell.share * 100).toFixed(1) }}%</span>
            </div>
          }

          <div class="side">Actually churned</div>
          @for (cell of cells().slice(2); track cell.label) {
            <div
              class="cell"
              [style.background]="cell.step"
              [style.color]="cell.ink"
              [title]="cell.meaning"
            >
              <span class="cell__count tabular">{{ cell.count }}</span>
              <span class="cell__share tabular">{{ (cell.share * 100).toFixed(1) }}%</span>
            </div>
          }
        </div>

        <p class="note">
          Bottom-left is the expensive quadrant: churners the model let through.
        </p>
      } @else {
        <p class="empty">Train a model to see its confusion matrix.</p>
      }
    </figure>
  `,
  styles: `
    .chart {
      margin: 0;
    }
    .grid {
      display: grid;
      grid-template-columns: auto 1fr 1fr;
      gap: 2px; /* the 2px surface gap between adjacent fills */
    }
    .head,
    .side {
      font-size: 11px;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 6px;
    }
    .side {
      justify-content: flex-end;
      text-align: right;
      padding-right: 10px;
    }
    .cell {
      border-radius: 6px;
      padding: 16px 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    }
    .cell__count {
      font-size: 20px;
      font-weight: 600;
    }
    .cell__share {
      font-size: 11px;
      opacity: 0.85;
    }
    .note {
      font-size: 12px;
      color: var(--text-secondary);
      margin: 12px 0 0;
    }
    .empty {
      color: var(--text-secondary);
      font-size: 13px;
    }
  `,
})
export class ConfusionMatrix {
  readonly matrix = input.required<number[][]>();

  protected readonly cells = computed<Cell[]>(() => {
    const rows = this.matrix();
    if (!rows?.length || rows.length < 2) return [];

    const [[trueNegative, falsePositive], [falseNegative, truePositive]] = rows;
    const total = trueNegative + falsePositive + falseNegative + truePositive || 1;
    const peak = Math.max(trueNegative, falsePositive, falseNegative, truePositive);

    const entries: [string, number, string][] = [
      ['TN', trueNegative, 'Correctly kept: predicted to stay, and stayed'],
      ['FP', falsePositive, 'False alarm: predicted to churn, but stayed'],
      ['FN', falseNegative, 'Missed churner: predicted to stay, but left'],
      ['TP', truePositive, 'Caught churner: predicted to churn, and left'],
    ];

    return entries.map(([label, count, meaning]) => {
      const step = this.rampStep(peak ? count / peak : 0);
      return {
        label,
        count,
        meaning,
        share: count / total,
        step: `var(--seq-${step})`,
        // Legibility follows the step, not the mode - the ink token already
        // knows which way the ramp runs on the current surface.
        ink: `var(--ink-on-seq-${step})`,
      };
    });
  });

  /** Snap a 0-1 intensity onto the documented sequential steps. */
  private rampStep(intensity: number): number {
    if (intensity > 0.8) return 700;
    if (intensity > 0.55) return 550;
    if (intensity > 0.3) return 400;
    if (intensity > 0.1) return 250;
    return 100;
  }
}
