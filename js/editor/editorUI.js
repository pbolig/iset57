/**
 * ISET N° 57 - Sistema de Píldoras de Edición Amigables y Modales Contextuales
 * Permite a Superusuarios y Administradores modificar cualquier grilla, lista, tabla o sección
 * visualmente (editar / agregar / borrar) sin tocar código JSON, con refresco instantáneo en tiempo real.
 */
(() => {
  "use strict";

  const auth = window.ISET_AUTH;
  const content = window.ISET_CONTENT;
  const config = window.ISET_CONFIG;

  const h = (tag, attrs = {}, ...children) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") {
        el.className = v;
      } else if (k === "value") {
        el.value = v;
        el.setAttribute("value", v);
      } else if (k === "defaultValue") {
        el.defaultValue = v;
        el.value = v;
      } else if (k === "checked") {
        el.checked = Boolean(v);
        if (v) el.setAttribute("checked", "");
      } else if (k === "selected") {
        el.selected = Boolean(v);
        if (v) el.setAttribute("selected", "");
      } else if (k.startsWith("on") && typeof v === "function") {
        el.addEventListener(k.slice(2).toLowerCase(), v);
      } else {
        el.setAttribute(k, v);
      }
    }

    if (attrs.value != null) {
      el.value = attrs.value;
    } else if (attrs.defaultValue != null) {
      el.value = attrs.defaultValue;
    }

    children.flat().forEach(c => {
      if (c != null) el.append(c.nodeType ? c : document.createTextNode(c));
    });

    if (tag.toLowerCase() === "textarea" && children.length > 0 && attrs.value == null && attrs.defaultValue == null) {
      el.value = el.textContent;
    }

    return el;
  };

  class EditorUI {
    constructor() {
      this.activeModal = null;
      this.init();
    }

    init() {
      auth.on("auth-changed", () => this.refreshPills());
      auth.on("auth-ready", () => this.refreshPills());
      content.on("content-updated", () => this.refreshPills());

      // Enganchar a __iset_render para refrescar píldoras limpiamente tras renderizados
      const wrapRender = () => {
        if (typeof window.__iset_render === "function" && !window.__iset_render._isetWrapped) {
          const original = window.__iset_render;
          window.__iset_render = (data) => {
            original(data);
            if (!this.activeModal) {
              setTimeout(() => this.refreshPills(), 60);
            }
          };
          window.__iset_render._isetWrapped = true;
        }
      };

      wrapRender();
      window.addEventListener("iset:content-loaded", () => {
        wrapRender();
        if (!this.activeModal) this.refreshPills();
      });

      // Observador enfocado ÚNICAMENTE en contenedores de datos para evitar parpadeos
      const observeDynamicContainers = () => {
        const containers = [
          document.getElementById("avisos"),
          document.getElementById("cards"),
          document.getElementById("articulos-container"),
          document.getElementById("plan")
        ].filter(Boolean);

        if (!containers.length) return;

        const observer = new MutationObserver((mutations) => {
          if (this.activeModal) return;

          const isOurMutation = mutations.every(m => {
            const target = m.target;
            return target && (
              target.classList?.contains("iset-edit-pill") ||
              target.classList?.contains("iset-pill-prominent") ||
              target.classList?.contains("iset-grid-toolbar-pills") ||
              target.closest?.(".iset-modal-backdrop")
            );
          });
          if (isOurMutation) return;

          if (!this._debounceTimer) {
            this._debounceTimer = setTimeout(() => {
              if (!this.activeModal) this.refreshPills();
              this._debounceTimer = null;
            }, 180);
          }
        });

        containers.forEach(c => observer.observe(c, { childList: true }));
      };

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
          wrapRender();
          observeDynamicContainers();
          this.refreshPills();
        });
      } else {
        wrapRender();
        observeDynamicContainers();
        this.refreshPills();
      }
    }

    clearPills() {
      document.querySelectorAll(".iset-edit-pill").forEach(el => el.remove());
      document.querySelectorAll(".iset-pill-prominent").forEach(el => el.remove());
      document.querySelectorAll(".iset-grid-toolbar-pills").forEach(el => el.remove());
      document.querySelectorAll(".iset-cta-restore-box").forEach(el => el.remove());
    }

    // Refrescar píldoras según el usuario logueado y la página actual
    refreshPills() {
      if (this.activeModal) return; // NUNCA borrar píldoras ni parpadear si un modal está activo

      this.clearPills();

      if (!auth.isLoggedIn()) return;

      const user = auth.getCurrentUser();
      if (!user || user.role === config.ROLES.VISITANTE) return;

      const path = window.location.pathname.toLowerCase();

      // 1. Píldoras en Index / Portada
      if (path.endsWith("index.html") || path.endsWith("/") || path.endsWith("/newiset57/") || (!path.includes(".html") && !path.includes("comunidad"))) {
        this.attachIndexPills();
      }

      // 2. Píldoras en Páginas de Carreras
      config.carreras.forEach(c => {
        if (path.includes(c.pagina) || path.includes(c.id)) {
          this.attachCarreraPagePills(c.id);
        }
      });

      // 3. Píldoras en Inscripción
      if (path.includes("inscripcion.html")) {
        this.attachInscripcionPills();
      }

      // 4. Píldoras en Comunidad y Blog
      if (path.includes("comunidad.html")) {
        this.attachComunidadPills();
      }
    }

    // Píldora sutil flotante en esquina
    createPill(label, onClick, customClass = "") {
      const pill = h("button", {
        type: "button",
        class: `iset-edit-pill ${customClass}`,
        title: label,
        "aria-label": label,
        onclick: (e) => {
          e.preventDefault();
          e.stopPropagation();
          onClick(e);
        }
      },
        document.createRange().createContextualFragment(`
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
          </svg>
        `),
        h("span", {}, label || "Editar")
      );
      return pill;
    }

    // Píldora destacada y amigable para cabeceras y barras de grillas
    createProminentPill(label, onClick, icon = "✏️", isAdd = false) {
      const pill = h("button", {
        type: "button",
        class: `iset-pill-prominent ${isAdd ? "iset-pill-add" : ""}`,
        title: label,
        "aria-label": label,
        onclick: (e) => {
          e.preventDefault();
          e.stopPropagation();
          onClick(e);
        }
      },
        h("span", { style: "font-size:0.95rem" }, icon),
        h("span", {}, label)
      );
      return pill;
    }

    // ====================================================
    // PÍLDORAS EN INDEX.HTML (Portada)
    // ====================================================
    attachIndexPills() {
      const canEditGeneral = auth.canEdit();

      // 1. Hero Institucional (Superusuario o Administrador)
      if (canEditGeneral) {
        const hero = document.querySelector(".hero");
        if (hero && !hero.querySelector(".iset-pill-hero")) {
          hero.classList.add("iset-editable-host");
          const pill = this.createProminentPill("Modificar Datos Institucionales", () => this.openInstitucionEditor(), "🏛️");
          pill.classList.add("iset-pill-hero", "iset-pill-corner");
          hero.appendChild(pill);
        }

        // Barra de herramientas sobre Novedades
        const novSec = document.getElementById("novedades");
        if (novSec) {
          const tNov = document.getElementById("t-nov");
          if (tNov && !tNov.parentNode.querySelector(".iset-nov-toolbar")) {
            const toolbar = h("div", { class: "iset-grid-toolbar-pills iset-nov-toolbar" },
              this.createProminentPill("Modificar Título e Intro de Novedades", () => this.openNovedadesHeadEditor(), "✏️"),
              this.createProminentPill("Publicar Nuevo Aviso", () => this.openAddAvisoEditor(), "➕", true)
            );
            tNov.after(toolbar);
          }
        }

        // Barra de herramientas sobre Oferta Académica
        const ofSec = document.getElementById("oferta") || document.querySelector(".oferta");
        if (ofSec) {
          const tOf = document.getElementById("t-of");
          if (tOf && !tOf.parentNode.querySelector(".iset-of-toolbar")) {
            const toolbar = h("div", { class: "iset-grid-toolbar-pills iset-of-toolbar" },
              this.createProminentPill("Modificar Título de Oferta Académica", () => this.openOfertaHeadEditor(), "✏️")
            );
            tOf.after(toolbar);
          }
        }

        // Pie de Página Institucional
        const pie = document.getElementById("pie");
        if (pie && !pie.parentNode.querySelector(".iset-pill-pie")) {
          const footerWrap = pie.closest("footer") || pie;
          footerWrap.classList.add("iset-editable-host");
          const pillWrap = h("div", { style: "text-align:center;margin-top:1rem" },
            this.createProminentPill("Modificar Contacto y Horarios", () => this.openInstitucionEditor(), "📞")
          );
          pie.after(pillWrap);
        }
      }

      // 2. Cada Aviso individual en la grilla de Novedades (Mesas de Examen)
      if (canEditGeneral) {
        const avisos = document.querySelectorAll(".avisos .aviso");
        const avisosData = content.getData()?.informacionGeneral?.avisos || [];
        avisos.forEach((avisoEl, idx) => {
          const avData = avisosData[idx];
          if (!avisoEl.querySelector(".iset-pill-aviso")) {
            avisoEl.classList.add("iset-editable-host");
            const isTable = Boolean(avData?.contenido?.filas || avData?.contenido?.columnas);
            const pillLabel = isTable ? "Modificar Mesas de Examen / Tabla" : (avData?.imagen ? "Modificar Publicación / Foto" : "Modificar Aviso");
            const pill = this.createPill(pillLabel, () => this.openAvisoEditor(idx), "iset-pill-aviso iset-pill-corner");
            avisoEl.appendChild(pill);
          }

          // Si el aviso contiene una tabla de datos (ej: Mesas de examen), agregamos una píldora prominente directamente en la toolbar de la tabla
          const tablaToolbar = avisoEl.querySelector(".tabla-toolbar");
          if (tablaToolbar && !tablaToolbar.querySelector(".iset-pill-tabla")) {
            const pillTabla = this.createProminentPill("Gestionar Mesas de Examen (Editar / Agregar / Borrar)", () => this.openAvisoEditor(idx), "📋");
            pillTabla.classList.add("iset-pill-tabla");
            pillTabla.style.fontSize = "0.82rem";
            pillTabla.style.padding = "0.32rem 0.85rem";
            tablaToolbar.appendChild(pillTabla);
          }
        });
      }

      // 3. Cada Card de Carrera en la Oferta Académica
      const cards = document.querySelectorAll(".cards .card");
      const espacios = content.getData()?.ofertaAcademica?.espacios || [];

      cards.forEach((cardEl, idx) => {
        const espacio = espacios[idx];
        if (!espacio) return;

        if (auth.canEdit(espacio.id)) {
          if (!cardEl.querySelector(".iset-pill-card")) {
            const cardInfo = cardEl.querySelector(".card-info") || cardEl;
            const btnWrap = cardInfo.querySelector("div:last-child") || cardInfo;
            const pill = this.createProminentPill("Modificar Carrera y Fotos", () => this.openCarreraCardEditor(espacio.id), "✏️");
            pill.classList.add("iset-pill-card");
            pill.style.marginTop = "0.5rem";
            pill.style.fontSize = "0.82rem";
            pill.style.padding = "0.32rem 0.85rem";
            btnWrap.appendChild(pill);

            if (espacio.id !== "simulacion" && !cardEl.querySelector(".iset-pill-card-plan")) {
              const pillPlan = this.createProminentPill("Gestionar Plan", () => this.openPlanEstudiosEditor(espacio.id), "📋");
              pillPlan.classList.add("iset-pill-card-plan");
              pillPlan.style.marginTop = "0.5rem";
              pillPlan.style.marginLeft = "0.4rem";
              pillPlan.style.fontSize = "0.82rem";
              pillPlan.style.padding = "0.32rem 0.85rem";
              btnWrap.appendChild(pillPlan);
            }
          }
        }
      });

      // 4. Botón en Oferta Académica (.oferta-acciones)
      const ofAcciones = document.querySelector(".oferta-acciones");
      if (ofAcciones && !ofAcciones.querySelector(".iset-pill-planes")) {
        const editableCarreras = config.carreras.filter(c => auth.canEdit(c.id) && c.id !== "simulacion");
        if (editableCarreras.length > 0) {
          const pillPlanes = this.createProminentPill(
            "Gestionar Planes de Estudio y Correlatividades",
            () => this.openPlanEstudiosEditor(),
            "📋"
          );
          pillPlanes.classList.add("iset-pill-planes");
          pillPlanes.style.marginLeft = "0.75rem";
          pillPlanes.style.fontSize = "0.95rem";
          pillPlanes.style.padding = "0.55rem 1.25rem";
          ofAcciones.appendChild(pillPlanes);
        }
      }

      // 5. Botón en Cabecera del Modal de Planes (#modal-plan)
      const modalPlan = document.getElementById("modal-plan");
      if (modalPlan) {
        const headerActions = modalPlan.querySelector(".modal-header-actions") || modalPlan.querySelector(".modal-header");
        if (headerActions && !modalPlan.querySelector(".iset-pill-modal-plan")) {
          const editableCarreras = config.carreras.filter(c => auth.canEdit(c.id) && c.id !== "simulacion");
          if (editableCarreras.length > 0) {
            const pillModal = this.createProminentPill(
              "✏️ Modificar / Gestionar Materias de este Plan",
              () => {
                const activeCareerId = modalPlan.getAttribute("data-active-career") ||
                                       modalPlan.querySelector("#plan-tabs .tab-btn.active")?.getAttribute("data-carrera") ||
                                       editableCarreras[0].id;
                this.openPlanEstudiosEditor(activeCareerId, (savedCarreraId) => {
                  if (window.abrirModalPlanCarrera) {
                    window.abrirModalPlanCarrera(savedCarreraId || activeCareerId);
                  }
                });
              },
              "📋"
            );
            pillModal.classList.add("iset-pill-modal-plan");

            const closeBtn = headerActions.querySelector(".modal-close");
            if (closeBtn) {
              closeBtn.before(pillModal);
            } else {
              headerActions.appendChild(pillModal);
            }
          }
        }
      }
    }

    // ====================================================
    // PÍLDORAS EN PÁGINAS DE CARRERAS
    // ====================================================
    attachCarreraPagePills(carreraId) {
      if (!auth.canEdit(carreraId)) return;

      // 1. Hero de Carrera
      const hero = document.querySelector(".hero");
      if (hero && !hero.querySelector(".iset-pill-carrera-hero")) {
        hero.classList.add("iset-editable-host");
        const pill = this.createProminentPill("Modificar Cabecera y Datos Rápidos", () => this.openCarreraHeroEditor(carreraId), "🎓");
        pill.classList.add("iset-pill-carrera-hero", "iset-pill-corner");
        hero.appendChild(pill);
      }

      // 2. Grillas de Perfil del Egresado y Campo Laboral
      const boxes = document.querySelectorAll(".caja-info");
      boxes.forEach(box => {
        const h3 = box.querySelector("h3");
        if (!h3) return;
        const text = h3.textContent.toLowerCase();

        if (text.includes("perfil") && !box.querySelector(".iset-pill-perfil")) {
          box.classList.add("iset-editable-host");
          const pill = this.createProminentPill("Modificar Lista de Perfil", () => this.openPerfilEditor(carreraId), "✏️");
          pill.classList.add("iset-pill-perfil", "iset-pill-corner");
          box.appendChild(pill);
        } else if (text.includes("campo") && !box.querySelector(".iset-pill-campo")) {
          box.classList.add("iset-editable-host");
          const pill = this.createProminentPill("Modificar Lista de Campo Laboral", () => this.openCampoEditor(carreraId), "✏️");
          pill.classList.add("iset-pill-campo", "iset-pill-corner");
          box.appendChild(pill);
        }
      });

      // 3. Grilla de Plan de Estudios y Materias
      const planSec = document.getElementById("plan");
      if (planSec) {
        const h2 = planSec.querySelector("h2");
        if (h2 && !planSec.querySelector(".iset-plan-toolbar")) {
          const toolbar = h("div", { class: "iset-grid-toolbar-pills iset-plan-toolbar" },
            this.createProminentPill("Gestionar Plan de Estudios (Agregar / Editar / Borrar Materias)", () => this.openPlanEstudiosEditor(carreraId), "📋")
          );
          h2.after(toolbar);
        }
      }

      // 4. Simulación Clínica (Equipamiento y Actividades)
      if (carreraId === "simulacion") {
        const equipList = document.getElementById("equip-list");
        if (equipList && !equipList.parentNode.querySelector(".iset-pill-equip")) {
          const box = equipList.closest(".caja-info") || equipList.parentNode;
          box.classList.add("iset-editable-host");
          const pill = this.createProminentPill("Modificar Equipamiento", () => this.openSimulacionEquipamientoEditor(), "🏥");
          pill.classList.add("iset-pill-equip", "iset-pill-corner");
          box.appendChild(pill);
        }

        const actList = document.getElementById("act-list");
        if (actList && !actList.parentNode.querySelector(".iset-pill-act")) {
          const box = actList.closest(".caja-info") || actList.parentNode;
          box.classList.add("iset-editable-host");
          const pill = this.createProminentPill("Modificar Actividades", () => this.openSimulacionActividadesEditor(), "🎯");
          pill.classList.add("iset-pill-act", "iset-pill-corner");
          box.appendChild(pill);
        }
      }

      // 5. Caja CTA de Inscripción
      const ctaSec = document.querySelector(".cta-sec, .cta-caja");
      if (ctaSec && !ctaSec.querySelector(".iset-pill-cta")) {
        ctaSec.classList.add("iset-editable-host");
        const pill = this.createProminentPill("Modificar Fechas de Inscripción", () => this.openCarreraCtaEditor(carreraId), "📅");
        pill.classList.add("iset-pill-cta", "iset-pill-corner");
        ctaSec.appendChild(pill);
      }
    }

    // ====================================================
    // PÍLDORAS EN INSCRIPCIÓN.HTML
    // ====================================================
    attachInscripcionPills() {
      const user = auth.getCurrentUser();
      if (!user || user.role === config.ROLES.VISITANTE) return;

      // 1. Cabecera Hero
      const hero = document.querySelector(".hero");
      if (hero && !hero.querySelector(".iset-pill-ins-hero")) {
        hero.classList.add("iset-editable-host");
        const pill = this.createProminentPill("Modificar Título e Introducción", () => this.openInscripcionHeroEditor(), "📝");
        pill.classList.add("iset-pill-ins-hero", "iset-pill-corner");
        hero.appendChild(pill);
      }

      // 2. Grilla de Pasos
      const secPasos = document.getElementById("pasos") || document.getElementById("pasos-sec") || document.querySelector(".pasos-grid")?.closest("section");
      if (secPasos && !secPasos.querySelector(".iset-pasos-toolbar")) {
        const h2 = secPasos.querySelector("h2");
        const toolbar = h("div", { class: "iset-grid-toolbar-pills iset-pasos-toolbar" },
          this.createProminentPill("Gestionar Pasos de Inscripción (Agregar / Editar / Borrar)", () => this.openInscripcionPasosEditor(), "🔢"),
          this.createProminentPill("Modificar Curso Propedéutico", () => this.openInscripcionPropedeuticoEditor(), "📚")
        );
        if (h2) h2.after(toolbar);
        else secPasos.prepend(toolbar);
      }

      // 3. Grilla de Requisitos Comunes
      const secReq = document.getElementById("requisitos") || document.getElementById("requisitos-sec") || document.getElementById("req-list")?.closest("section");
      if (secReq && !secReq.querySelector(".iset-req-toolbar")) {
        const h2 = secReq.querySelector("h2");
        const toolbar = h("div", { class: "iset-grid-toolbar-pills iset-req-toolbar" },
          this.createProminentPill("Gestionar Requisitos Comunes (Agregar / Editar / Borrar)", () => this.openInscripcionRequisitosEditor(), "📄")
        );
        if (h2) h2.after(toolbar);
        else secReq.prepend(toolbar);
      }

      // 4. Tabla de Períodos de Inscripción
      const secPer = document.getElementById("fechas") || document.getElementById("fechas-sec") || document.getElementById("periodos-container")?.closest("section") || document.querySelector("table")?.closest("section");
      if (secPer && !secPer.querySelector(".iset-per-toolbar")) {
        const h2 = secPer.querySelector("h2");
        const toolbar = h("div", { class: "iset-grid-toolbar-pills iset-per-toolbar" },
          this.createProminentPill("Gestionar Tabla de Fechas y Períodos (Agregar / Editar / Borrar)", () => this.openInscripcionPeriodosEditor(), "📅")
        );
        if (h2) h2.after(toolbar);
        else secPer.prepend(toolbar);
      }

      // 5. Grilla de Preguntas Frecuentes (FAQ)
      const secFaq = document.getElementById("faq") || document.getElementById("faq-sec") || document.getElementById("faq-container")?.closest("section") || document.getElementById("t-faq")?.closest("section");
      if (secFaq && !secFaq.querySelector(".iset-faq-toolbar")) {
        const h2 = secFaq.querySelector("h2");
        const toolbar = h("div", { class: "iset-grid-toolbar-pills iset-faq-toolbar" },
          this.createProminentPill("Gestionar Preguntas Frecuentes (Agregar / Editar / Borrar)", () => this.openInscripcionFaqEditor(), "❓"),
          this.createProminentPill("Agregar Nueva Pregunta", () => this.openInscripcionFaqEditor(true), "➕", true)
        );
        if (h2) h2.after(toolbar);
        else secFaq.prepend(toolbar);
      }

      // 6. En cada ítem individual de Pregunta Frecuente
      const faqDetails = document.querySelectorAll("#faq-container details");
      faqDetails.forEach((det, idx) => {
        if (!det.querySelector(".iset-pill-faq-item")) {
          det.classList.add("iset-editable-host");
          const pill = this.createPill("Editar esta pregunta", (e) => {
            this.openInscripcionFaqEditor(false, idx);
          }, "iset-pill-faq-item iset-pill-corner");
          det.appendChild(pill);
        }
      });

      // 7. Caja de Dudas Adicionales y Contacto Secretaría (#cta-box)
      const ctaBox = document.getElementById("cta-box");
      const secFaqWrap = secFaq?.querySelector(".wrap") || secFaq;
      const cs = content.getData()?.inscripcionGeneral?.contactoSecretaria;
      const isCtaActive = cs ? cs.activo !== false : true;

      if (isCtaActive && ctaBox) {
        if (!ctaBox.querySelector(".iset-pill-cta-dudas")) {
          ctaBox.classList.add("iset-editable-host");
          const toolbar = h("div", { class: "iset-grid-toolbar-pills iset-pill-cta-dudas", style: "margin-top:1.25rem" },
            this.createProminentPill("Modificar Caja '¿Tenés dudas adicionales?'", () => this.openInscripcionDudasEditor(), "✏️"),
            this.createProminentPill("Ocultar / Eliminar esta Caja", async () => {
              if (confirm("¿Seguro que deseás ocultar o eliminar la caja '¿Tenés dudas adicionales?' de la página?")) {
                await content.updateData(d => {
                  d.inscripcionGeneral = d.inscripcionGeneral || {};
                  d.inscripcionGeneral.contactoSecretaria = d.inscripcionGeneral.contactoSecretaria || {};
                  d.inscripcionGeneral.contactoSecretaria.activo = false;
                  return d;
                });
                window.ISET_TOAST("Caja de dudas adicionales ocultada. Podés reactivarla cuando quieras.", "info");
              }
            }, "🗑️")
          );
          ctaBox.appendChild(toolbar);
        }
      } else if (!isCtaActive && secFaqWrap) {
        if (!secFaqWrap.querySelector(".iset-cta-restore-box")) {
          const restoreBox = h("div", {
            class: "iset-cta-restore-box",
            style: "border:2px dashed var(--borde,#d3dde9);border-radius:10px;padding:1.4rem;text-align:center;margin-top:2rem;background:rgba(116,172,223,0.06)"
          },
            h("p", { style: "margin:0 0 0.75rem;color:var(--suave);font-style:italic" }, "La caja de '¿Tenés dudas adicionales?' se encuentra oculta / eliminada de la página pública."),
            this.createProminentPill("➕ Activar / Agregar Caja '¿Tenés dudas adicionales?'", () => this.openInscripcionDudasEditor(true), "➕", true)
          );
          secFaqWrap.appendChild(restoreBox);
        }
      }
    }

    // ====================================================
    // PÍLDORAS EN COMUNIDAD.HTML (Blog y Novedades)
    // ====================================================
    attachComunidadPills() {
      if (!auth.canEdit()) return;

      // 1. Cabecera
      const hero = document.querySelector(".hero");
      if (hero && !hero.querySelector(".iset-pill-com-hero")) {
        hero.classList.add("iset-editable-host");
        const pill = this.createProminentPill("Modificar Cabecera de Comunidad", () => this.openComunidadHeroEditor(), "🤝");
        pill.classList.add("iset-pill-com-hero", "iset-pill-corner");
        hero.appendChild(pill);
      }

      // 2. Carrusel Hero
      const carruselBox = document.querySelector(".hero-carrusel-box");
      if (carruselBox && !carruselBox.querySelector(".iset-pill-com-carrusel")) {
        carruselBox.classList.add("iset-editable-host");
        const pill = this.createProminentPill("Gestionar Fotos del Carrusel", () => this.openComunidadCarruselEditor(), "📸");
        pill.classList.add("iset-pill-com-carrusel", "iset-pill-corner");
        carruselBox.appendChild(pill);
      }

      // 3. Barra de herramientas sobre Artículos
      const artContainer = document.getElementById("articulos-container");
      if (artContainer && !document.querySelector(".iset-art-toolbar")) {
        const toolbar = h("div", { class: "iset-grid-toolbar-pills iset-art-toolbar", style: "margin:1.5rem auto" },
          this.createProminentPill("Publicar Nuevo Artículo de Comunidad", () => this.openComunidadNuevoArticuloEditor(), "➕", true)
        );
        artContainer.before(toolbar);
      }

      // 4. En cada tarjeta de artículo
      const artCards = document.querySelectorAll(".art-card");
      const articulosData = content.getData()?.comunidad?.articulos || [];

      artCards.forEach((cardEl, idx) => {
        const art = articulosData[idx];
        if (!art) return;
        if (!cardEl.querySelector(".iset-pill-art")) {
          cardEl.classList.add("iset-editable-host");
          const pill = this.createPill("Modificar este Artículo", () => this.openComunidadEditarArticuloEditor(art.id || idx), "iset-pill-art iset-pill-corner");
          cardEl.appendChild(pill);
        }
      });
    }

    // ====================================================
    // CONSTRUCTOR BASE DE MODALES AMIGABLES
    // ====================================================
    createEditorModal(title, bodyContent, onSave, onCancel = null) {
      if (this.activeModal) {
        this.activeModal.remove();
        this.activeModal = null;
      }

      const backdrop = h("div", { class: "iset-modal-backdrop open", style: "z-index:9998" });
      const modal = h("div", { class: "iset-modal iset-modal-lg" });

      const closeModal = (isCancelled = true) => {
        if (isCancelled && onCancel) onCancel();
        backdrop.remove();
        if (this.activeModal === backdrop) {
          this.activeModal = null;
        }
        setTimeout(() => this.refreshPills(), 60);
      };

      const header = h("div", { class: "iset-modal-header" },
        h("h3", { class: "iset-modal-title" }, `✏️ ${title}`),
        h("button", {
          class: "iset-modal-close",
          title: "Cerrar sin guardar",
          onclick: () => closeModal(true)
        }, "×")
      );

      const body = h("div", { class: "iset-modal-body" }, bodyContent);

      const footer = h("div", { class: "iset-modal-footer" },
        h("button", {
          type: "button",
          class: "iset-btn-secondary",
          onclick: () => closeModal(true)
        }, "✕ Cancelar"),
        h("button", {
          type: "button",
          class: "iset-btn-primary",
          style: "width:auto;padding:0.6rem 1.6rem",
          onclick: async (e) => {
            const btn = e.target;
            btn.disabled = true;
            btn.textContent = "Guardando cambios…";
            try {
              await onSave();
              window.ISET_TOAST("✅ ¡Cambios guardados y aplicados en tiempo real!", "success");
              closeModal(false);
            } catch (err) {
              window.ISET_TOAST(err.message || "Error al guardar los cambios", "error");
            } finally {
              btn.disabled = false;
              btn.textContent = "💾 Guardar Cambios";
            }
          }
        }, "💾 Guardar Cambios")
      );

      modal.appendChild(header);
      modal.appendChild(body);
      modal.appendChild(footer);
      backdrop.appendChild(modal);
      document.body.appendChild(backdrop);
      this.activeModal = backdrop;

      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) closeModal(true);
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && backdrop.parentNode) closeModal(true);
      });
    }

    // ====================================================
    // MÉTODOS DE OBTENCIÓN DE DATOS FRESCOS Y ACTUALES
    // ====================================================
    async getFreshData() {
      if (content && typeof content.loadAll === "function") {
        await content.loadAll(true);
      }
      return content.getData() || {};
    }

    async getFreshMaterias() {
      if (content && typeof content.loadAll === "function") {
        await content.loadAll(true);
      }
      return content.getMaterias() || {};
    }

    // ====================================================
    // EDITORES VISUALES DE SECCIONES (100% AMIGABLES)
    // ====================================================

    // 1. Institución (Nombre, Lema, Contacto, Dependencia)
    async openInstitucionEditor() {
      const data = await this.getFreshData();
      const inst = data.institucion || {};
      const c = inst.contacto || {};

      const form = h("form", {},
        h("div", { class: "iset-alert iset-alert-info" },
          "🏛️ Modificá los datos institucionales del ISET N° 57. Al guardar, el cambio se reflejará en tiempo real en la cabecera y pie de página de todo el sitio."
        ),
        h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label" }, "Nombre Corto Institucional"),
          h("input", { type: "text", id: "ed-inst-nombre", class: "iset-input", defaultValue: inst.nombre || "", value: inst.nombre || "" })
        ),
        h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label" }, "Nombre Oficial Completo"),
          h("input", { type: "text", id: "ed-inst-largo", class: "iset-input", defaultValue: inst.nombreLargo || "", value: inst.nombreLargo || "" })
        ),
        h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label" }, "Tipo de Gestión y Dependencia"),
          h("input", { type: "text", id: "ed-inst-gestion", class: "iset-input", defaultValue: inst.gestion || "", value: inst.gestion || "", placeholder: "Ej: Gestión pública provincial · Ministerio de Educación de Santa Fe" })
        ),
        h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label" }, "Lema Institucional"),
          h("textarea", { id: "ed-inst-lema", class: "iset-textarea" }, inst.lema || "")
        ),
        h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:0.75rem" },
          h("div", { class: "iset-form-group" },
            h("label", { class: "iset-label" }, "Dirección Física"),
            h("input", { type: "text", id: "ed-inst-dir", class: "iset-input", defaultValue: c.direccion || "", value: c.direccion || "" })
          ),
          h("div", { class: "iset-form-group" },
            h("label", { class: "iset-label" }, "Teléfono de Contacto"),
            h("input", { type: "text", id: "ed-inst-tel", class: "iset-input", defaultValue: c.telefono || "", value: c.telefono || "" })
          )
        ),
        h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:0.75rem" },
          h("div", { class: "iset-form-group" },
            h("label", { class: "iset-label" }, "Correo Electrónico"),
            h("input", { type: "email", id: "ed-inst-mail", class: "iset-input", defaultValue: c.email || "", value: c.email || "" })
          ),
          h("div", { class: "iset-form-group" },
            h("label", { class: "iset-label" }, "Horario de Atención"),
            h("input", { type: "text", id: "ed-inst-horario", class: "iset-input", defaultValue: c.horario || "", value: c.horario || "" })
          )
        )
      );

      this.createEditorModal("Datos Institucionales", form, async () => {
        await content.updateData(d => {
          d.institucion = d.institucion || {};
          d.institucion.nombre = form.querySelector("#ed-inst-nombre").value.trim();
          d.institucion.nombreLargo = form.querySelector("#ed-inst-largo").value.trim();
          d.institucion.gestion = form.querySelector("#ed-inst-gestion").value.trim();
          d.institucion.lema = form.querySelector("#ed-inst-lema").value.trim();
          d.institucion.contacto = d.institucion.contacto || {};
          d.institucion.contacto.direccion = form.querySelector("#ed-inst-dir").value.trim();
          d.institucion.contacto.telefono = form.querySelector("#ed-inst-tel").value.trim();
          d.institucion.contacto.email = form.querySelector("#ed-inst-mail").value.trim();
          d.institucion.contacto.horario = form.querySelector("#ed-inst-horario").value.trim();
          return d;
        });
      });
    }

    // 2. Encabezado de Novedades
    async openNovedadesHeadEditor() {
      const data = await this.getFreshData();
      const g = data.informacionGeneral || {};

      const form = h("form", {},
        h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label" }, "Título de la Sección"),
          h("input", { type: "text", id: "ed-nov-titulo", class: "iset-input", defaultValue: g.titulo || "Novedades", value: g.titulo || "Novedades" })
        ),
        h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label" }, "Bajada o Introducción"),
          h("textarea", { id: "ed-nov-intro", class: "iset-textarea" }, g.introduccion || "")
        )
      );

      this.createEditorModal("Título e Intro de Novedades", form, async () => {
        await content.updateData(d => {
          d.informacionGeneral = d.informacionGeneral || {};
          d.informacionGeneral.titulo = form.querySelector("#ed-nov-titulo").value.trim();
          d.informacionGeneral.introduccion = form.querySelector("#ed-nov-intro").value.trim();
          return d;
        });
      });
    }

    // 3. Encabezado de Oferta Académica
    async openOfertaHeadEditor() {
      const data = await this.getFreshData();
      const of = data.ofertaAcademica || {};

      const form = h("form", {},
        h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label" }, "Título de la Sección"),
          h("input", { type: "text", id: "ed-of-titulo", class: "iset-input", defaultValue: of.titulo || "Oferta académica", value: of.titulo || "Oferta académica" })
        ),
        h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label" }, "Introducción"),
          h("textarea", { id: "ed-of-intro", class: "iset-textarea" }, of.introduccion || "")
        )
      );

      this.createEditorModal("Título e Intro de Oferta Académica", form, async () => {
        await content.updateData(d => {
          d.ofertaAcademica = d.ofertaAcademica || {};
          d.ofertaAcademica.titulo = form.querySelector("#ed-of-titulo").value.trim();
          d.ofertaAcademica.introduccion = form.querySelector("#ed-of-intro").value.trim();
          return d;
        });
      });
    }

    // 4. Modificar o Publicar Aviso en Novedades
    async openAvisoEditor(avisoIndex) {
      const data = await this.getFreshData();
      let avisos = data.informacionGeneral?.avisos || [];
      let av = avisos[avisoIndex];
      if (!av) return;

      // Si es un aviso auto-generado, resolver los datos para mostrarlos completos en el formulario
      if (av.tipo === "auto_inscripcion" || av.tipo === "auto_propedeutico") {
        const ig = data.inscripcionGeneral || {};
        if (av.tipo === "auto_inscripcion") {
          const p = (ig.periodos && ig.periodos[0]) || {};
          const reqList = (ig.requisitosComunes || []).map(r => typeof r === "string" ? r : r.item);
          const reqTxt = reqList.slice(0, 4).join(", ") + (reqList.length > 4 ? " y más." : ".");
          av = {
            ...av,
            titulo: av.titulo || ("Inscripciones ciclo lectivo " + (ig.ciclo || "2027")),
            tipo: "fecha",
            contenido: av.contenido || ((p.fechas ? p.fechas + ", " : "") + (p.horario ? p.horario + ", " : "") + "en Secretaría del Instituto. Presentar " + reqTxt),
            nota: av.nota || "Consultá el cronograma completo, etapas de febrero y requisitos detallados en la página de inscripción.",
            enlace: av.enlace || { texto: "Ver requisitos y fechas de inscripción", url: "inscripcion.html" }
          };
        } else if (av.tipo === "auto_propedeutico") {
          const prop = ig.propedeutico || {};
          av = {
            ...av,
            titulo: av.titulo || "Curso propedéutico",
            tipo: "info",
            contenido: av.contenido || [
              prop.inicio ? "Inicio: " + prop.inicio : null,
              prop.modalidad ? "Modalidad: " + prop.modalidad : null,
              prop.duracion ? "Duración: " + prop.duracion : null,
              prop.nota || "Obligatorio para todas las tecnicaturas"
            ].filter(Boolean).join("\n"),
            nota: av.nota || "",
            enlace: av.enlace || { texto: "Más información", url: "inscripcion.html" }
          };
        }
      }

      this._renderAvisoForm(av, async (updatedAviso, shouldDelete) => {
        await content.updateData(d => {
          d.informacionGeneral = d.informacionGeneral || {};
          d.informacionGeneral.avisos = d.informacionGeneral.avisos || [];
          if (shouldDelete) {
            d.informacionGeneral.avisos.splice(avisoIndex, 1);
          } else {
            d.informacionGeneral.avisos[avisoIndex] = updatedAviso;
          }
          return d;
        });
      }, false);
    }

    async openAddAvisoEditor() {
      await this.getFreshData();
      const emptyAviso = {
        titulo: "Nuevo Aviso",
        espacioId: "general",
        tipo: "info",
        contenido: "Ingresá aquí el detalle de la noticia o aviso institucional.",
        nota: "",
        enlace: { texto: "Más información", url: "" }
      };

      this._renderAvisoForm(emptyAviso, async (newAviso) => {
        await content.updateData(d => {
          d.informacionGeneral = d.informacionGeneral || {};
          d.informacionGeneral.avisos = d.informacionGeneral.avisos || [];
          d.informacionGeneral.avisos.unshift(newAviso);
          return d;
        });
      }, true);
    }

    _renderAvisoForm(av, onSaveCallback, isNew = false) {
      // Determinar modo inicial: "texto", "foto", o "tabla"
      const hasInitialTable = Boolean(av.contenido && (av.contenido.filas || av.contenido.columnas));
      let currentMode = "texto";
      if (hasInitialTable) {
        currentMode = "tabla";
      } else if (av.imagen) {
        currentMode = "foto";
      }

      const rawContenido = av.contenido;
      let textContent = "";
      if (typeof rawContenido === "string") {
        textContent = rawContenido;
      } else if (Array.isArray(rawContenido)) {
        textContent = rawContenido.filter(c => typeof c === "string").join("\n");
      }

      let photoUrl = av.imagen || "";

      const normalizarUrl = (url) => {
        if (!url) return "";
        let u = String(url).trim();
        if (!u) return "";
        if (/^(https?:\/\/|mailto:|tel:|#|\/|\.\/|\.\.\/)/i.test(u)) return u;
        if (/\.html(\?.*)?(#.*)?$/i.test(u)) return u;
        return "https://" + u;
      };

      // Estructura de tabla si existe o valores iniciales para Mesas de Examen
      let tableTitulo = (hasInitialTable && av.contenido.titulo) ? av.contenido.titulo : "Cronograma de exámenes finales";
      let tableCols = (hasInitialTable && av.contenido.columnas) ? [...av.contenido.columnas] : ["Materia", "Carrera", "Fecha", "Hora", "Aula"];
      let tableRows = (hasInitialTable && av.contenido.filas) ? av.contenido.filas.map(f => [...f]) : [
        ["Programación I", "Tecnologías Digitales", "Lun 7/12/2026", "18:00", "Aula 3"]
      ];

      // Opciones dinámicas de Carreras
      const carreraOptions = [
        h("option", { value: "general", selected: !av.espacioId || av.espacioId === "general" }, "🏛️ Institucional / General (Todas las carreras)")
      ];
      const allData = content.getData() || {};
      const espacios = allData.ofertaAcademica?.espacios || [];
      if (espacios.length) {
        espacios.forEach(esp => {
          const label = esp.tituloCorto || esp.titulo.replace(/^Tecnicatura Superior en\s+|^Tecnicatura en\s+/i, "");
          carreraOptions.push(
            h("option", { value: esp.id, selected: av.espacioId === esp.id }, `🎓 ${label}`)
          );
        });
      } else {
        carreraOptions.push(
          h("option", { value: "digital", selected: av.espacioId === "digital" }, "🎓 Tecnologías Digitales"),
          h("option", { value: "higiene", selected: av.espacioId === "higiene" }, "🎓 Higiene y Seguridad"),
          h("option", { value: "enfermeria", selected: av.espacioId === "enfermeria" }, "🎓 Enfermería"),
          h("option", { value: "simulacion", selected: av.espacioId === "simulacion" }, "🎓 Simulación Clínica")
        );
      }

      const form = h("form", {},
        h("div", { class: "iset-alert iset-alert-info" },
          isNew
            ? "➕ Publicá un nuevo anuncio o novedad. Podés elegir entre Comunicado de Texto, Publicación con Foto, o Tabla Interactiva (ej: Mesas de Examen)."
            : "✏️ Modificá los datos del aviso, su carrera destinataria, formato de contenido o eliminalo si ya caducó."
        ),
        h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label" }, "Título del Aviso / Noticia"),
          h("input", { type: "text", id: "ed-av-titulo", class: "iset-input", defaultValue: av.titulo || "", value: av.titulo || "", placeholder: "Ej: Inicio de Inscripciones, Actos, Mesas..." })
        ),
        h("div", { style: "display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:0.75rem" },
          h("div", { class: "iset-form-group" },
            h("label", { class: "iset-label" }, "Carrera / Destinatario"),
            h("select", { id: "ed-av-espacio", class: "iset-select" },
              ...carreraOptions
            )
          ),
          h("div", { class: "iset-form-group" },
            h("label", { class: "iset-label" }, "Estilo / Prioridad Visual"),
            h("select", { id: "ed-av-tipo", class: "iset-select" },
              h("option", { value: "info", selected: av.tipo === "info" }, "Informativo General (Borde Celeste)"),
              h("option", { value: "importante", selected: av.tipo === "importante" }, "Importante / Urgente (Borde Rojo)"),
              h("option", { value: "fecha", selected: av.tipo === "fecha" }, "Fechas / Calendario (Borde Amarillo)")
            )
          ),
          h("div", { class: "iset-form-group" },
            h("label", { class: "iset-label" }, "Formato de Contenido"),
            h("select", {
              id: "ed-av-mode",
              class: "iset-select",
              onchange: (e) => {
                currentMode = e.target.value;
                updateView();
              }
            },
              h("option", { value: "texto", selected: currentMode === "texto" }, "📝 Noticia / Comunicado de Texto"),
              h("option", { value: "foto", selected: currentMode === "foto" }, "📸 Foto / Publicación con Imagen"),
              h("option", { value: "tabla", selected: currentMode === "tabla" }, "📊 Tabla Interactiva (Mesas de Examen / Fechas)")
            )
          )
        ),

        // Contenedores dinámicos para Texto, Foto o Tabla
        h("div", { id: "aviso-content-container" }),

        h("div", { class: "iset-form-group", style: "margin-top:1rem" },
          h("label", { class: "iset-label" }, "Nota Aclaratoria al Pie (Opcional)"),
          h("input", { type: "text", id: "ed-av-nota", class: "iset-input", defaultValue: av.nota || "", value: av.nota || "", placeholder: "Ej: Consultar requisitos completos en Secretaría." })
        ),
        h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:0.75rem" },
          h("div", { class: "iset-form-group" },
            h("label", { class: "iset-label" }, "Texto del Botón Enlace (Opcional)"),
            h("input", { type: "text", id: "ed-av-link-txt", class: "iset-input", defaultValue: av.enlace?.texto || "Más información", value: av.enlace?.texto || "Más información" })
          ),
          h("div", { class: "iset-form-group" },
            h("label", { class: "iset-label" }, "Destino del Enlace (URL o página)"),
            h("input", { type: "text", id: "ed-av-link-url", class: "iset-input", defaultValue: av.enlace?.url || "", value: av.enlace?.url || "", placeholder: "inscripcion.html, instagram.com o https://..." }),
            h("small", { style: "color:var(--suave);font-size:0.78rem;display:block;margin-top:0.25rem" }, "💡 Páginas locales (ej: inscripcion.html) o sitios web externos (ej: instagram.com)")
          )
        )
      );

      const contentBox = form.querySelector("#aviso-content-container");

      const renderTextEditor = () => {
        contentBox.innerHTML = "";
        const group = h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label" }, "Texto o Detalle del Comunicado"),
          h("textarea", {
            id: "ed-av-contenido",
            class: "iset-textarea",
            style: "min-height:120px",
            placeholder: "Escribí aquí los detalles o párrafos del comunicado...",
            defaultValue: textContent,
            value: textContent,
            oninput: (e) => { textContent = e.target.value; }
          }, textContent)
        );
        contentBox.appendChild(group);
      };

      const renderFotoEditor = () => {
        contentBox.innerHTML = "";
        const wrap = h("div", { style: "background:#fff;border:1.5px solid var(--borde);border-radius:10px;padding:1rem;display:grid;gap:0.85rem" });

        const fileInput = h("input", {
          type: "file",
          accept: "image/*",
          style: "display:none",
          onchange: async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
              window.ISET_TOAST("Subiendo y optimizando imagen…", "info");
              const uploadedUrl = await content.uploadImage(file);
              photoUrl = uploadedUrl;
              updateFotoPreview();
              window.ISET_TOAST("Imagen cargada con éxito", "success");
            } catch (err) {
              window.ISET_TOAST(err.message || "Error al subir imagen", "error");
            }
          }
        });

        const uploadBtn = h("button", {
          type: "button",
          class: "iset-btn-secondary",
          style: "font-size:0.88rem;padding:0.45rem 0.9rem",
          onclick: () => fileInput.click()
        }, "📁 Seleccionar Foto desde mi PC");

        const urlInput = h("input", {
          type: "text",
          class: "iset-input",
          placeholder: "O pegá la URL web / ruta de la imagen (https://... o img/...)",
          defaultValue: photoUrl,
          value: photoUrl,
          oninput: (e) => {
            photoUrl = e.target.value.trim();
            updateFotoPreview();
          }
        });

        const previewContainer = h("div", {
          style: "min-height:110px;border:1.5px dashed var(--borde);border-radius:8px;padding:0.75rem;display:flex;align-items:center;justify-content:center;background:rgba(20,33,61,0.02);position:relative"
        });

        const updateFotoPreview = () => {
          previewContainer.innerHTML = "";
          urlInput.value = photoUrl;
          if (photoUrl) {
            const img = h("img", {
              src: photoUrl,
              alt: "Vista previa",
              style: "max-height:220px;max-width:100%;border-radius:6px;object-fit:contain;box-shadow:0 2px 8px rgba(0,0,0,0.1)"
            });
            const removeBtn = h("button", {
              type: "button",
              class: "iset-btn-delete-row",
              style: "margin-left:0.75rem;align-self:flex-start",
              title: "Quitar imagen",
              onclick: () => {
                photoUrl = "";
                updateFotoPreview();
              }
            }, "🗑️ Quitar");
            previewContainer.appendChild(h("div", { style: "display:flex;align-items:center;gap:0.75rem;width:100%;justify-content:center;flex-wrap:wrap" }, img, removeBtn));
          } else {
            previewContainer.appendChild(
              h("div", { style: "text-align:center;color:var(--suave);font-size:0.88rem" },
                h("p", { style: "margin:0" }, "📷 Aún no seleccionaste ninguna imagen."),
                h("p", { style: "margin:0.25rem 0 0;font-size:0.8rem" }, "Hacé clic en 'Seleccionar Foto' o pegá una dirección URL arriba.")
              )
            );
          }
        };

        updateFotoPreview();

        const descGroup = h("div", { class: "iset-form-group", style: "margin:0" },
          h("label", { class: "iset-label" }, "Descripción o Epígrafe que acompaña la Foto (Opcional)"),
          h("textarea", {
            class: "iset-textarea",
            style: "min-height:80px",
            placeholder: "Detalle o comentario para acompañar la imagen (opcional)...",
            defaultValue: textContent,
            value: textContent,
            oninput: (e) => { textContent = e.target.value; }
          }, textContent)
        );

        wrap.appendChild(h("div", { class: "iset-form-group", style: "margin:0" },
          h("label", { class: "iset-label" }, "Fotografía / Imagen del Anuncio"),
          h("div", { style: "display:flex;gap:0.75rem;align-items:center;flex-wrap:wrap;margin-bottom:0.5rem" },
            uploadBtn,
            fileInput
          ),
          urlInput
        ));
        wrap.appendChild(previewContainer);
        wrap.appendChild(descGroup);

        contentBox.appendChild(wrap);
      };

      const renderTableEditor = () => {
        contentBox.innerHTML = "";

        const wrap = h("div", { style: "background:#fff;border:1.5px solid var(--borde);border-radius:10px;padding:1rem" },
          h("div", { class: "iset-form-group", style: "margin-bottom:0.75rem" },
            h("label", { class: "iset-label" }, "Título de la Tabla"),
            h("input", {
              type: "text",
              id: "ed-tabla-titulo",
              class: "iset-input",
              defaultValue: tableTitulo,
              value: tableTitulo,
              placeholder: "Ej: Cronograma de exámenes finales",
              oninput: (e) => { tableTitulo = e.target.value; }
            })
          ),
          h("div", { class: "iset-table-header-row" },
            h("span", {}, "Materia"),
            h("span", {}, "Carrera"),
            h("span", {}, "Fecha"),
            h("span", {}, "Hora"),
            h("span", {}, "Aula"),
            h("span", { style: "text-align:right" }, "Acción")
          ),
          h("div", { id: "table-rows-container" }),
          h("button", {
            type: "button",
            class: "iset-btn-add-item",
            style: "margin-top:0.75rem",
            onclick: () => {
              tableRows.push(["Nueva Materia", "Tecnologías Digitales", "Lun 14/12/2026", "18:00", "Aula 1"]);
              renderRows();
            }
          }, "➕ Agregar Nueva Fila / Mesa de Examen")
        );

        contentBox.appendChild(wrap);

        const renderRows = () => {
          const rowsBox = wrap.querySelector("#table-rows-container");
          rowsBox.innerHTML = "";

          if (!tableRows.length) {
            rowsBox.appendChild(h("p", { style: "color:var(--suave);font-style:italic;padding:0.75rem" }, "No hay mesas o filas registradas. Hacé clic en '+ Agregar Nueva Fila' para sumar la primera."));
            return;
          }

          tableRows.forEach((row, rIdx) => {
            const rowEl = h("div", { class: "iset-table-row-item" },
              h("input", {
                type: "text",
                class: "iset-input",
                style: "font-weight:700",
                defaultValue: row[0] || "",
                value: row[0] || "",
                placeholder: "Materia",
                oninput: (e) => { row[0] = e.target.value; }
              }),
              h("select", {
                class: "iset-select",
                onchange: (e) => { row[1] = e.target.value; }
              },
                h("option", { value: "Tecnologías Digitales", selected: (row[1] || "").includes("Digitales") }, "Tecnologías Digitales"),
                h("option", { value: "Higiene y Seguridad", selected: (row[1] || "").includes("Higiene") || (row[1] || "").includes("Seguridad") }, "Higiene y Seguridad"),
                h("option", { value: "Enfermería", selected: (row[1] || "").includes("Enfermería") }, "Enfermería"),
                h("option", { value: "Simulación Clínica", selected: (row[1] || "").includes("Simulación") }, "Simulación Clínica"),
                h("option", { value: "Institucional", selected: (row[1] || "").includes("Institucional") || (row[1] || "").includes("General") }, "Institucional / Todas")
              ),
              h("input", {
                type: "text",
                class: "iset-input",
                defaultValue: row[2] || "",
                value: row[2] || "",
                placeholder: "Ej: Lun 7/12/2026",
                oninput: (e) => { row[2] = e.target.value; }
              }),
              h("input", {
                type: "text",
                class: "iset-input",
                defaultValue: row[3] || "",
                value: row[3] || "",
                placeholder: "18:00",
                oninput: (e) => { row[3] = e.target.value; }
              }),
              h("input", {
                type: "text",
                class: "iset-input",
                defaultValue: row[4] || "",
                value: row[4] || "",
                placeholder: "Aula 3",
                oninput: (e) => { row[4] = e.target.value; }
              }),
              h("button", {
                type: "button",
                class: "iset-btn-delete-row",
                title: "Eliminar esta mesa",
                onclick: () => {
                  tableRows.splice(rIdx, 1);
                  renderRows();
                }
              }, "🗑️")
            );
            rowsBox.appendChild(rowEl);
          });
        };

        renderRows();
      };

      const updateView = () => {
        if (currentMode === "tabla") renderTableEditor();
        else if (currentMode === "foto") renderFotoEditor();
        else renderTextEditor();
      };

      updateView();

      if (!isNew) {
        const deleteBtn = h("button", {
          type: "button",
          class: "iset-btn-delete-row",
          style: "margin-top:0.6rem;font-size:0.86rem;padding:0.4rem 0.8rem",
          onclick: async () => {
            if (confirm("¿Estás seguro de eliminar este aviso permanentemente?")) {
              await onSaveCallback(null, true);
              window.ISET_TOAST("Aviso eliminado correctamente", "info");
              if (this.activeModal) this.activeModal.remove();
            }
          }
        }, "🗑️ Eliminar este aviso");
        form.appendChild(deleteBtn);
      }

      const modalTitle = isNew
        ? "Publicar Nuevo Aviso"
        : (currentMode === "tabla" ? "Modificar Mesas de Examen / Tabla" : (currentMode === "foto" ? "Modificar Publicación / Foto" : "Modificar Aviso"));

      this.createEditorModal(modalTitle, form, async () => {
        let finalContenido;
        let finalImagen = null;

        if (currentMode === "tabla") {
          finalContenido = {
            titulo: tableTitulo.trim() || "Cronograma de exámenes finales",
            columnas: tableCols,
            filas: tableRows.filter(r => r[0] && r[0].trim())
          };
        } else if (currentMode === "foto") {
          finalContenido = textContent.trim();
          finalImagen = photoUrl.trim();
          if (!finalImagen) {
            window.ISET_TOAST("Por favor seleccioná o ingresá una imagen para el formato Foto", "error");
            return;
          }
        } else {
          finalContenido = textContent.trim();
        }

        const rawTitulo = form.querySelector("#ed-av-titulo").value.trim();
        if (!rawTitulo) {
          window.ISET_TOAST("El aviso debe tener un título", "error");
          return;
        }

        const espacioVal = form.querySelector("#ed-av-espacio") ? form.querySelector("#ed-av-espacio").value : (av.espacioId || "general");

        const updated = {
          ...av,
          titulo: rawTitulo,
          espacioId: espacioVal,
          tipo: form.querySelector("#ed-av-tipo").value,
          contenido: finalContenido,
          nota: form.querySelector("#ed-av-nota").value.trim()
        };

        if (finalImagen) {
          updated.imagen = finalImagen;
        } else {
          delete updated.imagen;
        }

        const rawLinkUrl = form.querySelector("#ed-av-link-url").value.trim();
        const linkTxt = form.querySelector("#ed-av-link-txt").value.trim();
        if (rawLinkUrl) {
          const cleanUrl = normalizarUrl(rawLinkUrl);
          updated.enlace = { texto: linkTxt || "Más información", url: cleanUrl };
        } else {
          delete updated.enlace;
        }

        await onSaveCallback(updated, false);
      });
    }

    // 5. Card de Carrera e Imágenes (Carrusel)
    async openCarreraCardEditor(carreraId) {
      const data = await this.getFreshData();
      const esp = data.ofertaAcademica?.espacios?.find(e => e.id === carreraId);
      if (!esp) return;

      const carrusel = JSON.parse(JSON.stringify(esp.carrusel || []));

      const form = h("form", {},
        h("div", { class: "iset-alert iset-alert-info" },
          `🎓 Modificá el título, descripción y fotos de la tarjeta de ${esp.titulo}. Podés subir imágenes desde tu computadora.`
        ),
        h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label" }, "Título de la Carrera"),
          h("input", { type: "text", id: "ed-c-titulo", class: "iset-input", defaultValue: esp.titulo || "", value: esp.titulo || "" })
        ),
        h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label" }, "Título Corto / Abreviado"),
          h("input", { type: "text", id: "ed-c-tcorto", class: "iset-input", defaultValue: esp.tituloCorto || "", value: esp.tituloCorto || "" })
        ),
        h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label" }, "Descripción Breve"),
          h("textarea", { id: "ed-c-desc", class: "iset-textarea" }, esp.descripcion || "")
        ),
        h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label" }, "Color Temático Hexadecimal"),
          h("input", { type: "color", id: "ed-c-color", class: "iset-input", style: "height:45px", defaultValue: esp.color || "#74acdf", value: esp.color || "#74acdf" })
        ),
        h("div", { style: "margin-top:1.5rem;border-top:1px solid var(--borde);padding-top:1rem" },
          h("label", { class: "iset-label" }, `📸 Fotos del Carrusel (${carrusel.length} imágenes)`),
          h("div", { id: "carrusel-items-container" },
            ...carrusel.map((item, idx) => this._renderCarruselRow(item, idx, carrusel))
          ),
          h("button", {
            type: "button",
            class: "iset-btn-add-item",
            onclick: () => {
              carrusel.push({ imagen: "", titulo: "Foto " + (carrusel.length + 1), alt: "Foto institucional" });
              const container = form.querySelector("#carrusel-items-container");
              container.innerHTML = "";
              carrusel.forEach((it, idx) => container.appendChild(this._renderCarruselRow(it, idx, carrusel)));
            }
          }, "➕ Agregar Nueva Foto al Carrusel")
        )
      );

      this.createEditorModal(`Modificar Carrera: ${esp.titulo}`, form, async () => {
        await content.updateData(d => {
          const target = d.ofertaAcademica.espacios.find(e => e.id === carreraId);
          if (target) {
            target.titulo = form.querySelector("#ed-c-titulo").value.trim();
            target.tituloCorto = form.querySelector("#ed-c-tcorto").value.trim();
            target.descripcion = form.querySelector("#ed-c-desc").value.trim();
            target.color = form.querySelector("#ed-c-color").value;
            target.carrusel = carrusel.filter(it => it.imagen || it.src);
          }
          return d;
        }, carreraId);
      });
    }

    _renderCarruselRow(item, idx, listRef) {
      const card = h("div", { class: "iset-editor-row-card" });

      const header = h("div", { class: "iset-editor-row-header" },
        h("h4", { class: "iset-editor-row-title" }, `🖼️ Foto #${idx + 1}`),
        h("button", {
          type: "button",
          class: "iset-btn-delete-row",
          onclick: () => {
            listRef.splice(idx, 1);
            const container = document.getElementById("carrusel-items-container");
            container.innerHTML = "";
            listRef.forEach((it, i) => container.appendChild(this._renderCarruselRow(it, i, listRef)));
          }
        }, "🗑️ Eliminar")
      );

      const currentSrc = item.imagen || item.src || "";
      const preview = h("img", {
        class: "iset-image-preview",
        src: currentSrc || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='50'><text y='25' fill='gray'>Sin foto</text></svg>",
        style: "max-height:100px;width:auto;border-radius:6px;object-fit:cover"
      });

      const fileInput = h("input", {
        type: "file",
        accept: "image/*",
        style: "display:none",
        onchange: async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          try {
            window.ISET_TOAST("Subiendo y optimizando imagen…", "info");
            const uploadedUrl = await content.uploadImage(file);
            item.imagen = uploadedUrl;
            item.src = uploadedUrl;
            preview.src = uploadedUrl;
            urlInput.value = uploadedUrl;
            window.ISET_TOAST("Imagen lista para guardar", "success");
          } catch (err) {
            window.ISET_TOAST(err.message || "Error al subir imagen", "error");
          }
        }
      });

      const uploadBtn = h("button", {
        type: "button",
        class: "iset-btn-secondary",
        style: "font-size:0.84rem;padding:0.35rem 0.8rem",
        onclick: () => fileInput.click()
      }, "📁 Subir Foto desde mi PC");

      const urlInput = h("input", {
        type: "text",
        class: "iset-input",
        style: "font-size:0.86rem",
        defaultValue: currentSrc,
        placeholder: "O ingresá la ruta local (ej: img/...) o URL web",
        oninput: (e) => {
          const val = e.target.value.trim();
          item.imagen = val;
          item.src = val;
          preview.src = val;
        }
      });

      const titleInput = h("input", {
        type: "text",
        class: "iset-input",
        style: "font-size:0.86rem",
        defaultValue: item.titulo || item.alt || "",
        placeholder: "Descripción o epígrafe de la foto",
        oninput: (e) => {
          item.titulo = e.target.value;
          item.alt = e.target.value;
        }
      });

      card.appendChild(header);
      card.appendChild(h("div", { style: "display:flex;gap:1rem;align-items:center;flex-wrap:wrap" }, preview, uploadBtn, fileInput));
      card.appendChild(urlInput);
      card.appendChild(titleInput);
      return card;
    }

    // 6. Cabecera y Pills en Página de Carrera
    async openCarreraHeroEditor(carreraId) {
      const data = await this.getFreshData();
      const esp = data.ofertaAcademica?.espacios?.find(e => e.id === carreraId) || {};

      const form = h("form", {},
        h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label" }, "Título Principal de la Carrera"),
          h("input", { type: "text", id: "ed-h-titulo", class: "iset-input", defaultValue: esp.titulo || "", value: esp.titulo || "" })
        ),
        h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label" }, "Lema o Descripción Destacada"),
          h("textarea", { id: "ed-h-desc", class: "iset-textarea" }, esp.descripcion || "")
        ),
        h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:0.75rem" },
          h("div", { class: "iset-form-group" },
            h("label", { class: "iset-label" }, "⏱️ Duración"),
            h("input", { type: "text", id: "ed-h-duracion", class: "iset-input", defaultValue: esp.duracion || "3 años", value: esp.duracion || "3 años" })
          ),
          h("div", { class: "iset-form-group" },
            h("label", { class: "iset-label" }, "📍 Modalidad"),
            h("input", { type: "text", id: "ed-h-modalidad", class: "iset-input", defaultValue: esp.modalidad || "Presencial", value: esp.modalidad || "Presencial" })
          )
        ),
        h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:0.75rem" },
          h("div", { class: "iset-form-group" },
            h("label", { class: "iset-label" }, "🌙 Turno de Cursado"),
            h("input", { type: "text", id: "ed-h-turno", class: "iset-input", defaultValue: esp.turno || "Vespertino", value: esp.turno || "Vespertino" })
          ),
          h("div", { class: "iset-form-group" },
            h("label", { class: "iset-label" }, "🎓 Validez del Título"),
            h("input", { type: "text", id: "ed-h-validez", class: "iset-input", defaultValue: esp.validez || "Título Oficial con Validez Nacional", value: esp.validez || "Título Oficial con Validez Nacional" })
          )
        )
      );

      this.createEditorModal("Cabecera y Datos Rápidos", form, async () => {
        await content.updateData(d => {
          const target = d.ofertaAcademica.espacios.find(e => e.id === carreraId);
          if (target) {
            target.titulo = form.querySelector("#ed-h-titulo").value.trim();
            target.descripcion = form.querySelector("#ed-h-desc").value.trim();
            target.duracion = form.querySelector("#ed-h-duracion").value.trim();
            target.modalidad = form.querySelector("#ed-h-modalidad").value.trim();
            target.turno = form.querySelector("#ed-h-turno").value.trim();
            target.validez = form.querySelector("#ed-h-validez").value.trim();
          }
          return d;
        }, carreraId);
      });
    }

    // 7. Grilla Perfil del Egresado (Lista dinámica)
    async openPerfilEditor(carreraId) {
      const data = await this.getFreshData();
      const esp = data.ofertaAcademica?.espacios?.find(e => e.id === carreraId) || {};
      const list = [...(esp.perfil || [])];

      this._renderFriendlyListEditor("Perfil Profesional del Egresado", "Definí las capacidades y competencias de los futuros egresados. Podés editar cada punto, sumar nuevos o borrar los obsoletos.", list, "competencia", async (updatedList) => {
        await content.updateData(d => {
          const target = d.ofertaAcademica.espacios.find(e => e.id === carreraId);
          if (target) target.perfil = updatedList;
          return d;
        }, carreraId);
      });
    }

    // 8. Grilla Campo Laboral (Lista dinámica)
    async openCampoEditor(carreraId) {
      const data = await this.getFreshData();
      const esp = data.ofertaAcademica?.espacios?.find(e => e.id === carreraId) || {};
      const list = [...(esp.campoLaboral || [])];

      this._renderFriendlyListEditor("Campo y Salida Laboral", "Indicá los ámbitos y oportunidades de trabajo donde podrán desempeñarse los egresados.", list, "salida laboral", async (updatedList) => {
        await content.updateData(d => {
          const target = d.ofertaAcademica.espacios.find(e => e.id === carreraId);
          if (target) target.campoLaboral = updatedList;
          return d;
        }, carreraId);
      });
    }

    _renderFriendlyListEditor(title, subtitle, listRef, itemNoun, onSaveCallback) {
      const container = h("div", {},
        h("div", { class: "iset-alert iset-alert-info" }, subtitle),
        h("div", { id: "list-items-box" })
      );

      const renderItems = () => {
        const box = container.querySelector("#list-items-box");
        box.innerHTML = "";

        listRef.forEach((itemText, idx) => {
          const row = h("div", { class: "iset-editor-row-card" },
            h("div", { class: "iset-editor-row-header" },
              h("h4", { class: "iset-editor-row-title" }, `📌 Punto #${idx + 1}`),
              h("button", {
                type: "button",
                class: "iset-btn-delete-row",
                onclick: () => {
                  listRef.splice(idx, 1);
                  renderItems();
                }
              }, "🗑️ Eliminar")
            ),
            h("textarea", {
              class: "iset-textarea",
              style: "min-height:55px",
              defaultValue: itemText,
              value: itemText,
              placeholder: `Describí la ${itemNoun}…`,
              oninput: (e) => { listRef[idx] = e.target.value; }
            }, itemText)
          );
          box.appendChild(row);
        });

        const addBtn = h("button", {
          type: "button",
          class: "iset-btn-add-item",
          onclick: () => {
            listRef.push("");
            renderItems();
          }
        }, `➕ Agregar nueva ${itemNoun}`);
        box.appendChild(addBtn);
      };

      renderItems();

      this.createEditorModal(title, container, async () => {
        const cleaned = listRef.map(it => it.trim()).filter(Boolean);
        await onSaveCallback(cleaned);
      });
    }

    // 9. Grilla Plan de Estudios y Materias (Pestañas por Carrera y Año)
    async openPlanEstudiosEditor(initialCarreraId = null, onFinish = null) {
      const editableCarreras = config.carreras.filter(c => auth.canEdit(c.id) && c.id !== "simulacion");
      if (!editableCarreras.length) {
        window.ISET_TOAST("No tenés permisos para gestionar planes de estudio.", "error");
        return;
      }

      let activeCarreraId = (initialCarreraId && editableCarreras.some(c => c.id === initialCarreraId))
        ? initialCarreraId
        : editableCarreras[0].id;

      // Si el modal de visualización (#modal-plan) está abierto, cerrarlo temporalmente para no solaparse en el top-layer
      const modalPlan = document.getElementById("modal-plan");
      const wasModalPlanOpen = modalPlan && modalPlan.open;
      if (wasModalPlanOpen) {
        modalPlan.close();
      }

      const materiasData = await this.getFreshMaterias();
      const workingMaterias = JSON.parse(JSON.stringify(materiasData || {}));
      editableCarreras.forEach(c => {
        if (!Array.isArray(workingMaterias[c.id])) {
          workingMaterias[c.id] = [];
        }
      });

      let activeAnioTab = "1";

      const container = h("div", {},
        h("div", { class: "iset-alert iset-alert-info" },
          "📋 Administrá las materias y correlatividades oficiales del ISET N° 57. Podés modificar nombres, códigos, carga horaria, comisiones, docentes o agregar y eliminar materias por año."
        ),
        editableCarreras.length > 1 ? h("div", { id: "carreras-selector-tabs", class: "iset-career-tabs" }) : null,
        h("div", { id: "anios-tabs-nav", class: "iset-tabs" }),
        h("div", { id: "materias-year-container" })
      );

      const renderAll = () => {
        // 1. Pestañas de Carrera (si el usuario tiene acceso a más de una)
        const cTabsNav = container.querySelector("#carreras-selector-tabs");
        if (cTabsNav) {
          cTabsNav.innerHTML = "";
          editableCarreras.forEach(c => {
            const count = (workingMaterias[c.id] || []).length;
            const btn = h("button", {
              type: "button",
              class: `iset-career-tab-btn ${c.id === activeCarreraId ? "active" : ""}`,
              onclick: () => {
                activeCarreraId = c.id;
                activeAnioTab = "1";
                renderAll();
              }
            },
              h("span", {}, c.icono || "🎓"),
              h("span", {}, c.nombre.replace(/^Tecnicatura Superior en\s+/i, "")),
              h("span", { style: "font-size:0.75rem;opacity:0.85;background:rgba(20,33,61,0.12);padding:1px 7px;border-radius:10px" }, `${count}`)
            );
            cTabsNav.appendChild(btn);
          });
        }

        // 2. Pestañas de Año para la carrera activa
        const materiasCarrera = workingMaterias[activeCarreraId] || [];
        const tabsNav = container.querySelector("#anios-tabs-nav");
        tabsNav.innerHTML = "";
        ["1", "2", "3"].forEach(an => {
          const count = materiasCarrera.filter(m => String(m.anio).trim() === an).length;
          const btn = h("button", {
            type: "button",
            class: `iset-tab ${activeAnioTab === an ? "active" : ""}`,
            onclick: () => {
              activeAnioTab = an;
              renderMateriasList();
            }
          }, `${an}° Año (${count} materias)`);
          tabsNav.appendChild(btn);
        });

        renderMateriasList();
      };

      const renderMateriasList = () => {
        const materiasCarrera = workingMaterias[activeCarreraId] || [];
        const box = container.querySelector("#materias-year-container");
        box.innerHTML = "";

        // Actualizar estado activo de las pestañas de año
        const yearButtons = container.querySelectorAll("#anios-tabs-nav .iset-tab");
        yearButtons.forEach((btn, idx) => {
          const an = String(idx + 1);
          btn.classList.toggle("active", activeAnioTab === an);
        });

        const currentYearMaterias = materiasCarrera.filter(m => String(m.anio).trim() === activeAnioTab);

        if (!currentYearMaterias.length) {
          box.appendChild(h("p", { style: "color:var(--suave);font-style:italic;padding:1.5rem 0;text-align:center" }, `No hay materias registradas para ${activeAnioTab}° Año todavía.`));
        }

        currentYearMaterias.forEach((mat) => {
          const card = h("div", { class: "iset-editor-row-card" },
            h("div", { class: "iset-editor-row-header" },
              h("h4", { class: "iset-editor-row-title" },
                h("span", {}, `📖 ${mat.nombre || "Materia sin nombre"}`),
                mat.codigo ? h("span", { style: "font-size:0.78rem;color:var(--celeste-oscuro,#1e3a8a);background:rgba(116,172,223,0.2);padding:1px 6px;border-radius:4px" }, mat.codigo) : null
              ),
              h("button", {
                type: "button",
                class: "iset-btn-delete-row",
                title: "Eliminar esta materia del plan",
                onclick: () => {
                  const idx = materiasCarrera.indexOf(mat);
                  if (idx !== -1) {
                    materiasCarrera.splice(idx, 1);
                    renderAll();
                  }
                }
              }, "🗑️ Eliminar Materia")
            ),
            h("div", { class: "iset-form-group", style: "margin:0" },
              h("label", { class: "iset-label" }, "Nombre de la Materia *"),
              h("input", {
                type: "text",
                class: "iset-input",
                style: "font-weight:700",
                defaultValue: mat.nombre || "",
                value: mat.nombre || "",
                placeholder: "Ej: Programación I",
                oninput: (e) => { mat.nombre = e.target.value; }
              })
            ),
            h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:0.75rem" },
              h("div", { class: "iset-form-group", style: "margin:0" },
                h("label", { class: "iset-label" }, "Código Interno"),
                h("input", {
                  type: "text",
                  class: "iset-input",
                  defaultValue: mat.codigo || "",
                  value: mat.codigo || "",
                  placeholder: "Ej: 1PROG",
                  oninput: (e) => { mat.codigo = e.target.value; }
                })
              ),
              h("div", { class: "iset-form-group", style: "margin:0" },
                h("label", { class: "iset-label" }, "Carga Horaria Semanal (Módulos / Hs)"),
                h("input", {
                  type: "text",
                  class: "iset-input",
                  defaultValue: mat.cargaHoraria || "4",
                  value: mat.cargaHoraria || "4",
                  placeholder: "Ej: 4",
                  oninput: (e) => { mat.cargaHoraria = e.target.value; }
                })
              )
            ),
            h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:0.75rem" },
              h("div", { class: "iset-form-group", style: "margin:0" },
                h("label", { class: "iset-label" }, "Comisiones (Separadas por comas)"),
                h("input", {
                  type: "text",
                  class: "iset-input",
                  defaultValue: (mat.comisiones || ["A"]).join(", "),
                  value: (mat.comisiones || ["A"]).join(", "),
                  placeholder: "Ej: A, B",
                  oninput: (e) => {
                    mat.comisiones = e.target.value.split(",").map(s => s.trim()).filter(Boolean);
                  }
                })
              ),
              h("div", { class: "iset-form-group", style: "margin:0" },
                h("label", { class: "iset-label" }, "Docentes (ej: A: Prof. Pérez · B: Prof. Gómez)"),
                h("input", {
                  type: "text",
                  class: "iset-input",
                  defaultValue: Object.entries(mat.docentes || {}).map(([c, d]) => d ? `${c}: ${d}` : c).join(" · "),
                  value: Object.entries(mat.docentes || {}).map(([c, d]) => d ? `${c}: ${d}` : c).join(" · "),
                  placeholder: "Ej: A: Prof. Pérez · B: Prof. Gómez",
                  oninput: (e) => {
                    const docObj = {};
                    e.target.value.split("·").forEach(item => {
                      const parts = item.split(":");
                      if (parts.length >= 2) {
                        docObj[parts[0].trim()] = parts.slice(1).join(":").trim();
                      } else if (parts[0].trim()) {
                        docObj[parts[0].trim()] = "";
                      }
                    });
                    mat.docentes = docObj;
                  }
                })
              )
            ),
            h("div", { class: "iset-form-group", style: "margin:0" },
              h("label", { class: "iset-label" }, "Correlatividades Previas (Separadas por punto '·' o coma)"),
              h("input", {
                type: "text",
                class: "iset-input",
                defaultValue: (mat.correlativas || []).join(" · "),
                value: (mat.correlativas || []).join(" · "),
                placeholder: "Ej: Matemática I · Algoritmos y Estructuras de Datos",
                oninput: (e) => {
                  mat.correlativas = e.target.value.split(/[·,]/).map(s => s.trim()).filter(Boolean);
                }
              }),
              h("small", { style: "color:var(--suave);font-size:0.75rem" }, "Materias que el estudiante debe tener aprobadas antes de cursar esta materia.")
            )
          );
          box.appendChild(card);
        });

        const addBtn = h("button", {
          type: "button",
          class: "iset-btn-add-item",
          onclick: () => {
            materiasCarrera.push({
              nombre: "Nueva Materia",
              anio: activeAnioTab,
              codigo: "",
              cargaHoraria: "4",
              comisiones: ["A"],
              docentes: { A: "" },
              correlativas: []
            });
            renderAll();
          }
        }, `➕ Agregar Nueva Materia a ${activeAnioTab}° Año`);
        box.appendChild(addBtn);
      };

      renderAll();

      const finishCallback = () => {
        if (typeof onFinish === "function") {
          onFinish(activeCarreraId);
        } else if (wasModalPlanOpen && window.abrirModalPlanCarrera) {
          window.abrirModalPlanCarrera(activeCarreraId);
        }
      };

      this.createEditorModal(
        `Planes de Estudio y Correlatividades`,
        container,
        async () => {
          await content.updateMaterias(m => {
            editableCarreras.forEach(c => {
              if (workingMaterias[c.id]) {
                m[c.id] = workingMaterias[c.id];
              }
            });
            return m;
          }, activeCarreraId);
          finishCallback();
        },
        () => {
          finishCallback();
        }
      );
    }

    // 10. CTA de Inscripción en Carrera
    async openCarreraCtaEditor(carreraId) {
      const data = await this.getFreshData();
      const insG = data.inscripcionGeneral || {};
      const p1 = (insG.periodos && insG.periodos[0]) || {};

      const form = h("form", {},
        h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label" }, "Ciclo Lectivo"),
          h("input", { type: "text", id: "ed-cta-ciclo", class: "iset-input", defaultValue: insG.ciclo || "2027", value: insG.ciclo || "2027" })
        ),
        h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label" }, "Fechas del Primer Período"),
          h("input", { type: "text", id: "ed-cta-fechas", class: "iset-input", defaultValue: p1.fechas || "", value: p1.fechas || "" })
        ),
        h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label" }, "Horario y Atención"),
          h("input", { type: "text", id: "ed-cta-horario", class: "iset-input", defaultValue: p1.horario || "", value: p1.horario || "" })
        )
      );

      this.createEditorModal("Fechas de Inscripción", form, async () => {
        await content.updateData(d => {
          d.inscripcionGeneral = d.inscripcionGeneral || {};
          d.inscripcionGeneral.ciclo = form.querySelector("#ed-cta-ciclo").value.trim();
          d.inscripcionGeneral.periodos = d.inscripcionGeneral.periodos || [{}];
          d.inscripcionGeneral.periodos[0].fechas = form.querySelector("#ed-cta-fechas").value.trim();
          d.inscripcionGeneral.periodos[0].horario = form.querySelector("#ed-cta-horario").value.trim();
          return d;
        });
      });
    }

    // 11. Simulación Clínica: Equipamiento y Actividades
    async openSimulacionEquipamientoEditor() {
      const data = await this.getFreshData();
      const esp = data.ofertaAcademica?.espacios?.find(e => e.id === "simulacion") || {};
      const list = JSON.parse(JSON.stringify(esp.equipamiento || []));

      this._renderFriendlyListEditor("Equipamiento de Simulación Clínica", "Listado de simuladores de alta fidelidad, tecnología y simuladores hápticos del centro.", list, "equipo o simulador", async (updatedList) => {
        await content.updateData(d => {
          const target = d.ofertaAcademica.espacios.find(e => e.id === "simulacion");
          if (target) target.equipamiento = updatedList;
          return d;
        }, "simulacion");
      });
    }

    async openSimulacionActividadesEditor() {
      const data = await this.getFreshData();
      const esp = data.ofertaAcademica?.espacios?.find(e => e.id === "simulacion") || {};
      const list = JSON.parse(JSON.stringify(esp.actividades || []));

      this._renderFriendlyListEditor("Actividades y Formación Continua", "Listado de programas de capacitación, cursos y vinculaciones del Centro Regional de Simulación.", list, "actividad o curso", async (updatedList) => {
        await content.updateData(d => {
          const target = d.ofertaAcademica.espacios.find(e => e.id === "simulacion");
          if (target) target.actividades = updatedList;
          return d;
        }, "simulacion");
      });
    }

    // ====================================================
    // EDITORES DE INSCRIPCION.HTML
    // ====================================================

    // 12. Hero de Inscripción
    async openInscripcionHeroEditor() {
      const data = await this.getFreshData();
      const ins = data.inscripcionGeneral || {};

      const form = h("form", {},
        h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label" }, "Ciclo Lectivo"),
          h("input", { type: "text", id: "ed-insh-ciclo", class: "iset-input", defaultValue: ins.ciclo || "2027", value: ins.ciclo || "2027" })
        ),
        h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label" }, "Título Principal"),
          h("input", { type: "text", id: "ed-insh-titulo", class: "iset-input", defaultValue: ins.titulo || "Inscripción a Tecnicaturas", value: ins.titulo || "Inscripción a Tecnicaturas" })
        ),
        h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label" }, "Subtítulo"),
          h("input", { type: "text", id: "ed-insh-sub", class: "iset-input", defaultValue: ins.subtitulo || "Ciclo Lectivo 2027", value: ins.subtitulo || "Ciclo Lectivo 2027" })
        ),
        h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label" }, "Texto Introductorio"),
          h("textarea", { id: "ed-insh-intro", class: "iset-textarea", defaultValue: ins.introduccion || "", value: ins.introduccion || "" }, ins.introduccion || "")
        )
      );

      this.createEditorModal("Título e Intro de Inscripción", form, async () => {
        await content.updateData(d => {
          d.inscripcionGeneral = d.inscripcionGeneral || {};
          d.inscripcionGeneral.ciclo = form.querySelector("#ed-insh-ciclo").value.trim();
          d.inscripcionGeneral.titulo = form.querySelector("#ed-insh-titulo").value.trim();
          d.inscripcionGeneral.subtitulo = form.querySelector("#ed-insh-sub").value.trim();
          d.inscripcionGeneral.introduccion = form.querySelector("#ed-insh-intro").value.trim();
          return d;
        });
      });
    }

    // 13. Pasos de Inscripción (Grilla dinámica)
    async openInscripcionPasosEditor() {
      const data = await this.getFreshData();
      const pasos = JSON.parse(JSON.stringify(data.inscripcionGeneral?.pasos || []));

      const container = h("div", {},
        h("div", { class: "iset-alert iset-alert-info" },
          "🔢 Modificá cada paso del proceso de inscripción, agregá nuevos pasos o eliminá los que no correspondan."
        ),
        h("div", { id: "pasos-list-box" })
      );

      const renderRows = () => {
        const box = container.querySelector("#pasos-list-box");
        box.innerHTML = "";

        pasos.forEach((p, idx) => {
          const card = h("div", { class: "iset-editor-row-card" },
            h("div", { class: "iset-editor-row-header" },
              h("h4", { class: "iset-editor-row-title" }, `Paso #${idx + 1}: ${p.titulo || ""}`),
              h("button", {
                type: "button",
                class: "iset-btn-delete-row",
                onclick: () => {
                  pasos.splice(idx, 1);
                  renderRows();
                }
              }, "🗑️ Eliminar")
            ),
            h("div", { style: "display:grid;grid-template-columns:80px 1fr;gap:0.75rem" },
              h("div", { class: "iset-form-group", style: "margin:0" },
                h("label", { class: "iset-label" }, "Número"),
                h("input", {
                  type: "text",
                  class: "iset-input",
                  style: "text-align:center;font-weight:800",
                  defaultValue: p.numero || String(idx + 1),
                  value: p.numero || String(idx + 1),
                  oninput: (e) => { p.numero = e.target.value; }
                })
              ),
              h("div", { class: "iset-form-group", style: "margin:0" },
                h("label", { class: "iset-label" }, "Título del Paso"),
                h("input", {
                  type: "text",
                  class: "iset-input",
                  style: "font-weight:700",
                  defaultValue: p.titulo || "",
                  value: p.titulo || "",
                  oninput: (e) => { p.titulo = e.target.value; }
                })
              )
            ),
            h("div", { class: "iset-form-group", style: "margin:0" },
              h("label", { class: "iset-label" }, "Descripción Detallada"),
              h("textarea", {
                class: "iset-textarea",
                defaultValue: p.descripcion || "",
                value: p.descripcion || "",
                oninput: (e) => { p.descripcion = e.target.value; }
              }, p.descripcion || "")
            )
          );
          box.appendChild(card);
        });

        const addBtn = h("button", {
          type: "button",
          class: "iset-btn-add-item",
          onclick: () => {
            pasos.push({ numero: String(pasos.length + 1), titulo: "Nuevo Paso", descripcion: "" });
            renderRows();
          }
        }, "➕ Agregar Nuevo Paso de Inscripción");
        box.appendChild(addBtn);
      };

      renderRows();

      this.createEditorModal("Gestionar Pasos de Inscripción", container, async () => {
        await content.updateData(d => {
          d.inscripcionGeneral = d.inscripcionGeneral || {};
          d.inscripcionGeneral.pasos = pasos.filter(p => p.titulo);
          return d;
        });
      });
    }

    // 14. Curso Propedéutico
    async openInscripcionPropedeuticoEditor() {
      const data = await this.getFreshData();
      const prop = data.inscripcionGeneral?.propedeutico || {};

      const form = h("form", {},
        h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label" }, "Fecha de Inicio"),
          h("input", { type: "text", id: "ed-prop-inicio", class: "iset-input", defaultValue: prop.inicio || "", value: prop.inicio || "" })
        ),
        h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label" }, "Modalidad de Cursado"),
          h("input", { type: "text", id: "ed-prop-mod", class: "iset-input", defaultValue: prop.modalidad || "", value: prop.modalidad || "" })
        ),
        h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label" }, "Duración del Curso"),
          h("input", { type: "text", id: "ed-prop-dur", class: "iset-input", defaultValue: prop.duracion || "", value: prop.duracion || "" })
        ),
        h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label" }, "Nota Aclaratoria"),
          h("input", { type: "text", id: "ed-prop-nota", class: "iset-input", defaultValue: prop.nota || "Obligatorio para todas las tecnicaturas", value: prop.nota || "Obligatorio para todas las tecnicaturas" })
        )
      );

      this.createEditorModal("Curso Propedéutico", form, async () => {
        await content.updateData(d => {
          d.inscripcionGeneral = d.inscripcionGeneral || {};
          d.inscripcionGeneral.propedeutico = {
            inicio: form.querySelector("#ed-prop-inicio").value.trim(),
            modalidad: form.querySelector("#ed-prop-mod").value.trim(),
            duracion: form.querySelector("#ed-prop-dur").value.trim(),
            nota: form.querySelector("#ed-prop-nota").value.trim()
          };
          return d;
        });
      });
    }

    // 15. Requisitos Comunes (Grilla dinámica)
    async openInscripcionRequisitosEditor() {
      const data = await this.getFreshData();
      const reqs = JSON.parse(JSON.stringify(data.inscripcionGeneral?.requisitosComunes || []));

      const container = h("div", {},
        h("div", { class: "iset-alert iset-alert-info" },
          "📄 Administrá la documentación solicitada para armar el legajo del estudiante."
        ),
        h("div", { id: "reqs-list-box" })
      );

      const renderRows = () => {
        const box = container.querySelector("#reqs-list-box");
        box.innerHTML = "";

        reqs.forEach((r, idx) => {
          const card = h("div", { class: "iset-editor-row-card" },
            h("div", { class: "iset-editor-row-header" },
              h("h4", { class: "iset-editor-row-title" }, `Requisito #${idx + 1}: ${r.item || ""}`),
              h("button", {
                type: "button",
                class: "iset-btn-delete-row",
                onclick: () => {
                  reqs.splice(idx, 1);
                  renderRows();
                }
              }, "🗑️ Eliminar")
            ),
            h("div", { class: "iset-form-group", style: "margin:0" },
              h("label", { class: "iset-label" }, "Nombre del Documento / Requisito"),
              h("input", {
                type: "text",
                class: "iset-input",
                style: "font-weight:700",
                defaultValue: r.item || "",
                value: r.item || "",
                placeholder: "Ej: Documento Nacional de Identidad (DNI)",
                oninput: (e) => { r.item = e.target.value; }
              })
            ),
            h("div", { class: "iset-form-group", style: "margin:0" },
              h("label", { class: "iset-label" }, "Especificaciones y Detalle"),
              h("textarea", {
                class: "iset-textarea",
                style: "min-height:50px",
                defaultValue: r.detalle || "",
                value: r.detalle || "",
                placeholder: "Ej: Original y fotocopia de ambas caras.",
                oninput: (e) => { r.detalle = e.target.value; }
              }, r.detalle || "")
            )
          );
          box.appendChild(card);
        });

        const addBtn = h("button", {
          type: "button",
          class: "iset-btn-add-item",
          onclick: () => {
            reqs.push({ item: "Nuevo Requisito", detalle: "" });
            renderRows();
          }
        }, "➕ Agregar Nuevo Requisito");
        box.appendChild(addBtn);
      };

      renderRows();

      this.createEditorModal("Gestionar Requisitos Comunes", container, async () => {
        await content.updateData(d => {
          d.inscripcionGeneral = d.inscripcionGeneral || {};
          d.inscripcionGeneral.requisitosComunes = reqs.filter(r => r.item);
          return d;
        });
      });
    }

    // 16. Períodos de Inscripción (Tabla dinámica)
    async openInscripcionPeriodosEditor() {
      const data = await this.getFreshData();
      const periodos = JSON.parse(JSON.stringify(data.inscripcionGeneral?.periodos || []));

      const container = h("div", {},
        h("div", { class: "iset-alert iset-alert-info" },
          "📅 Administrá las etapas, fechas, horarios y lugares de atención de la tabla de inscripción."
        ),
        h("div", { id: "periodos-list-box" })
      );

      const renderRows = () => {
        const box = container.querySelector("#periodos-list-box");
        box.innerHTML = "";

        periodos.forEach((p, idx) => {
          const card = h("div", { class: "iset-editor-row-card" },
            h("div", { class: "iset-editor-row-header" },
              h("h4", { class: "iset-editor-row-title" }, `Etapa #${idx + 1}: ${p.etapa || ""}`),
              h("button", {
                type: "button",
                class: "iset-btn-delete-row",
                onclick: () => {
                  periodos.splice(idx, 1);
                  renderRows();
                }
              }, "🗑️ Eliminar")
            ),
            h("div", { class: "iset-form-group", style: "margin:0" },
              h("label", { class: "iset-label" }, "Nombre de la Etapa"),
              h("input", {
                type: "text",
                class: "iset-input",
                style: "font-weight:700",
                defaultValue: p.etapa || "",
                value: p.etapa || "",
                placeholder: "Ej: Inscripción general",
                oninput: (e) => { p.etapa = e.target.value; }
              })
            ),
            h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:0.75rem" },
              h("div", { class: "iset-form-group", style: "margin:0" },
                h("label", { class: "iset-label" }, "Fechas"),
                h("input", {
                  type: "text",
                  class: "iset-input",
                  defaultValue: p.fechas || "",
                  value: p.fechas || "",
                  placeholder: "Ej: 2 de noviembre al 18 de diciembre",
                  oninput: (e) => { p.fechas = e.target.value; }
                })
              ),
              h("div", { class: "iset-form-group", style: "margin:0" },
                h("label", { class: "iset-label" }, "Horario"),
                h("input", {
                  type: "text",
                  class: "iset-input",
                  defaultValue: p.horario || "",
                  value: p.horario || "",
                  placeholder: "Ej: Lunes a viernes de 9:00 a 20:00 h",
                  oninput: (e) => { p.horario = e.target.value; }
                })
              )
            ),
            h("div", { class: "iset-form-group", style: "margin:0" },
              h("label", { class: "iset-label" }, "Lugar de Atención"),
              h("input", {
                type: "text",
                class: "iset-input",
                defaultValue: p.lugar || "",
                value: p.lugar || "",
                placeholder: "Ej: Secretaría del Instituto (Necochea 1339, Rosario)",
                oninput: (e) => { p.lugar = e.target.value; }
              })
            )
          );
          box.appendChild(card);
        });

        const addBtn = h("button", {
          type: "button",
          class: "iset-btn-add-item",
          onclick: () => {
            periodos.push({ etapa: "Nueva Etapa", fechas: "", horario: "", lugar: "" });
            renderRows();
          }
        }, "➕ Agregar Nueva Etapa / Período");
        box.appendChild(addBtn);
      };

      renderRows();

      this.createEditorModal("Tabla de Fechas y Períodos", container, async () => {
        await content.updateData(d => {
          d.inscripcionGeneral = d.inscripcionGeneral || {};
          d.inscripcionGeneral.periodos = periodos.filter(p => p.etapa);
          return d;
        });
      });
    }

    // 17. Preguntas Frecuentes (FAQ)
    async openInscripcionFaqEditor(addNew = false, focusIndex = null) {
      const data = await this.getFreshData();
      const faqs = JSON.parse(JSON.stringify(data.inscripcionGeneral?.preguntasFrecuentes || []));

      if (addNew) {
        faqs.push({ pregunta: "¿Nueva pregunta frecuente?", respuesta: "" });
        focusIndex = faqs.length - 1;
      }

      const container = h("div", {},
        h("div", { class: "iset-alert iset-alert-info" },
          "❓ Administrá las preguntas frecuentes oficiales del ISET N° 57. Podés modificar preguntas y respuestas, reordenarlas con las flechas, agregar nuevas o eliminar las que ya no apliquen."
        ),
        h("div", { id: "faqs-list-box" })
      );

      const renderRows = () => {
        const box = container.querySelector("#faqs-list-box");
        box.innerHTML = "";

        if (!faqs.length) {
          box.appendChild(h("p", { style: "color:var(--suave);font-style:italic;padding:1.5rem 0;text-align:center" }, "No hay preguntas frecuentes registradas todavía. Hacé clic en 'Agregar Nueva Pregunta' abajo para crear la primera."));
        }

        faqs.forEach((f, idx) => {
          const isFocused = focusIndex === idx;
          const card = h("div", {
            class: "iset-editor-row-card",
            id: `faq-card-${idx}`,
            style: isFocused ? "border-color:var(--celeste,#74acdf);box-shadow:0 0 0 2px rgba(116,172,223,0.3)" : ""
          },
            h("div", { class: "iset-editor-row-header" },
              h("h4", { class: "iset-editor-row-title" },
                h("span", {}, `❓ Pregunta #${idx + 1}`),
                h("div", { style: "display:inline-flex;gap:0.3rem;margin-left:0.5rem" },
                  idx > 0 ? h("button", {
                    type: "button",
                    class: "iset-btn-reorder",
                    title: "Subir pregunta en el orden",
                    style: "background:transparent;border:1px solid var(--borde,#d3dde9);border-radius:4px;cursor:pointer;padding:2px 7px;font-size:0.75rem",
                    onclick: () => {
                      const temp = faqs[idx];
                      faqs[idx] = faqs[idx - 1];
                      faqs[idx - 1] = temp;
                      focusIndex = idx - 1;
                      renderRows();
                    }
                  }, "⬆️ Subir") : null,
                  idx < faqs.length - 1 ? h("button", {
                    type: "button",
                    class: "iset-btn-reorder",
                    title: "Bajar pregunta en el orden",
                    style: "background:transparent;border:1px solid var(--borde,#d3dde9);border-radius:4px;cursor:pointer;padding:2px 7px;font-size:0.75rem",
                    onclick: () => {
                      const temp = faqs[idx];
                      faqs[idx] = faqs[idx + 1];
                      faqs[idx + 1] = temp;
                      focusIndex = idx + 1;
                      renderRows();
                    }
                  }, "⬇️ Bajar") : null
                )
              ),
              h("button", {
                type: "button",
                class: "iset-btn-delete-row",
                title: "Eliminar esta pregunta frecuente",
                onclick: () => {
                  faqs.splice(idx, 1);
                  renderRows();
                }
              }, "🗑️ Eliminar Pregunta")
            ),
            h("div", { class: "iset-form-group", style: "margin:0" },
              h("label", { class: "iset-label" }, "¿Pregunta? *"),
              h("input", {
                type: "text",
                class: "iset-input",
                style: "font-weight:700",
                defaultValue: f.pregunta || "",
                value: f.pregunta || "",
                placeholder: "¿La carrera tiene costo?",
                oninput: (e) => { f.pregunta = e.target.value; }
              })
            ),
            h("div", { class: "iset-form-group", style: "margin:0" },
              h("label", { class: "iset-label" }, "Respuesta *"),
              h("textarea", {
                class: "iset-textarea",
                style: "min-height:75px",
                defaultValue: f.respuesta || "",
                value: f.respuesta || "",
                placeholder: "Escribí aquí la respuesta clara y concisa…",
                oninput: (e) => { f.respuesta = e.target.value; }
              }, f.respuesta || "")
            )
          );
          box.appendChild(card);
        });

        const addBtn = h("button", {
          type: "button",
          class: "iset-btn-add-item",
          onclick: () => {
            faqs.push({ pregunta: "¿Nueva pregunta frecuente?", respuesta: "" });
            focusIndex = faqs.length - 1;
            renderRows();
            setTimeout(() => {
              const newCard = container.querySelector(`#faq-card-${faqs.length - 1}`);
              if (newCard) {
                newCard.scrollIntoView({ behavior: "smooth", block: "center" });
                newCard.querySelector("input")?.focus();
              }
            }, 60);
          }
        }, "➕ Agregar Nueva Pregunta Frecuente");
        box.appendChild(addBtn);
      };

      renderRows();

      this.createEditorModal("Gestionar Preguntas Frecuentes (FAQ)", container, async () => {
        await content.updateData(d => {
          d.inscripcionGeneral = d.inscripcionGeneral || {};
          d.inscripcionGeneral.preguntasFrecuentes = faqs.filter(f => f.pregunta && f.pregunta.trim());
          return d;
        });
      });

      if (addNew || focusIndex !== null) {
        setTimeout(() => {
          const targetCard = container.querySelector(`#faq-card-${focusIndex || (faqs.length - 1)}`);
          if (targetCard) {
            targetCard.scrollIntoView({ behavior: "smooth", block: "center" });
            targetCard.querySelector("input")?.focus();
          }
        }, 120);
      }
    }

    // 17b. Caja de Dudas Adicionales y Contacto Secretaría
    async openInscripcionDudasEditor(forceActivate = false) {
      const data = await this.getFreshData();
      const insG = data.inscripcionGeneral || {};
      const cs = JSON.parse(JSON.stringify(insG.contactoSecretaria || {
        titulo: "¿Tenés dudas adicionales?",
        atencion: "Atención presencial en Secretaría",
        horario: "Lunes a viernes de 9:00 a 20:00 h",
        direccion: "Calle Ejemplo 1234, Rosario, Santa Fe",
        email: "contacto@iset57.edu.ar",
        telefono: "(0341) 000-0000",
        botonTexto: "Escribir a Secretaría",
        activo: true
      }));

      if (forceActivate) {
        cs.activo = true;
      }

      const form = h("form", {},
        h("div", { class: "iset-alert iset-alert-info" },
          "💬 Personalizá el bloque '¿Tenés dudas adicionales?' al pie de las preguntas frecuentes. Podés cambiar el título, los datos de contacto de Secretaría, el enlace de correo o desactivarlo para que no aparezca en la página."
        ),
        h("div", { class: "iset-form-group", style: "display:flex;align-items:center;gap:0.75rem;background:var(--fondo,#f5f8fb);padding:0.75rem 1rem;border-radius:8px;border:1px solid var(--borde,#d3dde9)" },
          h("input", {
            type: "checkbox",
            id: "ed-dudas-activo",
            style: "width:1.25rem;height:1.25rem;cursor:pointer",
            checked: cs.activo !== false
          }),
          h("label", { for: "ed-dudas-activo", style: "cursor:pointer;font-weight:700;margin:0" }, "Mostrar esta caja en la página pública de inscripción")
        ),
        h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label" }, "Título de la Caja *"),
          h("input", {
            type: "text",
            id: "ed-dudas-titulo",
            class: "iset-input",
            style: "font-weight:700",
            defaultValue: cs.titulo || "¿Tenés dudas adicionales?",
            value: cs.titulo || "¿Tenés dudas adicionales?"
          })
        ),
        h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label" }, "Texto o Bajada Explicativa"),
          h("textarea", {
            id: "ed-dudas-desc",
            class: "iset-textarea",
            style: "min-height:65px",
            defaultValue: cs.descripcion || "",
            value: cs.descripcion || "",
            placeholder: "Dejá en blanco para generar automáticamente con el horario, dirección y teléfono cargados abajo."
          }, cs.descripcion || "")
        ),
        h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:0.75rem" },
          h("div", { class: "iset-form-group", style: "margin:0" },
            h("label", { class: "iset-label" }, "Correo Electrónico de Contacto"),
            h("input", {
              type: "email",
              id: "ed-dudas-email",
              class: "iset-input",
              defaultValue: cs.email || "contacto@iset57.edu.ar",
              value: cs.email || "contacto@iset57.edu.ar"
            })
          ),
          h("div", { class: "iset-form-group", style: "margin:0" },
            h("label", { class: "iset-label" }, "Texto del Botón de Acción"),
            h("input", {
              type: "text",
              id: "ed-dudas-boton",
              class: "iset-input",
              defaultValue: cs.botonTexto || "Escribir a Secretaría",
              value: cs.botonTexto || "Escribir a Secretaría"
            })
          )
        ),
        h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-top:0.75rem" },
          h("div", { class: "iset-form-group", style: "margin:0" },
            h("label", { class: "iset-label" }, "Horario de Atención"),
            h("input", {
              type: "text",
              id: "ed-dudas-horario",
              class: "iset-input",
              defaultValue: cs.horario || "Lunes a viernes de 9:00 a 20:00 h",
              value: cs.horario || "Lunes a viernes de 9:00 a 20:00 h"
            })
          ),
          h("div", { class: "iset-form-group", style: "margin:0" },
            h("label", { class: "iset-label" }, "Teléfono"),
            h("input", {
              type: "text",
              id: "ed-dudas-tel",
              class: "iset-input",
              defaultValue: cs.telefono || "",
              value: cs.telefono || "",
              placeholder: "Ej: (0341) 000-0000"
            })
          )
        ),
        h("div", { class: "iset-form-group", style: "margin-top:0.75rem" },
          h("label", { class: "iset-label" }, "Dirección / Lugar de Atención"),
          h("input", {
            type: "text",
            id: "ed-dudas-dir",
            class: "iset-input",
            defaultValue: cs.direccion || "",
            value: cs.direccion || "",
            placeholder: "Ej: Calle Ejemplo 1234, Rosario, Santa Fe"
          })
        )
      );

      this.createEditorModal("Modificar Caja '¿Tenés dudas adicionales?'", form, async () => {
        const activo = form.querySelector("#ed-dudas-activo").checked;
        const titulo = form.querySelector("#ed-dudas-titulo").value.trim();
        const descripcion = form.querySelector("#ed-dudas-desc").value.trim();
        const email = form.querySelector("#ed-dudas-email").value.trim();
        const botonTexto = form.querySelector("#ed-dudas-boton").value.trim();
        const horario = form.querySelector("#ed-dudas-horario").value.trim();
        const telefono = form.querySelector("#ed-dudas-tel").value.trim();
        const direccion = form.querySelector("#ed-dudas-dir").value.trim();

        await content.updateData(d => {
          d.inscripcionGeneral = d.inscripcionGeneral || {};
          d.inscripcionGeneral.contactoSecretaria = {
            activo,
            titulo: titulo || "¿Tenés dudas adicionales?",
            descripcion,
            email: email || "contacto@iset57.edu.ar",
            botonTexto: botonTexto || "Escribir a Secretaría",
            horario: horario || "",
            telefono: telefono || "",
            direccion: direccion || "",
            atencion: "Atención presencial en Secretaría"
          };
          return d;
        });
      });
    }

    // ====================================================
    // EDITORES DE COMUNIDAD.HTML (Blog, Proyectos y Carrusel)
    // ====================================================

    // 18. Cabecera de Comunidad
    async openComunidadHeroEditor() {
      const data = await this.getFreshData();
      const com = data.comunidad || {};

      const form = h("form", {},
        h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label" }, "Título Principal"),
          h("input", { type: "text", id: "ed-com-titulo", class: "iset-input", defaultValue: com.titulo || "Comunidad & Blog", value: com.titulo || "Comunidad & Blog" })
        ),
        h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label" }, "Bajada o Introducción"),
          h("textarea", { id: "ed-com-bajada", class: "iset-textarea", defaultValue: com.bajada || com.subtitulo || "", value: com.bajada || com.subtitulo || "" }, com.bajada || com.subtitulo || "")
        )
      );

      this.createEditorModal("Cabecera de Comunidad", form, async () => {
        await content.updateData(d => {
          d.comunidad = d.comunidad || {};
          d.comunidad.titulo = form.querySelector("#ed-com-titulo").value.trim();
          d.comunidad.bajada = form.querySelector("#ed-com-bajada").value.trim();
          return d;
        });
      });
    }

    // 19. Carrusel Hero de Comunidad
    async openComunidadCarruselEditor() {
      const data = await this.getFreshData();
      const carrusel = JSON.parse(JSON.stringify(data.comunidad?.carruselHero || data.comunidad?.carrusel || []));

      const container = h("div", {},
        h("div", { class: "iset-alert iset-alert-info" },
          "📸 Administrá las fotos destacadas del carrusel de Comunidad. Podés subir imágenes desde tu computadora."
        ),
        h("div", { id: "carrusel-items-container" },
          ...carrusel.map((item, idx) => this._renderCarruselRow(item, idx, carrusel))
        ),
        h("button", {
          type: "button",
          class: "iset-btn-add-item",
          onclick: () => {
            carrusel.push({ imagen: "", titulo: "Nueva Imagen", descripcion: "" });
            const box = container.querySelector("#carrusel-items-container");
            box.innerHTML = "";
            carrusel.forEach((it, idx) => box.appendChild(this._renderCarruselRow(it, idx, carrusel)));
          }
        }, "➕ Agregar Nueva Foto al Carrusel")
      );

      this.createEditorModal("Fotos del Carrusel de Comunidad", container, async () => {
        await content.updateData(d => {
          d.comunidad = d.comunidad || {};
          d.comunidad.carruselHero = carrusel.filter(it => it.imagen || it.src);
          return d;
        });
      });
    }

    // 20. Publicar / Modificar Artículo de Comunidad
    async openComunidadNuevoArticuloEditor() {
      await this.getFreshData();
      const emptyArt = {
        id: "art-" + Date.now(),
        titulo: "Nuevo Proyecto o Jornada",
        carreraId: "general",
        carreraNombre: "Institucional",
        fecha: new Date().toISOString().split("T")[0],
        autor: "ISET N° 57",
        resumen: "Breve descripción para la portada de la noticia.",
        contenido: "Contenido completo y detallado del artículo o proyecto.",
        imagenes: ["img/general/nuevaSede.jpg"],
        etiquetas: ["Proyectos", "Comunidad"],
        visible: true
      };

      this._renderArticuloForm(emptyArt, async (newArt) => {
        await content.updateData(d => {
          d.comunidad = d.comunidad || {};
          d.comunidad.articulos = d.comunidad.articulos || [];
          d.comunidad.articulos.unshift(newArt);
          return d;
        });
      }, true);
    }

    async openComunidadEditarArticuloEditor(articuloId) {
      const data = await this.getFreshData();
      const articulos = data.comunidad?.articulos || [];
      const artIndex = articulos.findIndex(a => a.id === articuloId);
      const art = artIndex !== -1 ? articulos[artIndex] : articulos[Number(articuloId)] || {};

      this._renderArticuloForm(art, async (updatedArt, shouldDelete) => {
        await content.updateData(d => {
          d.comunidad = d.comunidad || {};
          d.comunidad.articulos = d.comunidad.articulos || [];
          if (shouldDelete) {
            d.comunidad.articulos = d.comunidad.articulos.filter(a => a.id !== art.id);
          } else {
            const idx = d.comunidad.articulos.findIndex(a => a.id === art.id);
            if (idx !== -1) d.comunidad.articulos[idx] = updatedArt;
          }
          return d;
        });
      }, false);
    }

    _renderArticuloForm(art, onSaveCallback, isNew = false) {
      let currentImg = (art.imagenes && art.imagenes[0]) || "";

      const form = h("form", {},
        h("div", { class: "iset-alert iset-alert-info" },
          isNew
            ? "➕ Publicá una nueva actividad, jornada o proyecto estudiantil en el blog de la comunidad."
            : "✏️ Modificá los datos del artículo seleccionado o eliminalo si ya no debe mostrarse."
        ),
        h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label" }, "Título de la Publicación"),
          h("input", { type: "text", id: "ed-art-titulo", class: "iset-input", defaultValue: art.titulo || "", value: art.titulo || "" })
        ),
        h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:0.75rem" },
          h("div", { class: "iset-form-group" },
            h("label", { class: "iset-label" }, "Carrera o Espacio Vinculado"),
            h("select", { id: "ed-art-carrera", class: "iset-select" },
              h("option", { value: "general", selected: art.carreraId === "general" }, "Institucional"),
              h("option", { value: "digitales", selected: art.carreraId === "digitales" }, "Tecnologías Digitales"),
              h("option", { value: "higiene", selected: art.carreraId === "higiene" }, "Seguridad e Higiene"),
              h("option", { value: "enfermeria", selected: art.carreraId === "enfermeria" }, "Enfermería"),
              h("option", { value: "simulacion", selected: art.carreraId === "simulacion" }, "Simulación Clínica")
            )
          ),
          h("div", { class: "iset-form-group" },
            h("label", { class: "iset-label" }, "Fecha"),
            h("input", { type: "date", id: "ed-art-fecha", class: "iset-input", defaultValue: art.fecha || "", value: art.fecha || "" })
          )
        ),
        h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label" }, "Autor o Coordinación"),
          h("input", { type: "text", id: "ed-art-autor", class: "iset-input", defaultValue: art.autor || "ISET N° 57", value: art.autor || "ISET N° 57" })
        ),
        // Imagen de Portada
        h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label" }, "Foto de Portada"),
          h("div", { style: "display:flex;gap:1rem;align-items:center;margin-bottom:0.4rem;flex-wrap:wrap" },
            h("img", {
              id: "art-img-preview",
              class: "iset-image-preview",
              src: currentImg || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='50'><text y='25' fill='gray'>Sin foto</text></svg>",
              style: "max-height:90px;width:auto;border-radius:6px;object-fit:cover"
            }),
            h("button", {
              type: "button",
              class: "iset-btn-secondary",
              onclick: () => fileInput.click()
            }, "📁 Subir Foto desde mi PC")
          ),
          h("input", {
            type: "text",
            id: "ed-art-img",
            class: "iset-input",
            defaultValue: currentImg,
            value: currentImg,
            placeholder: "Ruta local o URL de la imagen",
            oninput: (e) => {
              currentImg = e.target.value.trim();
              const prev = form.querySelector("#art-img-preview");
              if (prev) prev.src = currentImg;
            }
          })
        ),
        h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label" }, "Resumen Breve (Visible en la tarjeta)"),
          h("textarea", { id: "ed-art-resumen", class: "iset-textarea", style: "min-height:60px", defaultValue: art.resumen || "", value: art.resumen || "" }, art.resumen || "")
        ),
        h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label" }, "Contenido Completo de la Nota"),
          h("textarea", { id: "ed-art-contenido", class: "iset-textarea", style: "min-height:120px", defaultValue: art.contenido || "", value: art.contenido || "" }, art.contenido || "")
        ),
        h("div", { class: "iset-form-group" },
          h("label", { class: "iset-label" }, "Etiquetas (Separadas por comas)"),
          h("input", { type: "text", id: "ed-art-tags", class: "iset-input", defaultValue: (art.etiquetas || []).join(", "), value: (art.etiquetas || []).join(", ") })
        )
      );

      const fileInput = h("input", {
        type: "file",
        accept: "image/*",
        style: "display:none",
        onchange: async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          try {
            window.ISET_TOAST("Subiendo imagen…", "info");
            const uploadedUrl = await content.uploadImage(file);
            currentImg = uploadedUrl;
            form.querySelector("#art-img-preview").src = uploadedUrl;
            form.querySelector("#ed-art-img").value = uploadedUrl;
            window.ISET_TOAST("Foto lista", "success");
          } catch (err) {
            window.ISET_TOAST(err.message || "Error al subir foto", "error");
          }
        }
      });
      form.appendChild(fileInput);

      if (!isNew) {
        const deleteBtn = h("button", {
          type: "button",
          class: "iset-btn-delete-row",
          style: "margin-top:0.6rem;padding:0.4rem 0.8rem",
          onclick: async () => {
            if (confirm("¿Estás seguro de eliminar este artículo de forma permanente?")) {
              await onSaveCallback(null, true);
              window.ISET_TOAST("Artículo eliminado", "info");
              if (this.activeModal) this.activeModal.remove();
            }
          }
        }, "🗑️ Eliminar este artículo");
        form.appendChild(deleteBtn);
      }

      this.createEditorModal(isNew ? "Publicar Nuevo Artículo" : "Modificar Artículo", form, async () => {
        const carreraSelect = form.querySelector("#ed-art-carrera");
        const carreraId = carreraSelect.value;
        const carreraNombre = carreraSelect.options[carreraSelect.selectedIndex].text;

        const updated = {
          ...art,
          id: art.id || ("art-" + Date.now()),
          titulo: form.querySelector("#ed-art-titulo").value.trim(),
          carreraId: carreraId,
          carreraNombre: carreraNombre,
          fecha: form.querySelector("#ed-art-fecha").value,
          autor: form.querySelector("#ed-art-autor").value.trim(),
          resumen: form.querySelector("#ed-art-resumen").value.trim(),
          contenido: form.querySelector("#ed-art-contenido").value.trim(),
          imagenes: currentImg ? [currentImg] : (art.imagenes || []),
          etiquetas: form.querySelector("#ed-art-tags").value.split(",").map(s => s.trim()).filter(Boolean),
          visible: true
        };

        await onSaveCallback(updated, false);
      });
    }

    // ====================================================
    // EDITOR DIRECTO DE JSON (PARA SUPERUSUARIOS Y AVANZADOS)
    // ====================================================
    async openRawJSONEditor(initialFile = "data") {
      if (!auth.canEdit()) {
        window.ISET_TOAST("Acceso denegado: se requieren permisos de administrador o superusuario.", "error");
        return;
      }

      await this.getFreshData();
      await this.getFreshMaterias();

      let currentFile = initialFile;
      const isSuper = auth.isSuperuser();
      const user = auth.getCurrentUser();

      const backdrop = h("div", { class: "iset-modal-backdrop open", style: "z-index:9998" });
      const modal = h("div", { class: "iset-modal iset-modal-xl" });

      const header = h("div", { class: "iset-modal-header" },
        h("h3", { class: "iset-modal-title" }, "📝 Editor de Archivos JSON en Tiempo Real"),
        h("button", { class: "iset-modal-close", onclick: () => backdrop.remove() }, "×")
      );

      const body = h("div", { class: "iset-modal-body", style: "display:flex;flex-direction:column;flex:1;overflow:hidden" });

      const tabData = h("button", {
        type: "button",
        class: `iset-json-tab-btn ${currentFile === "data" ? "active" : ""}`,
        onclick: () => switchFile("data")
      }, "📄 data.json");

      const tabMaterias = h("button", {
        type: "button",
        class: `iset-json-tab-btn ${currentFile === "materias" ? "active" : ""}`,
        onclick: () => switchFile("materias")
      }, "📄 materias.json");

      const statusBadge = h("div", { class: "iset-json-status valid" }, "✅ JSON Válido");

      const fileInput = h("input", {
        type: "file",
        accept: ".json,application/json",
        style: "display:none",
        onchange: (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (event) => {
            try {
              const parsed = JSON.parse(event.target.result);
              textarea.value = JSON.stringify(parsed, null, 2);
              validateJson();
              window.ISET_TOAST(`Archivo ${file.name} cargado con éxito.`, "success");
            } catch (err) {
              window.ISET_TOAST(`Error de sintaxis: ${err.message}`, "error");
            }
          };
          reader.readAsText(file);
        }
      });

      const btnUpload = h("button", {
        type: "button",
        class: "iset-btn-secondary",
        style: "font-size:0.84rem;padding:0.35rem 0.85rem",
        onclick: () => fileInput.click()
      }, "📂 Cargar archivo .json desde mi PC");

      const btnFormat = h("button", {
        type: "button",
        class: "iset-btn-secondary",
        style: "font-size:0.84rem;padding:0.35rem 0.85rem",
        onclick: () => {
          try {
            const parsed = JSON.parse(textarea.value);
            textarea.value = JSON.stringify(parsed, null, 2);
            validateJson();
            window.ISET_TOAST("JSON formateado correctamente", "info");
          } catch (e) {
            window.ISET_TOAST("Error de sintaxis JSON", "error");
          }
        }
      }, "✨ Formatear");

      const btnDownload = h("button", {
        type: "button",
        class: "iset-btn-secondary",
        style: "font-size:0.84rem;padding:0.35rem 0.85rem",
        onclick: () => content.exportFile(currentFile)
      }, "📥 Descargar copia");

      const toolbar = h("div", { class: "iset-json-toolbar" },
        h("div", { class: "iset-json-tabs" }, tabData, tabMaterias),
        h("div", { class: "iset-json-actions" }, statusBadge, btnUpload, fileInput, btnFormat, btnDownload)
      );

      const editorBox = h("div", { class: "iset-json-editor-container" });
      const textarea = h("textarea", {
        class: "iset-json-textarea",
        spellcheck: "false",
        autocapitalize: "off",
        autocomplete: "off"
      });
      const errorBanner = h("div", { class: "iset-json-error-banner" });
      editorBox.appendChild(textarea);
      editorBox.appendChild(errorBanner);

      body.appendChild(toolbar);
      body.appendChild(editorBox);

      const btnSave = h("button", {
        type: "button",
        class: "iset-btn-primary",
        style: "width:auto",
        onclick: async () => {
          let parsed;
          try {
            parsed = JSON.parse(textarea.value);
          } catch (err) {
            window.ISET_TOAST("No se puede guardar: Corregí el error de sintaxis", "error");
            return;
          }

          btnSave.disabled = true;
          btnSave.textContent = "Guardando y aplicando…";

          try {
            if (currentFile === "data") {
              await content.updateData(currentData => {
                if (isSuper) {
                  return parsed;
                } else {
                  const allowed = user.carreras || [];
                  const updatedEspacios = currentData.ofertaAcademica?.espacios || [];
                  const incomingEspacios = parsed.ofertaAcademica?.espacios || [];
                  incomingEspacios.forEach(inEsp => {
                    if (allowed.includes(inEsp.id)) {
                      const idx = updatedEspacios.findIndex(e => e.id === inEsp.id);
                      if (idx !== -1) updatedEspacios[idx] = inEsp;
                      else updatedEspacios.push(inEsp);
                    }
                  });
                  currentData.ofertaAcademica.espacios = updatedEspacios;
                  return currentData;
                }
              });
            } else if (currentFile === "materias") {
              await content.updateMaterias(currentMaterias => {
                if (isSuper) {
                  return parsed;
                } else {
                  const allowed = user.carreras || [];
                  allowed.forEach(cId => {
                    if (parsed[cId]) currentMaterias[cId] = parsed[cId];
                  });
                  return currentMaterias;
                }
              });
            }

            window.ISET_TOAST(`✅ ${currentFile}.json guardado y aplicado en tiempo real`, "success");
            backdrop.remove();
          } catch (err) {
            window.ISET_TOAST(err.message || "Error al guardar el archivo JSON", "error");
          } finally {
            btnSave.disabled = false;
            btnSave.textContent = "💾 Guardar y Aplicar en Tiempo Real";
          }
        }
      }, "💾 Guardar y Aplicar en Tiempo Real");

      const footer = h("div", { class: "iset-modal-footer" },
        h("button", { type: "button", class: "iset-btn-secondary", onclick: () => backdrop.remove() }, "✕ Cancelar"),
        btnSave
      );

      modal.appendChild(header);
      modal.appendChild(body);
      modal.appendChild(footer);
      backdrop.appendChild(modal);
      document.body.appendChild(backdrop);

      function validateJson() {
        try {
          const parsed = JSON.parse(textarea.value);
          const lines = textarea.value.split("\n").length;
          const bytes = Math.round(new Blob([textarea.value]).size / 1024);
          statusBadge.className = "iset-json-status valid";
          statusBadge.textContent = `✅ JSON Válido (${lines} líneas · ${bytes} KB)`;
          errorBanner.style.display = "none";
          btnSave.disabled = false;
          return true;
        } catch (err) {
          statusBadge.className = "iset-json-status invalid";
          statusBadge.textContent = "❌ Error de Sintaxis";
          errorBanner.textContent = "Error: " + err.message;
          errorBanner.style.display = "block";
          btnSave.disabled = true;
          return false;
        }
      }

      function switchFile(fileKey) {
        currentFile = fileKey;
        if (fileKey === "data") {
          tabData.classList.add("active");
          tabMaterias.classList.remove("active");
          textarea.value = JSON.stringify(content.getData() || {}, null, 2);
        } else {
          tabData.classList.remove("active");
          tabMaterias.classList.add("active");
          textarea.value = JSON.stringify(content.getMaterias() || {}, null, 2);
        }
        validateJson();
      }

      textarea.addEventListener("keydown", (e) => {
        if (e.key === "Tab") {
          e.preventDefault();
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          textarea.value = textarea.value.substring(0, start) + "  " + textarea.value.substring(end);
          textarea.selectionStart = textarea.selectionEnd = start + 2;
          validateJson();
        }
      });

      textarea.addEventListener("input", validateJson);
      switchFile(initialFile);
    }
  }

  window.ISET_EDITOR_UI = new EditorUI();
})();
