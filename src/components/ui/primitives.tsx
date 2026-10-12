import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon, type IconName } from './Icon';
import { useUI } from '@/store/uiStore';

/**
 * Design-system primitives.
 *
 * Two rules are enforced here rather than left to call sites, because they are
 * the two most common ways a UI stops looking designed:
 *   • radius and spacing come only from the token scale (6/12/16, 4/8/12/16/24)
 *   • every icon-only control REQUIRES an accessible label — it is a mandatory
 *     prop on IconButton, not an optional one, so it cannot be forgotten.
 */

// ── Button ────────────────────────────────────────────────────────────────

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-sage-700 text-sage-50 hover:bg-sage-800 active:bg-sage-900 disabled:bg-ink-300 dark:disabled:bg-ink-700',
  secondary:
    'bg-white text-ink-800 border border-ink-200 hover:bg-ink-50 active:bg-ink-100 dark:bg-ink-800 dark:text-sage-50 dark:border-ink-700 dark:hover:bg-ink-700',
  ghost:
    'text-ink-700 hover:bg-ink-100 active:bg-ink-200 dark:text-ink-300 dark:hover:bg-ink-800',
  danger: 'bg-danger text-white hover:brightness-95 active:brightness-90',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-caption gap-1.5',
  md: 'h-9 px-4 text-body gap-2',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconRight?: IconName;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'secondary', size = 'md', icon, iconRight, block, className, children, ...rest },
    ref
  ) => (
    <button
      ref={ref}
      type="button"
      className={clsx(
        'inline-flex items-center justify-center rounded-control font-medium',
        'transition-colors duration-150 ease-out',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className
      )}
      {...rest}
    >
      {icon && <Icon name={icon} className="h-4 w-4 shrink-0" />}
      {children}
      {iconRight && <Icon name={iconRight} className="h-4 w-4 shrink-0" />}
    </button>
  )
);
Button.displayName = 'Button';

// ── IconButton ────────────────────────────────────────────────────────────

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  /** Required: an icon with no accessible name is invisible to screen readers. */
  label: string;
  variant?: Variant;
  size?: Size;
  active?: boolean;
  filled?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    { icon, label, variant = 'ghost', size = 'md', active, filled, className, ...rest },
    ref
  ) => (
    <Tooltip content={label}>
      <button
        ref={ref}
        type="button"
        aria-label={label}
        aria-pressed={active === undefined ? undefined : active}
        className={clsx(
          'inline-flex shrink-0 items-center justify-center rounded-control',
          'transition-colors duration-150 ease-out',
          'disabled:cursor-not-allowed disabled:opacity-40',
          size === 'sm' ? 'h-8 w-8' : 'h-9 w-9',
          active
            ? 'bg-sage-700 text-sage-50 hover:bg-sage-800'
            : VARIANTS[variant],
          className
        )}
        {...rest}
      >
        <Icon name={icon} filled={filled} className={size === 'sm' ? 'h-4 w-4' : 'h-[18px] w-[18px]'} />
      </button>
    </Tooltip>
  )
);
IconButton.displayName = 'IconButton';

// ── Tooltip ───────────────────────────────────────────────────────────────

/**
 * Hover/focus tooltip. Shows on keyboard focus too — a tooltip only reachable
 * by mouse fails exactly the users who most need the label.
 */
