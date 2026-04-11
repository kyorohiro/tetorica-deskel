const PWA_URL = "https://kyorohiro.github.io/tetorica-deskel/demo/";

function isPwaDistributionLocation() {
  const host = window.location.hostname;
  const path = window.location.pathname;

  //if (host === "localhost" || host === "127.0.0.1") {
  //  return true;
  //}

  return (
    host === "kyorohiro.github.io" &&
    path.startsWith("/tetorica-deskel/")
  );
}

function shouldShowPwaLink() {
  return !isPwaDistributionLocation();
}

function isOfficialPwaHost() {
  const host = window.location.hostname;
  return (
    host === "kyorohiro.github.io" ||
    host === "localhost" ||
    host === "127.0.0.1"
  );
}

function showPwaLink(url: string) {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.right = "16px";
  container.style.bottom = "16px";
  container.style.zIndex = "9999";
  container.style.padding = "12px 16px";
  container.style.borderRadius = "12px";
  container.style.background = "rgba(15, 23, 42, 0.92)";
  container.style.color = "white";
  container.style.boxShadow = "0 8px 24px rgba(0,0,0,0.3)";
  container.style.maxWidth = "320px";
  container.style.fontSize = "14px";
  container.innerHTML = `
    <div style="margin-bottom:8px; font-weight:600;">
      Installable PWA version
    </div>
    <div style="margin-bottom:12px; line-height:1.5;">
      For install/offline use, open the PWA version on GitHub Pages.
    </div>
    <a
      href="${url}"
      target="_blank"
      rel="noopener noreferrer"
      style="
        display:inline-block;
        padding:8px 12px;
        border-radius:8px;
        background:#22c55e;
        color:#052e16;
        text-decoration:none;
        font-weight:700;
      "
    >
      Open PWA Version
    </a>
  `;
  document.body.appendChild(container);
}

//if (!isOfficialPwaHost()) {
//  showPwaLink(PWA_URL);
//}
export {
    isOfficialPwaHost,
    isPwaDistributionLocation,
    shouldShowPwaLink,
    showPwaLink,
    PWA_URL
}


