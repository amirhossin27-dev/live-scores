// Public runtime settings. Never put credentials here.
// pushWorkerUrl and vapidPublicKey are public by design; the private VAPID key exists only as a Cloudflare secret.
window.APP_CONFIG = {
  apiBaseUrl: "https://amir-live-scores-api.onrender.com",
  pushWorkerUrl: "https://live-scores-push.pk5g9j9v7s.workers.dev",
  vapidPublicKey: "BDCx7bVOzt8Ssu7UxEno-XhH5NMzrdyy2FlFXlfJVRobAduj5VOVMsOiGvwyfzsp0oyTeP7gLBCzTx79cgm0_RA"
};
