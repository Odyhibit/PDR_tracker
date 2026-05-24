# PDR Tracker — Web App

A mobile-first web app for logging hail damage / paintless dent repair vehicles. Scan VIN barcodes with your phone's camera, auto-decode vehicle info via NHTSA, and export PDF reports and CSV files per customer.

https://odyhibit.github.io/PDR_tracker/
---
https://odyhibit.github.io/PDR_tracker/

## Features

- **Barcode scanning** — reads VIN barcodes from the driver-side door jamb in Safari on iPhone
- **NHTSA VIN decode** — free, no API key, returns year/make/model automatically
- **Color picker** — dropdown of common vehicle colors
- **Customer management** — auto-defaults to last used customer
- **PDF report** — opens print dialog, save as PDF or print
- **CSV export** — per customer, with contact info header, opens directly in Excel/Numbers
- **Supabase** — all data stored on Supabase backend