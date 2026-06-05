import { auth } from '../firebase'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendEmailVerification,
} from 'firebase/auth'

export const register = async (email, password) => {
  const result = await createUserWithEmailAndPassword(auth, email, password)
  try { await sendEmailVerification(result.user) } catch (_) {}
  return result
}

export const login = (email, password) =>
  signInWithEmailAndPassword(auth, email, password)

export const logout = () => signOut(auth)

export const onAuthChange = (callback) => onAuthStateChanged(auth, callback)
