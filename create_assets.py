import os, shutil

def make_svg(title, subtitle, icon, color1, color2):
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" width="100%" height="100%">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{color1}" />
      <stop offset="100%" stop-color="{color2}" />
    </linearGradient>
    <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
      <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="600" height="400" fill="url(#grad)" rx="12" />
  <rect width="600" height="400" fill="url(#grid)" rx="12" />
  <circle cx="500" cy="80" r="120" fill="rgba(255,255,255,0.06)" />
  <circle cx="100" cy="320" r="80" fill="rgba(255,255,255,0.04)" />
  
  <g transform="translate(300, 160)" text-anchor="middle">
    <text font-size="64" y="0">{icon}</text>
    <text font-family="'Bricolage Grotesque', sans-serif" font-size="24" font-weight="bold" fill="#ffffff" y="60">{title}</text>
    <text font-family="'Atkinson Hyperlegible', sans-serif" font-size="15" fill="rgba(255,255,255,0.85)" y="90">{subtitle}</text>
  </g>
</svg>"""

carreras = ['td', 'hys', 'enf', 'crsc']
subfolders = ['carrusel', 'comunidad']

for c in carreras:
    for s in subfolders:
        os.makedirs(os.path.join('img', 'carrera', c, s), exist_ok=True)

# 1. Tecnologías Digitales (td)
td_carrusel = [
    ("img/carrera/td/carrusel/1.svg", "Laboratorio de Software", "Desarrollo y Programación Web", "💻", "#1d3557", "#457b9d"),
    ("img/carrera/td/carrusel/2.svg", "Infraestructura & Redes", "Servidores y Ciberseguridad", "🌐", "#14213d", "#2a6f97"),
    ("img/carrera/td/carrusel/3.svg", "Sistemas Digitales", "Electrónica y Microprocesadores", "⚡", "#0b2545", "#134074")
]
td_comunidad = [
    ("img/carrera/td/comunidad/1.svg", "Muestra Anual de Software", "Proyectos Integradores de Estudiantes", "🚀", "#1d3557", "#3a86ff"),
    ("img/carrera/td/comunidad/2.svg", "Hackathon & Taller de Redes", "Práctica en Servidores Locales", "🛠️", "#14213d", "#0077b6")
]

# 2. Higiene y Seguridad (hys)
hys_carrusel = [
    ("img/carrera/hys/carrusel/1.svg", "Prevención y Ergonomía", "Gestión de Riesgos en Planta", "🦺", "#b08968", "#6f4e37"),
    ("img/carrera/hys/carrusel/2.svg", "Medio Ambiente & Seguridad", "Normativas y Auditorías Industriales", "🌿", "#588157", "#3a5a40"),
    ("img/carrera/hys/carrusel/3.svg", "Protección contra Incendios", "Sistemas de Extinción y Evacuación", "🛡️", "#a37081", "#6c584c")
]
hys_comunidad = [
    ("img/carrera/hys/comunidad/1.svg", "Relevamiento de Riesgos", "Prácticas de Campo en Fábricas", "🏭", "#b08968", "#7f4f24"),
    ("img/carrera/hys/comunidad/2.svg", "Simulacro de Evacuación", "Capacitación en Primeros Auxilios", "🚨", "#6c584c", "#43281c")
]

# 3. Enfermería (enf)
enf_carrusel = [
    ("img/carrera/enf/carrusel/1.svg", "Cuidados Integrales", "Atención y Salud Comunitaria", "🩺", "#1e88e5", "#1565c0"),
    ("img/carrera/enf/carrusel/2.svg", "Práctica Hospitalaria", "Clínica y Cuidados Críticos", "🏥", "#0288d1", "#01579b"),
    ("img/carrera/enf/carrusel/3.svg", "Salud y Humanización", "Ética y Compromiso Sanitario", "❤️", "#00acc1", "#00838f")
]
enf_comunidad = [
    ("img/carrera/enf/comunidad/1.svg", "Jornada Comunitaria de Salud", "Controles en Barrio y Charlas", "🤝", "#1e88e5", "#0d47a1"),
    ("img/carrera/enf/comunidad/2.svg", "Taller de Cuidados Avanzados", "Actualización en Farmacología", "💉", "#0288d1", "#01579b")
]

# 4. Simulación Clínica (crsc)
crsc_carrusel = [
    ("img/carrera/crsc/carrusel/1.svg", "Centro de Simulación Clínica", "Entrenamiento de Alta Fidelidad", "🔬", "#8e24aa", "#5e35b1"),
    ("img/carrera/crsc/carrusel/2.svg", "Escenarios Clínicos Reales", "Casos Críticos y Debriefing", "📋", "#6a1b9a", "#4527a0"),
    ("img/carrera/crsc/carrusel/3.svg", "Tecnología en Salud", "Robótica y Maniquíes Avanzados", "💡", "#7b1fa2", "#512da8")
]
crsc_comunidad = [
    ("img/carrera/crsc/comunidad/1.svg", "Simulacro Interdisciplinario", "Enfermería y Emergencias en Acción", "🚑", "#8e24aa", "#4a148c"),
    ("img/carrera/crsc/comunidad/2.svg", "Jornada de Entrenamiento Docente", "Metodologías de Simulación y Feedback", "🎓", "#6a1b9a", "#311b92")
]

all_assets = td_carrusel + td_comunidad + hys_carrusel + hys_comunidad + enf_carrusel + enf_comunidad + crsc_carrusel + crsc_comunidad

for path, t, s, ic, c1, c2 in all_assets:
    with open(path, 'w', encoding='utf-8') as f:
        f.write(make_svg(t, s, ic, c1, c2))

print(f"Generated {len(all_assets)} SVG assets in img/carrera/...")
