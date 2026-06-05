import { useLocation } from 'react-router-dom'
import WorkoutWizard from '../components/registro/WorkoutWizard'

export default function Registro() {
  const { state } = useLocation()
  return <WorkoutWizard initialType={state?.type} />
}
