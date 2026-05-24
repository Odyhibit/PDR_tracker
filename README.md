# PDR Tracker — Web App

A mobile-first web app for logging hail damage / paintless dent repair vehicles. Scan VIN barcodes with your phone's camera, auto-decode vehicle info via NHTSA, and export PDF reports and CSV files per customer.

---

## Features

- 📷 **Barcode scanning** — reads VIN barcodes from the driver-side door jamb in Safari on iPhone
- 🔍 **NHTSA VIN decode** — free, no API key, returns year/make/model automatically
- 🎨 **Color picker** — dropdown of common vehicle colors
- 👥 **Customer management** — auto-defaults to last used customer
- 📄 **PDF report** — opens print dialog, save as PDF or print
- 📊 **CSV export** — per customer, with contact info header, opens directly in Excel/Numbers
- 💾 **localStorage** — all data stored on-device, persists across tab closes and reboots

---

## Deployment: Vercel (Recommended)

Vercel is the easiest path — HTTPS is automatic, no config needed.

### Steps

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   gh repo create pdr-tracker --public --push
   ```

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com) and sign in with GitHub
   - Click **Add New Project** → import your `pdr-tracker` repo
   - Framework: **Vite** (auto-detected)
   - Click **Deploy**

3. **Done.** You get a URL like `pdr-tracker.vercel.app`

Every time you `git push`, Vercel auto-redeploys in ~30 seconds.

> **Note:** Since this is a Vite app (not Next.js), remove or ignore the `base` setting in `vite.config.js` for Vercel — Vercel serves from the root, not a subdirectory.

---

## Deployment: GitHub Pages (Alternative)

### One-time setup

1. Push to GitHub (same steps as above)
2. In your repo → **Settings** → **Pages** → Source: **GitHub Actions**
3. Edit `vite.config.js` — set `base` to your repo name:
   ```js
   base: '/your-repo-name/',
   ```
4. Push — the GitHub Action will build and deploy automatically

Your site will be at: `https://yourusername.github.io/your-repo-name/`

---

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

> **Camera scanning requires HTTPS.** It won't work on plain `http://localhost` in some browsers. Use Vercel or ngrok for live camera testing.

---

## Project structure

```
src/
├── App.jsx                    # Root with tab navigation
├── main.jsx                   # Entry point
├── index.css                  # Global styles + design tokens
├── context/
│   └── AppContext.jsx          # Global state (customers, vehicles)
├── components/
│   ├── UI.jsx                  # Shared components (Button, Card, Modal…)
│   └── VinScanner.jsx          # Camera barcode scanner overlay
├── pages/
│   ├── LogPage.jsx             # Main workflow: scan → decode → save
│   ├── VehiclesPage.jsx        # All logged cars, CSV + PDF export
│   └── CustomersPage.jsx       # Customer/lot management
└── utils/
    ├── nhtsa.js                # NHTSA vPIC API
    ├── report.js               # PDF via browser print dialog
    └── storage.js              # localStorage + CSV export
```

---

## Notes

- **VIN barcodes** on door jambs are typically Code 39 (older) or Code 128/PDF417 (newer). ZXing supports all of these.
- **Camera scanning** requires the site to be served over HTTPS — both Vercel and GitHub Pages provide this automatically.
- **Data lives on the device.** Clearing browser data or switching browsers will lose it. Use the CSV export regularly as a backup.
- **Add to Home Screen** in Safari for a full-screen app-like experience on iPhone.
- **Price tracking** is not included but easy to add — the data model just needs a `price` field on the vehicle object.
