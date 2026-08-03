import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { PredictionRow, RiskBand } from '../core/models';

const BAND_STYLE: Record<RiskBand, { label: string; icon: string; color: string }> = {
  high: { label: 'High', icon: '▲', color: 'var(--status-critical)' },
  medium: { label: 'Medium', icon: '●', color: 'var(--status-warning)' },
  low: { label: 'Low', icon: '✓', color: 'var(--status-good)' },
};

/** Columns that carry no meaning in a "who do we call first" list. */
const HIDDEN = new Set(['churn_probability', 'risk_band']);

@Component({
  selector: 'app-predictions-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="head">
      <div>
        <div class="card__title">Highest-risk customers</div>
        <div class="card__subtitle">
          Ranked by churn probability — the retention call list
        </div>
      </div>
      @if (rows().length) {
        <button type="button" class="export" (click)="exportCsv()">Export CSV</button>
      }
    </div>

    @if (rows().length) {
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Risk</th>
              <th scope="col" class="right">Probability</th>
              @for (column of columns(); track column) {
                <th scope="col">{{ column }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track $index) {
              <tr>
                <td>
                  <span class="band" [style.color]="style(row.risk_band).color">
                    <span aria-hidden="true">{{ style(row.risk_band).icon }}</span>
                    {{ style(row.risk_band).label }}
                  </span>
                </td>
                <td class="right tabular strong">
                  {{ (row.churn_probability * 100).toFixed(1) }}%
                </td>
                @for (column of columns(); track column) {
                  <td class="tabular">{{ row[column] ?? '—' }}</td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
    } @else {
      <p class="empty">Train a model to build the call list.</p>
    }
  `,
  styles: `
    .head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
    }
    .export {
      background: transparent;
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text-secondary);
      padding: 6px 12px;
      font-size: 13px;
      white-space: nowrap;
    }
    .export:hover {
      color: var(--text-primary);
      border-color: var(--baseline);
    }
    /* Wide tables scroll inside their own container, never the page body. */
    .scroll {
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th {
      text-align: left;
      font-weight: 500;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-muted);
      padding: 8px 12px 8px 0;
      border-bottom: 1px solid var(--border);
      white-space: nowrap;
    }
    td {
      padding: 9px 12px 9px 0;
      border-bottom: 1px solid var(--gridline);
      color: var(--text-secondary);
      white-space: nowrap;
    }
    tbody tr:hover td {
      color: var(--text-primary);
    }
    .right {
      text-align: right;
      padding-right: 20px;
    }
    .strong {
      color: var(--text-primary);
      font-weight: 600;
    }
    .band {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-weight: 500;
      font-size: 12px;
    }
    .empty {
      color: var(--text-secondary);
      font-size: 13px;
    }
  `,
})
export class PredictionsTable {
  readonly rows = input.required<PredictionRow[]>();
  readonly maxColumns = input(6);

  protected readonly columns = computed(() => {
    const first = this.rows()[0];
    if (!first) return [];
    return Object.keys(first)
      .filter((key) => !HIDDEN.has(key))
      .slice(0, this.maxColumns());
  });

  protected style(band: RiskBand) {
    return BAND_STYLE[band] ?? BAND_STYLE.low;
  }

  protected exportCsv(): void {
    const rows = this.rows();
    if (!rows.length) return;

    const headers = Object.keys(rows[0]);
    const body = rows.map((row) =>
      headers.map((header) => this.escape(row[header])).join(','),
    );
    const csv = [headers.join(','), ...body].join('\n');

    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'at-risk-customers.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  private escape(value: string | number | null): string {
    if (value === null || value === undefined) return '';
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }
}
