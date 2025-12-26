export function showToast(message: string) {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.position = 'fixed';
  toast.style.right = '16px';
  toast.style.bottom = '16px';
  toast.style.padding = '10px 12px';
  toast.style.background = 'rgba(20, 20, 20, 0.9)';
  toast.style.color = '#fff';
  toast.style.border = '1px solid rgba(255, 255, 255, 0.15)';
  toast.style.borderRadius = '6px';
  toast.style.fontSize = '12px';
  toast.style.zIndex = '9999';
  toast.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.35)';
  document.body.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 5000);
}
