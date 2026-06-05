export const MUSCLE_GROUPS = [
  'Glúteos', 'Isquios', 'Cuádriceps', 'Abductores', 'Gemelos',
  'Espalda', 'Pecho', 'Hombros', 'Tríceps', 'Bíceps',
  'Abdominales', 'Core & Estabilidad',
]

export const exercises = [
  // GLÚTEOS
  { id: 'glut_01', name: 'Hip Thrust', muscle: 'Glúteos', group: 'Glúteo mayor', level: 'A', equip: 'Barra/Mancuerna', alt: 'Puente de Glúteo', secondary: 'Isquios' },
  { id: 'glut_02', name: 'Hip Thrust a una pierna', muscle: 'Glúteos', group: 'Glúteo mayor', level: 'A', equip: 'Barra', alt: 'Puente de Glúteo un lado', secondary: 'Isquios' },
  { id: 'glut_03', name: 'Kettlebell swing', muscle: 'Glúteos', group: 'Isquios', level: 'A', equip: 'Kettlebell', alt: 'Peso muerto B-stance', secondary: 'Core' },
  { id: 'glut_04', name: 'Sentadillas búlgaras', muscle: 'Glúteos', group: 'Glúteo mayor', level: 'B', equip: 'Mancuernas', alt: 'Estocada en el lugar', secondary: 'Cuádriceps' },
  { id: 'glut_05', name: 'Step-ups altos', muscle: 'Glúteos', group: 'Glúteo mayor', level: 'B', equip: 'Cajón', alt: 'Zancadas atrás', secondary: 'Cuádriceps' },
  { id: 'glut_06', name: 'Zancadas atrás', muscle: 'Glúteos', group: 'Glúteo mayor', level: 'B', equip: 'Mancuernas', alt: 'Estocada sin peso', secondary: 'Cuádriceps' },
  { id: 'glut_07', name: 'Puente de Glúteo', muscle: 'Glúteos', group: 'Glúteo mayor', level: 'C', equip: 'Sin equipamiento', alt: 'Hip Thrust con mancuerna', secondary: 'Isquios' },
  { id: 'glut_08', name: 'Abducción con banda', muscle: 'Glúteos', group: 'Glúteo medio', level: 'C', equip: 'Banda elástica', alt: 'Abducción en cuadrupedia', secondary: 'Glúteo menor' },
  { id: 'glut_09', name: 'Clamshell', muscle: 'Glúteos', group: 'Glúteo medio', level: 'C', equip: 'Banda elástica', alt: 'Clamshell sin banda', secondary: 'Core lateral' },
  { id: 'glut_10', name: 'Patada de glúteo', muscle: 'Glúteos', group: 'Glúteo mayor', level: 'C', equip: 'Tobilleras/Polea/Banda', alt: 'Patada en cuadrupedia sin peso', secondary: 'Isquios' },
  { id: 'glut_11', name: 'Hip Thrust unilateral', muscle: 'Glúteos', group: 'Glúteo mayor', level: 'B', equip: 'Mancuerna', alt: 'Puente de Glúteo unilateral', secondary: 'Isquios' },
  { id: 'glut_12', name: 'Step-ups con mancuernas al cajón alto', muscle: 'Glúteos', group: 'Glúteo mayor', level: 'B', equip: 'Cajón + Mancuernas', alt: 'Zancadas atrás', secondary: 'Cuádriceps' },
  { id: 'glut_reverse_frog', name: 'Reverse Frog', muscle: 'Glúteos', group: 'Glúteo mayor', level: 'B', equip: 'Sin equipamiento', alt: 'Patada de glúteo en cuadrupedia', secondary: 'Isquios' },
  { id: 'glut_abd_pausa', name: 'Abducción con pausa', muscle: 'Glúteos', group: 'Glúteo medio', level: 'B', equip: 'Sin equipamiento / Banda', alt: 'Hip Abduction de pie con banda', secondary: 'Glúteo mayor' },
  { id: 'glut_patada_lateral', name: 'Patada lateral con tobillera', muscle: 'Glúteos', group: 'Glúteo menor', level: 'C', equip: 'Tobilleras', alt: 'Abducción en suelo con banda', secondary: 'TFL' },

  // ISQUIOS
  { id: 'isq_01', name: 'Peso Muerto', muscle: 'Isquios', group: 'Isquios / Glúteo', level: 'A', equip: 'Barra', alt: 'Peso muerto B-stance', secondary: 'Espalda baja' },
  { id: 'isq_02', name: 'Peso muerto B-stance', muscle: 'Isquios', group: 'Isquios', level: 'A', equip: 'Mancuernas', alt: 'Landmine RDL', secondary: 'Glúteo mayor' },
  { id: 'isq_03', name: 'Sentadilla punta pies elevados', muscle: 'Isquios', group: 'Isquios', level: 'B', equip: 'Sin equipamiento', alt: 'Sentadilla goblet', secondary: 'Glúteos' },
  { id: 'isq_04', name: 'Curl femoral fitball', muscle: 'Isquios', group: 'Isquios', level: 'C', equip: 'Fitball', alt: 'Puente pies elevados', secondary: 'Core' },
  { id: 'isq_05', name: 'Puente pies elevados', muscle: 'Isquios', group: 'Isquios', level: 'C', equip: 'Banco', alt: 'Puente de Glúteo', secondary: 'Glúteos' },
  { id: 'isq_06', name: 'Curl Femoral Máquina', muscle: 'Isquios', group: 'Isquios', level: 'C', equip: 'Máquina', alt: 'Curl femoral fitball', secondary: '—' },
  { id: 'isq_07', name: 'Curl de Isquiotibiales en máquina', muscle: 'Isquios', group: 'Isquios', level: 'B', equip: 'Máquina', alt: 'Curl femoral fitball / Nordic Curl', secondary: 'Glúteos' },
  { id: 'isq_08', name: 'Nordic Curl', muscle: 'Isquios', group: 'Isquios', level: 'C', equip: 'Sin equipamiento', alt: 'Curl femoral fitball', secondary: 'Core' },
  { id: 'hiperextensiones', name: 'Hiperextensiones', muscle: 'Isquios', group: 'Isquios / Lumbar', level: 'C', equip: 'Banco Romano', alt: 'Buenos días con mancuerna', secondary: 'Glúteos / Lumbar' },
  { id: 'landmine-rdl', name: 'Landmine RDL', muscle: 'Isquios', group: 'Isquios', level: 'B', equip: 'Barra + soporte landmine', alt: 'Peso muerto B-stance', secondary: 'Glúteos' },

  // CUÁDRICEPS
  { id: 'cua_01', name: 'Sentadilla Libre', muscle: 'Cuádriceps', group: 'Cuádriceps', level: 'A', equip: 'Barra', alt: 'Sentadilla goblet', secondary: 'Glúteos / Core' },
  { id: 'cua_02', name: 'Prensa', muscle: 'Cuádriceps', group: 'Cuádriceps', level: 'A', equip: 'Máquina', alt: 'Sentadilla goblet', secondary: 'Glúteos' },
  { id: 'cua_03', name: 'Sentadilla goblet', muscle: 'Cuádriceps', group: 'Cuádriceps', level: 'B', equip: 'Mancuerna', alt: 'Sentadilla sin peso', secondary: 'Glúteos' },
  { id: 'cua_04', name: 'Estocada en el lugar', muscle: 'Cuádriceps', group: 'Cuádriceps', level: 'B', equip: 'Mancuernas', alt: 'Estocada sin peso', secondary: 'Glúteo mayor' },
  { id: 'cua_05', name: 'Estocadas caminando', muscle: 'Cuádriceps', group: 'Cuádriceps', level: 'B', equip: 'Mancuernas', alt: 'Estocada en el lugar', secondary: 'Glúteos' },
  { id: 'cua_06', name: 'Sentadilla talones elevados', muscle: 'Cuádriceps', group: 'Cuádriceps', level: 'B', equip: 'Disco', alt: 'Sentadilla goblet', secondary: 'Core' },
  { id: 'cua_07', name: 'Sentadilla isométrica', muscle: 'Cuádriceps', group: 'Cuádriceps', level: 'C', equip: 'Pared', alt: 'Sentadilla Goblet', secondary: 'Abductores' },
  { id: 'cua_08', name: 'Extensión Cuádriceps', muscle: 'Cuádriceps', group: 'Cuádriceps', level: 'C', equip: 'Máquina', alt: 'Sentadilla isométrica', secondary: '—' },
  { id: 'cua_09', name: 'Hack Squat', muscle: 'Cuádriceps', group: 'Cuádriceps', level: 'A', equip: 'Máquina', alt: 'Sentadilla talones elevados', secondary: 'Glúteos' },

  // ABDUCTORES
  { id: 'abd_01', name: 'Caminata lateral con banda', muscle: 'Abductores', group: 'Glúteo medio', level: 'B', equip: 'Banda elástica', alt: 'Paso lateral sin banda', secondary: 'Glúteo mayor' },
  { id: 'abd_02', name: 'Abducción piernas tobilleras', muscle: 'Abductores', group: 'Glúteo menor', level: 'C', equip: 'Tobilleras', alt: 'Abducción lateral en suelo', secondary: 'TFL' },
  { id: 'abd_03', name: 'Abducción en cuadrupedia', muscle: 'Abductores', group: 'Glúteo medio', level: 'C', equip: 'Tobilleras', alt: 'Abducción sin tobilleras', secondary: 'Core' },
  { id: 'abd_04', name: 'Hip Abduction de pie con banda', muscle: 'Abductores', group: 'Glúteo medio', level: 'C', equip: 'Banda elástica', alt: 'Abducción lateral en suelo', secondary: 'TFL' },

  // GEMELOS
  { id: 'gem_01', name: 'Salto a la soga', muscle: 'Gemelos', group: 'Gemelos', level: 'A', equip: 'Soga para saltar', alt: 'Salto en el lugar', secondary: 'Cardio' },
  { id: 'gem_02', name: 'Elevación de talones de pie', muscle: 'Gemelos', group: 'Gemelos', level: 'C', equip: 'Escalón/Mancuerna', alt: 'Elevación en suelo', secondary: 'Sóleo' },
  { id: 'gem_03', name: 'Elevación de talones sentada', muscle: 'Gemelos', group: 'Sóleo', level: 'C', equip: 'Mancuerna en rodillas', alt: 'Elevación en suelo', secondary: 'Gemelos' },
  { id: 'gem_04', name: 'Prensa en punta de pies', muscle: 'Gemelos', group: 'Gemelos', level: 'C', equip: 'Máquina de prensa', alt: 'Elevación de talones en suelo', secondary: 'Sóleo' },

  // ESPALDA
  { id: 'esp_01', name: 'Dominadas', muscle: 'Espalda', group: 'Dorsal ancho', level: 'A', equip: 'Barra dominadas', alt: 'Jalón al pecho', secondary: 'Bíceps' },
  { id: 'esp_02', name: 'Remo con barra', muscle: 'Espalda', group: 'Dorsal / Romboides', level: 'A', equip: 'Barra', alt: 'Remo con Mancuerna', secondary: 'Trapecio' },
  { id: 'esp_03', name: 'Jalón al pecho', muscle: 'Espalda', group: 'Dorsal ancho', level: 'A', equip: 'Polea', alt: 'Dominadas', secondary: 'Bíceps' },
  { id: 'esp_04', name: 'Remo polea baja', muscle: 'Espalda', group: 'Romboides + Trapecio', level: 'A', equip: 'Polea', alt: 'Remo con Mancuerna', secondary: 'Dorsal' },
  { id: 'esp_05', name: 'Remo con Mancuerna', muscle: 'Espalda', group: 'Dorsal ancho', level: 'B', equip: 'Mancuerna', alt: 'Remo en polea', secondary: 'Bíceps' },
  { id: 'esp_06', name: 'Remo en prono', muscle: 'Espalda', group: 'Trapecio + Deltoides', level: 'B', equip: 'Banco + Mancuernas', alt: 'Remo con Mancuerna', secondary: 'Trapecio medio' },
  { id: 'esp_07', name: 'Face Pull', muscle: 'Espalda', group: 'Trapecio medio', level: 'C', equip: 'Polea/Banda', alt: 'Face Pull con banda', secondary: 'Deltoides post.' },

  // PECHO
  { id: 'pec_01', name: 'Press de Banca', muscle: 'Pecho', group: 'Pectoral mayor', level: 'A', equip: 'Banco + Barra', alt: 'Flexiones de brazos', secondary: 'Tríceps / Hombro' },
  { id: 'cruces-polea', name: 'Cruces en Polea', muscle: 'Pecho', group: 'Pectoral mayor', level: 'C', equip: 'Polea', alt: 'Aperturas con Mancuernas', secondary: 'Hombro ant.' },
  { id: 'pec_02', name: 'Press inclinado mancuernas', muscle: 'Pecho', group: 'Pectoral superior', level: 'A', equip: 'Banco inclinado + Mancuernas', alt: 'Flexiones inclinadas', secondary: 'Tríceps' },
  { id: 'pec_03', name: 'Flexiones de brazos', muscle: 'Pecho', group: 'Pectoral mayor', level: 'B', equip: 'Sin equipamiento', alt: 'Flexiones en rodillas', secondary: 'Tríceps' },
  { id: 'pec_04', name: 'Aperturas mancuernas', muscle: 'Pecho', group: 'Pectoral mayor', level: 'C', equip: 'Banco + Mancuernas', alt: 'Aperturas en suelo', secondary: 'Hombro ant.' },

  // HOMBROS
  { id: 'hom_01', name: 'Press hombros', muscle: 'Hombros', group: 'Deltoides anterior', level: 'A', equip: 'Mancuernas/Barra', alt: 'Press con banda', secondary: 'Tríceps' },
  { id: 'hom_02', name: 'Elevaciones laterales', muscle: 'Hombros', group: 'Deltoides lateral', level: 'C', equip: 'Mancuernas', alt: 'Elevaciones con banda', secondary: 'Trapecio sup.' },
  { id: 'hom_03', name: 'Vuelo posterior', muscle: 'Hombros', group: 'Deltoides posterior', level: 'C', equip: 'Mancuernas', alt: 'Vuelo posterior con banda', secondary: 'Romboides' },
  { id: 'hom_04', name: 'Face Pull', muscle: 'Hombros', group: 'Deltoides posterior', level: 'C', equip: 'Polea/Banda elástica', alt: 'Vuelo posterior con banda', secondary: 'Trapecio' },
  { id: 'hom_05', name: 'Arnold Press', muscle: 'Hombros', group: 'Deltoides completo', level: 'B', equip: 'Mancuernas', alt: 'Press de hombros unilateral', secondary: 'Tríceps' },
  { id: 'hom_06', name: 'Press de hombros unilateral', muscle: 'Hombros', group: 'Deltoides anterior', level: 'C', equip: 'Mancuerna', alt: 'Press hombros', secondary: 'Core' },
  { id: 'hom_07', name: 'Vuelos posteriores con mancuerna', muscle: 'Hombros', group: 'Deltoides posterior', level: 'C', equip: 'Mancuernas', alt: 'Face Pull', secondary: 'Romboides' },

  // TRÍCEPS
  { id: 'tri_01', name: 'Fondos de banco', muscle: 'Tríceps', group: 'Tríceps', level: 'B', equip: 'Banco', alt: 'Fondos en suelo', secondary: 'Pecho / Hombro' },
  { id: 'tri_02', name: 'Copa tríceps', muscle: 'Tríceps', group: 'Tríceps largo', level: 'C', equip: 'Mancuerna', alt: 'Copa con banda', secondary: 'Tríceps' },
  { id: 'tri_03', name: 'Kick-back tríceps', muscle: 'Tríceps', group: 'Tríceps', level: 'C', equip: 'Mancuernas', alt: 'Extensión con banda', secondary: 'Tríceps lateral' },
  { id: 'tri_04', name: 'Tríceps banda elástica', muscle: 'Tríceps', group: 'Tríceps completo', level: 'C', equip: 'Banda elástica', alt: 'Tríceps banda', secondary: 'Tríceps' },
  { id: 'tri_05', name: 'Press Francés', muscle: 'Tríceps', group: 'Tríceps largo', level: 'C', equip: 'Barra EZ / Mancuernas', alt: 'Copa tríceps', secondary: 'Tríceps medial' },
  { id: 'tri_06', name: 'Extensión en Polea', muscle: 'Tríceps', group: 'Tríceps completo', level: 'C', equip: 'Polea', alt: 'Tríceps banda elástica', secondary: 'Tríceps lateral' },

  // BÍCEPS
  { id: 'bic_01', name: 'Curl en barra Z', muscle: 'Bíceps', group: 'Bíceps / Braquial', level: 'B', equip: 'Barra Z', alt: 'Curl mancuernas', secondary: 'Braquial' },
  { id: 'bic_02', name: 'Curl mancuernas', muscle: 'Bíceps', group: 'Bíceps', level: 'C', equip: 'Mancuernas', alt: 'Curl con banda', secondary: 'Antebrazo' },
  { id: 'bic_03', name: 'Curl martillo', muscle: 'Bíceps', group: 'Bíceps / Braquial', level: 'C', equip: 'Mancuernas', alt: 'Curl martillo con banda', secondary: 'Antebrazo' },
  { id: 'bic_04', name: 'Curl concentrado', muscle: 'Bíceps', group: 'Bíceps', level: 'C', equip: 'Mancuerna', alt: 'Curl con banda', secondary: 'Bíceps' },
  { id: 'bic_05', name: 'Curl de bíceps con mancuerna', muscle: 'Bíceps', group: 'Bíceps', level: 'C', equip: 'Mancuernas', alt: 'Curl en polea', secondary: 'Antebrazo' },

  // ABDOMINALES
  { id: 'abs_01', name: 'Rueda abdominal',          muscle: 'Abdominales', zone: 'Superior', group: 'Recto abdominal',     level: 'B', equip: 'Rueda abdominal',       alt: 'Plancha con flexión',         secondary: 'Serrato' },
  { id: 'abs_02', name: 'Plancha con flexión',       muscle: 'Abdominales', zone: 'Superior', group: 'Core',               level: 'B', equip: 'Sin equipamiento',      alt: 'La Plancha',                  secondary: 'Pecho' },
  { id: 'abs_03', name: 'Crunch',                    muscle: 'Abdominales', zone: 'Superior', group: 'Recto abdominal',     level: 'C', equip: 'Sin equipamiento',      alt: 'Bicycle Crunch',              secondary: 'Core' },
  { id: 'abs_04', name: 'Bicycle Crunch',            muscle: 'Abdominales', zone: 'Superior', group: 'Oblicuos',            level: 'C', equip: 'Sin equipamiento',      alt: 'Bicycle lento',               secondary: 'Recto abdominal' },
  { id: 'abs_05', name: 'One arm toe touch',         muscle: 'Abdominales', zone: 'Superior', group: 'Oblicuos',            level: 'C', equip: 'Sin equipamiento',      alt: 'Scissors Abs',                secondary: 'Recto abdominal' },
  { id: 'abi_01', name: 'Mountain Climber',          muscle: 'Abdominales', zone: 'Inferior', group: 'Core / Flexores',     level: 'B', equip: 'Sin equipamiento',      alt: 'Mountain Climber lento',      secondary: 'Cardio' },
  { id: 'abi_02', name: 'Elevación de piernas colgado', muscle: 'Abdominales', zone: 'Inferior', group: 'Recto abdominal inf.', level: 'B', equip: 'Barra dominadas', alt: 'Reverse Crunch',              secondary: 'Flexores' },
  { id: 'abi_03', name: 'Reverse Crunch',            muscle: 'Abdominales', zone: 'Inferior', group: 'Recto abdominal inf.', level: 'C', equip: 'Sin equipamiento',     alt: 'Elevación de piernas colgado', secondary: 'Core' },
  { id: 'abi_04', name: 'Scissors Abs',              muscle: 'Abdominales', zone: 'Inferior', group: 'Recto abdominal inf.', level: 'C', equip: 'Sin equipamiento',     alt: 'Scissors lento',              secondary: 'Flexores' },
  { id: 'obl_01', name: 'Giros rusos',               muscle: 'Abdominales', zone: 'Oblicuos', group: 'Oblicuos',            level: 'C', equip: 'Sin equipamiento/Pesa', alt: 'Giros sin peso',              secondary: 'Recto abdominal' },
  { id: 'obl_02', name: 'Rolling Plank',             muscle: 'Abdominales', zone: 'Oblicuos', group: 'Oblicuos / Core',     level: 'C', equip: 'Sin equipamiento',      alt: 'Plancha lateral estática',    secondary: 'Core' },
  { id: 'obl_03', name: 'Plancha lateral',           muscle: 'Abdominales', zone: 'Oblicuos', group: 'Oblicuos',            level: 'C', equip: 'Sin equipamiento',      alt: 'Plancha lateral rodilla',     secondary: 'Core' },
  { id: 'obl_04', name: 'Dead Bug',                  muscle: 'Core & Estabilidad',            group: 'Core profundo',       level: 'D', equip: 'Sin equipamiento',      alt: 'Dead Bug simplificado',       secondary: 'Core' },

  // CORE & ESTABILIDAD
  { id: 'cor_01', name: 'La Plancha', muscle: 'Core & Estabilidad', group: 'Core profundo', level: 'D', equip: 'Sin equipamiento', alt: 'Plancha en rodillas', secondary: 'Glúteos' },
  { id: 'cor_02', name: 'Press Pallof', muscle: 'Core & Estabilidad', group: 'Core anti-rotación', level: 'D', equip: 'Banda/Polea', alt: 'Plancha lateral', secondary: 'Oblicuos' },
  { id: 'cor_03', name: 'Bird Dog', muscle: 'Core & Estabilidad', group: 'Core profundo', level: 'D', equip: 'Sin equipamiento', alt: 'Bird Dog simplificado', secondary: 'Lumbar' },
  { id: 'cor_04', name: 'Hollow Body Hold', muscle: 'Core & Estabilidad', group: 'Core profundo', level: 'D', equip: 'Sin equipamiento', alt: 'La Plancha', secondary: 'Recto abdominal' },
  { id: 'plancha-arrastre-mancuerna', name: 'Plancha con Arrastre de Mancuerna', muscle: 'Core & Estabilidad', group: 'Core profundo', level: 'D', equip: 'Mancuerna', alt: 'La Plancha', secondary: 'Oblicuos' },
]

export const getExerciseById = (id) => exercises.find(e => e.id === id)
export const getExercisesByMuscle = (muscle) => exercises.filter(e => e.muscle === muscle)
export const getExercisesByLevel = (level) => exercises.filter(e => e.level === level)
