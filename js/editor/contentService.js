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
      this.isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
      this.syncQueueKey = "iset_pending_sync_queue";
      this.isSyncing = false;

      this._initNetworkListeners();
    }

    _initNetworkListeners() {
      if (typeof window === "undefined") return;

      window.addEventListener("online", () => {
        this.isOnline = true;
        console.log("🌐 Conexión a internet detectada. Verificando sincronización silenciosa...");
        this.emit("network-status", { online: true });
        this.syncPendingQueue();
      });

      window.addEventListener("offline", () => {
        this.isOnline = false;
        console.warn("📴 Modo sin conexión activo. Los cambios se guardarán localmente.");
        this.emit("network-status", { online: false });
        if (window.ISET_TOAST) {
          window.ISET_TOAST("Estás en modo sin conexión. Podés seguir editando y se sincronizará automáticamente al volver internet.", "info");
        }
      });

      // Chequeo periódico en segundo plano para sincronizar cambios pendientes si hay red
      setInterval(() => {
        if (this.isOnline && this.getPendingCount() > 0 && !this.isSyncing) {
          this.syncPendingQueue();
        }
      }, 40000);
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

    // ----------------------------------------------------
    // Gestión de Cola Offline (Pending Sync Queue)
    // ----------------------------------------------------
    getPendingQueue() {
      try {
        const raw = localStorage.getItem(this.syncQueueKey);
        return raw ? JSON.parse(raw) : [];
      } catch (_) {
        return [];
      }
    }

    getPendingCount() {
      return this.getPendingQueue().length;
    }

    getSyncStatus() {
      return {
        isOnline: this.isOnline,
        isSyncing: this.isSyncing,
        pendingCount: this.getPendingCount()
      };
    }

    addToSyncQueue(type, content) {
      const queue = this.getPendingQueue();
      const auth = window.ISET_AUTH;
      const user = auth?.getCurrentUser();

      const existingIdx = queue.findIndex(q => q.type === type);
      const item = {
        id: "sync_" + type + "_" + Date.now(),
        type: type, // 'data' o 'materias'
        content: content,
        timestamp: Date.now(),
        userEmail: user?.email || "unknown",
        userId: user?.id || null
      };

      if (existingIdx !== -1) {
        queue[existingIdx] = item;
      } else {
        queue.push(item);
      }

      try {
        localStorage.setItem(this.syncQueueKey, JSON.stringify(queue));
      } catch (e) {
        console.warn("No se pudo guardar sync queue en localStorage:", e);
      }

      this.emit("sync-status", {
        status: "pending",
        pendingCount: queue.length,
        isOnline: this.isOnline
      });
    }

    removeFromSyncQueue(type) {
      let queue = this.getPendingQueue();
      queue = queue.filter(q => q.type !== type);
      try {
        localStorage.setItem(this.syncQueueKey, JSON.stringify(queue));
      } catch (_) {}

      this.emit("sync-status", {
        status: queue.length > 0 ? "pending" : "synced",
        pendingCount: queue.length,
        isOnline: this.isOnline
      });
    }

    // ----------------------------------------------------
    // Sincronización Silenciosa en Segundo Plano (Cloud Sync)
    // ----------------------------------------------------
    async syncPendingQueue() {
      if (this.isSyncing) return;
      const queue = this.getPendingQueue();
      if (!queue.length) return;

      const auth = window.ISET_AUTH;
      const supabase = auth?.supabase;
      if (!supabase || !auth.isLoggedIn()) {
        console.log("Sincronización en pausa: esperando sesión de administrador en Supabase.");
        return;
      }

      this.isSyncing = true;
      this.emit("sync-status", { status: "syncing", pendingCount: queue.length, isOnline: this.isOnline });

      let syncedCount = 0;
      const user = auth.getCurrentUser();

      for (const item of [...queue]) {
        try {
          const { error } = await supabase
            .from("site_content")
            .upsert({
              id: item.type,
              content: item.content,
              updated_by: user?.id,
              updated_at: new Date().toISOString()
            });

          if (!error) {
            // Registro en log de auditoría
            try {
              await supabase.from("site_sync_log").insert({
                section: item.type,
                updated_by: user?.id,
                sync_source: "offline_sync"
              });
            } catch (_) {}

            this.removeFromSyncQueue(item.type);
            syncedCount++;
          } else {
            console.warn(`Error al sincronizar ${item.type} con Supabase:`, error);
          }
        } catch (err) {
          console.warn(`Fallo de conexión al sincronizar ${item.type}:`, err);
          break; // Detener bucle si hay fallo de conexión para no saturar
        }
      }

      this.isSyncing = false;
      const remaining = this.getPendingCount();

      this.emit("sync-status", {
        status: remaining > 0 ? "pending" : "synced",
        pendingCount: remaining,
        isOnline: this.isOnline
      });

      if (syncedCount > 0) {
        if (window.ISET_TOAST) {
          window.ISET_TOAST(`☁️ Conexión activa: ${syncedCount} cambio${syncedCount > 1 ? "s" : ""} sincronizado${syncedCount > 1 ? "s" : ""} silenciosamente con Supabase.`, "success");
        }
        this.emit("sync-completed", { count: syncedCount });
      }
    }

    // ----------------------------------------------------
    // Carga de Contenido con Resiliencia Offline-First
    // ----------------------------------------------------
    async loadAll(forceFresh = false) {
      const auth = window.ISET_AUTH;
      const supabase = auth?.supabase;

      let remoteData = null;
      let remoteMaterias = null;

      // 1. Si hay conexión y Supabase está configurado, consultar la nube
      if (this.isOnline && supabase) {
        try {
          const fetchPromise = supabase
            .from("site_content")
            .select("id, content");

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout de conexión a Supabase")), 5000)
          );

          const { data: records, error } = await Promise.race([fetchPromise, timeoutPromise]);

          if (!error && records && records.length > 0) {
            const dataRow = records.find(r => r.id === "data");
            const materiasRow = records.find(r => r.id === "materias");
            if (dataRow?.content) remoteData = dataRow.content;
            if (materiasRow?.content) remoteMaterias = materiasRow.content;
          }
        } catch (e) {
          console.warn("No se pudo obtener contenido de Supabase:", e);
        }
      }

      // 2. Si no hay datos remotos o se fuerza refresco de archivos base, leer archivos JSON
      let staticData = null;
      let staticMaterias = null;
      if (!remoteData || forceFresh) {
        try {
          const [resData, resMat] = await Promise.all([
            fetch("data.json?_t=" + Date.now(), { cache: "no-cache" }).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch("materias.json?_t=" + Date.now(), { cache: "no-cache" }).then(r => r.ok ? r.json() : null).catch(() => null)
          ]);
          staticData = resData;
          staticMaterias = resMat;
        } catch (e) {
          console.warn("Error al cargar archivos JSON:", e);
        }
      }

      // 3. Resolución de datos (Prioridad Offline-First):
      // A) Cambios en cola pendientes de sincronización (la versión editada localmente sin internet)
      // B) Supabase remoto (servidor en producción)
      // C) Caché local persistida en localStorage
      // D) Archivos JSON estáticos del servidor como semilla / fallback
      const pendingData = this.getPendingQueue().find(q => q.type === "data");
      const pendingMaterias = this.getPendingQueue().find(q => q.type === "materias");

      if (pendingData?.content) {
        this.data = pendingData.content;
      } else if (remoteData) {
        this.data = remoteData;
        try { localStorage.setItem("iset_custom_data", JSON.stringify(remoteData)); } catch (_) {}
      } else {
        try {
          const localData = localStorage.getItem("iset_custom_data");
          if (localData) this.data = JSON.parse(localData);
          else if (staticData) this.data = staticData;
        } catch (_) {
          if (staticData) this.data = staticData;
        }
      }

      if (pendingMaterias?.content) {
        this.materias = pendingMaterias.content;
      } else if (remoteMaterias) {
        this.materias = remoteMaterias;
        try { localStorage.setItem("iset_custom_materias", JSON.stringify(remoteMaterias)); } catch (_) {}
      } else {
        try {
          const localMaterias = localStorage.getItem("iset_custom_materias");
          if (localMaterias) this.materias = JSON.parse(localMaterias);
          else if (staticMaterias) this.materias = staticMaterias;
        } catch (_) {
          if (staticMaterias) this.materias = staticMaterias;
        }
      }

      // 4. Si hay materias detalladas, vincularlas a espacios en data
      this._linkMateriasToData();

      // 5. Suscribirse a cambios en tiempo real si Supabase está activo
      this._subscribeRealtime();

      // 6. Si hay ítems pendientes de sincronización y estamos online, sincronizar en segundo plano
      if (this.isOnline && this.getPendingCount() > 0) {
        setTimeout(() => this.syncPendingQueue(), 1200);
      }

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
                try { localStorage.setItem("iset_custom_data", JSON.stringify(this.data)); } catch (_) {}
                this._linkMateriasToData();
                this.emit("content-updated", { data: this.data, materias: this.materias, source: "remote" });
              } else if (row?.id === "materias") {
                this.materias = row.content;
                try { localStorage.setItem("iset_custom_materias", JSON.stringify(this.materias)); } catch (_) {}
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

      // Guardar persistentemente (Supabase o Cola Offline)
      await this._persistData();

      // Emitir evento para refrescar la vista en tiempo real de inmediato
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

    // Persistencia en Supabase y localStorage con soporte Offline-First
    async _persistData() {
      // 1. Siempre guardar en caché local primero
      try {
        localStorage.setItem("iset_custom_data", JSON.stringify(this.data));
      } catch (e) {
        console.warn("Error guardando en localStorage:", e);
      }

      const auth = window.ISET_AUTH;
      const supabase = auth?.supabase;
      const isLoggedIn = auth?.isLoggedIn();
      const user = auth?.getCurrentUser();

      // 2. Si hay conexión y usuario logueado en Supabase, intentar guardar en la nube
      if (this.isOnline && supabase && isLoggedIn) {
        try {
          const savePromise = supabase
            .from("site_content")
            .upsert({
              id: "data",
              content: this.data,
              updated_by: user?.id,
              updated_at: new Date().toISOString()
            });

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout de red en Supabase")), 6000)
          );

          const { error } = await Promise.race([savePromise, timeoutPromise]);
          if (error) throw error;

          // Registro en log de auditoría
          try {
            await supabase.from("site_sync_log").insert({
              section: "data",
              updated_by: user?.id,
              sync_source: "online"
            });
          } catch (_) {}

          this.removeFromSyncQueue("data");
          this.emit("sync-status", { status: "synced", pendingCount: this.getPendingCount(), isOnline: true });
          if (window.ISET_TOAST) {
            window.ISET_TOAST("✅ Guardado y sincronizado con Supabase en tiempo real.", "success");
          }
          return;
        } catch (e) {
          console.warn("Fallo guardado en Supabase, encolando para sincronización silenciosa:", e);
        }
      }

      // 3. Si no hay conexión o falló Supabase, encolar para sincronización silenciosa
      this.addToSyncQueue("data", this.data);
      if (window.ISET_TOAST) {
        window.ISET_TOAST("💾 Guardado localmente. Se sincronizará en la nube automáticamente al detectar internet.", "info");
      }
    }

    async _persistMaterias() {
      try {
        localStorage.setItem("iset_custom_materias", JSON.stringify(this.materias));
      } catch (e) {
        console.warn("Error guardando materias en localStorage:", e);
      }

      const auth = window.ISET_AUTH;
      const supabase = auth?.supabase;
      const isLoggedIn = auth?.isLoggedIn();
      const user = auth?.getCurrentUser();

      if (this.isOnline && supabase && isLoggedIn) {
        try {
          const savePromise = supabase
            .from("site_content")
            .upsert({
              id: "materias",
              content: this.materias,
              updated_by: user?.id,
              updated_at: new Date().toISOString()
            });

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout de red en Supabase")), 6000)
          );

          const { error } = await Promise.race([savePromise, timeoutPromise]);
          if (error) throw error;

          try {
            await supabase.from("site_sync_log").insert({
              section: "materias",
              updated_by: user?.id,
              sync_source: "online"
            });
          } catch (_) {}

          this.removeFromSyncQueue("materias");
          this.emit("sync-status", { status: "synced", pendingCount: this.getPendingCount(), isOnline: true });
          if (window.ISET_TOAST) {
            window.ISET_TOAST("✅ Materias guardadas y sincronizadas con Supabase en tiempo real.", "success");
          }
          return;
        } catch (e) {
          console.warn("Fallo guardado de materias en Supabase, encolando:", e);
        }
      }

      this.addToSyncQueue("materias", this.materias);
      if (window.ISET_TOAST) {
        window.ISET_TOAST("💾 Materias guardadas localmente. Se sincronizarán en la nube automáticamente al detectar internet.", "info");
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
