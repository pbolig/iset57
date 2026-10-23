/**
 * ISET N° 57 - Interfaz de Usuario para Autenticación, Menú y Dashboard de Superusuario
 */
(() => {
  "use strict";

  const auth = window.ISET_AUTH;
  const content = window.ISET_CONTENT;
  const config = window.ISET_CONFIG;

  // Sistema de Notificaciones Toast
  function showToast(message, type = "info") {
    let container = document.getElementById("iset-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "iset-toast-container";
      container.className = "iset-toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `iset-toast ${type}`;
    toast.innerHTML = `<span>${type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️"}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
  window.ISET_TOAST = showToast;

  // Helper para crear elementos
  const h = (tag, attrs = {}, ...children) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
      else el.setAttribute(k, v);
    }
    children.flat().forEach(c => {
      if (c != null) el.append(c.nodeType ? c : document.createTextNode(c));
    });
    return el;
  };

  class AuthUI {
    constructor() {
      this.activeTab = "login";
      this.init();
    }

    init() {
      document.addEventListener("DOMContentLoaded", () => {
        this.renderNavButton();
        this.buildAuthModal();
        this.buildDashboardModal();
        this.checkPasswordResetUrl();
      });

      // Reaccionar a cambios de auth
      auth.on("auth-changed", () => {
        this.renderNavButton();
      });
      auth.on("password-recovery-mode", () => {
        this.openAuthModal("reset");
      });

      // Reaccionar a eventos de sincronización y red
      if (content && typeof content.on === "function") {
        content.on("sync-status", () => this.renderNavButton());
        content.on("network-status", () => this.renderNavButton());
        content.on("sync-completed", () => this.renderNavButton());
      }
    }

    // Comprobar si la URL viene de un correo de recuperación
    checkPasswordResetUrl() {
      const hash = window.location.hash;
      if (hash && hash.includes("type=recovery")) {
        setTimeout(() => this.openAuthModal("reset"), 600);
      }
    }

    // Renderizar botón de acceso o chip de usuario en la barra de navegación
    renderNavButton() {
      const nav = document.querySelector("header nav") || document.querySelector("nav");
      if (!nav) return;

      let wrap = document.getElementById("iset-nav-auth-wrap");
      if (!wrap) {
        wrap = h("div", { id: "iset-nav-auth-wrap", class: "iset-nav-auth", style: "position:relative" });
        nav.appendChild(wrap);
      }

      wrap.innerHTML = "";

      const user = auth.getCurrentUser();
      if (!user) {
        const loginBtn = h("button", {
          type: "button",
          class: "iset-login-btn",
          onclick: () => this.openAuthModal("login")
        }, "🔐 Acceso");
        wrap.appendChild(loginBtn);
        return;
      }

      // Usuario logueado
      const initial = (user.fullName || user.email || "U").charAt(0).toUpperCase();
      let roleLabel = "Visitante";
      let roleBadgeClass = "iset-badge-visitante";

      if (user.role === config.ROLES.SUPERUSER) {
        roleLabel = "Superusuario";
        roleBadgeClass = "iset-badge-superuser";
      } else if (user.role === config.ROLES.ADMIN) {
        const count = user.carreras?.length || 0;
        roleLabel = `Admin (${count} carrera${count !== 1 ? "s" : ""})`;
        roleBadgeClass = "iset-badge-admin";
      }

      // Estado de sincronización en la nube (Offline-First)
      const syncInfo = (content && typeof content.getSyncStatus === "function")
        ? content.getSyncStatus()
        : { isOnline: true, isSyncing: false, pendingCount: 0 };

      let syncBadge = null;
      if (user.role === config.ROLES.SUPERUSER || user.role === config.ROLES.ADMIN) {
        if (!syncInfo.isOnline) {
          syncBadge = h("span", {
            class: "iset-sync-indicator offline",
            title: "Modo sin conexión. Los cambios se guardan localmente y se sincronizarán al volver internet."
          }, "📴 Offline");
        } else if (syncInfo.isSyncing) {
          syncBadge = h("span", {
            class: "iset-sync-indicator syncing",
            title: "Sincronizando cambios en la nube con Supabase..."
          }, "🔄 Sincronizando");
        } else if (syncInfo.pendingCount > 0) {
          syncBadge = h("span", {
            class: "iset-sync-indicator pending",
            title: `${syncInfo.pendingCount} cambio(s) guardados localmente esperando conexión.`
          }, `🟡 ${syncInfo.pendingCount} pend.`);
        } else {
          syncBadge = h("span", {
            class: "iset-sync-indicator synced",
            title: "Conectado a internet y sincronizado con Supabase en tiempo real."
          }, "☁️ En línea");
        }
      }

      const chip = h("div", {
        class: "iset-user-chip",
        onclick: (e) => {
          e.stopPropagation();
          const menu = document.getElementById("iset-user-menu");
          if (menu) menu.classList.toggle("open");
        }
      },
        h("div", { class: "iset-user-avatar" }, initial),
        h("span", {}, user.fullName?.split(" ")[0] || user.email),
        h("span", { class: `iset-badge-role ${roleBadgeClass}` }, roleLabel),
        syncBadge,
        h("span", { style: "font-size:0.7rem;margin-left:2px" }, "▼")
      );

      // Menú desplegable
      const menu = h("div", { id: "iset-user-menu", class: "iset-user-menu" },
        h("div", { class: "iset-menu-header" },
          h("p", { class: "iset-menu-name" }, user.fullName),
          h("p", { class: "iset-menu-email" }, user.email)
        ),
        (user.role === config.ROLES.SUPERUSER || user.role === config.ROLES.ADMIN) ? h("button", {
          class: "iset-menu-item",
          style: "color:var(--celeste-oscuro, #1e3a8a);font-weight:700",
          onclick: async () => {
            menu.classList.remove("open");
            showToast("Verificando y sincronizando con la nube…", "info");
            if (content && typeof content.syncPendingQueue === "function") {
              await content.syncPendingQueue();
            }
          }
        }, `☁️ Sincronizar en la nube ${syncInfo.pendingCount > 0 ? `(${syncInfo.pendingCount} pendientes)` : "(Al día)"}`) : null,
        user.role === config.ROLES.SUPERUSER ? h("button", {
          class: "iset-menu-item",
          onclick: () => {
            menu.classList.remove("open");
            this.openDashboardModal();
          }
        }, "⚙️ Dashboard de Superusuario") : null,
        (user.role === config.ROLES.SUPERUSER || user.role === config.ROLES.ADMIN) ? h("button", {
          class: "iset-menu-item",
          style: "color:var(--tinta);font-weight:700",
          onclick: () => {
            menu.classList.remove("open");
            if (window.ISET_EDITOR_UI) window.ISET_EDITOR_UI.openPlanEstudiosEditor();
          }
        }, "📋 Gestionar Planes de Estudio y Correlatividades") : null,
        (user.role === config.ROLES.SUPERUSER || user.role === config.ROLES.ADMIN) ? h("button", {
          class: "iset-menu-item",
          style: "color:var(--tinta);font-weight:700",
          onclick: () => {
            menu.classList.remove("open");
            if (window.ISET_EDITOR_UI) window.ISET_EDITOR_UI.openInscripcionFaqEditor();
          }
        }, "❓ Gestionar Preguntas Frecuentes (FAQ)") : null,
        (user.role === config.ROLES.SUPERUSER || user.role === config.ROLES.ADMIN) ? h("button", {
          class: "iset-menu-item",
          style: "color:var(--tinta);font-weight:700",
          onclick: () => {
            menu.classList.remove("open");
            if (window.ISET_EDITOR_UI) window.ISET_EDITOR_UI.openInscripcionDudasEditor();
          }
        }, "💬 Modificar Caja '¿Tenés dudas adicionales?'") : null,
        (user.role === config.ROLES.SUPERUSER || user.role === config.ROLES.ADMIN) ? h("button", {
          class: "iset-menu-item",
          style: "color:var(--tinta);font-weight:800;background:var(--celeste-suave)",
          onclick: () => {
            menu.classList.remove("open");
            if (window.ISET_EDITOR_UI) window.ISET_EDITOR_UI.openRawJSONEditor();
          }
        }, "📝 Editor de Código JSON / Subir Archivo") : null,
        (user.role === config.ROLES.SUPERUSER || user.role === config.ROLES.ADMIN) ? h("button", {
          class: "iset-menu-item",
          style: "color:var(--tinta);font-weight:700",
          onclick: () => {
            menu.classList.remove("open");
            if (window.ISET_EDITOR_UI) window.ISET_EDITOR_UI.openAddAvisoEditor();
          }
        }, "📢 Publicar Aviso / Mesas de Examen") : null,
        (user.role === config.ROLES.SUPERUSER || user.role === config.ROLES.ADMIN) ? h("button", {
          class: "iset-menu-item",
          style: "color:var(--tinta);font-weight:700",
          onclick: () => {
            menu.classList.remove("open");
            if (window.ISET_EDITOR_UI) window.ISET_EDITOR_UI.openInstitucionEditor();
          }
        }, "🏛️ Modificar Datos Institucionales") : null,
        user.role === config.ROLES.ADMIN ? h("div", {
          style: "padding:0.4rem 0.8rem;font-size:0.8rem;color:var(--suave)"
        }, `Carreras: ${(!user.carreras || user.carreras.length === 0 || user.carreras.length === config.carreras.length) ? "Todas las carreras (General)" : user.carreras.join(", ")}`) : null,
        h("button", {
          class: "iset-menu-item",
          onclick: () => {
            menu.classList.remove("open");
            content.exportFile("data");
            showToast("Descargando data.json actualizado", "success");
          }
        }, "📥 Descargar data.json"),
        h("button", {
          class: "iset-menu-item",
          onclick: () => {
            menu.classList.remove("open");
            content.exportFile("materias");
            showToast("Descargando materias.json actualizado", "success");
          }
        }, "📥 Descargar materias.json"),
        h("button", {
          class: "iset-menu-item",
          onclick: () => {
            menu.classList.remove("open");
            this.openDashboardModal("supabase");
          }
        }, "🔌 Configurar Supabase"),
        h("button", {
          class: "iset-menu-item danger",
          onclick: async () => {
            menu.classList.remove("open");
            await auth.signOut();
            showToast("Sesión cerrada", "info");
          }
        }, "🚪 Cerrar Sesión")
      );

      wrap.appendChild(chip);
      wrap.appendChild(menu);

      // Cerrar menú al hacer clic afuera
      document.addEventListener("click", () => {
        menu.classList.remove("open");
      });
    }

    // Modal de Login / Registro / Recuperación
    buildAuthModal() {
      if (document.getElementById("iset-auth-modal-backdrop")) return;

      const backdrop = h("div", { id: "iset-auth-modal-backdrop", class: "iset-modal-backdrop" });
      const modal = h("div", { class: "iset-modal" });

      const header = h("div", { class: "iset-modal-header" },
        h("h3", { class: "iset-modal-title", id: "iset-auth-title" }, "🔐 Acceso al Sistema"),
        h("button", {
          class: "iset-modal-close",
          onclick: () => this.closeAuthModal()
        }, "×")
      );

      const body = h("div", { class: "iset-modal-body", id: "iset-auth-body" });
      modal.appendChild(header);
      modal.appendChild(body);
      backdrop.appendChild(modal);
      document.body.appendChild(backdrop);

      // Cerrar con Escape o clic afuera
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) this.closeAuthModal();
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && backdrop.classList.contains("open")) this.closeAuthModal();
      });
    }

    openAuthModal(tab = "login") {
      this.activeTab = tab;
      const backdrop = document.getElementById("iset-auth-modal-backdrop");
      if (!backdrop) return;
      this.renderAuthTabContent();
      backdrop.classList.add("open");
    }

    closeAuthModal() {
      const backdrop = document.getElementById("iset-auth-modal-backdrop");
      if (backdrop) backdrop.classList.remove("open");
    }

    renderAuthTabContent() {
      const body = document.getElementById("iset-auth-body");
      if (!body) return;

      body.innerHTML = "";

      // Si es pestaña de reset de contraseña
      if (this.activeTab === "reset") {
        body.appendChild(this.buildResetPasswordForm());
        return;
      }

      // Barra de pestañas
      const tabs = h("div", { class: "iset-tabs" },
        h("button", {
          class: `iset-tab ${this.activeTab === "login" ? "active" : ""}`,
          onclick: () => { this.activeTab = "login"; this.renderAuthTabContent(); }
        }, "Iniciar Sesión"),
        h("button", {
          class: `iset-tab ${this.activeTab === "register" ? "active" : ""}`,
          onclick: () => { this.activeTab = "register"; this.renderAuthTabContent(); }
        }, "Registrarse"),
        h("button", {
          class: `iset-tab ${this.activeTab === "recover" ? "active" : ""}`,
          onclick: () => { this.activeTab = "recover"; this.renderAuthTabContent(); }
        }, "Recuperar Clave")
      );

      body.appendChild(tabs);

      if (this.activeTab === "login") {
        body.appendChild(this.buildLoginForm());
      } else if (this.activeTab === "register") {
        body.appendChild(this.buildRegisterForm());
      } else if (this.activeTab === "recover") {
        body.appendChild(this.buildRecoverForm());
      }
    }

    buildLoginForm() {
      const form = h("form", {
        onsubmit: async (e) => {
          e.preventDefault();
          const email = form.email.value.trim();
          const password = form.password.value;
          const submitBtn = form.querySelector("button[type=submit]");
          submitBtn.disabled = true;
          submitBtn.textContent = "Ingresando…";

          try {
            await auth.signIn({ email, password });
            showToast("¡Bienvenido al sistema!", "success");
            this.closeAuthModal();
          } catch (err) {
            showToast(err.message || "Error al iniciar sesión", "error");
          } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Ingresar";
          }
        }
      },
        h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label", for: "login-email" }, "Correo Electrónico"),
          h("input", {
            type: "email",
            id: "login-email",
            name: "email",
            class: "iset-input",
            placeholder: "ejemplo@correo.com",
            required: true
          })
        ),
        h("div", { class: "iset-form-group" },
          h("div", { style: "display:flex;justify-content:space-between;align-items:center" },
            h("label", { class: "iset-label", for: "login-pass" }, "Contraseña"),
            h("a", {
              href: "#",
              style: "font-size:0.82rem;color:var(--celeste);text-decoration:none",
              onclick: (e) => {
                e.preventDefault();
                this.activeTab = "recover";
                this.renderAuthTabContent();
              }
            }, "¿Olvidaste tu contraseña?")
          ),
          h("input", {
            type: "password",
            id: "login-pass",
            name: "password",
            class: "iset-input",
            placeholder: "••••••••",
            required: true
          })
        ),
        h("button", { type: "submit", class: "iset-btn-primary" }, "Ingresar")
      );
      return form;
    }

    buildRegisterForm() {
      const form = h("form", {
        onsubmit: async (e) => {
          e.preventDefault();
          const fullName = form.fullName.value.trim();
          const email = form.email.value.trim();
          const password = form.password.value;

          if (password.length < 6) {
            showToast("La contraseña debe tener al menos 6 caracteres", "error");
            return;
          }

          const submitBtn = form.querySelector("button[type=submit]");
          submitBtn.disabled = true;
          submitBtn.textContent = "Creando cuenta…";

          try {
            const res = await auth.signUp({ email, password, fullName });
            showToast(res.message || "Cuenta creada con éxito", "success");
            this.closeAuthModal();
          } catch (err) {
            showToast(err.message || "Error al registrarse", "error");
          } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Crear Cuenta";
          }
        }
      },
        h("div", { class: "iset-alert iset-alert-info" },
          "💡 El primer usuario en registrarse o el correo pedro.bolig@gamil.com asumirá rol de Superusuario total."
        ),
        h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label", for: "reg-name" }, "Nombre y Apellido"),
          h("input", {
            type: "text",
            id: "reg-name",
            name: "fullName",
            class: "iset-input",
            placeholder: "Pedro Bolig",
            required: true
          })
        ),
        h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label", for: "reg-email" }, "Correo Electrónico"),
          h("input", {
            type: "email",
            id: "reg-email",
            name: "email",
            class: "iset-input",
            placeholder: "pedro.bolig@gamil.com",
            required: true
          })
        ),
        h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label", for: "reg-pass" }, "Contraseña"),
          h("input", {
            type: "password",
            id: "reg-pass",
            name: "password",
            class: "iset-input",
            placeholder: "Mínimo 6 caracteres",
            required: true
          })
        ),
        h("button", { type: "submit", class: "iset-btn-primary" }, "Crear Cuenta")
      );
      return form;
    }

    buildRecoverForm() {
      const form = h("form", {
        onsubmit: async (e) => {
          e.preventDefault();
          const email = form.email.value.trim();
          const submitBtn = form.querySelector("button[type=submit]");
          submitBtn.disabled = true;
          submitBtn.textContent = "Enviando…";

          try {
            const res = await auth.requestPasswordReset(email);
            showToast(res.message, "success");
            if (res.mockToken) {
              // Modo de prueba local: pasar directo al formulario de cambio
              setTimeout(() => {
                this.activeTab = "reset";
                this.renderAuthTabContent();
              }, 1200);
            }
          } catch (err) {
            showToast(err.message || "Error al solicitar recuperación", "error");
          } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Enviar Instrucciones";
          }
        }
      },
        h("div", { class: "iset-alert iset-alert-info" },
          "Ingresá tu correo para recibir un enlace de recuperación de contraseña."
        ),
        h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label", for: "rec-email" }, "Correo Electrónico"),
          h("input", {
            type: "email",
            id: "rec-email",
            name: "email",
            class: "iset-input",
            placeholder: "ejemplo@correo.com",
            required: true
          })
        ),
        h("button", { type: "submit", class: "iset-btn-primary" }, "Enviar Instrucciones")
      );
      return form;
    }

    buildResetPasswordForm() {
      const form = h("form", {
        onsubmit: async (e) => {
          e.preventDefault();
          const pass1 = form.pass1.value;
          const pass2 = form.pass2.value;

          if (pass1 !== pass2) {
            showToast("Las contraseñas no coinciden", "error");
            return;
          }
          if (pass1.length < 6) {
            showToast("La contraseña debe tener al menos 6 caracteres", "error");
            return;
          }

          const submitBtn = form.querySelector("button[type=submit]");
          submitBtn.disabled = true;
          submitBtn.textContent = "Guardando nueva contraseña…";

          try {
            await auth.updatePassword(pass1);
            showToast("¡Contraseña restablecida con éxito! Ya podés ingresar.", "success");
            this.activeTab = "login";
            this.renderAuthTabContent();
          } catch (err) {
            showToast(err.message || "Error al restablecer contraseña", "error");
          } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Guardar Nueva Contraseña";
          }
        }
      },
        h("div", { class: "iset-alert iset-alert-success" },
          "🔑 Ingresá tu nueva contraseña a continuación."
        ),
        h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label", for: "new-pass-1" }, "Nueva Contraseña"),
          h("input", {
            type: "password",
            id: "new-pass-1",
            name: "pass1",
            class: "iset-input",
            placeholder: "Mínimo 6 caracteres",
            required: true
          })
        ),
        h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label", for: "new-pass-2" }, "Confirmar Nueva Contraseña"),
          h("input", {
            type: "password",
            id: "new-pass-2",
            name: "pass2",
            class: "iset-input",
            placeholder: "Repetir contraseña",
            required: true
          })
        ),
        h("button", { type: "submit", class: "iset-btn-primary" }, "Guardar Nueva Contraseña")
      );
      return form;
    }

    // ----------------------------------------------------
    // Dashboard de Superusuario (Roles, JSON y Supabase)
    // ----------------------------------------------------
    buildDashboardModal() {
      if (document.getElementById("iset-dashboard-backdrop")) return;

      const backdrop = h("div", { id: "iset-dashboard-backdrop", class: "iset-modal-backdrop" });
      const modal = h("div", { class: "iset-modal iset-modal-lg" });

      const header = h("div", { class: "iset-modal-header" },
        h("h3", { class: "iset-modal-title" }, "⚙️ Panel de Superusuario"),
        h("button", {
          class: "iset-modal-close",
          onclick: () => this.closeDashboardModal()
        }, "×")
      );

      const body = h("div", { class: "iset-modal-body", id: "iset-dashboard-body" });
      modal.appendChild(header);
      modal.appendChild(body);
      backdrop.appendChild(modal);
      document.body.appendChild(backdrop);

      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) this.closeDashboardModal();
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && backdrop.classList.contains("open")) this.closeDashboardModal();
      });
    }

    openDashboardModal(initialTab = "users") {
      this.dashboardTab = initialTab;
      const backdrop = document.getElementById("iset-dashboard-backdrop");
      if (!backdrop) return;
      this.renderDashboardContent();
      backdrop.classList.add("open");
    }

    closeDashboardModal() {
      const backdrop = document.getElementById("iset-dashboard-backdrop");
      if (backdrop) backdrop.classList.remove("open");
    }

    async renderDashboardContent() {
      const body = document.getElementById("iset-dashboard-body");
      if (!body) return;

      body.innerHTML = "";

      const tabs = h("div", { class: "iset-tabs" },
        h("button", {
          class: `iset-tab ${this.dashboardTab === "users" ? "active" : ""}`,
          onclick: () => { this.dashboardTab = "users"; this.renderDashboardContent(); }
        }, "👥 Gestión de Usuarios y Roles"),
        h("button", {
          class: `iset-tab ${this.dashboardTab === "export" ? "active" : ""}`,
          onclick: () => { this.dashboardTab = "export"; this.renderDashboardContent(); }
        }, "📦 Archivos JSON y GitHub"),
        h("button", {
          class: `iset-tab ${this.dashboardTab === "supabase" ? "active" : ""}`,
          onclick: () => { this.dashboardTab = "supabase"; this.renderDashboardContent(); }
        }, "🔌 Conexión Supabase")
      );

      body.appendChild(tabs);

      if (this.dashboardTab === "users") {
        await this.renderUsersTab(body);
      } else if (this.dashboardTab === "export") {
        this.renderExportTab(body);
      } else if (this.dashboardTab === "supabase") {
        this.renderSupabaseTab(body);
      }
    }

    async renderUsersTab(container) {
      const isLive = auth.isLiveSupabase();
      const statusBanner = h("div", {
        class: `iset-alert ${isLive ? "iset-alert-success" : "iset-alert-warning"}`,
        style: "display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;margin-bottom:1.2rem"
      },
        h("div", {},
          h("strong", {}, isLive ? "🟢 Origen: Base de datos Supabase en Vivo (Nube)" : "🟡 Origen: Modo Local / Pruebas (Almacenamiento de este navegador)"),
          h("div", { style: "font-size:0.82rem;margin-top:0.25rem;opacity:0.9" },
            isLive
              ? `Conectado a ${auth.config.supabaseUrl}. Estás viendo los usuarios registrados en el servidor central.`
              : "⚠️ La web en este navegador está en modo local. Los usuarios que se registren en otros dispositivos no aparecerán acá hasta que se conecte Supabase centralizado."
          )
        ),
        h("button", {
          type: "button",
          class: "iset-btn-secondary",
          style: "padding:0.4rem 0.85rem;font-size:0.82rem",
          onclick: () => {
            this.dashboardTab = "users";
            this.openSuperuserDashboard();
          }
        }, "🔄 Actualizar Lista")
      );
      container.appendChild(statusBanner);

      const intro = h("div", { class: "iset-alert iset-alert-info" },
        "👑 Como Superusuario, podés convertir a cualquier usuario visitante en Administrador y asignarle una o más carreras específicas. Los administradores verán las píldoras de edición únicamente en las carreras que tengan asignadas."
      );
      container.appendChild(intro);

      const loadingMsg = h("p", {}, "Cargando usuarios registrados…");
      container.appendChild(loadingMsg);

      try {
        const users = await auth.listUsers();
        loadingMsg.remove();

        if (users.length === 0) {
          container.appendChild(h("p", { style: "color:var(--suave);font-style:italic" }, "No hay otros usuarios registrados aún."));
          return;
        }

        const tableWrap = h("div", { class: "iset-users-table-wrap" });
        const table = h("table", { class: "iset-users-table" },
          h("thead", {},
            h("tr", {},
              h("th", {}, "Usuario / Correo"),
              h("th", {}, "Rol"),
              h("th", {}, "Carreras Asignadas"),
              h("th", {}, "Acciones")
            )
          )
        );

        const tbody = h("tbody");

        users.forEach(u => {
          const isCurrentSuper = u.role === config.ROLES.SUPERUSER;
          const tr = h("tr");

          // Columna 1: Usuario
          tr.appendChild(h("td", {},
            h("strong", {}, u.full_name || u.email.split("@")[0]),
            h("div", { style: "font-size:0.8rem;color:var(--suave)" }, u.email)
          ));

          // Columna 2: Rol actual
          const badgeClass = isCurrentSuper ? "iset-badge-superuser" : u.role === "admin" ? "iset-badge-admin" : "iset-badge-visitante";
          tr.appendChild(h("td", {},
            h("span", { class: `iset-badge-role ${badgeClass}` }, u.role.toUpperCase())
          ));

          // Columna 3: Carreras asignadas
          const carrerasWrap = h("td", {});
          if (isCurrentSuper) {
            carrerasWrap.appendChild(h("span", { style: "font-size:0.85rem;color:var(--sol);font-weight:700" }, "★ Todas las carreras"));
          } else if (u.carreras && u.carreras.length > 0) {
            const pills = h("div", { class: "iset-user-carreras-pills" });
            u.carreras.forEach(cId => {
              const cInfo = config.carreras.find(c => c.id === cId);
              pills.appendChild(h("span", { class: "iset-carrera-tag", style: cInfo?.color ? `background:${cInfo.color}` : "" }, cInfo?.nombre?.split(" ")[3] || cId));
            });
            carrerasWrap.appendChild(pills);
          } else {
            carrerasWrap.appendChild(h("span", { style: "font-size:0.82rem;color:var(--suave)" }, "Ninguna"));
          }
          tr.appendChild(carrerasWrap);

          // Columna 4: Botón editar permisos
          const actionsTd = h("td", {});
          const editBtn = h("button", {
            class: "iset-btn-secondary",
            onclick: () => this.openEditUserModal(u)
          }, "Editar Permisos");
          actionsTd.appendChild(editBtn);
          tr.appendChild(actionsTd);

          tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        tableWrap.appendChild(table);
        container.appendChild(tableWrap);

      } catch (err) {
        loadingMsg.textContent = "Error al listar usuarios: " + err.message;
      }
    }

    // Modal para editar los permisos y carreras de un usuario
    openEditUserModal(user) {
      const backdrop = h("div", { class: "iset-modal-backdrop open", style: "z-index:10001" });
      const modal = h("div", { class: "iset-modal" });

      const header = h("div", { class: "iset-modal-header" },
        h("h3", { class: "iset-modal-title" }, `Permisos: ${user.full_name || user.email}`),
        h("button", { class: "iset-modal-close", onclick: () => backdrop.remove() }, "×")
      );

      const body = h("div", { class: "iset-modal-body" });

      const roleSelect = h("select", { class: "iset-select" },
        h("option", { value: config.ROLES.VISITANTE, selected: user.role === config.ROLES.VISITANTE }, "Visitante (Solo lectura)"),
        h("option", { value: config.ROLES.ADMIN, selected: user.role === config.ROLES.ADMIN }, "Administrador de Carreras"),
        h("option", { value: config.ROLES.SUPERUSER, selected: user.role === config.ROLES.SUPERUSER }, "Superusuario (Permisos totales)")
      );

      const isInitiallyAdmin = user.role === config.ROLES.ADMIN;
      const initialCarreras = Array.isArray(user.carreras) && user.carreras.length > 0
        ? user.carreras
        : config.carreras.map(c => c.id);

      const carrerasSection = h("div", {
        id: "carreras-selector-section",
        style: isInitiallyAdmin ? "display:block;margin-top:1.2rem" : "display:none;margin-top:1.2rem"
      },
        h("div", { style: "display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem" },
          h("label", { class: "iset-label", style: "margin:0" }, "Carreras que podrá administrar:"),
          h("div", { style: "display:flex;gap:0.5rem" },
            h("button", {
              type: "button",
              class: "iset-btn-secondary",
              style: "padding:0.2rem 0.55rem;font-size:0.75rem",
              onclick: () => {
                carrerasSection.querySelectorAll("input[type=checkbox]").forEach(cb => cb.checked = true);
              }
            }, "Marcar todas"),
            h("button", {
              type: "button",
              class: "iset-btn-secondary",
              style: "padding:0.2rem 0.55rem;font-size:0.75rem",
              onclick: () => {
                carrerasSection.querySelectorAll("input[type=checkbox]").forEach(cb => cb.checked = false);
              }
            }, "Desmarcar")
          )
        ),
        h("div", { class: "iset-checkbox-grid" },
          ...config.carreras.map(c => {
            const isChecked = isInitiallyAdmin
              ? initialCarreras.includes(c.id)
              : true; // Por defecto marcar todas si se promueve a admin
            return h("label", { class: "iset-checkbox-label" },
              h("input", {
                type: "checkbox",
                name: "carrera",
                value: c.id,
                checked: isChecked
              }),
              h("span", {}, `${c.icono} ${c.nombre}`)
            );
          })
        ),
        h("div", { class: "iset-alert iset-alert-info", style: "margin-top:0.8rem;font-size:0.82rem;line-height:1.45" },
          "💡 Los administradores pueden editar Novedades, Avisos, Mesas de Examen, Planes de Estudio, Inscripción, FAQs, Comunidad y las carreras que tengan asignadas."
        )
      );

      roleSelect.addEventListener("change", () => {
        const isAdm = roleSelect.value === config.ROLES.ADMIN;
        carrerasSection.style.display = isAdm ? "block" : "none";
        if (isAdm) {
          const checked = carrerasSection.querySelectorAll("input[type=checkbox]:checked");
          if (checked.length === 0) {
            carrerasSection.querySelectorAll("input[type=checkbox]").forEach(cb => cb.checked = true);
          }
        }
      });

      body.appendChild(h("div", { class: "iset-form-group" },
        h("label", { class: "iset-label" }, "Rol del Usuario"),
        roleSelect
      ));
      body.appendChild(carrerasSection);

      const footer = h("div", { class: "iset-modal-footer" },
        h("button", { class: "iset-btn-secondary", onclick: () => backdrop.remove() }, "Cancelar"),
        h("button", {
          class: "iset-btn-primary",
          style: "width:auto",
          onclick: async (e) => {
            const btn = e.target;
            btn.disabled = true;
            btn.textContent = "Guardando…";

            const newRole = roleSelect.value;
            let assignedCarreras = [];
            if (newRole === config.ROLES.ADMIN) {
              const checkedBoxes = carrerasSection.querySelectorAll("input[type=checkbox]:checked");
              assignedCarreras = Array.from(checkedBoxes).map(cb => cb.value);
              // Si no tildó ninguna o tildó todas, asignar todas
              if (assignedCarreras.length === 0) {
                assignedCarreras = config.carreras.map(c => c.id);
              }
            } else if (newRole === config.ROLES.SUPERUSER) {
              assignedCarreras = config.carreras.map(c => c.id);
            }

            try {
              await auth.updateUserRole(user.id, newRole, assignedCarreras);
              showToast("Permisos actualizados con éxito", "success");
              backdrop.remove();
              this.renderDashboardContent();
            } catch (err) {
              showToast(err.message || "Error al actualizar permisos", "error");
            } finally {
              btn.disabled = false;
              btn.textContent = "Guardar Permisos";
            }
          }
        }, "Guardar Permisos")
      );

      modal.appendChild(header);
      modal.appendChild(body);
      modal.appendChild(footer);
      backdrop.appendChild(modal);
      document.body.appendChild(backdrop);
    }

    renderExportTab(container) {
      container.appendChild(h("div", { class: "iset-alert iset-alert-success" },
        "💾 Los cambios que realices quedan guardados en tiempo real. Podés editar el código JSON directamente, subir archivos desde tu computadora o descargar copias para el repositorio."
      ));

      // Card destacada para abrir el Editor de Código JSON en Tiempo Real
      const editorCard = h("div", {
        class: "caja-info",
        style: "border-top:6px solid var(--tinta);background:var(--papel);padding:1.4rem;margin-bottom:1.4rem;display:flex;flex-direction:column;gap:0.75rem;box-shadow:0 4px 16px rgba(20,33,61,0.08)"
      },
        h("div", { style: "display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem" },
          h("h3", { style: "margin:0;font:800 1.25rem var(--f-titulo);color:var(--tinta)" }, "📝 Editor de Código JSON & Subida de Archivos"),
          h("span", { class: "badge-espacio", style: "background:var(--sol);color:var(--tinta);font-weight:800" }, "⚡ Tiempo Real")
        ),
        h("p", { style: "margin:0;color:var(--suave);font-size:0.92rem" },
          "Permite ver el código JSON en vivo, validarlo con detector de errores, modificarlo manualmente o cargar un archivo .json directamente desde tu disco para aplicarlo de forma instantánea a todo el sitio."
        ),
        h("div", { style: "display:flex;gap:0.75rem;flex-wrap:wrap;margin-top:0.3rem" },
          h("button", {
            class: "iset-btn-primary",
            style: "width:auto;font-size:0.92rem",
            onclick: () => {
              this.closeDashboardModal();
              if (window.ISET_EDITOR_UI) window.ISET_EDITOR_UI.openRawJSONEditor("data");
            }
          }, "📝 Abrir Editor de data.json"),
          h("button", {
            class: "iset-btn-secondary",
            style: "font-size:0.92rem",
            onclick: () => {
              this.closeDashboardModal();
              if (window.ISET_EDITOR_UI) window.ISET_EDITOR_UI.openRawJSONEditor("materias");
            }
          }, "📝 Abrir Editor de materias.json")
        )
      );

      container.appendChild(editorCard);

      const cardsGrid = h("div", { style: "display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.2rem;margin-top:1.2rem" },
        // Card data.json
        h("div", { class: "caja-info", style: "border-top:5px solid var(--celeste);padding:1.4rem" },
          h("h3", { style: "margin:0 0 0.5rem;font:800 1.2rem var(--f-titulo)" }, "📄 data.json"),
          h("p", { style: "font-size:0.9rem;color:var(--suave);margin:0 0 1rem" },
            "Contiene la información institucional, avisos de novedades, requisitos de inscripción y oferta académica."
          ),
          h("div", { style: "display:flex;gap:0.6rem;flex-wrap:wrap" },
            h("button", {
              class: "iset-btn-primary",
              style: "font-size:0.88rem;padding:0.45rem 1rem",
              onclick: () => {
                content.exportFile("data");
                showToast("data.json descargado correctamente", "success");
              }
            }, "📥 Descargar data.json"),
            h("button", {
              class: "iset-btn-secondary",
              style: "font-size:0.88rem",
              onclick: async () => {
                await content.copyToClipboard("data");
                showToast("Contenido de data.json copiado al portapapeles", "success");
              }
            }, "📋 Copiar JSON")
          )
        ),
        // Card materias.json
        h("div", { class: "caja-info", style: "border-top:5px solid var(--sol);padding:1.4rem" },
          h("h3", { style: "margin:0 0 0.5rem;font:800 1.2rem var(--f-titulo)" }, "📄 materias.json"),
          h("p", { style: "font-size:0.9rem;color:var(--suave);margin:0 0 1rem" },
            "Estructura detallada de materias por año, comisiones, docentes asignados y correlatividades."
          ),
          h("div", { style: "display:flex;gap:0.6rem;flex-wrap:wrap" },
            h("button", {
              class: "iset-btn-primary",
              style: "font-size:0.88rem;padding:0.45rem 1rem",
              onclick: () => {
                content.exportFile("materias");
                showToast("materias.json descargado correctamente", "success");
              }
            }, "📥 Descargar materias.json"),
            h("button", {
              class: "iset-btn-secondary",
              style: "font-size:0.88rem",
              onclick: async () => {
                await content.copyToClipboard("materias");
                showToast("Contenido de materias.json copiado al portapapeles", "success");
              }
            }, "📋 Copiar JSON")
          )
        )
      );

      container.appendChild(cardsGrid);
    }

    renderSupabaseTab(container) {
      const isLive = auth.isLiveSupabase();
      const hasProd = config.hasConfiguredProduction;

      const statusAlert = h("div", {
        class: `iset-alert ${isLive ? "iset-alert-success" : "iset-alert-warning"}`
      }, isLive
        ? `🟢 Conexión activa con Supabase (${auth.config.supabaseUrl}). Todos los registros de usuarios y cambios de contenido se sincronizan en la nube.`
        : "🟡 Modo Local / Pruebas activo. Los registros de usuarios se guardan sólo en el almacenamiento local de este navegador."
      );
      container.appendChild(statusAlert);

      const prodNotice = h("div", {
        class: "iset-alert iset-alert-info",
        style: "margin-top:0.8rem;line-height:1.5"
      },
        h("strong", {}, "💡 ¿Por qué no veías los usuarios en producción?"),
        h("p", { style: "margin:0.4rem 0 0;font-size:0.88rem" },
          "El formulario de abajo guarda las credenciales únicamente en el ",
          h("code", {}, "localStorage"),
          " de este navegador. Para que ",
          h("strong", {}, "TODOS"),
          " los visitantes que se registren en GitHub Pages queden registrados en la base centralizada de Supabase, las credenciales deben cargarse en el archivo ",
          h("code", {}, "js/auth/config.js"),
          " o como Secrets en GitHub Actions (",
          h("code", {}, "SUPABASE_URL"),
          " y ",
          h("code", {}, "SUPABASE_ANON_KEY"),
          ")."
        )
      );
      container.appendChild(prodNotice);

      const form = h("form", {
        onsubmit: (e) => {
          e.preventDefault();
          const url = form.sbUrl.value.trim();
          const key = form.sbKey.value.trim();

          localStorage.setItem("iset_supabase_url", url);
          localStorage.setItem("iset_supabase_anon_key", key);

          showToast("Credenciales guardadas en este navegador. Conectando…", "success");
          setTimeout(() => window.location.reload(), 1200);
        }
      },
        h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label", for: "sb-url" }, "Supabase Project URL"),
          h("input", {
            type: "text",
            id: "sb-url",
            name: "sbUrl",
            class: "iset-input",
            defaultValue: localStorage.getItem("iset_supabase_url") || config.supabaseUrl || "",
            placeholder: "https://xyzcompany.supabase.co"
          })
        ),
        h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label", for: "sb-key" }, "Supabase Anon Key (Public)"),
          h("input", {
            type: "password",
            id: "sb-key",
            name: "sbKey",
            class: "iset-input",
            defaultValue: localStorage.getItem("iset_supabase_anon_key") || config.supabaseAnonKey || "",
            placeholder: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
          })
        ),
        h("div", { style: "display:flex;flex-wrap:wrap;gap:0.75rem;margin-top:1.2rem" },
          h("button", { type: "submit", class: "iset-btn-primary", style: "width:auto" }, "Guardar en este Navegador"),
          h("button", {
            type: "button",
            class: "iset-btn-secondary",
            onclick: () => {
              const url = form.sbUrl.value.trim();
              const key = form.sbKey.value.trim();
              if (!url || !key) {
                showToast("Ingresá la URL y Anon Key primero para copiar el código", "warning");
                return;
              }
              const snippet = `  const PRODUCTION_SUPABASE_URL = "${url}";\n  const PRODUCTION_SUPABASE_ANON_KEY = "${key}";`;
              navigator.clipboard?.writeText(snippet)
                .then(() => showToast("📋 Código copiado. Pegalo en js/auth/config.js", "success"))
                .catch(() => alert(snippet));
            }
          }, "📋 Copiar código para config.js"),
          h("button", {
            type: "button",
            class: "iset-btn-secondary",
            onclick: () => {
              localStorage.removeItem("iset_supabase_url");
              localStorage.removeItem("iset_supabase_anon_key");
              showToast("Restaurado a modo local predeterminado.", "info");
              setTimeout(() => window.location.reload(), 1000);
            }
          }, "Restablecer a Modo Local")
        )
      );

      container.appendChild(form);

      // Guía rápida de SQL y Email Confirm
      const guideBox = h("div", { style: "margin-top:1.8rem;background:var(--fondo);border:1px solid var(--borde);border-radius:10px;padding:1.2rem" },
        h("h4", { style: "margin:0 0 0.5rem;font:800 1.05rem var(--f-titulo)" }, "📜 Pasos en tu panel de Supabase"),
        h("ul", { style: "margin:0;padding-left:1.2rem;font-size:0.88rem;color:var(--suave);line-height:1.6" },
          h("li", {},
            h("strong", {}, "Desactivar confirmación por email obligatoria: "),
            "Andá a ", h("em", {}, "Authentication -> Providers -> Email"),
            " y desmarcá ", h("strong", {}, "'Confirm email'"),
            ". Así cualquier usuario registrado podrá ingresar sin esperar correos."
          ),
          h("li", {},
            h("strong", {}, "Ejecutar supabase-setup.sql: "),
            "Copiá y ejecutá el script en ", h("em", {}, "SQL Editor"),
            " de Supabase. El script sincroniza automáticamente todos los usuarios existentes en ",
            h("code", {}, "auth.users"), " hacia la tabla ", h("code", {}, "profiles"), "."
          )
        )
      );
      container.appendChild(guideBox);
    }
  }

  window.ISET_AUTH_UI = new AuthUI();
})();
