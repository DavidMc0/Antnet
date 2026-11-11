document.body.dataset.external = "ran";
const status = document.getElementById("sw-status");
if (status && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").then(
    () => {
      status.textContent = "Service worker: registered";
      document.body.dataset.siteSw = "registered";
    },
    (e) => {
      status.textContent = `Service worker: rejected (${e.name})`;
      document.body.dataset.siteSw = "rejected";
    },
  );
}
