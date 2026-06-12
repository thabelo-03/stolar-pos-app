# Stolar POS — Product Documentation & Release Notes

## Version: v1.0.1-beta
**Release Date:** May 26, 2026  
**Target Environments:** Mobile Client (Android APK) & POS REST API Server  
**CI/CD Pipeline:** EAS Android Production Build successfully completed  

---

### 🚀 Overview
**Stolar POS** is a state-of-the-art, multi-shop, multi-currency Point of Sale (POS) solution engineered for retail and wholesale businesses operating in dynamic financial climates. Built on a robust **React Native (Expo)** client and powered by a highly-scalable **Node.js/Express & MongoDB** backend, Stolar POS integrates real-time synchronization, advanced offline-safe transactions, per-branch pricing, and premium corporate reporting.

---

## 💎 Key Features & Capabilities

### 1. 🏢 Multi-Branch Operations Deck
*   **Decentralized Branch Registry:** Managers can register multiple shop branches under a unified account, generating unique shop identifiers (e.g., `STLR-XXXX`).
*   **Staff Linking Pipeline:** Cashiers can search for a branch using its code and submit link requests. Managers approve or decline requests in real-time from their terminal.
*   **Instant Context Switching:** Cashiers and managers can seamlessly jump between different shops. The client automatically refreshes the product catalogue, transaction history, and exchange rates.

### 2. 💱 Stable Multi-Currency Billing Engine
*   **USD Base Stability:** Products are stored with a base price in USD to maintain stable inventory valuations.
*   **Dual Live Conversion Layers:** The system supports dynamic, live pricing in **ZAR (South African Rand)** and **ZiG (Zimbabwe Gold)**.
*   **Operational Exchange Rates:** Managers can adjust exchange rates for ZAR and ZiG at any time. Changes are instantly broadcast to all linked cashier terminals.
*   **Multi-Currency Checkout:** Cashiers can process transactions in USD, ZAR, or ZiG, with the system calculating exact tendered amounts and local change automatically.

### 3. 🛍️ High-Performance Point of Sale Terminal
*   **Barcode Scanning Support:** Full integration with device cameras (`expo-camera`) to scan products and automatically add them to the sale.
*   **Dynamic Cart Calculations:** Real-time updates for discounts, payment methods, split payments, and local currency conversions.
*   **Offline-Safe Transactions:** Sales are queued locally if connection is lost, and automatically synced to the server once the network is restored (preventing transaction gaps).

### 4. 📦 Per-Shop Intelligent Inventory Deck
*   **Compound Scoped Barcodes:** Barcodes are unique *per shop*, allowing different branches to carry identical inventory items with distinct local pricing and stock levels.
*   **Inter-Branch Stock Transfers:** Managers can transfer stock quantities from a source shop to a target shop with a single click. The system safely manages stock levels at both locations.
*   **Audit Logs & Single-Click Restores:** Every single modification to inventory (price changes, quantity edits) is logged with cashier metadata. If a mistake occurs, managers can restore the product's state to any historical restore point.

### 5. 📊 Branded Corporate Reporting & Analytics
*   **Manager Dashboard:** Real-time stats showing daily revenue, order counts, profit margins, and cost of goods sold (COGS) charts.
*   **Zebra-Striped Financial Tables:** High-end tabular logs with bold monospace formatting for numeric figures and bold highlighted grand total rows.
*   **Interactive KPI Cards:** Modern, shadowed cockpit metrics grids summarizing unique items, total quantity, and valuation.
*   **Branded PDF Export Engine:** Generates gorgeous, corporate-ready PDF reports directly from the app using custom-injected Google Fonts (`Inter` & `Outfit`) and striking linear gradients (Indigo/Slate for Cashiers, Lavender/Purple for Managers).

