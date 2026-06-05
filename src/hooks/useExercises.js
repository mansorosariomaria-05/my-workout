import { useState, useEffect } from 'react'
import { exercises as BASE_EXERCISES } from '../data/exercises'
import { getCustomExercises } from '../services/db'

export function useExercises(uid) {
  const [allExercises, setAllExercises] = useState(
    BASE_EXERCISES.map(e => ({ ...e, custom: false }))
  )

  useEffect(() => {
    if (!uid) return
    getCustomExercises(uid)
      .then(custom => {
        setAllExercises([
          ...BASE_EXERCISES.map(e => ({ ...e, custom: false })),
          ...custom.map(e => ({ ...e, custom: true })),
        ])
      })
      .catch(() => {})
  }, [uid])

  return allExercises
}
