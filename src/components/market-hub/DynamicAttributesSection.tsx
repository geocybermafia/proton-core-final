import React from 'react';
import { ChevronDown, Link as LinkIcon, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { MarketTheme } from './MarketConstants';
import {
  CategoryFormSchema,
  DynamicFieldSchema,
  isDynamicFieldCore,
  isDynamicFieldVisible,
} from './ListingSchemas';
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
  const isKa = language === 'ka';

  const visibleFields = React.useMemo(
    () => (schema.fields || []).filter((f) => isDynamicFieldVisible(f, attributes)),
    [schema.fields, attributes]
  );

  const coreFields = React.useMemo(
    () => visibleFields.filter((f) => isDynamicFieldCore(f)),
    [visibleFields]
  );

  const additionalFields = React.useMemo(
    () => visibleFields.filter((f) => !isDynamicFieldCore(f)),
    [visibleFields]
  );

  const filledAdditionalCount = React.useMemo(() => {
    return additionalFields.filter((f) => {
      const val = attributes[f.key];
      if (f.type === 'boolean') return val === true;
      return val !== undefined && val !== null && String(val).trim() !== '';
    }).length;
  }, [additionalFields, attributes]);

  const hasAdditionalErrors = React.useMemo(
    () => additionalFields.some((f) => Boolean(errors[f.key])),
    [additionalFields, errors]
  );

  const [showAdditional, setShowAdditional] = React.useState<boolean>(
    () => filledAdditionalCount > 0 || hasAdditionalErrors
  );
  const prevFilledCountRef = React.useRef<number>(filledAdditionalCount);

  React.useEffect(() => {
    setShowAdditional(filledAdditionalCount > 0 || hasAdditionalErrors);
    prevFilledCountRef.current = filledAdditionalCount;
  }, [schema.categoryId]);

  React.useEffect(() => {
    if (prevFilledCountRef.current === 0 && filledAdditionalCount > 0) {
      setShowAdditional(true);
    }
    prevFilledCountRef.current = filledAdditionalCount;
  }, [filledAdditionalCount]);

  React.useEffect(() => {
    if (hasAdditionalErrors) {
      setShowAdditional(true);
    }
  }, [hasAdditionalErrors]);

  if (!schema.fields || schema.fields.length === 0 || visibleFields.length === 0) {
    return null;
  }

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
        <div key={`${schema.categoryId}-${field.key}`} className="space-y-2 min-w-0">
          <label className={cn(
            "text-[13px] sm:text-sm font-bold leading-snug flex flex-wrap items-center gap-1.5",
            field.required ? currentTheme.accent : currentTheme.text
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
                "w-full min-h-[46px] pl-4 pr-10 py-3 rounded-2xl border appearance-none text-base md:text-sm font-semibold shadow-inner transition-all cursor-pointer",
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
              size={16}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-proton-muted pointer-events-none group-hover:text-proton-text transition-colors"
            />
          </div>
          {errorMsg && (
            <p className="text-xs sm:text-[13px] font-semibold text-rose-500 flex items-center gap-1.5 ml-1">
              <AlertCircle size={13} className="shrink-0" />
              <span>{errorMsg}</span>
            </p>
          )}
        </div>
      );
    }

    if (field.type === 'url') {
      return (
        <div key={`${schema.categoryId}-${field.key}`} className="space-y-2 min-w-0">
          <label className={cn(
            "text-[13px] sm:text-sm font-bold leading-snug flex flex-wrap items-center gap-1.5",
            field.required ? currentTheme.accent : currentTheme.text
          )}>
            <span>{label}</span>
            {field.required && <span className="text-rose-500">*</span>}
          </label>
          <div className="relative group">
            <LinkIcon
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-proton-muted group-focus-within:text-proton-accent transition-colors"
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
                "w-full min-h-[46px] pl-10 pr-4 py-3 rounded-2xl border text-base md:text-sm font-semibold shadow-inner transition-all scroll-mb-24",
                currentTheme.input,
                errorMsg && "border-rose-500/70 focus:border-rose-500"
              )}
            />
          </div>
          {errorMsg && (
            <p className="text-xs sm:text-[13px] font-semibold text-rose-500 flex items-center gap-1.5 ml-1">
              <AlertCircle size={13} className="shrink-0" />
              <span>{errorMsg}</span>
            </p>
          )}
        </div>
      );
    }

    if (field.type === 'number') {
      return (
        <div key={`${schema.categoryId}-${field.key}`} className="space-y-2 min-w-0">
          <label className={cn(
            "text-[13px] sm:text-sm font-bold leading-snug flex flex-wrap items-center gap-1.5",
            field.required ? currentTheme.accent : currentTheme.text
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
                "w-full min-h-[46px] px-4 py-3 rounded-2xl border text-base md:text-sm font-bold font-mono tabular-nums shadow-inner transition-all scroll-mb-24",
                field.suffix ? "pr-16" : "",
                currentTheme.input,
                errorMsg && "border-rose-500/70 focus:border-rose-500"
              )}
            />
            {field.suffix && (
              <span className={cn(
                "absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono font-bold pointer-events-none",
                currentTheme.muted
              )}>
                {field.suffix}
              </span>
            )}
          </div>
          {errorMsg && (
            <p className="text-xs sm:text-[13px] font-semibold text-rose-500 flex items-center gap-1.5 ml-1">
              <AlertCircle size={13} className="shrink-0" />
              <span>{errorMsg}</span>
            </p>
          )}
        </div>
      );
    }

    // Default: 'text'
    return (
      <div key={`${schema.categoryId}-${field.key}`} className="space-y-2 min-w-0">
        <label className={cn(
          "text-[13px] sm:text-sm font-bold leading-snug flex flex-wrap items-center gap-1.5",
          field.required ? currentTheme.accent : currentTheme.text
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
            "w-full min-h-[46px] px-4 py-3 rounded-2xl border text-base md:text-sm font-semibold shadow-inner transition-all scroll-mb-24",
            currentTheme.input,
            errorMsg && "border-rose-500/70 focus:border-rose-500"
          )}
        />
        {errorMsg && (
          <p className="text-xs sm:text-[13px] font-semibold text-rose-500 flex items-center gap-1.5 ml-1">
            <AlertCircle size={13} className="shrink-0" />
            <span>{errorMsg}</span>
          </p>
        )}
      </div>
    );
  };

  const renderBooleanField = (field: DynamicFieldSchema) => {
    const checked = attributes[field.key] === true;
    const errorMsg = errors[field.key];
    const label = isKa ? field.labelKa : field.labelEn;

    return (
      <div key={`${schema.categoryId}-${field.key}`} className="space-y-1.5">
        <div className={cn(
          "px-4 py-3 min-h-[54px] rounded-2xl bg-proton-card/70 border border-proton-border flex items-center justify-between gap-4",
          errorMsg && "border-rose-500/70"
        )}>
          <span className={cn("text-[13px] sm:text-sm font-semibold leading-snug break-words min-w-0", currentTheme.text)}>
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
            className="min-w-[44px] min-h-[44px] flex items-center justify-end shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-proton-accent rounded-xl"
          >
            <span className={cn(
              "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out",
              checked ? "bg-proton-accent" : "bg-proton-border"
            )}>
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                  checked ? "translate-x-5" : "translate-x-0"
                )}
              />
            </span>
          </button>
        </div>
        {errorMsg && (
          <p className="text-xs sm:text-[13px] font-semibold text-rose-500 flex items-center gap-1.5 ml-1">
            <AlertCircle size={13} className="shrink-0" />
            <span>{errorMsg}</span>
          </p>
        )}
      </div>
    );
  };

  const renderFieldGroup = (fields: DynamicFieldSchema[]) => {
    const nonBoolean = fields.filter((f) => f.type !== 'boolean');
    const bools = fields.filter((f) => f.type === 'boolean');
    return (
      <>
        {nonBoolean.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
            {nonBoolean.map(renderFieldInput)}
          </div>
        )}
        {bools.length > 0 && (
          <div className="space-y-3">
            {bools.map(renderBooleanField)}
          </div>
        )}
      </>
    );
  };

  const hasCoreRequired = coreFields.some((f) => f.required);

  return (
    <div className="space-y-4">
      {coreFields.length > 0 && (
        <div className="space-y-5 p-4 sm:p-5 rounded-2xl bg-proton-bg/60 border border-proton-border shadow-inner">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={cn("text-sm font-bold flex items-center gap-2 leading-snug", currentTheme.accent)}>
              <span>🧩</span>
              <span>{isKa ? 'ძირითადი მახასიათებლები' : 'Key Specifications'}</span>
            </span>
            {hasCoreRequired && (
              <span className={cn("text-xs font-semibold", currentTheme.muted)}>
                {isKa ? '* სავალდებულო' : '* Required'}
              </span>
            )}
          </div>

          {renderFieldGroup(coreFields)}
        </div>
      )}

      {additionalFields.length > 0 && (
        <div className="rounded-2xl bg-proton-bg/50 border border-proton-border overflow-hidden">
          <button
            type="button"
            data-testid="toggle-additional-details"
            aria-expanded={showAdditional}
            onClick={() => setShowAdditional((prev) => !prev)}
            className="w-full min-h-[48px] px-4 sm:px-5 py-3 flex items-center justify-between gap-3 text-left hover:bg-proton-card/50 transition-colors cursor-pointer"
          >
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <span className={cn("text-[13px] sm:text-sm font-bold leading-snug", currentTheme.text)}>
                {isKa ? 'დამატებითი მახასიათებლები' : 'Additional details'}
              </span>
              <span className={cn("text-xs font-medium", currentTheme.muted)}>
                {filledAdditionalCount > 0
                  ? (isKa ? `(${filledAdditionalCount} შევსებული)` : `(${filledAdditionalCount} filled)`)
                  : (isKa ? '(არასავალდებულო)' : '(optional)')}
              </span>
            </div>
            <ChevronDown
              size={18}
              className={cn(
                "shrink-0 transition-transform duration-200",
                currentTheme.muted,
                showAdditional && "rotate-180 text-proton-accent"
              )}
            />
          </button>

          {showAdditional && (
            <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-2 border-t border-proton-border/60 space-y-4">
              {renderFieldGroup(additionalFields)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
