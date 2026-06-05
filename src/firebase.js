import { initializeApp } from 'firebase/app'
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyBeufCdHZuqXQO-d6AynFZ9cyb5oAL-wvY",
  authDomain: "my-workout-ro.firebaseapp.com",
  projectId: "my-workout-ro",
  storageBucket: "my-workout-ro.firebasestorage.app",
  messagingSenderId: "1006754095520",
  appId: "1:1006754095520:web:2fdb803f0e7ffc11c504c5"
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
setPersistence(auth, browserLocalPersistence)

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
})

export default app
