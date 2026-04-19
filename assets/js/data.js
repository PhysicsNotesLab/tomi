/**
 * CURRICULUM DATA — Física UNAL
 * Fuente de verdad del plan de estudios.
 * Editar aquí para cambiar materias, créditos o iconos.
 */
"use strict";

const CURRICULUM = [
  {
    id: 1, name: "Semestre I", subtitle: "Fundamentos",
    icon: "fa-atom", credits: 18,
    subjects: [
      { id: "s1-1", name: "Fundamentos de física experimental", credits: 3, icon: "fa-flask-vial",         tag: "Laboratorio" },
      { id: "s1-2", name: "Fundamentos de física teórica",      credits: 3, icon: "fa-atom",               tag: "Teoría"      },
      { id: "s1-3", name: "Cálculo diferencial en una variable",credits: 3, icon: "fa-wave-square",        tag: "Cálculo"     },
      { id: "s1-4", name: "Taller de matemáticas y ciencias",   credits: 3, icon: "fa-brain",              tag: "Taller"      },
      { id: "s1-5", name: "Matemáticas básicas (Álgebra lineal)",credits:3, icon: "fa-vector-square",      tag: "Optativa"    },
      { id: "s1-6", name: "Inglés I",                           credits: 3, icon: "fa-language",           tag: "Idiomas"     },
    ]
  },
  {
    id: 2, name: "Semestre II", subtitle: "Ondas y Cálculo",
    icon: "fa-wave-square", credits: 17,
    subjects: [
      { id: "s2-1", name: "Mediciones mecánicas",                       credits: 3, icon: "fa-ruler-combined", tag: "Laboratorio" },
      { id: "s2-2", name: "Mecánica newtoniana",                        credits: 4, icon: "fa-apple-whole",    tag: "Teoría"      },
      { id: "s2-3", name: "Cálculo integral en una variable",           credits: 4, icon: "fa-infinity",       tag: "Cálculo"     },
      { id: "s2-4", name: "Cálculo vectorial",                          credits: 4, icon: "fa-arrows-spin",    tag: "Cálculo"     },
      { id: "s2-5", name: "Formación integral humanística en ciencia",  credits: 2, icon: "fa-book-open",      tag: "Optativa"    },
    ]
  },
  {
    id: 3, name: "Semestre III", subtitle: "Electromagnetismo",
    icon: "fa-bolt", credits: 16,
    subjects: [
      { id: "s3-1", name: "Mediciones electromagnéticas",               credits: 3, icon: "fa-magnet",                  tag: "Laboratorio" },
      { id: "s3-2", name: "Electricidad y magnetismo",                  credits: 4, icon: "fa-bolt",                    tag: "Teoría"      },
      { id: "s3-3", name: "Programación numérica",                      credits: 3, icon: "fa-code",                    tag: "Optativa"    },
      { id: "s3-4", name: "Estadística básica",                         credits: 3, icon: "fa-chart-bar",               tag: "Optativa"    },
      { id: "s3-5", name: "Ecuaciones diferenciales ordinarias",        credits: 3, icon: "fa-square-root-variable",    tag: "Cálculo"     },
    ]
  },
  {
    id: 4, name: "Semestre IV", subtitle: "Mecánica",
    icon: "fa-gears", credits: 15,
    subjects: [
      { id: "s4-1", name: "Formación integral humanística II",       credits: 2, icon: "fa-book-open",   tag: "Optativa"    },
      { id: "s4-2", name: "Mecánica analítica I",                    credits: 3, icon: "fa-gears",       tag: "Teoría"      },
      { id: "s4-3", name: "Oscilaciones y ondas",                    credits: 4, icon: "fa-wave-square", tag: "Teoría"      },
      { id: "s4-4", name: "Matemáticas especiales I para física",    credits: 4, icon: "fa-superscript", tag: "Matemáticas" },
      { id: "s4-5", name: "Relatividad",                             credits: 2, icon: "fa-clock",       tag: "Teoría"      },
    ]
  },
  {
    id: 5, name: "Semestre V", subtitle: "Cuántica",
    icon: "fa-shuffle", credits: 15,
    subjects: [
      { id: "s5-1", name: "Experimentos en física moderna",        credits: 3, icon: "fa-flask",       tag: "Laboratorio" },
      { id: "s5-2", name: "Mecánica analítica II",                 credits: 3, icon: "fa-gears",       tag: "Teoría"      },
      { id: "s5-3", name: "Electrodinámica I",                     credits: 4, icon: "fa-bolt",        tag: "Teoría"      },
      { id: "s5-4", name: "Matemáticas especiales II para física", credits: 3, icon: "fa-superscript", tag: "Matemáticas" },
      { id: "s5-5", name: "Electrónica e instrumentación",         credits: 2, icon: "fa-microchip",   tag: "Optativa"    },
    ]
  },
  {
    id: 6, name: "Semestre VI", subtitle: "Física Estadística",
    icon: "fa-chart-line", credits: 14,
    subjects: [
      { id: "s6-1", name: "Laboratorio módulo experimental",            credits: 3, icon: "fa-flask-vial",      tag: "Laboratorio" },
      { id: "s6-2", name: "Termodinámica módulo de teoría",             credits: 3, icon: "fa-temperature-high",tag: "Teoría"      },
      { id: "s6-3", name: "Electrodinámica II",                         credits: 3, icon: "fa-bolt",            tag: "Teoría"      },
      { id: "s6-4", name: "Mecánica cuántica I",                        credits: 3, icon: "fa-atom",            tag: "Teoría"      },
      { id: "s6-5", name: "Herramientas matemáticas y computacionales", credits: 2, icon: "fa-laptop-code",     tag: "Optativa"    },
    ]
  },
  {
    id: 7, name: "Semestre VII", subtitle: "Relatividad",
    icon: "fa-clock", credits: 13,
    subjects: [
      { id: "s7-1", name: "Mediciones en óptica y acústica", credits: 3, icon: "fa-eye",        tag: "Laboratorio" },
      { id: "s7-2", name: "Mecánica estadística",            credits: 3, icon: "fa-chart-line", tag: "Teoría"      },
      { id: "s7-3", name: "Temas de física contemporánea",   credits: 2, icon: "fa-newspaper",  tag: "Seminario"   },
      { id: "s7-4", name: "Mecánica cuántica II",            credits: 3, icon: "fa-atom",       tag: "Teoría"      },
      { id: "s7-5", name: "Física y Óptica",                 credits: 2, icon: "fa-lightbulb",  tag: "Optativa"    },
    ]
  },
  {
    id: 8, name: "Semestre VIII", subtitle: "Partículas",
    icon: "fa-burst", credits: 17,
    subjects: [
      { id: "s8-1", name: "Aplicaciones de física moderna",      credits: 3, icon: "fa-rocket",     tag: "Optativa" },
      { id: "s8-2", name: "Introducción al estado sólido",       credits: 4, icon: "fa-cube",        tag: "Teoría"   },
      { id: "s8-3", name: "Introducción a la física subnuclear", credits: 3, icon: "fa-burst",       tag: "Teoría"   },
      { id: "s8-4", name: "Libre elección 1",                    credits: 4, icon: "fa-circle-plus", tag: "Electiva" },
      { id: "s8-5", name: "Libre elección 2",                    credits: 3, icon: "fa-circle-plus", tag: "Electiva" },
    ]
  },
  {
    id: 9, name: "Semestre IX", subtitle: "Cosmología",
    icon: "fa-star", credits: 19,
    subjects: [
      { id: "s9-1", name: "Introducción a la investigación", credits: 3, icon: "fa-microscope",  tag: "Investigación" },
      { id: "s9-2", name: "Libre elección 3",                credits: 4, icon: "fa-circle-plus", tag: "Electiva"      },
      { id: "s9-3", name: "Libre elección 4",                credits: 4, icon: "fa-circle-plus", tag: "Electiva"      },
      { id: "s9-4", name: "Libre elección 5",                credits: 4, icon: "fa-circle-plus", tag: "Electiva"      },
      { id: "s9-5", name: "Libre elección 6",                credits: 4, icon: "fa-circle-plus", tag: "Electiva"      },
    ]
  },
  {
    id: 10, name: "Semestre X", subtitle: "Investigación",
    icon: "fa-flask-vial", credits: 12,
    subjects: [
      { id: "s10-1", name: "Trabajo de grado",  credits: 8, icon: "fa-scroll",       tag: "Tesis"    },
      { id: "s10-2", name: "Libre elección 7",  credits: 4, icon: "fa-circle-plus",  tag: "Electiva" },
    ]
  }
];

