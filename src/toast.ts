
function showToast(message: string): void {
  let toast = document.getElementById("toast");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add("show");

  window.setTimeout(() => {
    toast?.classList.remove("show");
  }, 1500);
}

export {
    showToast
}