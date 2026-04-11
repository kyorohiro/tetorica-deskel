let hideTimer: number | undefined;

function showToast(message: string): void {
  let toast = document.getElementById("toast") as HTMLDivElement | null;

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";

    toast.style.position = "fixed";
    toast.style.right = "16px";
    toast.style.bottom = "16px";
    toast.style.zIndex = "9999";
    toast.style.padding = "10px 14px";
    toast.style.borderRadius = "10px";
    toast.style.background = "rgba(20, 20, 20, 0.8)";
    toast.style.color = "white";
    toast.style.fontSize = "13px";
    toast.style.pointerEvents = "none";
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
    toast.style.transition = "opacity 0.2s ease, transform 0.2s ease";

    document.body.appendChild(toast);
  }

  toast.textContent = message;

  if (hideTimer !== undefined) {
    window.clearTimeout(hideTimer);
  }

  requestAnimationFrame(() => {
    if (!toast) {
      return;
    }
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  });

  hideTimer = window.setTimeout(() => {
    if (!toast) {
      return;
    }
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
  }, 1500);
}

export { showToast };