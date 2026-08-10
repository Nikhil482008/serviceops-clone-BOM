import { ReactNode } from 'react';
import { X, ChevronLeft } from 'lucide-react';

/* Small shared pieces for the BOM admin screens — drawer shell, KPI tile, switch, pills —
 * matching the module's existing panels (BomScanPathsPanel et al.) so the three new screens
 * read as the same product. */

export function BomDrawer({ width = 560, title, sub, onClose, children, footer }: {
  width?: number; title: string; sub?: string; onClose: () => void;
  children: ReactNode; footer?: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-end bg-black/50">
      <div style={{ width }} className="flex h-full max-w-[96vw] flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-[#DFE5ED] px-5 py-3">
          <div className="min-w-0">
            <h3 className="text-[16px] font-semibold text-[#364658]">{title}</h3>
            {sub && <p className="mt-0.5 text-[13px] text-[#7B8FA5]">{sub}</p>}
          </div>
          <button onClick={onClose} className="flex size-8 flex-shrink-0 items-center justify-center rounded text-[#7B8FA5] transition-colors hover:bg-[#F3F4F6] hover:text-[#364658]">
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-[#DFE5ED] px-5 py-3">{footer}</div>
        )}
      </div>
    </div>
  );
}

export function BomPageHead({ title, sub, onBack, actions }: {
  title: string; sub: string; onBack: () => void; actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <button onClick={onBack} className="mb-1 inline-flex items-center gap-1 text-[12px] font-medium text-[#7B8FA5] transition-colors hover:text-[#3D8BD0]">
          <ChevronLeft size={13} /> Admin · BOM Management
        </button>
        <h1 className="text-[20px] font-semibold text-[#364658]">{title}</h1>
        <p className="mt-1 max-w-[720px] text-[13px] leading-[1.55] text-[#7B8FA5]">{sub}</p>
      </div>
      {actions && <div className="flex items-center gap-2 pt-6">{actions}</div>}
    </div>
  );
}

export function Kpi({ label, value, sub, tone }: {
  label: string; value: ReactNode; sub?: string; tone?: 'ok' | 'warn' | 'danger';
}) {
  const color = tone === 'danger' ? 'text-[#DC2626]' : tone === 'warn' ? 'text-[#D97706]' : 'text-[#364658]';
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-3">
      <div className="text-[12px] text-[#7B8FA5]">{label}</div>
      <div className={`mt-1 text-[22px] font-semibold leading-none tracking-[-0.02em] ${color}`} style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div className="mt-1.5 text-[12px] text-[#9CA3AF]">{sub}</div>}
    </div>
  );
}

export function BomSwitch({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      role="switch" aria-checked={on} aria-label={label} onClick={onClick}
      className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${on ? 'bg-[#3D8BD0]' : 'bg-[#CBCED4]'}`}
    >
      <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
    </button>
  );
}

export function StatusPill({ on, onLabel = 'Active', offLabel = 'Disabled' }: {
  on: boolean; onLabel?: string; offLabel?: string;
}) {
  return on ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF3] px-2 py-0.5 text-[11px] font-medium text-[#22A06B]">
      <span className="size-1.5 rounded-full bg-[#22C55E]" />{onLabel}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[11px] font-medium text-[#64748B]">
      <span className="size-1.5 rounded-full bg-[#94A3B8]" />{offLabel}
    </span>
  );
}

/** Two-step destructive action: first click arms it, second confirms — the consequence is
 *  named in place instead of a browser dialog. */
export function ConfirmButton({ armed, onArm, onConfirm, onCancel, confirmText }: {
  armed: boolean; onArm: () => void; onConfirm: () => void; onCancel: () => void; confirmText: string;
}) {
  if (!armed) {
    return (
      <button onClick={onArm} className="rounded px-2 py-1 text-[12px] font-medium text-[#7B8FA5] transition-colors hover:bg-[#FEF3F2] hover:text-[#DC2626]">
        Delete
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <button onClick={onConfirm} className="rounded bg-[#DC2626] px-2 py-1 text-[12px] font-medium text-white hover:bg-[#b91c1c]">{confirmText}</button>
      <button onClick={onCancel} className="rounded px-2 py-1 text-[12px] text-[#7B8FA5] hover:bg-[#F3F4F6]">Cancel</button>
    </span>
  );
}

export const selectCls =
  'h-9 rounded border border-[#d1d5db] bg-white px-2.5 text-[13px] text-[#364658] focus:border-[#3D8BD0] focus:outline-none focus:ring-1 focus:ring-[#3D8BD0]';
export const inputCls =
  'h-9 rounded border border-[#d1d5db] bg-white px-3 text-[13px] text-[#364658] placeholder:text-[#9ca3af] focus:border-[#3D8BD0] focus:outline-none focus:ring-1 focus:ring-[#3D8BD0]';
export const priBtnCls =
  'inline-flex h-9 items-center gap-1.5 rounded bg-[#3D8BD0] px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-[#3479b5] disabled:cursor-not-allowed disabled:opacity-50';
export const secBtnCls =
  'inline-flex h-9 items-center gap-1.5 rounded border border-[#d1d5db] bg-white px-3.5 text-[13px] font-medium text-[#364658] transition-colors hover:bg-[#F9FAFB]';
