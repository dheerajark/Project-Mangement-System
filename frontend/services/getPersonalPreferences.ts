export interface PersonalPreferences {
  mode?: 'day' | 'night' | 'auto';
  accentColor?: 'orange' | 'cyan' | 'teal' | 'red' | 'green' | 'blue' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'slate';
  dimMode?: boolean;
  landingPage?: '/dashboard' | '/projects' | '/tasks';
}

const PREF_KEY = 'epms_user_personal_preferences';

export function getPersonalPreferences(): PersonalPreferences {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

export function savePersonalPreferences(prefs: Partial<PersonalPreferences>): PersonalPreferences {
  const current = getPersonalPreferences();
  const updated = { ...current, ...prefs };
  if (typeof window !== 'undefined') {
    localStorage.setItem(PREF_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('personal_preferences_changed'));
  }
  return updated;
}

