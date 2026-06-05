export default function Button({ children, variant = 'primary', size = 'md', className = '', disabled, onClick, type = 'button' }) {
  const base = 'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:pointer-events-none'

  const variants = {
    primary:  'bg-app-purple text-app-text hover:bg-app-purple-light',
    secondary: 'bg-app-elevated text-app-text hover:bg-app-highlight',
    ghost:    'bg-transparent text-app-muted hover:text-app-text hover:bg-app-elevated',
    danger:   'bg-app-coral/20 text-app-coral hover:bg-app-coral/30',
    green:    'bg-app-green text-app-text hover:bg-app-green-light',
    outline:  'border border-app-purple/50 text-app-purple-light hover:bg-app-purple/10',
  }

  const sizes = {
    sm:  'px-3 py-1.5 text-sm',
    md:  'px-4 py-2.5 text-sm',
    lg:  'px-6 py-3.5 text-base w-full',
    xl:  'px-6 py-4 text-base w-full font-semibold',
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  )
}
