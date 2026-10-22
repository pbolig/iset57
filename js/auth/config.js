/**
 * ISET N° 57 - Configuración Global de Autenticación, Roles y Supabase
 */
window.ISET_CONFIG = (() => {
  // Configuración predeterminada o persistida en localStorage
  const savedUrl = localStorage.getItem("iset_supabase_url") || "";
  const savedKey = localStorage.getItem("iset_supabase_anon_key") || "";

  return {
    // Credenciales de Supabase
    supabaseUrl: savedUrl || "https://su-proyecto.supabase.co",
    supabaseAnonKey: savedKey || "",

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
