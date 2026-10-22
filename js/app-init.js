/**
 * ISET N° 57 - Inicializador Universal del Sistema
 * Carga Supabase, autenticación, contenido en tiempo real y UI de edición.
 */
(() => {
  "use strict";

  async function startEngine() {
    // 1. Inicializar Auth y Content
    if (window.ISET_AUTH && window.ISET_CONTENT) {
      try {
        await window.ISET_AUTH.init();
        await window.ISET_CONTENT.loadAll();
      } catch (err) {
        console.error("Error inicializando motor ISET:", err);
      }
    }

    // 2. Si la página tiene una función __iset_render registrada, escuchar actualizaciones
    window.addEventListener("iset:content-updated", (e) => {
      if (typeof window.__iset_render === "function" && e.detail && e.detail.data) {
        console.log("🔄 Refrescando pantalla con datos actualizados en tiempo real…");
        window.__iset_render(e.detail.data);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startEngine);
  } else {
    startEngine();
  }
})();
