import { forwardRef, type ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-deep',
  secondary: 'border border-line-strong bg-surface text-ink hover:bg-canvas',
  ghost: 'text-ink-soft hover:bg-quiet-soft',
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }>(
  function Button({ variant = 'secondary', size = 'md', className = '', ...rest }, ref) {
  return (
    <button
      ref={ref}
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${
        size === 'sm' ? 'h-8 px-3 text-sm' : 'h-10 px-4 text-sm'
      } max-sm:min-h-11 ${VARIANT[variant]} ${className}`}
    />
  );
});
