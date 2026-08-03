import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** A single headline figure. No plot, so no hover layer. */
@Component({
  selector: 'app-stat-tile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tile">
      <div class="tile__label">{{ label() }}</div>
      <div class="tile__value">{{ value() }}</div>
      @if (caption()) {
        <div class="tile__caption">{{ caption() }}</div>
      }
    </div>
  `,
  styles: `
    .tile {
      background: var(--surface-1);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 16px 18px;
    }
    .tile__label {
      font-size: 12px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-muted);
    }
    .tile__value {
      font-size: 30px;
      font-weight: 600;
      line-height: 1.2;
      margin-top: 6px;
      color: var(--text-primary);
    }
    .tile__caption {
      font-size: 12px;
      color: var(--text-secondary);
      margin-top: 2px;
    }
  `,
})
export class StatTile {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly caption = input<string>('');
}
