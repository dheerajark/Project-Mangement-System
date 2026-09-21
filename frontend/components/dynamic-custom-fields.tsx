'use client';

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import {
  Type,
  AlignLeft,
  Hash,
  Percent,
  DollarSign,
  Calendar,
  Clock,
  CheckSquare,
  List,
  CheckCheck,
  User as UserIcon,
  Link as LinkIcon,
  Mail,
  Phone,
  HelpCircle,
  SlidersHorizontal,
} from 'lucide-react';

export interface CustomFieldDefinition {
  id: string;
  name: string;
  apiName: string;
  type:
    | 'TEXT'
    | 'TEXTAREA'
    | 'NUMBER'
    | 'DECIMAL'
    | 'CURRENCY'
    | 'PERCENTAGE'
    | 'DATE'
    | 'DATETIME'
    | 'CHECKBOX'
    | 'SELECT'
    | 'MULTI_SELECT'
    | 'USER'
    | 'URL'
    | 'EMAIL'
    | 'PHONE';
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  isRequired: boolean;
  isActive: boolean;
  showInList: boolean;
  showInKanban: boolean;
  showInGantt: boolean;
  options?: string; // JSON string
  validation?: string; // JSON string
  position: number;
  section?: string;
}

interface DynamicCustomFieldsProps {
  projectId?: string;
  values: Record<string, any>;
  onChange: (newValues: Record<string, any>) => void;
  errors?: Record<string, string>;
  members?: Array<{ id?: string; userId?: string; user?: any; email?: string; firstName?: string; lastName?: string }>;
}

export const FIELD_TYPE_CONFIG: Record<
  string,
  { label: string; icon: any; color: string; description: string }
> = {
  TEXT: {
    label: 'Single-line Text',
    icon: Type,
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    description: 'Short text input up to 255 characters',
  },
  TEXTAREA: {
    label: 'Multi-line Text',
    icon: AlignLeft,
    color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    description: 'Long-form notes and specifications',
  },
  NUMBER: {
    label: 'Integer Number',
    icon: Hash,
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    description: 'Whole numeric quantities (e.g. sprint #, count)',
  },
  DECIMAL: {
    label: 'Decimal Number',
    icon: Hash,
    color: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
    description: 'Floating point numbers with decimal places',
  },
  CURRENCY: {
    label: 'Currency',
    icon: DollarSign,
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    description: 'Monetary amounts with currency symbol',
  },
  PERCENTAGE: {
    label: 'Percentage',
    icon: Percent,
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    description: 'Percent ratio (0-100%)',
  },
  DATE: {
    label: 'Date',
    icon: Calendar,
    color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    description: 'Calendar date picker (YYYY-MM-DD)',
  },
  DATETIME: {
    label: 'Date & Time',
    icon: Clock,
    color: 'text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20',
    description: 'Combined date and time timestamp',
  },
  CHECKBOX: {
    label: 'Checkbox / Toggle',
    icon: CheckSquare,
    color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    description: 'Boolean Yes/No flag',
  },
  SELECT: {
    label: 'Dropdown Picklist',
    icon: List,
    color: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
    description: 'Single choice from customizable option badges',
  },
  MULTI_SELECT: {
    label: 'Multi-Select Picklist',
    icon: CheckCheck,
    color: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
    description: 'Multiple selections from predefined options',
  },
  USER: {
    label: 'User / Assignee Picker',
    icon: UserIcon,
    color: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    description: 'Team member selection from organization',
  },
  URL: {
    label: 'Web URL',
    icon: LinkIcon,
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    description: 'Validated web link with direct navigation',
  },
  EMAIL: {
    label: 'Email Address',
    icon: Mail,
    color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    description: 'Validated email with mailto link',
  },
  PHONE: {
    label: 'Phone Number',
    icon: Phone,
    color: 'text-green-400 bg-green-500/10 border-green-500/20',
    description: 'Formatted contact phone number',
  },
};

