import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { FeatureImportance } from '../core/models';

interface Bar {
  feature: string;
  importance: number;
  width: number;
  y: number;
  label: string;
}

const ROW_HEIGHT = 26;
const BAR_HEIGHT = 14;
const LABEL_WIDTH = 132;

/**
 * Ranked horizontal bars. One series, so no legend — the title names it, and
 * every bar is direct-labelled with its value.
 */
@Component({
  selector: 'app-feature-importance-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="chart">
      <figcaption>
        <div class="card__title">What drives churn</div>
        <div class="card__subtitle">
          Permutation importance — drop in ROC-AUC when the column is shuffled
        </div>
      </figcaption>

      @if (bars().length) {
        <svg
          [attr.viewBox]="'0 0 460 ' + height()"
          role="img"
          [attr.aria-label]="summary()"
          preserveAspectRatio="xMinYMin meet"
        >
          @for (bar of bars(); track bar.feature) {
            <g class="row">
              <text class="axis-label" [attr.x]="LABEL_WIDTH - 8" [attr.y]="bar.y + 11">
                {{ bar.feature }}
              </text>
              <rect
                class="bar"
                [attr.x]="LABEL_WIDTH"
                [attr.y]="bar.y"
                [attr.width]="bar.width"
                [attr.height]="BAR_HEIGHT"
                rx="4"
              >
                <title>{{ bar.feature }}: {{ bar.label }}</title>
              </rect>
              <text
                class="value"
                [attr.x]="LABEL_WIDTH + bar.width + 8"
                [attr.y]="bar.y + 11"
              >
                {{ bar.label }}
              </text>
            </g>
          }
          <line
            class="baseline"
            [attr.x1]="LABEL_WIDTH"
            y1="0"
            [attr.x2]="LABEL_WIDTH"
            [attr.y2]="height()"
          />
        </svg>
      } @else {
        <p class="empty">Train a model to see which columns matter.</p>
      }
    </figure>
  `,
  styles: `
    .chart {
      margin: 0;
    }
    svg {
      width: 100%;
      height: auto;
      overflow: visible;
    }
    .bar {
      fill: var(--series-1);
      transition: opacity 0.12s ease;
    }
    .row:hover .bar {
      opacity: 0.78;
    }
    .axis-label {
      fill: var(--text-secondary);
      font-size: 11px;
      text-anchor: end;
    }
    .value {
      fill: var(--text-muted);
      font-size: 11px;
      font-variant-numeric: tabular-nums;
    }
    .baseline {
      stroke: var(--baseline);
      stroke-width: 1;
    }
    .empty {
      color: var(--text-secondary);
      font-size: 13px;
    }
  `,
})
export class FeatureImportanceChart {
  readonly features = input.required<FeatureImportance[]>();
  readonly maxBars = input(10);

  protected readonly LABEL_WIDTH = LABEL_WIDTH;
  protected readonly BAR_HEIGHT = BAR_HEIGHT;

  protected readonly bars = computed<Bar[]>(() => {
    const rows = (this.features() ?? []).slice(0, this.maxBars());
    // A negative importance means shuffling the column *helped* - clamp to zero
    // so the axis stays anchored and the bar simply disappears.
    const peak = Math.max(...rows.map((r) => r.importance), 0.0001);
    const track = 460 - LABEL_WIDTH - 52;

    return rows.map((row, index) => ({
      feature: row.feature,
      importance: row.importance,
      width: Math.max(0, (row.importance / peak) * track),
      y: index * ROW_HEIGHT + 4,
      label: row.importance.toFixed(3),
    }));
  });

  protected readonly height = computed(() => this.bars().length * ROW_HEIGHT + 8);

  protected readonly summary = computed(() => {
    const rows = this.bars();
    if (!rows.length) return 'No feature importances available.';
    const top = rows.map((r) => `${r.feature} ${r.label}`).join(', ');
    return `Feature importance, highest first: ${top}.`;
  });
}
