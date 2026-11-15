import React from 'react';
import { ChevronDown, Link as LinkIcon, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { MarketTheme } from './MarketConstants';
import { CategoryFormSchema, DynamicFieldSchema } from './ListingSchemas';
import { FastInput } from './FastInputs';

export interface DynamicAttributesSectionProps {
  schema: CategoryFormSchema;
  attributes: Record<string, string | number | boolean>;
  onChange: (key: string, value: string | number | boolean | undefined) => void;
  language: string;
  currentTheme: MarketTheme;
  errors?: Record<string, string>;
  onClearError?: (key: string) => void;
}

export const DynamicAttributesSection: React.FC<DynamicAttributesSectionProps> = ({
  schema,
  attributes,
  onChange,
  language,
  currentTheme,
  errors = {},
  onClearError,
}) => {
  if (!schema.fields || schema.fields.length === 0) {
    return null;
  }

  const isKa = language === 'ka';
  const nonBooleanFields = schema.fields.filter(f => f.type !== 'boolean');
  const booleanFields = schema.fields.filter(f => f.type === 'boolean');

  const renderFieldInput = (field: DynamicFieldSchema) => {
    const rawValue = attributes[field.key];
    const stringValue = rawValue === undefined || rawValue === null ? '' : String(rawValue);
    const errorMsg = errors[field.key];
    const label = isKa ? field.labelKa : field.labelEn;
    const placeholder = isKa
      ? (field.placeholderKa || '')
      : (field.placeholderEn || '');

    if (field.type === 'select') {
      return (
        <div key={`${schema.categoryId}-${field.key}`} className="space-y-2.5">
          <label className={cn(
            "text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5",
            field.required ? currentTheme.accent : currentTheme.muted
          )}>
            <span>{label}</span>
            {field.required && <span className="text-rose-500">*</span>}
          </label>
          <div className="relative group">
            <select
              value={stringValue}
              onChange={(e) => {
                const nextVal = e.target.value;
                onChange(field.key, nextVal || undefined);
                onClearError?.(field.key);
              }}
              aria-invalid={Boolean(errorMsg)}
              className={cn(
                "w-full pl-4 pr-10 py-3.5 rounded-2xl border appearance-none text-xs font-bold shadow-inner transition-all cursor-pointer",
                currentTheme.input,
                errorMsg && "border-rose-500/70 focus:border-rose-500"
              )}
            >
              <option value="" className="bg-proton-card text-proton-muted">
                {isKa ? 'აირჩიეთ...' : 'Select...'}
              </option>
              {(field.options || []).map((opt) => (
                <option
                  key={opt.value}
                  value={opt.value}
                  className="bg-proton-card text-proton-text font-semibold py-1.5"
                >
                  {isKa ? opt.labelKa : opt.labelEn}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-4.5 top-1/2 -translate-y-1/2 text-proton-muted pointer-events-none group-hover:text-proton-text transition-colors"
            />
          </div>
          {errorMsg && (
            <p className="text-[11px] font-semibold text-rose-500 flex items-center gap-1.5 ml-1">
              <AlertCircle size={12} className="shrink-0" />
              <span>{errorMsg}</span>
            </p>
          )}
        </div>
      );
    }

    if (field.type === 'url') {
      return (
        <div key={`${schema.categoryId}-${field.key}`} className="space-y-2.5">
          <label className={cn(
            "text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5",
            field.required ? currentTheme.accent : currentTheme.muted
          )}>
            <span>{label}</span>
            {field.required && <span className="text-rose-500">*</span>}
          </label>
          <div className="relative group">
            <LinkIcon
              size={13}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-proton-muted group-focus-within:text-proton-accent transition-colors"
            />
            <FastInput
              type="url"
              value={stringValue}
              maxLength={field.maxLength || 300}
              onCommit={(val) => {
                onChange(field.key, val);
                onClearError?.(field.key);
              }}
              placeholder={placeholder}
              aria-invalid={Boolean(errorMsg)}
              className={cn(
                "w-full pl-10 pr-4 py-3.5 rounded-2xl border text-xs font-bold shadow-inner transition-all",
                currentTheme.input,
                errorMsg && "border-rose-500/70 focus:border-rose-500"
              )}
            />
          </div>
          {errorMsg && (
            <p className="text-[11px] font-semibold text-rose-500 flex items-center gap-1.5 ml-1">
              <AlertCircle size={12} className="shrink-0" />
              <span>{errorMsg}</span>
            </p>
          )}
        </div>
      );
    }

    if (field.type === 'number') {
      return (
        <div key={`${schema.categoryId}-${field.key}`} className="space-y-2.5">
          <label className={cn(
            "text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5",
            field.required ? currentTheme.accent : currentTheme.muted
          )}>
            <span>{label}</span>
            {field.required && <span className="text-rose-500">*</span>}
          </label>
          <div className="relative">
            <FastInput
              type="number"
              min={field.min}
              max={field.max}
              step="any"
              value={stringValue}
              onCommit={(val) => {
                onChange(field.key, val);
                onClearError?.(field.key);
              }}
              placeholder={placeholder}
              aria-invalid={Boolean(errorMsg)}
              className={cn(
                "w-full px-4.5 py-3.5 rounded-2xl border text-xs font-bold font-mono shadow-inner transition-all",
                field.suffix ? "pr-16" : "",
                currentTheme.input,
                errorMsg && "border-rose-500/70 focus:border-rose-500"
              )}
            />
            {field.suffix && (
              <span className={cn(
                "absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold pointer-events-none",
                currentTheme.muted
              )}>
                {field.suffix}
              </span>
            )}
          </div>
          {errorMsg && (
            <p className="text-[11px] font-semibold text-rose-500 flex items-center gap-1.5 ml-1">
              <AlertCircle size={12} className="shrink-0" />
              <span>{errorMsg}</span>
            </p>
          )}
        </div>
      );
    }

    // Default: 'text'
    return (
      <div key={`${schema.categoryId}-${field.key}`} className="space-y-2.5">
        <label className={cn(
          "text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5",
          field.required ? currentTheme.accent : currentTheme.muted
        )}>
          <span>{label}</span>
          {field.required && <span className="text-rose-500">*</span>}
        </label>
        <FastInput
          type="text"
          value={stringValue}
          maxLength={field.maxLength || 160}
          onCommit={(val) => {
            onChange(field.key, val);
            onClearError?.(field.key);
          }}
          placeholder={placeholder}
          aria-invalid={Boolean(errorMsg)}
          className={cn(
            "w-full px-4.5 py-3.5 rounded-2xl border text-xs font-bold shadow-inner transition-all",
            currentTheme.input,
            errorMsg && "border-rose-500/70 focus:border-rose-500"
          )}
        />
        {errorMsg && (
          <p className="text-[11px] font-semibold text-rose-500 flex items-center gap-1.5 ml-1">
            <AlertCircle size={12} className="shrink-0" />
            <span>{errorMsg}</span>
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5 p-5 rounded-3xl bg-proton-bg/60 border border-proton-border shadow-inner">
      <div className="flex items-center justify-between gap-2">
        <span className={cn("text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5", currentTheme.accent)}>
          <span>🧩</span>
          <span>{isKa ? 'კატეგორიის სპეციფიკური მონაცემები' : 'Category Specifications'}</span>
        </span>
        <span className={cn("text-[9px] font-mono uppercase", currentTheme.muted)}>
          {isKa ? '* სავალდებულო' : '* Required'}
        </span>
      </div>

      {nonBooleanFields.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {nonBooleanFields.map(renderFieldInput)}
        </div>
      )}

      {booleanFields.length > 0 && (
        <div className="space-y-3 pt-1">
          {booleanFields.map((field) => {
            const checked = attributes[field.key] === true;
            const errorMsg = errors[field.key];
            const label = isKa ? field.labelKa : field.labelEn;

            return (
              <div key={`${schema.categoryId}-${field.key}`} className="space-y-1.5">
                <div className={cn(
                  "px-4 py-3 rounded-2xl bg-proton-card/70 border border-proton-border flex items-center justify-between gap-4",
                  errorMsg && "border-rose-500/70"
                )}>
                  <span className={cn("text-xs font-bold", currentTheme.text)}>
                    {label}
                    {field.required && <span className="text-rose-500 ml-1">*</span>}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={checked}
                    aria-label={label}
                    onClick={() => {
                      onChange(field.key, checked ? undefined : true);
                      onClearError?.(field.key);
                    }}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none",
                      checked ? "bg-proton-accent" : "bg-proton-border"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-300 ease-in-out",
                        checked ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>
                {errorMsg && (
                  <p className="text-[11px] font-semibold text-rose-500 flex items-center gap-1.5 ml-1">
                    <AlertCircle size={12} className="shrink-0" />
                    <span>{errorMsg}</span>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
