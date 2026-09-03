interface Option {
  value: string;
  label: string;
}
interface Props {
  value: string;
  options: Option[];
  onChange: (v: string) => void;
}

export const PillGroup = ({ value, options, onChange }: Props) => (
  <div className="flex gap-2">
    {options.map((opt) => {
      const active = value === opt.value;
      return (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex-1 px-3 py-2 rounded-md text-xs font-semibold border transition-colors ${
            active
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card text-muted-foreground border-border hover:border-primary/50"
          }`}
        >
          {opt.label}
        </button>
      );
    })}
  </div>
);
