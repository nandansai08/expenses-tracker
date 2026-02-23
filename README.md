# BloomBudget — Expenses Tracker

A modern, local-first expenses tracker with sign-in and OTP verification UI built using plain HTML, CSS, and JavaScript.

## Features

- Google or Apple provider selection on sign-in screen.
- Email + OTP verification flow before app access.
- Secure OTP comparison using SHA-256 hash in browser.
- Add expenses with title, amount (Indian Rupees), category, date, and notes.
- Real-time summary metrics:
  - Total spent
  - Current month spending
  - Average spend per day
- Category filtering for quick analysis.
- Donut chart visualization for spending by category.
- CSV export for external analysis (amounts in INR).
- Local storage persistence (works offline in the browser).

## Important authentication note

This is a **frontend-only demo implementation** suitable for static hosting on Azure. It simulates provider-based login UX and OTP flow in-browser.

For production-grade authentication on Azure, replace this with:

- Azure AD B2C or Microsoft Entra External ID for OAuth (Google/Apple federation), and
- a backend/API (Azure Functions/App Service) for server-side OTP generation, email delivery, storage, and validation.

## Run locally

```bash
python3 -m http.server 4173
```

Then visit: `http://localhost:4173`

## Azure hosting support

This repository supports both:

1. **Azure Static Web Apps** (`staticwebapp.config.json`)
2. **Azure App Service (Windows/IIS)** (`web.config`)

## Reference inspirations

- Material Design 3: https://m3.material.io/
- Nielsen Norman Group heuristics: https://www.nngroup.com/articles/ten-usability-heuristics/
- MDN Web Docs: https://developer.mozilla.org/
- Azure Static Web Apps config: https://learn.microsoft.com/azure/static-web-apps/configuration
- Azure App Service docs: https://learn.microsoft.com/azure/app-service/

## Azure/Oryx build compatibility

If Azure Oryx is used during deployment, this repo now includes a `package.json` with both required scripts:

- `build`
- `build:azure`

Both run `scripts/build.mjs`, which creates a `dist/` folder containing all static assets needed for deployment.

For Azure Static Web Apps workflow settings, use:

- `app_location: "/"`
- `output_location: "dist"`

