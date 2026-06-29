import React, { useState, useEffect } from 'react';

export interface FastInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onCommit: (val: string | any) => void;
}

export const FastInput = React.forwardRef<HTMLInputElement, FastInputProps>(({ value, onCommit, ...props }, ref) => {
  const [localVal, setLocalVal] = useState(value);

  useEffect(() => {
    setLocalVal(value);
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localVal !== value) {
        onCommit(localVal);
      }
    }, 150); // Fast 150ms state commit to minimize lag completely while capturing fast typing batches
    return () => clearTimeout(timer);
  }, [localVal, value, onCommit]);

  return (
    <input
      ref={ref}
      {...props}
      value={localVal}
      onChange={(e) => setLocalVal(e.target.value)}
      onBlur={() => {
        if (localVal !== value) {
          onCommit(localVal);
        }
      }}
    />
  );
});

FastInput.displayName = 'FastInput';

export interface FastTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  value: string;
  onCommit: (val: string | any) => void;
}

export const FastTextarea = React.forwardRef<HTMLTextAreaElement, FastTextareaProps>(({ value, onCommit, ...props }, ref) => {
  const [localVal, setLocalVal] = useState(value);

  useEffect(() => {
    setLocalVal(value);
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localVal !== value) {
        onCommit(localVal);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [localVal, value, onCommit]);

  return (
    <textarea
      ref={ref}
      {...props}
      value={localVal}
      onChange={(e) => setLocalVal(e.target.value)}
      onBlur={() => {
        if (localVal !== value) {
          onCommit(localVal);
        }
      }}
    />
  );
});

FastTextarea.displayName = 'FastTextarea';
