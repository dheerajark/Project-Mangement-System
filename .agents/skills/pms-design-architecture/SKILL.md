---
name: pms-design-architecture
description: Design system guidelines, layout standards, color palettes, UI components, typography, header standards, and visual consistency rules for the Project Management System (PMS) web app.
---

# PMS Design System & UI Architecture Guide

This skill defines the mandatory design system, UI layout architecture, component specifications, color tokens, and visual consistency guidelines for the Project Management System (PMS) web application.

---

## 1. Core Design Philosophy

1. **Visual Excellence & Wow Factor**: Dark-mode-first aesthetic with rich dark slate (`bg-slate-950`, `bg-slate-900`, `bg-card`), glassmorphism backdrop blurs (`backdrop-blur-xl`), vibrant gradient highlights, and soft charcoal eye-care mode compatibility.
2. **Strict Layout Consistency**: Every page in the dashboard must strictly use standard layout boundaries, header components, and grid containers. Ad-hoc header heights, custom container widths, or misaligned paddings are prohibited.
3. **Micro-Animations & Feedback**: All interactive elements (buttons, cards, links, tabs) must feature active scale responses (`active:scale-[0.98]`), smooth hover transitions (`transition-all duration-150`), and `cursor-pointer`.

---

## 2. Layout & Container Architecture

### 2.1 Main Dashboard Page Structure
Every dashboard route in `app/(dashboard)/*` MUST adhere to this exact structural hierarchy:

```tsx
'use client';

import React from 'react';
import Header from '@/components/header';

export default function MyPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-slate-100">
      {/* 1. Standardized Header */}
      <Header
        title="Page Title"
        subtitle="Portal Name"
        backHref="/dashboard" // Optional back link
      >
        {/* Optional Page-Specific Action Buttons (e.g. Create Button) */}
      </Header>

      {/* 2. Standardized Main Content Wrapper */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Page Content / Widgets / Tables */}
      </main>
    </div>
  );
}
```

### 2.2 Container Bounds Rules
- **Header Inner Container**: Always `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between` (encapsulated inside `<Header />`).
- **Main Body Container**: Always `max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8`.
- **Prohibited**: Never use `max-w-5xl` or raw `px-6` directly on top-level pages as it breaks alignment when navigating across tabs.

---

## 3. Standardized Header Component (`Header`)

