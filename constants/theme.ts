/**
 * Stolar POS — Premium Design System
 * Global theme constants used across all screens
 */

export const Colors = {
  // --- Dark (Cashier POS) Palette ---
  dark: {
    bg: '#0a0f1e',
    bgSecondary: '#111827',
    surface: 'rgba(255,255,255,0.06)',
    surfaceElevated: 'rgba(255,255,255,0.10)',
    border: 'rgba(255,255,255,0.10)',
    text: '#f1f5f9',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',
    // Compatibility aliases for standard templates
    background: '#0a0f1e',
    icon: '#94a3b8',
  },

  // --- Light (Manager) Palette ---
  light: {
    bg: '#f0f4ff',
    bgSecondary: '#e8edff',
    surface: '#ffffff',
    surfaceElevated: '#f8faff',
    border: '#e2e8f0',
    text: '#0f172a',
    textSecondary: '#475569',
    textMuted: '#94a3b8',
    // Compatibility aliases for standard templates
    background: '#f0f4ff',
    icon: '#475569',
  },

  // --- Brand / Accent ---
  brand: {
    blue: '#2563eb',
    blueDeep: '#1e3a8a',
    blueSoft: '#1d4ed8',
    cyan: '#06b6d4',
    cyanSoft: '#0891b2',
    emerald: '#10b981',
    emeraldSoft: '#059669',
    amber: '#f59e0b',
    rose: '#f43f5e',
    roseDeep: '#e11d48',
    purple: '#8b5cf6',
  },

  // --- Gradients (as arrays for use with linear-gradient) ---
  gradients: {
    darkHeader: ['#0a0f1e', '#162444'],
    blueHeader: ['#1e3a8a', '#2563eb'],
    blueDeep: ['#0f172a', '#1e3a8a'],
    emerald: ['#064e3b', '#059669'],
    cyan: ['#0891b2', '#06b6d4'],
    amber: ['#92400e', '#f59e0b'],
    rose: ['#9f1239', '#f43f5e'],
    card: ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)'],
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const Radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
};

export const Shadows = {
  // For light backgrounds
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  cardDeep: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  // For dark backgrounds
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  }),
  blueGlow: {
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  emeraldGlow: {
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
};

export const Typography = {
  hero: { fontSize: 36, fontWeight: '800' as const, letterSpacing: -1 },
  h1: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '700' as const },
  h3: { fontSize: 18, fontWeight: '700' as const },
  h4: { fontSize: 16, fontWeight: '600' as const },
  body: { fontSize: 14, fontWeight: '400' as const },
  bodyBold: { fontSize: 14, fontWeight: '600' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
  captionBold: { fontSize: 12, fontWeight: '600' as const },
  micro: { fontSize: 10, fontWeight: '600' as const, letterSpacing: 0.5 },
};