const TOTAL_CREDITS = CURRICULUM.reduce((s, sem) => s + sem.credits, 0);

const SUBJECT_STATUS = {
  pending: { label: "Pendiente", cls: "status-pending", icon: "fa-circle"       },
  active:  { label: "En curso",  cls: "status-active",  icon: "fa-circle-dot"   },
  passed:  { label: "Aprobada",  cls: "status-passed",  icon: "fa-circle-check" },
  failed:  { label: "Reprobada", cls: "status-failed",  icon: "fa-circle-xmark" },
};

const FILE_ICONS = {
  "application/pdf":    { icon: "fa-file-pdf",        color: "#ff5252" },
  "application/msword": { icon: "fa-file-word",       color: "#2196f3" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":         { icon: "fa-file-word",       color: "#2196f3" },
  "application/vnd.ms-excel":                                                         { icon: "fa-file-excel",      color: "#4caf50" },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":               { icon: "fa-file-excel",      color: "#4caf50" },
  "application/vnd.ms-powerpoint":                                                    { icon: "fa-file-powerpoint", color: "#ff6d42" },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":       { icon: "fa-file-powerpoint", color: "#ff6d42" },
  "text/plain":         { icon: "fa-file-lines",  color: "#90a4ae" },
  "image/png":          { icon: "fa-file-image",  color: "#ab47bc" },
  "image/jpeg":         { icon: "fa-file-image",  color: "#ab47bc" },
  "image/webp":         { icon: "fa-file-image",  color: "#ab47bc" },
  "image/gif":          { icon: "fa-file-image",  color: "#ab47bc" },
  "default":            { icon: "fa-file",         color: "#78909c" },
};

function getFileIcon(mime) { return FILE_ICONS[mime] || FILE_ICONS["default"]; }

function formatBytes(b) {
  if (!b) return "—";
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
  return (b / 1048576).toFixed(1) + " MB";
}

function formatDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

function getSemester(id)    { return CURRICULUM.find(s => s.id === id); }
function getSubject(semId, subId) {
  const sem = getSemester(semId);
  return sem ? sem.subjects.find(s => s.id === subId) : null;
}
function subKey(semId, subId) { return `${semId}_${subId}`; }