The [`Header`](file:///c:/Salesforce/Labs/NSK/Project%20Management%20System/frontend/components/header.tsx) component encapsulates the top navigation bar for all pages:

```tsx
import Header from '@/components/header';

// Usage Examples:
<Header title="Projects Center" subtitle="Projects Portal" backHref="/dashboard" />
<Header title="User Preferences & Accessibility" subtitle="User Settings" activeNav="preferences" />
<Header title="Organization Control Panel" subtitle="Admin Panel" activeNav="settings" />
```

### Header Features:
- Fixed `h-16` height with `sticky top-0 z-30 backdrop-blur-xl`.
- Unified right-side utility bar containing:
  - `<NotificationBell />`
  - Preferences Button (`/settings/personal`) with `activeNav="preferences"` highlight.
  - Organization Settings Button (`/settings`) with `activeNav="settings"` highlight (visible for admins with `MANAGE_USERS`).
  - Logout Button (`handleLogout`).

---

## 4. Design System Tokens & Components

### 4.1 Color Tokens & Palettes
- **Background Layer 0**: `bg-slate-950` / `bg-background`
- **Background Layer 1 (Cards/Panels)**: `bg-slate-900/30 border border-slate-900 rounded-2xl`
- **Background Layer 2 (Inputs/Tables)**: `bg-slate-950 border border-slate-850 rounded-xl`
- **Primary Text**: `text-slate-100` / `text-foreground`
- **Secondary Text (Muted)**: `text-slate-400` / `text-muted-foreground`
- **Tertiary Text (Labels/Captions)**: `text-slate-500`
- **Primary Brand Gradient**: `bg-gradient-to-r from-indigo-600 to-blue-600`
- **Gradient Text**: `bg-gradient-to-r from-indigo-400 to-blue-400 bg-clip-text text-transparent`

### 4.2 Button Variants

#### Primary Action Button (Gradient)
```tsx
<button
  type="submit"
  className="px-4.5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl font-semibold shadow-lg text-sm active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
>
  <Plus className="w-4 h-4" /> Create Item
</button>
```

#### Secondary Outline Button
```tsx
<button
  type="button"
  className="px-4 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-slate-200 flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
>
  Cancel
</button>
```

#### Danger / Delete Button
```tsx
<button
  type="button"
  className="p-1.5 text-red-400 border border-red-900/30 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
>
  <Trash2 className="w-4 h-4" />
</button>
```

### 4.3 Form Input Specification
All form fields (text inputs, selects, textareas) must follow this exact styling:

```tsx
<div className="space-y-1">
  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
    Field Label *
  </label>
  <input
    type="text"
    placeholder="Enter text..."
    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 placeholder-slate-650 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs"
  />
</div>
```

### 4.4 Status Badges Standard
Use these color semantics across all entities (Projects, Tasks, Issues, Milestones, Timesheets):

| Status Category | Style Classes | Example Uses |
| :--- | :--- | :--- |
| **Success / Active** | `bg-emerald-500/10 text-emerald-400 border border-emerald-500/20` | `ACTIVE`, `DONE`, `COMPLETED`, `APPROVED` |
| **In Progress / Info** | `bg-blue-500/10 text-blue-400 border border-blue-500/20` | `IN_PROGRESS`, `PLANNING`, `SUBMITTED` |
| **Warning / Review** | `bg-amber-500/10 text-amber-400 border border-amber-500/20` | `REVIEW`, `PENDING`, `SUSPENDED` |
| **Danger / Critical** | `bg-rose-500/10 text-rose-400 border border-rose-500/20` | `CRITICAL`, `BLOCKED`, `REJECTED`, `MISSED` |
| **Neutral / Muted** | `bg-slate-800 text-slate-400 border border-slate-700/50` | `TODO`, `PLANNED`, `UNSUBMITTED`, `ARCHIVED` |

Badge markup pattern:
```tsx
<span className="px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
  Active
</span>
```

### 4.5 Modals & Drawers Standard

#### Modal Dialog Overlay
```tsx
<div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
  <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
    {/* Modal Header, Body, Footer */}
  </div>
</div>
```

#### Side Drawer
```tsx
<div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-slate-900 border-l border-slate-800 shadow-2xl z-50 overflow-y-auto">
  {/* Drawer Content */}
</div>
```

### 4.6 Data Tables
```tsx
<div className="overflow-x-auto rounded-xl border border-slate-900">
  <table className="w-full text-left text-sm text-slate-300">
    <thead className="bg-slate-950 text-slate-400 uppercase text-xs font-semibold tracking-wider border-b border-slate-900">
      <tr>
        <th className="px-6 py-4">Column Header</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-900 bg-slate-900/10">
      <tr className="hover:bg-slate-900/30 transition-colors">
        <td className="px-6 py-4">Data Cell</td>
      </tr>
    </tbody>
  </table>
</div>
```

---

## 5. Non-Negotiable Checklist for New UI Components

Before declaring any UI task or component complete, verify:
- [ ] Uses `<Header />` from `@/components/header` for page headers.
- [ ] `<main>` content wrapper has `max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8`.
- [ ] All interactive elements include `cursor-pointer` and appropriate hover/active states.
- [ ] Form inputs use `bg-slate-950 border-slate-850 rounded-xl focus:border-indigo-500`.
- [ ] Status indicators use the standardized semantic badge colors.
- [ ] Dark mode and color theme variables (`theme-*`) are respected.
