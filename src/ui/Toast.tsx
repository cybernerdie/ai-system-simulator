import { Check } from 'lucide-react';

export interface ToastAction {
  label: string;
  run: () => void;
}
export interface ToastData {
  text: string;
  action?: ToastAction;
}

export function Toast({ toast, onDismiss }: { toast: ToastData; onDismiss: () => void }) {
  return (
    <div className="toast" role="status">
      <Check size={14} strokeWidth={2.5} aria-hidden />
      {toast.text}
      {toast.action && (
        <button
          className="toast-action"
          onClick={() => {
            toast.action!.run();
            onDismiss();
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}
