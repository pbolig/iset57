/**
 * ISET N° 57 - Configuración Global de Autenticación, Roles y Supabase
 */
window.ISET_CONFIG = (() => {
  // ==============================================================================
  // 1. CREDENCIALES DE PRODUCCIÓN PARA SUPABASE (CENTRALIZADAS)
  // ==============================================================================
  // La clave 'anon' de Supabase es PÚBLICA por diseño (diseñada para frontends web
  // estáticos como GitHub Pages). Toda la seguridad se basa en Row Level Security (RLS).
  // Colocá aquí tus datos reales para que TODOS los usuarios en producción se registren
  // en la misma base de datos de Supabase en lugar de quedar aislados en modo local:
  const PRODUCTION_SUPABASE_URL = ""; // Ej: "https://xyzcompany.supabase.co"
  const PRODUCTION_SUPABASE_ANON_KEY = ""; // Ej: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

  // 2. Persistencia en localStorage (permite sobreescribir desde el navegador para pruebas locales)
  const savedUrl = localStorage.getItem("iset_supabase_url") || "";
  const savedKey = localStorage.getItem("iset_supabase_anon_key") || "";

  const finalUrl = savedUrl || PRODUCTION_SUPABASE_URL || "https://su-proyecto.supabase.co";
  const finalKey = savedKey || PRODUCTION_SUPABASE_ANON_KEY || "";

  return {
    // Credenciales de Supabase
    supabaseUrl: finalUrl,
    supabaseAnonKey: finalKey,
    hasConfiguredProduction: Boolean(PRODUCTION_SUPABASE_URL && PRODUCTION_SUPABASE_ANON_KEY),

    // Correos con asignación automática de Superusuario
    superuserEmails: [
      "pedro.bolig@gamil.com",
      "pedro.bolig@gmail.com"
    ],

    // Catálogo de carreras administrables en el sistema
    carreras: [
      {
        id: "digitales",
        nombre: "Tecnicatura Superior en Tecnologías Digitales",
        color: "#74acdf",
        pagina: "digitales.html",
        icono: "💻"
      },
      {
        id: "higiene",
        nombre: "Tecnicatura Superior en Higiene y Seguridad",
        color: "#f6b40e",
        pagina: "higiene.html",
        icono: "🛡️"
      },
      {
        id: "enfermeria",
        nombre: "Tecnicatura Superior en Enfermería",
        color: "#e07a8e",
        pagina: "enfermeria.html",
        icono: "🩺"
      },
      {
        id: "simulacion",
        nombre: "Centro Regional de Simulación Clínica",
        color: "#5aa88a",
        pagina: "simulacion.html",
        icono: "🏥"
      }
    ],

    // Módulos generales del sitio (gestionables por Superusuario)
    seccionesGenerales: [
      { id: "institucion", nombre: "Datos Institucionales (Nombre, lema, contacto)", icono: "🏛️" },
      { id: "informacionGeneral", nombre: "Novedades y Avisos Generales", icono: "📢" },
      { id: "inscripcionGeneral", nombre: "Requisitos y Períodos de Inscripción", icono: "📝" },
      { id: "comunidad", nombre: "Comunidad, Blog y Proyectos", icono: "🤝" }
    ],

    // Roles soportados
    ROLES: {
      SUPERUSER: "superuser",
      ADMIN: "admin",
      VISITANTE: "visitante"
    },

    // Storage bucket para imágenes
    storageBucket: "iset-assets"
  };
})();
