# Angular Application

[Frontend overview](../../README.md)

This folder is the application entry point and feature shell.

- `app.ts`, `app.config.ts`, and `app.routes.ts` configure startup and routing.
- [components/](<components/README.md>) contains charts, tables, and reusable dashboard panels.
- [core/](<core/README.md>) contains the API client and shared TypeScript models.
- [pages/](<pages/README.md>) contains the route-level dashboard view.

Keep server communication in `core/` and page composition in `pages/`.