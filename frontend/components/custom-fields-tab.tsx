'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import {
  Plus,
  Trash2,
  Edit2,
  SlidersHorizontal,
  Layers,
  ArrowUp,
  ArrowDown,
  Check,
  X,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  CheckSquare,
  HelpCircle,
  LayoutGrid,
  Type,
} from 'lucide-react';
import {
  CustomFieldDefinition,
  FIELD_TYPE_CONFIG,
} from './dynamic-custom-fields';

interface CustomFieldsTabProps {
  projectId?: string;
  canManage?: boolean;
}

export default function CustomFieldsTab({
  projectId,
  canManage = true,
}: CustomFieldsTabProps) {
  const queryClient = useQueryClient();

  // Dialog & Form States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<CustomFieldDefinition | null>(
    null,
  );
  const [deleteConfirmField, setDeleteConfirmField] =
    useState<CustomFieldDefinition | null>(null);

  // Creation Wizard Step
  const [selectedType, setSelectedType] = useState<
    CustomFieldDefinition['type'] | null
  >(null);
  const [fieldName, setFieldName] = useState('');
  const [apiName, setApiName] = useState('');
  const [description, setDescription] = useState('');
  const [placeholder, setPlaceholder] = useState('');
  const [defaultValue, setDefaultValue] = useState('');
  const [isRequired, setIsRequired] = useState(false);
  const [showInList, setShowInList] = useState(true);
  const [showInKanban, setShowInKanban] = useState(false);
  const [showInGantt, setShowInGantt] = useState(false);
  const [section, setSection] = useState('General');

  // Options builder for Select / MultiSelect
  const [dropdownOptions, setDropdownOptions] = useState<
    Array<{ label: string; value: string; color: string }>
  >([
    { label: 'Option 1', value: 'Option 1', color: '#3b82f6' },
    { label: 'Option 2', value: 'Option 2', color: '#10b981' },
  ]);
  const [newOptionLabel, setNewOptionLabel] = useState('');
  const [newOptionColor, setNewOptionColor] = useState('#6366f1');

  // Validation Limits
  const [minLength, setMinLength] = useState<string>('');
  const [maxLength, setMaxLength] = useState<string>('');
  const [minValue, setMinValue] = useState<string>('');
  const [maxValue, setMaxValue] = useState<string>('');
  const [regexPattern, setRegexPattern] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch Custom Fields
  const { data: fields = [], isLoading } = useQuery<CustomFieldDefinition[]>({
    queryKey: ['custom-fields', projectId, true],
    queryFn: async () => {
      const url = projectId
        ? `/custom-fields?projectId=${projectId}&includeInactive=true`
        : '/custom-fields?includeInactive=true';
      const res = await api.get(url);
      return res.data;
    },
  });

  // Create Field Mutation
  const createFieldMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/custom-fields', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields'] });
      handleCloseCreateModal();
    },
    onError: (err: any) => {
      setFormError(
        err.response?.data?.message || 'Failed to create custom field',
      );
    },
  });

  // Update Field Mutation
  const updateFieldMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await api.put(`/custom-fields/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields'] });
      setEditingField(null);
    },
  });

  // Delete Field Mutation
  const deleteFieldMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/custom-fields/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields'] });
      setDeleteConfirmField(null);
    },
  });

  // Reorder Fields Mutation
  const reorderMutation = useMutation({
    mutationFn: async (items: Array<{ id: string; position: number }>) => {
      const res = await api.put('/custom-fields/reorder', { items });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields'] });
    },
  });

  const handleNameChange = (name: string) => {
    setFieldName(name);
    if (!editingField) {
      const slug =
        'cf_' +
        name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_|_$/g, '');
      setApiName(slug);
    }
  };

  const handleOpenCreateModal = () => {
    setSelectedType('TEXT');
    setFieldName('');
    setApiName('');
    setDescription('');
    setPlaceholder('');
    setDefaultValue('');
    setIsRequired(false);
    setShowInList(true);
    setShowInKanban(false);
    setShowInGantt(false);
    setSection('General');
    setDropdownOptions([
      { label: 'Option 1', value: 'Option 1', color: '#3b82f6' },
      { label: 'Option 2', value: 'Option 2', color: '#10b981' },
    ]);
    setMinLength('');
    setMaxLength('');
    setMinValue('');
    setMaxValue('');
    setRegexPattern('');
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
    setSelectedType(null);
    setFormError(null);
  };

  const handleAddOption = () => {
    if (!newOptionLabel.trim()) return;
    setDropdownOptions([
      ...dropdownOptions,
      {
        label: newOptionLabel.trim(),
        value: newOptionLabel.trim(),
        color: newOptionColor,
      },
    ]);
    setNewOptionLabel('');
  };

  const handleRemoveOption = (index: number) => {
    setDropdownOptions(dropdownOptions.filter((_, i) => i !== index));
  };

  const handleSaveCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType || !fieldName.trim() || !apiName.trim()) {
      setFormError('Please provide a field name and valid API identifier');
      return;
    }

    const validationObj: any = {};
    if (minLength) validationObj.minLength = Number(minLength);
    if (maxLength) validationObj.maxLength = Number(maxLength);
    if (minValue) validationObj.minValue = Number(minValue);
    if (maxValue) validationObj.maxValue = Number(maxValue);
    if (regexPattern) validationObj.regex = regexPattern;

    const payload: any = {
      name: fieldName.trim(),
      apiName: apiName.trim(),
      type: selectedType,
      projectId: projectId || null,
      description: description.trim() || null,
      placeholder: placeholder.trim() || null,
      defaultValue: defaultValue.trim() || null,
      isRequired,
      showInList,
      showInKanban,
      showInGantt,
      section: section.trim() || 'General',
    };

    if (
      selectedType === 'SELECT' ||
      selectedType === 'MULTI_SELECT'
    ) {
      payload.options = JSON.stringify(dropdownOptions);
    }

    if (Object.keys(validationObj).length > 0) {
      payload.validation = JSON.stringify(validationObj);
    }

    createFieldMutation.mutate(payload);
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const newFields = [...fields];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newFields.length) return;

    const temp = newFields[index];
    newFields[index] = newFields[targetIndex];
    newFields[targetIndex] = temp;

    const items = newFields.map((f, pos) => ({ id: f.id, position: pos }));
    reorderMutation.mutate(items);
  };

  const handleToggleActive = (field: CustomFieldDefinition) => {
    updateFieldMutation.mutate({
      id: field.id,
      data: { isActive: !field.isActive },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 bg-slate-900/40 border border-slate-850 rounded-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-bold text-slate-100">
              {projectId ? 'Project Task Custom Fields' : 'Organization Task Custom Fields'}
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            {projectId
              ? 'Configure custom attributes specifically scoped to this project.'
              : 'Define global attributes applicable to all projects across the organization portal.'}
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl font-semibold shadow-lg text-xs active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Custom Field
          </button>
        )}
      </div>

      {/* Fields List Table / Cards */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400 flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
          <span className="text-xs">Loading custom field definitions...</span>
        </div>
      ) : fields.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/20 border border-slate-850 rounded-2xl space-y-3">
          <SlidersHorizontal className="w-8 h-8 text-slate-600 mx-auto" />
          <h4 className="text-sm font-semibold text-slate-300">
            No Custom Fields Configured
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Add custom fields like Release Version, Sprint, Environment, or Cost
            Center to capture structured project data.
          </p>
        </div>
      ) : (
        <div className="bg-slate-900/30 border border-slate-850 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-850">
                <tr>
                  <th className="px-4 py-3.5 w-12 text-center">#</th>
                  <th className="px-4 py-3.5">Field Name & Key</th>
                  <th className="px-4 py-3.5">Type</th>
                  <th className="px-4 py-3.5">Section</th>
                  <th className="px-4 py-3.5">Required</th>
                  <th className="px-4 py-3.5">Views</th>
                  <th className="px-4 py-3.5">Status</th>
                  {canManage && (
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 bg-slate-900/10">
                {fields.map((field, idx) => {
                  const typeCfg = FIELD_TYPE_CONFIG[field.type] || {
                    label: field.type,
                    icon: Type,
                    color: 'text-slate-400 bg-slate-800 border-slate-700',
                  };
                  const Icon = typeCfg.icon;

                  return (
                    <tr
                      key={field.id}
                      className={`hover:bg-slate-900/40 transition-colors ${
                        !field.isActive ? 'opacity-50' : ''
                      }`}
                    >
                      {/* Position Reorder */}
                      <td className="px-4 py-3 text-center">
                        {canManage ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => handleMove(idx, 'up')}
                              disabled={idx === 0}
                              className="text-slate-500 hover:text-indigo-400 disabled:opacity-20 cursor-pointer"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {idx + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleMove(idx, 'down')}
                              disabled={idx === fields.length - 1}
                              className="text-slate-500 hover:text-indigo-400 disabled:opacity-20 cursor-pointer"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-500">{idx + 1}</span>
                        )}
                      </td>

                      {/* Name & Key */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                          {field.name}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500">
                          {field.apiName}
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded-lg text-[10px] font-semibold inline-flex items-center gap-1.5 border ${typeCfg.color}`}
                        >
                          <Icon className="w-3 h-3" />
                          {typeCfg.label}
                        </span>
                      </td>

                      {/* Section */}
                      <td className="px-4 py-3 text-slate-400">
                        <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px]">
                          {field.section || 'General'}
                        </span>
                      </td>

                      {/* Required */}
                      <td className="px-4 py-3">
                        {field.isRequired ? (
                          <span className="text-rose-400 font-bold text-[11px]">
                            Required
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">
                            Optional
                          </span>
                        )}
                      </td>

                      {/* Views */}
                      <td className="px-4 py-3 text-[10px] space-x-1">
                        {field.showInList && (
                          <span className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded">
                            List
                          </span>
                        )}
                        {field.showInKanban && (
                          <span className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded">
                            Kanban
                          </span>
                        )}
                      </td>

                      {/* Status Active/Inactive */}
                      <td className="px-4 py-3">
                        {canManage ? (
                          <button
                            type="button"
                            onClick={() => handleToggleActive(field)}
                            className={`px-2 py-1 rounded-full text-[10px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors ${
                              field.isActive
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                field.isActive ? 'bg-emerald-500' : 'bg-slate-500'
                              }`}
                            />
                            {field.isActive ? 'Active' : 'Inactive'}
                          </button>
                        ) : (
                          <span className="text-slate-400">
                            {field.isActive ? 'Active' : 'Inactive'}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      {canManage && (
                        <td className="px-4 py-3 text-right space-x-1">
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmField(field)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                            title="Delete Field"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Custom Field Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-indigo-400" />
                Create New Task Custom Field
              </h3>
              <button
                type="button"
                onClick={handleCloseCreateModal}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCreate} className="space-y-6">
              {formError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {formError}
                </div>
              )}

              {/* 1. Select Field Type */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  1. Select Field Type
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto p-1">
                  {Object.entries(FIELD_TYPE_CONFIG).map(([typeKey, cfg]) => {
                    const Icon = cfg.icon;
                    const isSelected = selectedType === typeKey;
                    return (
                      <button
                        key={typeKey}
                        type="button"
                        onClick={() =>
                          setSelectedType(
                            typeKey as CustomFieldDefinition['type'],
                          )
                        }
                        className={`p-3 rounded-xl border text-left flex flex-col gap-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600/20 border-indigo-500 ring-1 ring-indigo-500'
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`p-1.5 rounded-lg border ${cfg.color}`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-xs font-bold text-slate-200 truncate">
                            {cfg.label}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 line-clamp-2">
                          {cfg.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Field Properties */}
              <div className="space-y-4 pt-2 border-t border-slate-800">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  2. Field Configuration
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Field Label *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Release Version"
                      value={fieldName}
                      onChange={(e) => handleNameChange(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 placeholder-slate-650 focus:outline-none focus:border-indigo-500 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      API Identifier *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="cf_release_version"
                      value={apiName}
                      onChange={(e) => setApiName(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 placeholder-slate-650 focus:outline-none focus:border-indigo-500 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Form Section
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Specifications, Financials"
                      value={section}
                      onChange={(e) => setSection(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 placeholder-slate-650 focus:outline-none focus:border-indigo-500 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Default Value
                    </label>
                    <input
                      type="text"
                      placeholder="Default initial value..."
                      value={defaultValue}
                      onChange={(e) => setDefaultValue(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 placeholder-slate-650 focus:outline-none focus:border-indigo-500 text-xs"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Help Text / Tooltip
                    </label>
                    <input
                      type="text"
                      placeholder="Guidance displayed to team members..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 placeholder-slate-650 focus:outline-none focus:border-indigo-500 text-xs"
                    />
                  </div>
                </div>

                {/* Dropdown Options Builder for SELECT & MULTI_SELECT */}
                {(selectedType === 'SELECT' ||
                  selectedType === 'MULTI_SELECT') && (
                  <div className="space-y-3 p-4 bg-slate-950/60 border border-slate-850 rounded-xl">
                    <label className="block text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">
                      Dropdown Choices / Options List
                    </label>
                    <div className="space-y-2">
                      {dropdownOptions.map((opt, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 bg-slate-900 border border-slate-800 rounded-lg text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: opt.color }}
                            />
                            <span className="font-semibold text-slate-200">
                              {opt.label}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveOption(idx)}
                            className="text-slate-500 hover:text-rose-400 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2 pt-2">
                      <input
                        type="text"
                        placeholder="New option label..."
                        value={newOptionLabel}
                        onChange={(e) => setNewOptionLabel(e.target.value)}
                        className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                      <input
                        type="color"
                        value={newOptionColor}
                        onChange={(e) => setNewOptionColor(e.target.value)}
                        className="w-8 h-8 rounded-lg bg-transparent border-0 cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={handleAddOption}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        Add Option
                      </button>
                    </div>
                  </div>
                )}

                {/* Flags and Toggles */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                  <label className="flex items-center gap-2 p-2.5 bg-slate-950 border border-slate-850 rounded-xl cursor-pointer hover:border-slate-700">
                    <input
                      type="checkbox"
                      checked={isRequired}
                      onChange={(e) => setIsRequired(e.target.checked)}
                      className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-indigo-600"
                    />
                    <span className="text-xs text-slate-300 font-semibold">
                      Required Field
                    </span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 bg-slate-950 border border-slate-850 rounded-xl cursor-pointer hover:border-slate-700">
                    <input
                      type="checkbox"
                      checked={showInList}
                      onChange={(e) => setShowInList(e.target.checked)}
                      className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-indigo-600"
                    />
                    <span className="text-xs text-slate-300 font-semibold">
                      Show in List
                    </span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 bg-slate-950 border border-slate-850 rounded-xl cursor-pointer hover:border-slate-700">
                    <input
                      type="checkbox"
                      checked={showInKanban}
                      onChange={(e) => setShowInKanban(e.target.checked)}
                      className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-indigo-600"
                    />
                    <span className="text-xs text-slate-300 font-semibold">
                      Show on Kanban
                    </span>
                  </label>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleCloseCreateModal}
                  className="px-4 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createFieldMutation.isPending}
                  className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {createFieldMutation.isPending && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  Save Field Definition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmField && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-100">
                Delete Custom Field?
              </h3>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Are you sure you want to delete{' '}
              <strong className="text-slate-200">
                {deleteConfirmField.name}
              </strong>{' '}
              ({deleteConfirmField.apiName})? Historical values stored in existing
              tasks will remain safely preserved, but the field will no longer
              appear on new creation forms.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmField(null)}
                className="px-4 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  deleteFieldMutation.mutate(deleteConfirmField.id)
                }
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