export function Tooltip({
  content,
  children,
  side = 'bottom',
}: {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom';
}) {
  const [open, setOpen] = useState(false);
  const timer = useRef<number>();

  const show = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(true), 350);
  }, []);
  const hide = useCallback(() => {
    window.clearTimeout(timer.current);
    setOpen(false);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <span
      className="relative inline-flex"
      onPointerEnter={show}
      onPointerLeave={hide}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={hide}
    >
      {children}
      <AnimatePresence>
        {open && content && (
          <motion.span
            role="tooltip"
            initial={{ opacity: 0, y: side === 'bottom' ? -4 : 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={clsx(
              'pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap',
              'rounded-control bg-ink-900 px-2 py-1 text-caption font-medium text-white shadow-medium',
              'dark:bg-ink-100 dark:text-ink-900',
              side === 'bottom' ? 'top-[calc(100%+6px)]' : 'bottom-[calc(100%+6px)]'
            )}
          >
            {content}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

// ── Text input ────────────────────────────────────────────────────────────

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  suffix?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, hint, error, suffix, className, id, ...rest }, ref) => {
    const generated = useId();
    const inputId = id ?? generated;
    const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-caption font-medium text-ink-500 dark:text-ink-400">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={clsx(
              'h-9 w-full rounded-control border bg-white px-2.5 text-body tabular-nums',
              'transition-colors duration-150 ease-out',
              'placeholder:text-ink-400',
              'dark:bg-ink-800 dark:text-sage-50',
              error
                ? 'border-danger focus:border-danger'
                : 'border-ink-200 focus:border-sage-500 dark:border-ink-700',
              suffix && 'pr-9',
              className
            )}
            {...rest}
          />
          {suffix && (
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-caption text-ink-400">
              {suffix}
            </span>
          )}
        </div>
        {error ? (
          <p id={`${inputId}-error`} className="flex items-center gap-1 text-caption text-danger">
            <Icon name="alert" className="h-3.5 w-3.5" />
            {error}
          </p>
        ) : hint ? (
          <p id={`${inputId}-hint`} className="text-caption text-ink-400">
            {hint}
          </p>
        ) : null}
      </div>
    );
  }
);
TextField.displayName = 'TextField';

// ── Numeric field with slider ─────────────────────────────────────────────

/**
 * Paired slider + numeric input.
 *
 * Professional tools never make you drag for a precise value. The slider is for
 * exploration, the box is for "make it exactly 1.83". The box commits on blur
 * or Enter and reverts on Escape, so a half-typed number never reaches state.
 */
export function NumberField({
  label,
  value,
  min,
  max,
  step = 0.01,
  suffix,
  onChange,
  onCommit,
  format,
  parse,
  disabled,
  showSlider = true,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  /** Live updates while the slider is dragged. */
  onChange: (value: number) => void;
  /** Called once when a gesture or edit finishes — the undo boundary. */
  onCommit?: (value: number) => void;
  format?: (value: number) => string;
  parse?: (text: string) => number | null;
  disabled?: boolean;
  showSlider?: boolean;
}) {
  const id = useId();
  const [text, setText] = useState<string | null>(null);
  const display = format ? format(value) : String(Math.round(value * 1000) / 1000);

  const commitText = () => {
    if (text === null) return;
    const parsed = parse ? parse(text) : Number(text);
    setText(null);
    if (parsed === null || !Number.isFinite(parsed)) return;
    const clamped = Math.min(Math.max(parsed, min), max);
    onChange(clamped);
    onCommit?.(clamped);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-caption font-medium text-ink-500 dark:text-ink-400">
          {label}
        </label>
        <div className="relative w-[92px]">
          <input
            id={id}
            type="text"
            inputMode="decimal"
            disabled={disabled}
            value={text ?? display}
            onChange={(e) => setText(e.target.value)}
            onBlur={commitText}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
              } else if (e.key === 'Escape') {
                setText(null);
                e.currentTarget.blur();
              }
              e.stopPropagation();
            }}
            className={clsx(
              'h-7 w-full rounded-control border border-ink-200 bg-white px-2 text-caption tabular-nums',
              'transition-colors duration-150 ease-out focus:border-sage-500',
              'disabled:opacity-50 dark:border-ink-700 dark:bg-ink-800 dark:text-sage-50',
              suffix && 'pr-6'
            )}
          />
          {suffix && (
            <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[11px] text-ink-400">
              {suffix}
            </span>
          )}
        </div>
      </div>
      {showSlider && (
        <input
          type="range"
          aria-label={`${label} slider`}
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          onPointerUp={() => onCommit?.(value)}
          onKeyUp={() => onCommit?.(value)}
          className="h-1 w-full cursor-pointer appearance-none rounded-full bg-ink-200 accent-sage-600 disabled:opacity-40 dark:bg-ink-700"
        />
      )}
    </div>
  );
}

// ── Panel section ─────────────────────────────────────────────────────────

