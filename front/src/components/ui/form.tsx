import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { forwardRef } from 'react'
import { TriangleAlert } from 'lucide-react'

export function focusChampInvalide(formulaire: HTMLFormElement) {
  // Attendre que React relie le champ à son message avant de lui donner le focus.
  requestAnimationFrame(() => formulaire.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
}

// ============================================================
// Boutons — 48 px de haut minimum (brief : ergonomie seniors)
// ============================================================
export type ButtonVariant =
  | 'primaire'
  | 'secondaire'
  | 'ocre'
  | 'fantome'
  | 'danger'
  | 'blanc'
export type ButtonSize = 'normal' | 'petit'

export function buttonClasses(variant: ButtonVariant = 'primaire', size: ButtonSize = 'normal'): string {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-colors select-none'
  const dims =
    size === 'petit'
      ? 'min-h-[44px] px-4 text-[0.9375rem]'
      : 'min-h-[48px] px-6 text-[1.0625rem]'
  const styles: Record<ButtonVariant, string> = {
    primaire: 'bg-forest text-white hover:bg-forest-dark disabled:opacity-50 disabled:cursor-not-allowed',
    secondaire: 'bg-white text-forest border border-forest hover:bg-leaf-pale disabled:opacity-50 disabled:cursor-not-allowed',
    ocre: 'bg-ocre text-white hover:bg-ocre-dark disabled:opacity-50 disabled:cursor-not-allowed',
    fantome: 'bg-transparent text-forest hover:bg-leaf-pale disabled:opacity-50',
    danger: 'bg-brique text-white hover:bg-brique/90 disabled:opacity-50 disabled:cursor-not-allowed',
    blanc: 'bg-white text-bark border border-line hover:bg-sand disabled:opacity-50',
  }
  return `${base} ${dims} ${styles[variant]}`
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primaire', size = 'normal', className = '', type = 'button', ...rest },
  ref,
) {
  return <button ref={ref} type={type} className={`${buttonClasses(variant, size)} ${className}`} {...rest} />
})

// ============================================================
// Champs de formulaire
// ============================================================
const inputBase =
  'w-full rounded-xl border bg-white px-4 py-3 text-[1.0625rem] text-bark placeholder:text-mist min-h-[48px]'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
  describedBy?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, describedBy, className = '', ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className={`${inputBase} ${invalid ? 'border-brique focus:border-brique' : 'border-controle focus:border-forest'} ${className}`}
      {...rest}
    />
  )
})

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
  describedBy?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, describedBy, className = '', rows = 5, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className={`${inputBase} ${invalid ? 'border-brique focus:border-brique' : 'border-controle focus:border-forest'} ${className}`}
      {...rest}
    />
  )
})

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean
  describedBy?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid, describedBy, className = '', children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className={`${inputBase} ${invalid ? 'border-brique' : 'border-controle focus:border-forest'} ${className}`}
      {...rest}
    >
      {children}
    </select>
  )
})

interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode
}

export function Checkbox({ label, id, className = '', ...rest }: CheckboxProps) {
  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <input
        id={id}
        type="checkbox"
        className="mt-2 h-6 w-6 shrink-0 accent-forest cursor-pointer"
        {...rest}
      />
      <label htmlFor={id} className="text-[1.0625rem] leading-relaxed cursor-pointer">
        {label}
      </label>
    </div>
  )
}

interface RadioProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode
  hint?: string
}

export function Radio({ label, id, hint, className = '', ...rest }: RadioProps) {
  return (
    <div className={`flex items-start gap-3 rounded-xl border border-line bg-white p-4 has-checked:border-forest ${className}`}>
      <input id={id} type="radio" className="mt-1.5 h-6 w-6 shrink-0 accent-forest cursor-pointer" {...rest} />
      <div>
        <label htmlFor={id} className="text-[1.0625rem] font-bold leading-relaxed cursor-pointer">
          {label}
        </label>
        {hint ? <p className="text-[0.9375rem] text-mist">{hint}</p> : null}
      </div>
    </div>
  )
}

// ============================================================
// Champ étiqueté : label + aide + erreur accessible (RGAA 11.1, 11.2, 11.10)
// ============================================================
interface FieldProps {
  label: ReactNode
  htmlFor: string
  required?: boolean
  hint?: ReactNode
  error?: string
  children: ReactNode
  className?: string
}

export function Field({ label, htmlFor, required, hint, error, children, className = '' }: FieldProps) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor={htmlFor} className="font-bold text-[1.0625rem]">
        {label}
        {required ? (
          <span className="text-brique"> — champ obligatoire</span>
        ) : (
          <span className="font-normal text-mist"> (facultatif)</span>
        )}
      </label>
      {hint ? (
        <p id={`${htmlFor}-hint`} className="text-[0.9375rem] text-mist">
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={`${htmlFor}-err`} role="alert" className="flex items-start gap-2 rounded-lg bg-brique-pale px-3 py-2 text-[0.9375rem] font-bold text-brique">
          <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  )
}
