export const MUSCLE_GROUPS = [
  'Glúteos', 'Isquios', 'Cuádriceps', 'Abductores', 'Gemelos',
  'Espalda', 'Pecho', 'Hombros', 'Tríceps', 'Bíceps',
  'Abdominales', 'Core & Estabilidad',
]

export const exercises = [
  // GLÚTEOS
  { id: 'glut_01', name: 'Hip Thrust', muscle: 'Glúteos', group: 'Glúteo mayor', level: 'A', equip: 'Barra/Mancuerna', alt: 'Puente de Glúteo', secondary: 'Isquios', pattern: 'empuje_cadera', unilateral: false },
  { id: 'glut_02', name: 'Hip Thrust a una pierna', muscle: 'Glúteos', group: 'Glúteo mayor', level: 'A', equip: 'Barra', alt: 'Puente de Glúteo un lado', secondary: 'Isquios', pattern: 'empuje_cadera', unilateral: true },
  { id: 'glut_03', name: 'Kettlebell swing', muscle: 'Glúteos', group: 'Isquios', level: 'A', equip: 'Kettlebell', alt: 'Peso muerto B-stance', secondary: 'Core', pattern: 'bisagra', unilateral: false },
  { id: 'glut_04', name: 'Sentadillas búlgaras', muscle: 'Glúteos', group: 'Glúteo mayor', level: 'B', equip: 'Mancuernas', alt: 'Estocada en el lugar', secondary: 'Cuádriceps', pattern: 'zancada', unilateral: true },
  { id: 'glut_05', name: 'Step-ups altos', muscle: 'Glúteos', group: 'Glúteo mayor', level: 'B', equip: 'Cajón', alt: 'Zancadas atrás', secondary: 'Cuádriceps', pattern: 'zancada', unilateral: true },
  { id: 'glut_06', name: 'Zancadas atrás', muscle: 'Glúteos', group: 'Glúteo mayor', level: 'B', equip: 'Mancuernas', alt: 'Estocada sin peso', secondary: 'Cuádriceps', pattern: 'zancada', unilateral: true },
  { id: 'glut_07', name: 'Puente de Glúteo', muscle: 'Glúteos', group: 'Glúteo mayor', level: 'C', equip: 'Sin equipamiento', alt: 'Hip Thrust con mancuerna', secondary: 'Isquios', pattern: 'empuje_cadera', unilateral: false },
  { id: 'glut_08', name: 'Abducción con banda', muscle: 'Glúteos', group: 'Glúteo medio', level: 'C', equip: 'Banda elástica', alt: 'Abducción en cuadrupedia', secondary: 'Glúteo menor', pattern: 'abduccion', unilateral: false },
  { id: 'glut_09', name: 'Clamshell', muscle: 'Glúteos', group: 'Glúteo medio', level: 'C', equip: 'Banda elástica', alt: 'Clamshell sin banda', secondary: 'Core lateral', pattern: 'abduccion', unilateral: false },
  { id: 'glut_10', name: 'Patada de glúteo', muscle: 'Glúteos', group: 'Glúteo mayor', level: 'C', equip: 'Tobilleras/Polea/Banda', alt: 'Patada en cuadrupedia sin peso', secondary: 'Isquios', pattern: 'extension_cadera', unilateral: false },
  { id: 'glut_11', name: 'Hip Thrust unilateral', muscle: 'Glúteos', group: 'Glúteo mayor', level: 'B', equip: 'Mancuerna', alt: 'Puente de Glúteo unilateral', secondary: 'Isquios', pattern: 'empuje_cadera', unilateral: true },
  { id: 'glut_12', name: 'Step-ups con mancuernas al cajón alto', muscle: 'Glúteos', group: 'Glúteo mayor', level: 'B', equip: 'Cajón + Mancuernas', alt: 'Zancadas atrás', secondary: 'Cuádriceps', pattern: 'zancada', unilateral: true },
  { id: 'glut_reverse_frog', name: 'Reverse Frog', muscle: 'Glúteos', group: 'Glúteo mayor', level: 'B', equip: 'Sin equipamiento', alt: 'Patada de glúteo en cuadrupedia', secondary: 'Isquios', pattern: 'extension_cadera', unilateral: false },
  { id: 'glut_abd_pausa', name: 'Abducción con pausa', muscle: 'Glúteos', group: 'Glúteo medio', level: 'B', equip: 'Sin equipamiento / Banda', alt: 'Hip Abduction de pie con banda', secondary: 'Glúteo mayor', pattern: 'abduccion', unilateral: false },
  { id: 'glut_patada_lateral', name: 'Patada lateral con tobillera', muscle: 'Glúteos', group: 'Glúteo menor', level: 'C', equip: 'Tobilleras', alt: 'Abducción en suelo con banda', secondary: 'TFL', pattern: 'abduccion', unilateral: false },

  // ISQUIOS
  { id: 'isq_01', name: 'Peso Muerto', muscle: 'Isquios', group: 'Isquios / Glúteo', level: 'A', equip: 'Barra', alt: 'Peso muerto B-stance', secondary: 'Espalda baja', pattern: 'bisagra', unilateral: false },
  { id: 'isq_02', name: 'Peso muerto B-stance', muscle: 'Isquios', group: 'Isquios', level: 'A', equip: 'Mancuernas', alt: 'Landmine RDL', secondary: 'Glúteo mayor', pattern: 'bisagra', unilateral: true },
  { id: 'isq_03', name: 'Sentadilla punta pies elevados', muscle: 'Isquios', group: 'Isquios', level: 'B', equip: 'Sin equipamiento', alt: 'Sentadilla goblet', secondary: 'Glúteos', pattern: 'sentadilla', unilateral: false },
  { id: 'isq_04', name: 'Curl femoral fitball', muscle: 'Isquios', group: 'Isquios', level: 'C', equip: 'Fitball', alt: 'Puente pies elevados', secondary: 'Core', pattern: 'curl_femoral', unilateral: false },
  { id: 'isq_05', name: 'Puente pies elevados', muscle: 'Isquios', group: 'Isquios', level: 'C', equip: 'Banco', alt: 'Puente de Glúteo', secondary: 'Glúteos', pattern: 'empuje_cadera', unilateral: false },
  { id: 'isq_06', name: 'Curl Femoral Máquina', muscle: 'Isquios', group: 'Isquios', level: 'C', equip: 'Máquina', alt: 'Curl femoral fitball', secondary: '—', pattern: 'curl_femoral', unilateral: false },
  { id: 'isq_07', name: 'Curl de Isquiotibiales en máquina', muscle: 'Isquios', group: 'Isquios', level: 'B', equip: 'Máquina', alt: 'Curl femoral fitball / Nordic Curl', secondary: 'Glúteos', pattern: 'curl_femoral', unilateral: false },
  { id: 'isq_08', name: 'Nordic Curl', muscle: 'Isquios', group: 'Isquios', level: 'C', equip: 'Sin equipamiento', alt: 'Curl femoral fitball', secondary: 'Core', pattern: 'curl_femoral', unilateral: false },
  { id: 'hiperextensiones', name: 'Hiperextensiones', muscle: 'Isquios', group: 'Isquios / Lumbar', level: 'C', equip: 'Banco Romano', alt: 'Buenos días con mancuerna', secondary: 'Glúteos / Lumbar', pattern: 'bisagra', unilateral: false },
  { id: 'landmine-rdl', name: 'Landmine RDL', muscle: 'Isquios', group: 'Isquios', level: 'B', equip: 'Barra + soporte landmine', alt: 'Peso muerto B-stance', secondary: 'Glúteos', pattern: 'bisagra', unilateral: false },

  // CUÁDRICEPS
  { id: 'cua_01', name: 'Sentadilla Libre', muscle: 'Cuádriceps', group: 'Cuádriceps', level: 'A', equip: 'Barra', alt: 'Sentadilla goblet', secondary: 'Glúteos / Core', pattern: 'sentadilla', unilateral: false },
  { id: 'cua_02', name: 'Prensa', muscle: 'Cuádriceps', group: 'Cuádriceps', level: 'A', equip: 'Máquina', alt: 'Sentadilla goblet', secondary: 'Glúteos', pattern: 'sentadilla', unilateral: false },
  { id: 'cua_03', name: 'Sentadilla goblet', muscle: 'Cuádriceps', group: 'Cuádriceps', level: 'B', equip: 'Mancuerna', alt: 'Sentadilla sin peso', secondary: 'Glúteos', pattern: 'sentadilla', unilateral: false },
  { id: 'cua_04', name: 'Estocada en el lugar', muscle: 'Cuádriceps', group: 'Cuádriceps', level: 'B', equip: 'Mancuernas', alt: 'Estocada sin peso', secondary: 'Glúteo mayor', pattern: 'zancada', unilateral: true },
  { id: 'cua_05', name: 'Estocadas caminando', muscle: 'Cuádriceps', group: 'Cuádriceps', level: 'B', equip: 'Mancuernas', alt: 'Estocada en el lugar', secondary: 'Glúteos', pattern: 'zancada', unilateral: true },
  { id: 'cua_06', name: 'Sentadilla talones elevados', muscle: 'Cuádriceps', group: 'Cuádriceps', level: 'B', equip: 'Disco', alt: 'Sentadilla goblet', secondary: 'Core', pattern: 'sentadilla', unilateral: false },
  { id: 'cua_07', name: 'Sentadilla isométrica', muscle: 'Cuádriceps', group: 'Cuádriceps', level: 'C', equip: 'Pared', alt: 'Sentadilla Goblet', secondary: 'Abductores', pattern: 'sentadilla', unilateral: false },
  { id: 'cua_08', name: 'Extensión Cuádriceps', muscle: 'Cuádriceps', group: 'Cuádriceps', level: 'C', equip: 'Máquina', alt: 'Sentadilla isométrica', secondary: '—', pattern: 'extension_rodilla', unilateral: false },
  { id: 'cua_09', name: 'Hack Squat', muscle: 'Cuádriceps', group: 'Cuádriceps', level: 'A', equip: 'Máquina', alt: 'Sentadilla talones elevados', secondary: 'Glúteos', pattern: 'sentadilla', unilateral: false },

  // ABDUCTORES
  { id: 'abd_01', name: 'Caminata lateral con banda', muscle: 'Abductores', group: 'Glúteo medio', level: 'B', equip: 'Banda elástica', alt: 'Paso lateral sin banda', secondary: 'Glúteo mayor', pattern: 'abduccion', unilateral: false },
  { id: 'abd_02', name: 'Abducción piernas tobilleras', muscle: 'Abductores', group: 'Glúteo menor', level: 'C', equip: 'Tobilleras', alt: 'Abducción lateral en suelo', secondary: 'TFL', pattern: 'abduccion', unilateral: false },
  { id: 'abd_03', name: 'Abducción en cuadrupedia', muscle: 'Abductores', group: 'Glúteo medio', level: 'C', equip: 'Tobilleras', alt: 'Abducción sin tobilleras', secondary: 'Core', pattern: 'abduccion', unilateral: false },
  { id: 'abd_04', name: 'Hip Abduction de pie con banda', muscle: 'Abductores', group: 'Glúteo medio', level: 'C', equip: 'Banda elástica', alt: 'Abducción lateral en suelo', secondary: 'TFL', pattern: 'abduccion', unilateral: false },

  // GEMELOS
  { id: 'gem_01', name: 'Salto a la soga', muscle: 'Gemelos', group: 'Gemelos', level: 'A', equip: 'Soga para saltar', alt: 'Salto en el lugar', secondary: 'Cardio', pattern: 'gemelos', unilateral: false },
  { id: 'gem_02', name: 'Elevación de talones de pie', muscle: 'Gemelos', group: 'Gemelos', level: 'C', equip: 'Escalón/Mancuerna', alt: 'Elevación en suelo', secondary: 'Sóleo', pattern: 'gemelos', unilateral: false },
  { id: 'gem_03', name: 'Elevación de talones sentada', muscle: 'Gemelos', group: 'Sóleo', level: 'C', equip: 'Mancuerna en rodillas', alt: 'Elevación en suelo', secondary: 'Gemelos', pattern: 'gemelos', unilateral: false },
  { id: 'gem_04', name: 'Prensa en punta de pies', muscle: 'Gemelos', group: 'Gemelos', level: 'C', equip: 'Máquina de prensa', alt: 'Elevación de talones en suelo', secondary: 'Sóleo', pattern: 'gemelos', unilateral: false },

  // ESPALDA
  { id: 'esp_01', name: 'Dominadas', muscle: 'Espalda', group: 'Dorsal ancho', level: 'A', equip: 'Barra dominadas', alt: 'Jalón al pecho', secondary: 'Bíceps', pattern: 'traccion_vertical', unilateral: false },
  { id: 'esp_02', name: 'Remo con barra', muscle: 'Espalda', group: 'Dorsal / Romboides', level: 'A', equip: 'Barra', alt: 'Remo con Mancuerna', secondary: 'Trapecio', pattern: 'traccion_horizontal', unilateral: false },
  { id: 'esp_03', name: 'Jalón al pecho', muscle: 'Espalda', group: 'Dorsal ancho', level: 'A', equip: 'Polea', alt: 'Dominadas', secondary: 'Bíceps', pattern: 'traccion_vertical', unilateral: false },
  { id: 'esp_04', name: 'Remo polea baja', muscle: 'Espalda', group: 'Romboides + Trapecio', level: 'A', equip: 'Polea', alt: 'Remo con Mancuerna', secondary: 'Dorsal', pattern: 'traccion_horizontal', unilateral: false },
  { id: 'esp_05', name: 'Remo con Mancuerna', muscle: 'Espalda', group: 'Dorsal ancho', level: 'B', equip: 'Mancuerna', alt: 'Remo en polea', secondary: 'Bíceps', pattern: 'traccion_horizontal', unilateral: true },
  { id: 'esp_06', name: 'Remo en prono', muscle: 'Espalda', group: 'Trapecio + Deltoides', level: 'B', equip: 'Banco + Mancuernas', alt: 'Remo con Mancuerna', secondary: 'Trapecio medio', pattern: 'traccion_horizontal', unilateral: false },
  { id: 'esp_07', name: 'Face Pull', muscle: 'Espalda', group: 'Trapecio medio', level: 'C', equip: 'Polea/Banda', alt: 'Face Pull con banda', secondary: 'Deltoides post.', pattern: 'deltoides_posterior', unilateral: false },

  // PECHO
  { id: 'pec_01', name: 'Press de Banca', muscle: 'Pecho', group: 'Pectoral mayor', level: 'A', equip: 'Banco + Barra', alt: 'Flexiones de brazos', secondary: 'Tríceps / Hombro', pattern: 'empuje_horizontal', unilateral: false },
  { id: 'cruces-polea', name: 'Cruces en Polea', muscle: 'Pecho', group: 'Pectoral mayor', level: 'C', equip: 'Polea', alt: 'Aperturas con Mancuernas', secondary: 'Hombro ant.', pattern: 'aperturas', unilateral: false },
  { id: 'pec_02', name: 'Press inclinado mancuernas', muscle: 'Pecho', group: 'Pectoral superior', level: 'A', equip: 'Banco inclinado + Mancuernas', alt: 'Flexiones inclinadas', secondary: 'Tríceps', pattern: 'empuje_horizontal', unilateral: false },
  { id: 'pec_03', name: 'Flexiones de brazos', muscle: 'Pecho', group: 'Pectoral mayor', level: 'B', equip: 'Sin equipamiento', alt: 'Flexiones en rodillas', secondary: 'Tríceps', pattern: 'empuje_horizontal', unilateral: false },
  { id: 'pec_04', name: 'Aperturas mancuernas', muscle: 'Pecho', group: 'Pectoral mayor', level: 'C', equip: 'Banco + Mancuernas', alt: 'Aperturas en suelo', secondary: 'Hombro ant.', pattern: 'aperturas', unilateral: false },

  // HOMBROS
  { id: 'hom_01', name: 'Press hombros', muscle: 'Hombros', group: 'Deltoides anterior', level: 'A', equip: 'Mancuernas/Barra', alt: 'Press con banda', secondary: 'Tríceps', pattern: 'empuje_vertical', unilateral: false },
  { id: 'hom_02', name: 'Elevaciones laterales', muscle: 'Hombros', group: 'Deltoides lateral', level: 'C', equip: 'Mancuernas', alt: 'Elevaciones con banda', secondary: 'Trapecio sup.', pattern: 'elevacion_lateral', unilateral: false },
  { id: 'hom_03', name: 'Vuelo posterior', muscle: 'Hombros', group: 'Deltoides posterior', level: 'C', equip: 'Mancuernas', alt: 'Vuelo posterior con banda', secondary: 'Romboides', pattern: 'deltoides_posterior', unilateral: false },
  { id: 'hom_04', name: 'Face Pull', muscle: 'Hombros', group: 'Deltoides posterior', level: 'C', equip: 'Polea/Banda elástica', alt: 'Vuelo posterior con banda', secondary: 'Trapecio', pattern: 'deltoides_posterior', unilateral: false },
  { id: 'hom_05', name: 'Arnold Press', muscle: 'Hombros', group: 'Deltoides completo', level: 'B', equip: 'Mancuernas', alt: 'Press de hombros unilateral', secondary: 'Tríceps', pattern: 'empuje_vertical', unilateral: false },
  { id: 'hom_06', name: 'Press de hombros unilateral', muscle: 'Hombros', group: 'Deltoides anterior', level: 'C', equip: 'Mancuerna', alt: 'Press hombros', secondary: 'Core', pattern: 'empuje_vertical', unilateral: true },
  { id: 'hom_07', name: 'Vuelos posteriores con mancuerna', muscle: 'Hombros', group: 'Deltoides posterior', level: 'C', equip: 'Mancuernas', alt: 'Face Pull', secondary: 'Romboides', pattern: 'deltoides_posterior', unilateral: false },

  // TRÍCEPS
  { id: 'tri_01', name: 'Fondos de banco', muscle: 'Tríceps', group: 'Tríceps', level: 'B', equip: 'Banco', alt: 'Fondos en suelo', secondary: 'Pecho / Hombro', pattern: 'triceps', unilateral: false },
  { id: 'tri_02', name: 'Copa tríceps', muscle: 'Tríceps', group: 'Tríceps largo', level: 'C', equip: 'Mancuerna', alt: 'Copa con banda', secondary: 'Tríceps', pattern: 'triceps', unilateral: false },
  { id: 'tri_03', name: 'Kick-back tríceps', muscle: 'Tríceps', group: 'Tríceps', level: 'C', equip: 'Mancuernas', alt: 'Extensión con banda', secondary: 'Tríceps lateral', pattern: 'triceps', unilateral: false },
  { id: 'tri_04', name: 'Tríceps banda elástica', muscle: 'Tríceps', group: 'Tríceps completo', level: 'C', equip: 'Banda elástica', alt: 'Tríceps banda', secondary: 'Tríceps', pattern: 'triceps', unilateral: false },
  { id: 'tri_05', name: 'Press Francés', muscle: 'Tríceps', group: 'Tríceps largo', level: 'C', equip: 'Barra EZ / Mancuernas', alt: 'Copa tríceps', secondary: 'Tríceps medial', pattern: 'triceps', unilateral: false },
  { id: 'tri_06', name: 'Extensión en Polea', muscle: 'Tríceps', group: 'Tríceps completo', level: 'C', equip: 'Polea', alt: 'Tríceps banda elástica', secondary: 'Tríceps lateral', pattern: 'triceps', unilateral: false },

  // BÍCEPS
  { id: 'bic_01', name: 'Curl en barra Z', muscle: 'Bíceps', group: 'Bíceps / Braquial', level: 'B', equip: 'Barra Z', alt: 'Curl mancuernas', secondary: 'Braquial', pattern: 'biceps', unilateral: false },
  { id: 'bic_02', name: 'Curl mancuernas', muscle: 'Bíceps', group: 'Bíceps', level: 'C', equip: 'Mancuernas', alt: 'Curl con banda', secondary: 'Antebrazo', pattern: 'biceps', unilateral: false },
  { id: 'bic_03', name: 'Curl martillo', muscle: 'Bíceps', group: 'Bíceps / Braquial', level: 'C', equip: 'Mancuernas', alt: 'Curl martillo con banda', secondary: 'Antebrazo', pattern: 'biceps', unilateral: false },
  { id: 'bic_04', name: 'Curl concentrado', muscle: 'Bíceps', group: 'Bíceps', level: 'C', equip: 'Mancuerna', alt: 'Curl con banda', secondary: 'Bíceps', pattern: 'biceps', unilateral: true },
  { id: 'bic_05', name: 'Curl de bíceps con mancuerna', muscle: 'Bíceps', group: 'Bíceps', level: 'C', equip: 'Mancuernas', alt: 'Curl en polea', secondary: 'Antebrazo', pattern: 'biceps', unilateral: false },

  // ABDOMINALES
  { id: 'abs_01', name: 'Rueda abdominal',          muscle: 'Abdominales', zone: 'Superior', group: 'Recto abdominal',     level: 'B', equip: 'Rueda abdominal',       alt: 'Plancha con flexión',         secondary: 'Serrato', pattern: 'core_antiextension', unilateral: false },
  { id: 'abs_02', name: 'Plancha con flexión',       muscle: 'Abdominales', zone: 'Superior', group: 'Core',               level: 'B', equip: 'Sin equipamiento',      alt: 'La Plancha',                  secondary: 'Pecho', pattern: 'core_antiextension', unilateral: false },
  { id: 'abs_03', name: 'Crunch',                    muscle: 'Abdominales', zone: 'Superior', group: 'Recto abdominal',     level: 'C', equip: 'Sin equipamiento',      alt: 'Bicycle Crunch',              secondary: 'Core', pattern: 'core_flexion', unilateral: false },
  { id: 'abs_04', name: 'Bicycle Crunch',            muscle: 'Abdominales', zone: 'Superior', group: 'Oblicuos',            level: 'C', equip: 'Sin equipamiento',      alt: 'Bicycle lento',               secondary: 'Recto abdominal', pattern: 'core_flexion', unilateral: false },
  { id: 'abs_05', name: 'One arm toe touch',         muscle: 'Abdominales', zone: 'Superior', group: 'Oblicuos',            level: 'C', equip: 'Sin equipamiento',      alt: 'Scissors Abs',                secondary: 'Recto abdominal', pattern: 'core_flexion', unilateral: false },
  { id: 'abi_01', name: 'Mountain Climber',          muscle: 'Abdominales', zone: 'Inferior', group: 'Core / Flexores',     level: 'B', equip: 'Sin equipamiento',      alt: 'Mountain Climber lento',      secondary: 'Cardio', pattern: 'core_antiextension', unilateral: false },
  { id: 'abi_02', name: 'Elevación de piernas colgado', muscle: 'Abdominales', zone: 'Inferior', group: 'Recto abdominal inf.', level: 'B', equip: 'Barra dominadas', alt: 'Reverse Crunch',              secondary: 'Flexores', pattern: 'core_flexion', unilateral: false },
  { id: 'abi_03', name: 'Reverse Crunch',            muscle: 'Abdominales', zone: 'Inferior', group: 'Recto abdominal inf.', level: 'C', equip: 'Sin equipamiento',     alt: 'Elevación de piernas colgado', secondary: 'Core', pattern: 'core_flexion', unilateral: false },
  { id: 'abi_04', name: 'Scissors Abs',              muscle: 'Abdominales', zone: 'Inferior', group: 'Recto abdominal inf.', level: 'C', equip: 'Sin equipamiento',     alt: 'Scissors lento',              secondary: 'Flexores', pattern: 'core_flexion', unilateral: false },
  { id: 'obl_01', name: 'Giros rusos',               muscle: 'Abdominales', zone: 'Oblicuos', group: 'Oblicuos',            level: 'C', equip: 'Sin equipamiento/Pesa', alt: 'Giros sin peso',              secondary: 'Recto abdominal', pattern: 'core_rotacion', unilateral: false },
  { id: 'obl_02', name: 'Rolling Plank',             muscle: 'Abdominales', zone: 'Oblicuos', group: 'Oblicuos / Core',     level: 'C', equip: 'Sin equipamiento',      alt: 'Plancha lateral estática',    secondary: 'Core', pattern: 'core_rotacion', unilateral: false },
  { id: 'obl_03', name: 'Plancha lateral',           muscle: 'Abdominales', zone: 'Oblicuos', group: 'Oblicuos',            level: 'C', equip: 'Sin equipamiento',      alt: 'Plancha lateral rodilla',     secondary: 'Core', pattern: 'core_rotacion', unilateral: false },
  { id: 'obl_04', name: 'Dead Bug',                  muscle: 'Core & Estabilidad',            group: 'Core profundo',       level: 'D', equip: 'Sin equipamiento',      alt: 'Dead Bug simplificado',       secondary: 'Core', pattern: 'core_antiextension', unilateral: false },

  // CORE & ESTABILIDAD
  { id: 'cor_01', name: 'La Plancha', muscle: 'Core & Estabilidad', group: 'Core profundo', level: 'D', equip: 'Sin equipamiento', alt: 'Plancha en rodillas', secondary: 'Glúteos', pattern: 'core_antiextension', unilateral: false },
  { id: 'cor_02', name: 'Press Pallof', muscle: 'Core & Estabilidad', group: 'Core anti-rotación', level: 'D', equip: 'Banda/Polea', alt: 'Plancha lateral', secondary: 'Oblicuos', pattern: 'core_rotacion', unilateral: false },
  { id: 'cor_03', name: 'Bird Dog', muscle: 'Core & Estabilidad', group: 'Core profundo', level: 'D', equip: 'Sin equipamiento', alt: 'Bird Dog simplificado', secondary: 'Lumbar', pattern: 'core_antiextension', unilateral: false },
  { id: 'cor_04', name: 'Hollow Body Hold', muscle: 'Core & Estabilidad', group: 'Core profundo', level: 'D', equip: 'Sin equipamiento', alt: 'La Plancha', secondary: 'Recto abdominal', pattern: 'core_antiextension', unilateral: false },
  { id: 'plancha-arrastre-mancuerna', name: 'Plancha con Arrastre de Mancuerna', muscle: 'Core & Estabilidad', group: 'Core profundo', level: 'D', equip: 'Mancuerna', alt: 'La Plancha', secondary: 'Oblicuos', pattern: 'core_rotacion', unilateral: false },
]

export const getExerciseById = (id) => exercises.find(e => e.id === id)
export const getExercisesByMuscle = (muscle) => exercises.filter(e => e.muscle === muscle)
export const getExercisesByLevel = (level) => exercises.filter(e => e.level === level)
