import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { RiskBand, SegmentReport } from '../core/models';

interface Band {
  band: RiskBand;
  label: string;
  icon: string;
  color: string;
  customers: number;
  share: number;
  averageProbability: number;
}

/** Status colours are paired with an icon and a label, never colour alone. */
const BANDS: Record<RiskBand, { label: string; icon: string; color: string }> = {
  high: { label: 'High risk', icon: '▲', color: 'var(--status-critical)' },
  medium: { label: 'Medium risk', icon: '●', color: 'var(--status-warning)' },
  low: { label: 'Low risk', icon: '✓', color: 'var(--status-good)' },
};

@Component({
  selector: 'app-risk-segments',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="chart">
      <figcaption>
        <div class="card__title">Customers by risk band</div>
        <div class="card__subtitle">
          Scored across the whole file — high is a churn probability of 70% or more
        </div>
      </figcaption>

      @if (bands().length) {
        <div class="bar" role="img" [attr.aria-label]="summary()">
          @for (band of bands(); track band.band) {
            @if (band.share > 0) {
              <div
                class="bar__segment"
                [style.width.%]="band.share * 100"
                [style.background]="band.color"
                [title]="band.label + ': ' + band.customers + ' customers'"
              ></div>
            }
          }
        </div>

        <ul class="legend">
          @for (band of bands(); track band.band) {
            <li class="legend__item">
              <span class="legend__icon" [style.color]="band.color" aria-hidden="true">
                {{ band.icon }}
              </span>
              <span class="legend__label">{{ band.label }}</span>
              <span class="legend__value tabular">{{ band.customers }}</span>
              <span class="legend__share tabular">
                {{ (band.share * 100).toFixed(1) }}%
              </span>
              <span class="legend__prob tabular">
                avg {{ (band.averageProbability * 100).toFixed(0) }}%
              </span>
            </li>
          }
        </ul>
      } @else {
        <p class="empty">Train a model to segment the customer base.</p>
      }
    </figure>
  `,
  styles: `
    .chart {
      margin: 0;
    }
    .bar {
      display: flex;
      gap: 2px; /* 2px surface gap between adjacent fills */
      height: 28px;
      margin-bottom: 16px;
    }
    .bar__segment {
      border-radius: 4px;
      min-width: 3px;
    }
    .legend {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .legend__item {
      display: grid;
      grid-template-columns: 16px 1fr auto auto auto;
      align-items: baseline;
      gap: 10px;
      font-size: 13px;
    }
    .legend__icon {
      font-size: 11px;
      text-align: center;
    }
    .legend__label {
      color: var(--text-primary);
    }
    .legend__value {
      color: var(--text-primary);
      font-weight: 600;
    }
    .legend__share,
    .legend__prob {
      color: var(--text-muted);
      font-size: 12px;
      min-width: 52px;
      text-align: right;
    }
    .empty {
      color: var(--text-secondary);
      font-size: 13px;
    }
  `,
})
export class RiskSegments {
  readonly report = input<SegmentReport | null>(null);

  protected readonly bands = computed<Band[]>(() => {
    const segments = this.report()?.segments ?? [];
    return segments.map((segment) => ({
      band: segment.band,
      ...BANDS[segment.band],
      customers: segment.customers,
      share: segment.share,
      averageProbability: segment.average_probability,
    }));
  });

  protected readonly summary = computed(() =>
    this.bands()
      .map((b) => `${b.label}: ${b.customers} customers`)
      .join('; '),
  );
}