export function Section({
  title,
  icon,
  children,
  action,
  defaultOpen = true,
  collapsible = true,
}: {
  title: string;
  icon?: IconName;
  children: ReactNode;
  action?: ReactNode;
  defaultOpen?: boolean;
  collapsible?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const reducedMotion = useUI((s) => s.reducedMotion);

  return (
    <section className="border-b border-ink-200 last:border-b-0 dark:border-ink-800">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        {collapsible ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex flex-1 items-center gap-2 text-left"
          >
            <Icon
              name="chevron-down"
              className={clsx(
                'h-3.5 w-3.5 text-ink-400 transition-transform duration-150',
                !open && '-rotate-90'
              )}
            />
            {icon && <Icon name={icon} className="h-4 w-4 text-ink-400" />}
            <h3 className="text-caption font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">
              {title}
            </h3>
          </button>
        ) : (
          <div className="flex flex-1 items-center gap-2">
            {icon && <Icon name={icon} className="h-4 w-4 text-ink-400" />}
            <h3 className="text-caption font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">
              {title}
            </h3>
          </div>
        )}
        {action}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reducedMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-3 px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

// ── Segmented control ─────────────────────────────────────────────────────

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = 'md',
}: {
  value: T;
  options: Array<{ value: T; label: string; icon?: IconName }>;
  onChange: (value: T) => void;
  label: string;
  size?: Size;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex items-center gap-0.5 rounded-control bg-ink-100 p-0.5 dark:bg-ink-800"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-[4px] font-medium',
              'transition-colors duration-150 ease-out',
              size === 'sm' ? 'h-7 px-2 text-caption' : 'h-8 px-3 text-caption',
              active
                ? 'bg-white text-ink-900 shadow-subtle dark:bg-ink-700 dark:text-sage-50'
                : 'text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-sage-100'
            )}
          >
            {option.icon && <Icon name={option.icon} className="h-3.5 w-3.5" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Switch ────────────────────────────────────────────────────────────────

export function Switch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <label htmlFor={id} className="block cursor-pointer text-body text-ink-700 dark:text-ink-200">
          {label}
        </label>
        {description && <p className="text-caption text-ink-400">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative h-5 w-9 shrink-0 rounded-full transition-colors duration-150 ease-out',
          checked ? 'bg-sage-600' : 'bg-ink-300 dark:bg-ink-700'
        )}
      >
        <span
          className={clsx(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-subtle',
            'transition-transform duration-150 ease-out',
            checked ? 'translate-x-[18px]' : 'translate-x-0.5'
          )}
        />
      </button>
    </div>
  );
}

// ── Colour swatches ───────────────────────────────────────────────────────

export function SwatchGrid({
  colors,
  value,
  onChange,
  label,
}: {
  colors: Array<{ color: string; name: string }>;
  value: string;
  onChange: (color: string) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {colors.map((c) => {
        const active = c.color.toLowerCase() === value.toLowerCase();
        return (
          <Tooltip key={c.color} content={c.name}>
            <button
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={c.name}
              onClick={() => onChange(c.color)}
              className={clsx(
                'relative h-7 w-7 rounded-control border transition-transform duration-150 ease-out',
                'hover:scale-110',
                active
                  ? 'border-sage-600 ring-2 ring-sage-500 ring-offset-1 dark:ring-offset-ink-900'
                  : 'border-ink-200 dark:border-ink-700'
              )}
              style={{ backgroundColor: c.color }}
            >
              {/* Selection is marked by a tick as well as the ring, so the state
                  does not rely on colour alone. */}
              {active && (
                <Icon
                  name="check"
                  className="absolute inset-0 m-auto h-3.5 w-3.5 text-white mix-blend-difference"
                  strokeWidth={2.4}
                />
              )}
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: IconName;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ink-100 text-ink-400 dark:bg-ink-800">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <div>
        <p className="text-body font-medium text-ink-800 dark:text-sage-50">{title}</p>
        <p className="mt-1 max-w-[38ch] text-caption text-ink-500 dark:text-ink-400">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton rounded-control', className)} aria-hidden="true" />;
}

// ── Color Picker ──────────────────────────────────────────────────────────
export {
  ColorPicker,
  type ColorOption,
  type ColorPickerProps,
} from './ColorPicker';


