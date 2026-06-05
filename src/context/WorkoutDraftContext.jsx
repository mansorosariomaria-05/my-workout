import { createContext, useContext, useState, useCallback } from 'react'

const WorkoutDraftContext = createContext(null)

export function WorkoutDraftProvider({ children }) {
  const [draft, setDraftState] = useState(() => {
    try {
      const s = sessionStorage.getItem('workoutDraft')
      return s ? JSON.parse(s) : null
    } catch { return null }
  })

  const setDraft = useCallback((data) => {
    setDraftState(data)
    if (data) sessionStorage.setItem('workoutDraft', JSON.stringify(data))
    else sessionStorage.removeItem('workoutDraft')
  }, [])

  const clearDraft = useCallback(() => {
    setDraftState(null)
    sessionStorage.removeItem('workoutDraft')
  }, [])

  return (
    <WorkoutDraftContext.Provider value={{ draft, setDraft, clearDraft }}>
      {children}
    </WorkoutDraftContext.Provider>
  )
}

export const useWorkoutDraft = () => useContext(WorkoutDraftContext)
