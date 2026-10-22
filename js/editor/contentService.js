/**
 * ISET N° 57 - Servicio de Contenido y Sincronización JSON en Tiempo Real
 * Gestiona data.json y materias.json, almacenamiento en Supabase/local, y subida de imágenes.
 */
(() => {
  "use strict";

  class ContentService {
    constructor() {
      this.data = null;
      this.materias = null;
      this.listeners = {};
      this.isSaving = false;
    }

    on(event, callback) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(callback);
    }

    emit(event, payload) {
      if (this.listeners[event]) {
        this.listeners[event].forEach(fn => {
          try { fn(payload); } catch (e) { console.error("Error en listener:", e); }
        });
      }
      // También emitir como evento global en window
      window.dispatchEvent(new CustomEvent("iset:" + event, { detail: payload }));
    }

    // Cargar contenido completo (data.json + materias.json)
    async loadAll() {
      const auth = window.ISET_AUTH;
      const supabase = auth?.supabase;

      // 1. Intentar cargar desde Supabase si está disponible
      if (supabase) {
        try {
          const { data: records, error } = await supabase
            .from("site_content")
            .select("id, content");

          if (!error && records && records.length > 0) {
            const dataRow = records.find(r => r.id === "data");
            const materiasRow = records.find(r => r.id === "materias");
            if (dataRow?.content) this.data = dataRow.content;
            if (materiasRow?.content) this.materias = materiasRow.content;
          }
        } catch (e) {
          console.warn("No se pudo obtener contenido de Supabase, recurriendo a archivos locales:", e);
        }
      }

      // 2. Si no hay datos en memoria, cargar archivos estáticos
      if (!this.data) {
        // Verificar si hay caché local guardada
        const localData = localStorage.getItem("iset_custom_data");
        if (localData) {
          try {
            this.data = JSON.parse(localData);
          } catch (_) {}
        }
      }

      if (!this.materias) {
        const localMaterias = localStorage.getItem("iset_custom_materias");
        if (localMaterias) {
          try {
            this.materias = JSON.parse(localMaterias);
          } catch (_) {}
        }
      }

      // 3. Si aún faltan, fetch a los archivos estáticos
      const fetchPromises = [];
      if (!this.data) {
        fetchPromises.push(
          fetch("data.json?_t=" + Date.now(), { cache: "no-cache" })
            .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
            .then(d => { this.data = d; })
        );
      }
      if (!this.materias) {
        fetchPromises.push(
          fetch("materias.json?_t=" + Date.now(), { cache: "no-cache" })
            .then(r => r.ok ? r.json() : null)
            .then(m => { this.materias = m || {}; })
            .catch(() => { this.materias = {}; })
        );
      }

      if (fetchPromises.length > 0) {
        await Promise.all(fetchPromises);
      }

      // 4. Si hay materias detalladas, vincularlas a espacios en data
      this._linkMateriasToData();

      // 5. Suscribirse a cambios en tiempo real si Supabase está activo
      this._subscribeRealtime();

      this.emit("content-loaded", { data: this.data, materias: this.materias });
      return { data: this.data, materias: this.materias };
    }

    _linkMateriasToData() {
      if (this.materias && this.data?.ofertaAcademica?.espacios) {
        this.data.ofertaAcademica.espacios.forEach(esp => {
          if (this.materias[esp.id]) {
            esp.materiasDetalladas = this.materias[esp.id];
          }
        });
      }
    }

    _subscribeRealtime() {
      const auth = window.ISET_AUTH;
      const supabase = auth?.supabase;
      if (!supabase) return;

      try {
        supabase
          .channel("public:site_content")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "site_content" },
            (payload) => {
              console.log("⚡ Actualización en tiempo real recibida:", payload);
              const row = payload.new;
              if (row?.id === "data") {
                this.data = row.content;
                this._linkMateriasToData();
                this.emit("content-updated", { data: this.data, materias: this.materias, source: "remote" });
              } else if (row?.id === "materias") {
                this.materias = row.content;
                this._linkMateriasToData();
                this.emit("content-updated", { data: this.data, materias: this.materias, source: "remote" });
              }
            }
          )
          .subscribe();
      } catch (e) {
        console.warn("No se pudo iniciar canal Realtime:", e);
      }
    }

    getData() {
      return this.data;
    }

    getMaterias() {
      return this.materias;
    }

    // ----------------------------------------------------
    // Actualización de Secciones con Validación de Roles
    // ----------------------------------------------------
    async updateData(updaterFn, carreraId = null) {
      const auth = window.ISET_AUTH;
      if (!auth.canEdit(carreraId)) {
        throw new Error("No tenés permisos para modificar esta sección.");
      }

      // Aplicar actualización sobre clon profundo
      const current = JSON.parse(JSON.stringify(this.data));
      const updated = updaterFn(current) || current;
      this.data = updated;
      this._linkMateriasToData();

      // Guardar persistentemente
      await this._persistData();

      // Emitir evento para refrescar la vista en tiempo real
      this.emit("content-updated", { data: this.data, materias: this.materias, carreraId });
      return this.data;
    }

    async updateMaterias(updaterFn, carreraId = null) {
      const auth = window.ISET_AUTH;
      if (!auth.canEdit(carreraId)) {
        throw new Error("No tenés permisos para modificar las materias de esta carrera.");
      }

      const current = JSON.parse(JSON.stringify(this.materias || {}));
      const updated = updaterFn(current) || current;
      this.materias = updated;
      this._linkMateriasToData();

      await this._persistMaterias();

      this.emit("content-updated", { data: this.data, materias: this.materias, carreraId });
      return this.materias;
    }

    // Persistencia en Supabase y localStorage
    async _persistData() {
      localStorage.setItem("iset_custom_data", JSON.stringify(this.data));

      const auth = window.ISET_AUTH;
      if (auth?.supabase && auth.isLoggedIn()) {
        try {
          const user = auth.getCurrentUser();
          const { error } = await auth.supabase
            .from("site_content")
            .upsert({
              id: "data",
              content: this.data,
              updated_by: user.id,
              updated_at: new Date().toISOString()
            });
          if (error) throw error;
        } catch (e) {
          console.error("Error persistiendo data en Supabase:", e);
        }
      }
    }

    async _persistMaterias() {
      localStorage.setItem("iset_custom_materias", JSON.stringify(this.materias));

      const auth = window.ISET_AUTH;
      if (auth?.supabase && auth.isLoggedIn()) {
        try {
          const user = auth.getCurrentUser();
          const { error } = await auth.supabase
            .from("site_content")
            .upsert({
              id: "materias",
              content: this.materias,
              updated_by: user.id,
              updated_at: new Date().toISOString()
            });
          if (error) throw error;
        } catch (e) {
          console.error("Error persistiendo materias en Supabase:", e);
        }
      }
    }

    // ----------------------------------------------------
    // Subida y Procesamiento de Imágenes
    // ----------------------------------------------------
    async uploadImage(file) {
      const auth = window.ISET_AUTH;
      if (!auth.canEdit()) {
        throw new Error("No tenés permisos para subir imágenes.");
      }

      // Si Supabase Storage está activo, subir al bucket
      if (auth?.supabase && auth.isLoggedIn()) {
        try {
          const fileExt = file.name.split(".").pop();
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
          const filePath = `uploads/${fileName}`;

          const { error: uploadError } = await auth.supabase.storage
            .from(window.ISET_CONFIG.storageBucket)
            .upload(filePath, file, { cacheControl: "3600", upsert: false });

          if (!uploadError) {
            const { data: { publicUrl } } = auth.supabase.storage
              .from(window.ISET_CONFIG.storageBucket)
              .getPublicUrl(filePath);
            return publicUrl;
          }
          console.warn("Fallo subida a Supabase Storage, recurriendo a optimización Base64:", uploadError);
        } catch (e) {
          console.warn("Error en subida Supabase:", e);
        }
      }

      // Fallback: Optimizar imagen a WebP/JPEG Base64 para almacenamiento directo
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            let width = img.width;
            let height = img.height;
            const maxDim = 1200;

            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, width, height);

            const compressedDataUrl = canvas.toDataURL("image/webp", 0.85);
            resolve(compressedDataUrl);
          };
          img.onerror = reject;
          img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    // ----------------------------------------------------
    // Exportación de Archivos JSON para GitHub
    // ----------------------------------------------------
    exportFile(type = "data") {
      const isData = type === "data";
      const filename = isData ? "data.json" : "materias.json";
      const content = isData ? this.data : this.materias;
      const jsonStr = JSON.stringify(content, null, 2);

      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    copyToClipboard(type = "data") {
      const isData = type === "data";
      const content = isData ? this.data : this.materias;
      const jsonStr = JSON.stringify(content, null, 2);
      return navigator.clipboard.writeText(jsonStr);
    }
  }

  window.ISET_CONTENT = new ContentService();
})();
