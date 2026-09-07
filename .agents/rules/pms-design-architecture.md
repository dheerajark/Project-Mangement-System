# PMS Design System & UI Consistency Rules

Always follow these non-negotiable rules whenever creating, modifying, or refactoring UI components or page layouts in the Project Management System codebase:

1. **Header Consistency**:
   - Every page header in `app/(dashboard)/*` MUST use the `<Header />` component imported from `@/components/header`.
   - Never write ad-hoc headers with custom inline paddings or custom top bars.

2. **Main Layout Bounds**:
   - Every top-level page `<main>` element MUST use `className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6"`.
   - Never use `max-w-5xl` or raw `px-6` directly on top-level pages as it breaks alignment when navigating across tabs.

3. **Input & Form Field Consistency**:
   - Form controls must use `bg-slate-950 border border-slate-850 rounded-xl text-slate-100 placeholder-slate-650 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs`.
   - Field labels must use `block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2`.

4. **Button & Action Micro-Interactions**:
   - Primary action buttons: `px-4.5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl font-semibold shadow-lg text-sm active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50`.
   - All interactive elements must explicitly include `cursor-pointer`.

5. **Status Badge Semantics**:
   - Success / Active / Done: `bg-emerald-500/10 text-emerald-400 border border-emerald-500/20`
   - In Progress / Planning: `bg-blue-500/10 text-blue-400 border border-blue-500/20`
   - Review / Pending: `bg-amber-500/10 text-amber-400 border border-amber-500/20`
   - Critical / Blocked / Rejected: `bg-rose-500/10 text-rose-400 border border-rose-500/20`
   - Muted / Neutral / Todo: `bg-slate-800 text-slate-400 border border-slate-700/50`