### 6. 🛡️ Admin Control Cockpit
*   **Manual Activations:** Administrators can manually activate manager accounts, allocate subscription months, and audit cash payments.
*   **Access Management:** Block and unblock managers instantly in response to payment delays or policy violations.
*   **Comprehensive Audit Logs:** Detailed tracking of subscription extensions and cash ledger modifications.

---

## 🛠️ Recent Refinements & Bug Patches in v1.0.1

### 1. 🔗 Cashier-Side Active Shop Synchronization (Mobile Client)
*   **The Issue:** Expo Router persistently caches tab screens in memory. When a cashier switched their active shop branch in the **My Shop** screen, other pre-loaded tabs (such as the *Sale/Cart* and *Inventory* screens) failed to detect the update, leaving them showing the stale products pool of the previously selected shop.
*   **The Fix:** Engineered a zero-dependency **Reactive Subscriber State Pattern** in `hooks/use-active-shop.ts`. All active screens now bind as listeners to a unified global store. 
*   **Benefit:** The millisecond a manager or cashier switches active shops, every single screen in the background instantly updates its active session and transparently refetches the correct products, currency rates, and recent transactions.

### 2. 🗄️ Scoped Stock Updates & Refund Logic (POS Backend)
*   **The Issue:** When completing a checkout (`POST /api/sales`) or executing a cashier refund, the server-side database engine only queried products by their `barcode`. Because barcodes are unique *per shop* rather than globally, MongoDB consistently picked the first document registered under that barcode (usually Shop A), leaking all stock deductions/restorations away from Shop B.
*   **The Fix:** Upgraded `stolar-server/server.js` transaction handlers. All stock adjustments are now securely queried by **both** `barcode` and the active `shopId` of the transaction, supporting both native ObjectIDs and string formats.
*   **Benefit:** Completely resolves cross-shop stock leakage. Selling in Shop B strictly decrements Shop B's inventory counts.

### 3. 💱 Manager Notification Currency Corrections (POS Backend)
*   **The Issue:** The automated cashier sale notifications sent to the manager's phone displayed a ZAR symbol (`R`) but evaluated the raw, unconverted USD value (e.g., displaying `R10.00` instead of `R192.00`).
*   **The Fix:** Programmed the notification dispatcher to dynamically lookup the shop's active ZAR exchange rate (defaulting to `19.2` if unconfigured) and multiply it by `totalUSD`.
*   **Benefit:** Managers now receive real-time notifications with perfectly accurate Rand values.

### 4. 📊 Branded Corporate PDF Exports (Mobile Client)
*   **The Issue:** Legacy system generated default web-view layout sheets that lacked corporate branding, clean alignment, or high-end typography.
*   **The Fix:** Fully redesigned the cashier's financial report generation template:
    *   **Typography:** Injected Google Fonts (`Inter` and `Outfit`) directly into print-compiled HTML streams.
    *   **Visual Cueing:** Implemented a stunning Slate-Dark Cockpit linear gradient banner (`#0a0f1e` to `#162444`) with high-contrast neon details.
    *   **Metrics Grid:** Replaced vertical text lists with a structured, three-column responsive KPI card grid (Unique Items, Total Quantity, and Total Valuation).
    *   **Financial Tables:** Confined rows within precise grid boundaries, configured bold monospace fonts for numbers, and highlighted the grand total footer in high-contrast cyan.

### 5. ⌨️ Register New Shop Layout Adjustments (Mobile Client)
*   **The Issue:** The new branch creation sheet did not scale correctly on small-screen Android devices when the keyboard was active, occluding the submit buttons.
*   **The Fix:** Configured a dynamic `KeyboardAvoidingView` wrapper with adaptive offsets inside `register-shop.tsx`, allowing the scroll view to auto-scale safely when typing.

---

## 📦 Download & Deployment Assets
*   **Mobile App Installer:** [Stolar POS Android v1.0.1-beta APK](https://expo.dev/artifacts/eas/4oaCtqDy3rJ4gHCLoZQLGs.apk)
*   **POS API Server URL:** Configured and running via nodemon dev processes.
