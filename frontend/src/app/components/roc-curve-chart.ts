import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const SIZE = 260;
const PAD = 34;

/**
 * ROC curve against the no-skill diagonal. One series, so the title carries
 * identity and no legend box is needed; the diagonal is recessive chrome.
 */
@Component({
  selector: 'app-roc-curve-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="chart">
      <figcaption>
        <div class="card__title">ROC curve</div>
        <div class="card__subtitle">
          Area under curve
          <strong class="tabular">{{ auc() !== null ? auc()!.toFixed(3) : '—' }}</strong>
          — 0.5 would be a coin flip
        </div>
      </figcaption>

      @if (path()) {
        <svg
          [attr.viewBox]="'0 0 ' + SIZE + ' ' + SIZE"
          role="img"
          [attr.aria-label]="summary()"
        >
          @for (tick of ticks(); track tick.value) {
            <line
              class="grid"
              [attr.x1]="PAD"
              [attr.y1]="tick.y"
              [attr.x2]="SIZE - 10"
              [attr.y2]="tick.y"
            />
            <text class="tick" [attr.x]="PAD - 6" [attr.y]="tick.y + 3">
              {{ tick.value.toFixed(1) }}
            </text>
            <text class="tick tick--x" [attr.x]="tick.x" [attr.y]="SIZE - PAD + 14">
              {{ tick.value.toFixed(1) }}
            </text>
          }

          <line
            class="diagonal"
            [attr.x1]="PAD"
            [attr.y1]="SIZE - PAD"
            [attr.x2]="SIZE - 10"
            y2="10"
          />
          <path class="curve" [attr.d]="path()" />

          <line
            class="axis"
            [attr.x1]="PAD"
            [attr.y1]="SIZE - PAD"
            [attr.x2]="SIZE - 10"
            [attr.y2]="SIZE - PAD"
          />
          <line
            class="axis"
            [attr.x1]="PAD"
            y1="10"
            [attr.x2]="PAD"
            [attr.y2]="SIZE - PAD"
          />

          <text class="axis-title" [attr.x]="SIZE / 2" [attr.y]="SIZE - 4">
            False positive rate
          </text>
          <text
            class="axis-title"
            [attr.transform]="'rotate(-90 12 ' + SIZE / 2 + ')'"
            x="12"
            [attr.y]="SIZE / 2"
          >
            True positive rate
          </text>
        </svg>
      } @else {
        <p class="empty">Train a model to see its ROC curve.</p>
      }
    </figure>
  `,
  styles: `
    .chart {
      margin: 0;
    }
    svg {
      width: 100%;
      max-width: 320px;
      height: auto;
    }
    .curve {
      fill: none;
      stroke: var(--series-1);
      stroke-width: 2;
      stroke-linejoin: round;
      stroke-linecap: round;
    }
    .diagonal {
      stroke: var(--baseline);
      stroke-width: 1.5;
      stroke-dasharray: 4 4;
    }
    .grid {
      stroke: var(--gridline);
      stroke-width: 1;
    }
    .axis {
      stroke: var(--baseline);
      stroke-width: 1;
    }
    .tick {
      fill: var(--text-muted);
      font-size: 9px;
      text-anchor: end;
      font-variant-numeric: tabular-nums;
    }
    .tick--x {
      text-anchor: middle;
    }
    .axis-title {
      fill: var(--text-secondary);
      font-size: 10px;
      text-anchor: middle;
    }
    .empty {
      color: var(--text-secondary);
      font-size: 13px;
    }
  `,
})
export class RocCurveChart {
  readonly fpr = input<number[]>([]);
  readonly tpr = input<number[]>([]);
  readonly auc = input<number | null>(null);

  protected readonly SIZE = SIZE;
  protected readonly PAD = PAD;

  protected readonly ticks = computed(() =>
    [0, 0.25, 0.5, 0.75, 1].map((value) => ({
      value,
      x: this.toX(value),
      y: this.toY(value),
    })),
  );

  protected readonly path = computed(() => {
    const xs = this.fpr() ?? [];
    const ys = this.tpr() ?? [];
    if (xs.length < 2 || xs.length !== ys.length) return '';
    return xs
      .map((x, i) => `${i === 0 ? 'M' : 'L'}${this.toX(x)},${this.toY(ys[i])}`)
      .join(' ');
  });

  protected readonly summary = computed(() => {
    const auc = this.auc();
    return auc === null
      ? 'ROC curve.'
      : `ROC curve with an area under curve of ${auc.toFixed(3)}.`;
  });

  private toX(value: number): number {
    return PAD + value * (SIZE - PAD - 10);
  }

  private toY(value: number): number {
    return SIZE - PAD - value * (SIZE - PAD - 10);
  }
}
