import type { ButtonHTMLAttributes } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary';
};

export function Button({ variant = 'primary', className = '', ...rest }: Props) {
  const base =
    'w-full rounded-xl px-4 py-3 text-base font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-accent-600 text-white hover:bg-accent-700 active:bg-accent-800',
    secondary:
      'bg-transparent text-accent-700 dark:text-accent-300 border border-accent-300 dark:border-accent-700 hover:bg-accent-50 dark:hover:bg-accent-900',
  };
  return <button className={`${base} ${variants[variant]} ${className}`} {...rest} />;
}
