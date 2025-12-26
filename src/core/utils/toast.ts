type ToastType = 'error' | 'warning' | 'success' | 'message';

export type ToastOptions = {
  timeoutMs?: number;
  fadeoutMs?: number;
  type?: ToastType;
};

let toastContainer: HTMLDivElement | null = null;

function getToastContainer(): HTMLDivElement {
  if (toastContainer) return toastContainer;
  toastContainer = document.createElement('div');
  toastContainer.style.position = 'fixed';
  toastContainer.style.top = '16px';
  toastContainer.style.right = '16px';
  toastContainer.style.display = 'flex';
  toastContainer.style.flexDirection = 'column';
  toastContainer.style.alignItems = 'flex-end';
  toastContainer.style.gap = '10px';
  toastContainer.style.zIndex = '9999';
  toastContainer.style.pointerEvents = 'none';
  document.body.appendChild(toastContainer);
  return toastContainer;
}

function getToastTheme(type: ToastType) {
  switch (type) {
    case 'error':
      return { icon: '❌', background: 'rgba(120, 20, 20, 0.92)', border: 'rgba(255, 120, 120, 0.6)' };
    case 'warning':
      return { icon: '⚠️', background: 'rgba(120, 90, 20, 0.92)', border: 'rgba(255, 220, 120, 0.6)' };
    case 'success':
      return { icon: '✅', background: 'rgba(20, 110, 50, 0.92)', border: 'rgba(120, 240, 160, 0.6)' };
    default:
      return { icon: 'ℹ️', background: 'rgba(20, 40, 120, 0.92)', border: 'rgba(120, 160, 255, 0.6)' };
  }
}

export function showToast(message: string, options: ToastOptions = {}) {
  const timeoutMs = options.timeoutMs ?? 5000;
  const fadeoutMs = options.fadeoutMs ?? 2000;
  const type = options.type ?? 'message';
  const theme = getToastTheme(type);

  const toast = document.createElement('div');
  toast.style.display = 'flex';
  toast.style.alignItems = 'center';
  toast.style.gap = '8px';
  toast.style.padding = '12px 14px';
  toast.style.background = theme.background;
  toast.style.color = '#fff';
  toast.style.border = `1px solid ${theme.border}`;
  toast.style.borderRadius = '8px';
  toast.style.fontSize = '13px';
  toast.style.minWidth = '220px';
  toast.style.boxShadow = '0 8px 18px rgba(0, 0, 0, 0.35)';
  toast.style.opacity = '1';
  toast.style.transition = `opacity ${fadeoutMs}ms ease`;
  toast.style.pointerEvents = 'auto';

  const icon = document.createElement('span');
  icon.textContent = theme.icon;
  icon.style.fontSize = '14px';
  const text = document.createElement('span');
  text.textContent = message;

  toast.append(icon, text);

  const container = getToastContainer();
  container.appendChild(toast);

  window.setTimeout(() => {
    toast.style.opacity = '0';
    window.setTimeout(() => {
      toast.remove();
    }, fadeoutMs);
  }, timeoutMs);
}
