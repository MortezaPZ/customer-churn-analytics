# Customer Churn Dashboard

[Project overview](../README.md)

This Angular dashboard uploads customer CSV data to the Django API and presents the resulting churn analysis: data quality, model scores, risk segments, feature importance, and customer-level predictions.

## Structure

- [src/](<src/README.md>) contains the Angular application.
- [public/](<public/README.md>) contains static browser assets.
- Inside `src/app/`, [components/](<src/app/components/README.md>) renders charts, tables, and reusable panels; [core/](<src/app/core/README.md>) holds API access and data models; [pages/](<src/app/pages/README.md>) contains the dashboard screen.

## Run locally

From this directory, run `npm ci` and then `npm start`. The development server opens at `http://localhost:4200`.

Run `npm test` for the configured Vitest suite and `npm run build` for a production build. The API contract used by the browser is centralized in `src/app/core/api.service.ts`.