export default function DynamicCustomFields({
  projectId,
  values,
  onChange,
  errors = {},
  members = [],
}: DynamicCustomFieldsProps) {
  // Fetch custom fields for organization & project
  const { data: fields = [], isLoading } = useQuery<CustomFieldDefinition[]>({
    queryKey: ['custom-fields', projectId],
    queryFn: async () => {
      const url = projectId
        ? `/custom-fields?projectId=${projectId}`
        : '/custom-fields';
      const res = await api.get(url);
      return res.data;
    },
  });

  // Group fields by Section
  const sectionedFields = useMemo(() => {
    const groups: Record<string, CustomFieldDefinition[]> = {};
    for (const field of fields) {
      if (!field.isActive) continue;
      const sectionName = field.section?.trim() || 'General Information';
      if (!groups[sectionName]) {
        groups[sectionName] = [];
      }
      groups[sectionName].push(field);
    }
    return groups;
  }, [fields]);

  const handleFieldChange = (apiName: string, val: any) => {
    onChange({
      ...values,
      [apiName]: val,
    });
  };

  if (isLoading) {
    return (
      <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-xl flex items-center justify-center gap-2 text-xs text-slate-400">
        <div className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        Loading custom fields...
      </div>
    );
  }

  if (fields.length === 0) {
    return null;
  }

  return (
    <div className="space-y-5 pt-2">
      {Object.entries(sectionedFields).map(([sectionName, sectionFields]) => (
        <div
          key={sectionName}
          className="p-4 bg-slate-900/40 border border-slate-850 rounded-2xl space-y-4 shadow-sm"
        >
          <div className="flex items-center gap-2 pb-2 border-b border-slate-850">
            <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
            <h4 className="text-xs font-bold text-slate-200 tracking-wide uppercase">
              {sectionName}
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {sectionFields.map((field) => {
              const val = values[field.apiName] !== undefined ? values[field.apiName] : field.defaultValue || '';
              const error = errors[field.apiName];

              // Parse options for SELECT / MULTI_SELECT
              let parsedOptions: Array<{ label: string; value: string; color?: string }> = [];
              if (field.options) {
                try {
                  const opts = JSON.parse(field.options);
                  parsedOptions = opts.map((o: any) =>
                    typeof o === 'string' ? { label: o, value: o } : o,
                  );
                } catch {
                  parsedOptions = [];
                }
              }

              return (
                <div
                  key={field.id}
                  className={`space-y-1.5 ${
                    field.type === 'TEXTAREA' ? 'sm:col-span-2' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                      {field.name}
                      {field.isRequired && (
                        <span className="text-rose-400 font-bold">*</span>
                      )}
                    </label>
                    {field.description && (
                      <span
                        title={field.description}
                        className="text-slate-500 hover:text-slate-300 cursor-help"
                      >
                        <HelpCircle className="w-3 h-3" />
                      </span>
                    )}
                  </div>

                  {/* Field Controls based on Type */}
                  {field.type === 'TEXT' && (
                    <input
                      type="text"
                      placeholder={field.placeholder || 'Enter text...'}
                      value={val}
                      onChange={(e) =>
                        handleFieldChange(field.apiName, e.target.value)
                      }
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                  )}

                  {field.type === 'TEXTAREA' && (
                    <textarea
                      rows={3}
                      placeholder={field.placeholder || 'Enter notes or details...'}
                      value={val}
                      onChange={(e) =>
                        handleFieldChange(field.apiName, e.target.value)
                      }
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
                    />
                  )}

                  {field.type === 'NUMBER' && (
                    <input
                      type="number"
                      placeholder={field.placeholder || '0'}
                      value={val}
                      onChange={(e) =>
                        handleFieldChange(
                          field.apiName,
                          e.target.value === '' ? '' : Number(e.target.value),
                        )
                      }
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                  )}

                  {field.type === 'DECIMAL' && (
                    <input
                      type="number"
                      step="any"
                      placeholder={field.placeholder || '0.00'}
                      value={val}
                      onChange={(e) =>
                        handleFieldChange(
                          field.apiName,
                          e.target.value === '' ? '' : Number(e.target.value),
                        )
                      }
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                  )}

                  {field.type === 'CURRENCY' && (
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-bold">
                        $
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={val}
                        onChange={(e) =>
                          handleFieldChange(
                            field.apiName,
                            e.target.value === '' ? '' : Number(e.target.value),
                          )
                        }
                        className="w-full pl-7 pr-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                      />
                    </div>
                  )}

                  {field.type === 'PERCENTAGE' && (
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        placeholder="0.0"
                        value={val}
                        onChange={(e) =>
                          handleFieldChange(
                            field.apiName,
                            e.target.value === '' ? '' : Number(e.target.value),
                          )
                        }
                        className="w-full pr-7 pl-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-bold">
                        %
                      </span>
                    </div>
                  )}

                  {field.type === 'DATE' && (
                    <input
                      type="date"
                      value={val}
                      onChange={(e) =>
                        handleFieldChange(field.apiName, e.target.value)
                      }
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                  )}

                  {field.type === 'DATETIME' && (
                    <input
                      type="datetime-local"
                      value={val ? val.substring(0, 16) : ''}
                      onChange={(e) =>
                        handleFieldChange(field.apiName, e.target.value)
                      }
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                  )}

                  {field.type === 'CHECKBOX' && (
                    <label className="flex items-center gap-2.5 p-2 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition-all">
                      <input
                        type="checkbox"
                        checked={val === true || val === 'true'}
                        onChange={(e) =>
                          handleFieldChange(field.apiName, e.target.checked)
                        }
                        className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-950 cursor-pointer"
                      />
                      <span className="text-xs text-slate-300 font-medium">
                        {val === true || val === 'true' ? 'Enabled' : 'Disabled'}
                      </span>
                    </label>
                  )}

                  {field.type === 'SELECT' && (
                    <select
                      value={val}
                      onChange={(e) =>
                        handleFieldChange(field.apiName, e.target.value)
                      }
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all cursor-pointer"
                    >
                      <option value="">-- Select Option --</option>
                      {parsedOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  )}

                  {field.type === 'MULTI_SELECT' && (
                    <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5 max-h-36 overflow-y-auto">
                      {parsedOptions.map((opt) => {
                        const selectedList: string[] = Array.isArray(val)
                          ? val
                          : typeof val === 'string' && val
                          ? val.split(',').map((s) => s.trim())
                          : [];
                        const isSelected = selectedList.includes(opt.value);

                        return (
                          <label
                            key={opt.value}
                            className="flex items-center gap-2 text-xs text-slate-300 hover:text-white cursor-pointer py-0.5"
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                let updated: string[];
                                if (e.target.checked) {
                                  updated = [...selectedList, opt.value];
                                } else {
                                  updated = selectedList.filter(
                                    (x) => x !== opt.value,
                                  );
                                }
                                handleFieldChange(field.apiName, updated);
                              }}
                              className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                            <span>{opt.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {field.type === 'USER' && (
                    <select
                      value={val}
                      onChange={(e) =>
                        handleFieldChange(field.apiName, e.target.value)
                      }
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all cursor-pointer"
                    >
                      <option value="">-- Select User --</option>
                      {members.map((m: any) => {
                        const uid = m.userId || m.id || m.user?.id;
                        const name =
                          m.user
                            ? `${m.user.firstName || ''} ${m.user.lastName || ''}`.trim() || m.user.email
                            : `${m.firstName || ''} ${m.lastName || ''}`.trim() || m.email || uid;
                        return (
                          <option key={uid} value={uid}>
                            {name}
                          </option>
                        );
                      })}
                    </select>
                  )}

                  {field.type === 'URL' && (
                    <div className="relative">
                      <input
                        type="url"
                        placeholder="https://..."
                        value={val}
                        onChange={(e) =>
                          handleFieldChange(field.apiName, e.target.value)
                        }
                        className="w-full pl-8 pr-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                      />
                      <LinkIcon className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                    </div>
                  )}

                  {field.type === 'EMAIL' && (
                    <div className="relative">
                      <input
                        type="email"
                        placeholder="name@domain.com"
                        value={val}
                        onChange={(e) =>
                          handleFieldChange(field.apiName, e.target.value)
                        }
                        className="w-full pl-8 pr-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                      />
                      <Mail className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                    </div>
                  )}

                  {field.type === 'PHONE' && (
                    <div className="relative">
                      <input
                        type="tel"
                        placeholder="+1-555-0199"
                        value={val}
                        onChange={(e) =>
                          handleFieldChange(field.apiName, e.target.value)
                        }
                        className="w-full pl-8 pr-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                      />
                      <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                    </div>
                  )}

                  {/* Validation Error Message */}
                  {error && (
                    <p className="text-[10px] text-rose-400 font-medium pt-0.5">
                      {error}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
