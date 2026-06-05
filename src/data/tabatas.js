export const builtinTabatas = [
  {
    id: 'tb01',
    name: 'Estabilidad y Apertura',
    stations: [
      { name: 'KB Swing', muscle: 'Isquios/Glúteo', equip: 'Pesa Rusa', alt: 'Puente explosivo' },
      { name: 'Flexiones', muscle: 'Pectoral mayor', equip: 'Peso corporal', alt: 'Flexiones igual' },
      { name: 'Zancadas atrás', muscle: 'Glúteo mayor', equip: 'Mancuernas', alt: 'Zancadas sin peso' },
      { name: 'Rolling Plank', muscle: 'Core/Oblicuos', equip: 'Peso corporal', alt: 'Plancha lateral' },
    ],
    defaults: { prep: 10, work: 20, rest: 10, sets: 8, setRest: 60 },
  },
  {
    id: 'tb02',
    name: 'Tracción y Salto',
    stations: [
      { name: 'Soga saltar', muscle: 'Gemelos/Cardio', equip: 'Soga', alt: 'Jumping Jacks' },
      { name: 'Remo mancuerna', muscle: 'Dorsal', equip: 'Mancuerna', alt: 'Remo banda' },
      { name: 'Sentadilla Goblet', muscle: 'Cuádriceps', equip: 'Pesa Rusa', alt: 'Air Squat' },
      { name: 'Dead Bug', muscle: 'Recto abdominal', equip: 'Peso corporal', alt: 'Dead Bug igual' },
      { name: 'Abducción banda', muscle: 'Glúteo medio', equip: 'Banda', alt: 'Abducción lateral suelo' },
    ],
    defaults: { prep: 10, work: 20, rest: 10, sets: 8, setRest: 60 },
  },
  {
    id: 'tb03',
    name: 'Step & Power',
    stations: [
      { name: 'Step-ups altos', muscle: 'Glúteo mayor', equip: 'Step', alt: 'Estocada frontal' },
      { name: 'Press militar', muscle: 'Deltoides', equip: 'Mancuernas', alt: 'Pike Push ups' },
      { name: 'Puente pies elevados', muscle: 'Isquios', equip: 'Step', alt: 'Puente suelo' },
      { name: 'Mountain Climbers', muscle: 'Core/Hombros', equip: 'Peso corporal', alt: 'Escaladores' },
    ],
    defaults: { prep: 10, work: 20, rest: 10, sets: 8, setRest: 60 },
  },
  {
    id: 'tb04',
    name: 'Cadena Posterior',
    stations: [
      { name: 'Peso Muerto B-stance', muscle: 'Isquios', equip: 'Mancuernas', alt: 'PM rumano' },
      { name: 'Jalón a la cara', muscle: 'Trapecio/Delt.post', equip: 'Banda', alt: 'Vuelo posterior' },
      { name: 'Sentadilla Isométrica', muscle: 'Cuádriceps', equip: 'Peso corporal', alt: 'Sentadilla sostenida' },
      { name: 'Bicycle Crunch', muscle: 'Oblicuos', equip: 'Peso corporal', alt: 'Bicycle igual' },
      { name: 'Patada glúteo', muscle: 'Glúteo mayor', equip: 'Tobilleras', alt: 'Extensión cadera' },
    ],
    defaults: { prep: 10, work: 20, rest: 10, sets: 8, setRest: 60 },
  },
  {
    id: 'tb05',
    name: 'Empuje y Desplazamiento',
    stations: [
      { name: 'Caminata lateral', muscle: 'Glúteo medio', equip: 'Banda', alt: 'Abducción de pie' },
      { name: 'Press inclinado', muscle: 'Pectoral sup', equip: 'Mancuernas+Step', alt: 'Flexiones elevadas' },
      { name: 'Copa tríceps', muscle: 'Tríceps', equip: 'Mancuerna', alt: 'Flexiones diamante' },
      { name: 'Giros rusos', muscle: 'Oblicuos', equip: 'Pesa Rusa', alt: 'Giros sin peso' },
    ],
    defaults: { prep: 10, work: 20, rest: 10, sets: 8, setRest: 60 },
  },
  {
    id: 'tb06',
    name: 'Movilidad Dinámica',
    stations: [
      { name: 'KB Swing', muscle: 'Isquios', equip: 'Pesa Rusa', alt: 'PM mancuernas' },
      { name: 'Sentadilla talón elevado', muscle: 'Cuádriceps', equip: 'Mancuernas', alt: 'Sentadilla clásica' },
      { name: 'Vuelo posterior', muscle: 'Delt.posterior', equip: 'Mancuernas', alt: 'Remo prono' },
      { name: 'Scissors Abs', muscle: 'Abdomen inf', equip: 'Tobilleras', alt: 'Elevación piernas' },
      { name: 'Soga saltar', muscle: 'Cardio/Gemelos', equip: 'Soga', alt: 'Carrera rodillas arriba' },
    ],
    defaults: { prep: 10, work: 20, rest: 10, sets: 8, setRest: 60 },
  },
  {
    id: 'tb07',
    name: 'Resistencia Unilateral',
    stations: [
      { name: 'Sentadilla Búlgara', muscle: 'Glúteo/Cuád', equip: 'Step', alt: 'Estocada atrás' },
      { name: 'Remo un brazo', muscle: 'Dorsal', equip: 'Mancuerna', alt: 'Remo con banda' },
      { name: 'Elevación lateral', muscle: 'Delt.lateral', equip: 'Mancuernas', alt: 'Con banda' },
      { name: 'Plancha lateral', muscle: 'Oblicuos', equip: 'Peso corporal', alt: 'Plancha lateral igual' },
    ],
    defaults: { prep: 10, work: 20, rest: 10, sets: 8, setRest: 60 },
  },
  {
    id: 'tb08',
    name: 'Glúteo y Core',
    stations: [
      { name: 'Hip Thrust', muscle: 'Glúteo mayor', equip: 'Mancuerna+Step', alt: 'Puente suelo' },
      { name: 'Abducción cuadrupedia', muscle: 'Glúteo medio', equip: 'Tobilleras', alt: 'Abducción suelo' },
      { name: 'Reverse Crunch', muscle: 'Abdomen inf', equip: 'Peso corporal', alt: 'Reverse Crunch igual' },
      { name: 'Tríceps banda', muscle: 'Tríceps', equip: 'Banda', alt: 'Flexiones cerradas' },
      { name: 'Estocada en lugar', muscle: 'Cuádriceps', equip: 'Mancuernas', alt: 'Sentadilla libre' },
    ],
    defaults: { prep: 10, work: 20, rest: 10, sets: 8, setRest: 60 },
  },
  {
    id: 'tb09',
    name: 'Full Range',
    stations: [
      { name: 'Sentadilla Goblet', muscle: 'Cuádriceps', equip: 'Pesa Rusa', alt: 'Sentadilla sumo' },
      { name: 'Face Pull', muscle: 'Delt.post', equip: 'Banda', alt: 'Remo alto' },
      { name: 'Step-ups', muscle: 'Glúteo mayor', equip: 'Step', alt: 'Estocada frontal larga' },
      { name: 'One arm toe touch', muscle: 'Oblicuos/Recto', equip: 'Peso corporal', alt: 'V-ups' },
    ],
    defaults: { prep: 10, work: 20, rest: 10, sets: 8, setRest: 60 },
  },
  {
    id: 'tb10',
    name: 'Finalización y Tono',
    stations: [
      { name: 'Soga saltar', muscle: 'Gemelos', equip: 'Soga', alt: 'Trote en el lugar' },
      { name: 'Curl martillo', muscle: 'Bíceps/Braquial', equip: 'Mancuernas', alt: 'Curl banda' },
      { name: 'Kick-back tríceps', muscle: 'Tríceps', equip: 'Mancuernas', alt: 'Fondos suelo' },
      { name: 'Elevación talones', muscle: 'Gemelos', equip: 'Step', alt: 'Elevación suelo' },
      { name: 'La Plancha', muscle: 'Core', equip: 'Peso corporal', alt: 'Plancha igual' },
    ],
    defaults: { prep: 10, work: 20, rest: 10, sets: 8, setRest: 60 },
  },
]

export const calcTabataTime = (params) => {
  const { prep, work, rest, sets, setRest, stationCount } = params
  const totalSec = prep + ((work + rest) * stationCount * sets) + (setRest * (sets - 1))
  const min = Math.floor(totalSec / 60)
  const sec = String(totalSec % 60).padStart(2, '0')
  return `${min}:${sec}`
}
