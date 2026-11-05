import React, { useState, useEffect } from 'react';

export interface FastInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onCommit: (val: string | any) => void;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const FastInput = React.forwardRef<HTMLInputElement, FastInputProps>(({ value, onCommit, onChange, ...props }, ref) => {
  const [localVal, setLocalVal] = useState(value);

  useEffect(() => {
    setLocalVal(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    setLocalVal(nextVal);
    onCommit(nextVal);
    if (onChange) {
      onChange(e);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (localVal !== value) {
      onCommit(localVal);
    }
    if (props.onBlur) {
      props.onBlur(e);
    }
  };

  return (
    <input
      ref={ref}
      {...props}
      value={localVal}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
});

FastInput.displayName = 'FastInput';

export interface FastTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  value: string;
  onCommit: (val: string | any) => void;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

export const FastTextarea = React.forwardRef<HTMLTextAreaElement, FastTextareaProps>(({ value, onCommit, onChange, ...props }, ref) => {
  const [localVal, setLocalVal] = useState(value);

  useEffect(() => {
    setLocalVal(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextVal = e.target.value;
    setLocalVal(nextVal);
    onCommit(nextVal);
    if (onChange) {
      onChange(e);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    if (localVal !== value) {
      onCommit(localVal);
    }
    if (props.onBlur) {
      props.onBlur(e);
    }
  };

  return (
    <textarea
      ref={ref}
      {...props}
      value={localVal}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
});

FastTextarea.displayName = 'FastTextarea';
