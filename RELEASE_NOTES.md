# Stolar POS — Release Notes (v1.0.0)

Welcome to the premium release of **Stolar POS**! This update introduces high-end corporate styling, robust layout scaling, and complete integration with Firebase services.

---

## 🚀 Key Improvements & Innovations

### 1. 📂 Core Firebase & Package Integration
- **Package Unification**: Consolidated the application identifier across Android and iOS platforms to `com.stolar.pos`.
- **Firebase Infrastructure**: Embedded direct native Google Services configurations (`google-services.json`) into the build pipeline, establishing a robust foundation for Firebase App Distribution, analytics, and messaging.

### 2. ⌨️ Keyboard Layout & View Adjustments
- **Form Occlusion Fix**: Resolved keyboard overlap issues on the **Branch Establishment (Register New Shop)** form by wrapping scroll structures in an intelligent `KeyboardAvoidingView`. Viewports now automatically scale upwards when the software keyboard is active on both iOS and Android.

### 3. 📄 Premium Corporate PDF Reports
Transformed standard plain browser print-outs into gorgeously designed, branded PDF exports optimized for both cashiers and managers:
- **Daily Sales Summary PDF**: Includes high-contrast Outfit typography header elements, grouped payment breakdowns (Cash/Card/Other), refund log highlighting (soft rose background with strike-through styling), and automatic transaction rankings.
- **Profit Report PDF**: Upgraded with deep Indigo/Slate cashier-specific headers, dynamic multi-column KPI blocks (Revenue, COGS, Profit, and Margins), and color-coded positive/negative profit rows.

---

## 🛠️ Verification & Build Info
- **Target Platform**: Android APK (Preview/Production)
- **Package Name**: `com.stolar.pos`
- **Build Tooling**: EAS Build CI/CD Pipeline
- **Type Safety**: Verified compiling with `0 static typescript errors`.
