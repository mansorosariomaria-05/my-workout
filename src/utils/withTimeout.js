// Rechaza con { code: 'timeout' } si la promesa no se resuelve en `ms`. La promesa original NO se
// cancela (una escritura de Firestore encolada igual se enviará cuando haya red) — por eso las
// escrituras de workouts usan IDs fijos: si terminan después del timeout, sobrescriben el mismo
// documento en vez de duplicarlo. Un rechazo tardío de la promesa original se ignora a propósito.
export function withTimeout(promise, ms) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`Timeout de ${ms} ms`)
      err.code = 'timeout'
      reject(err)
    }, ms)
  })
  Promise.resolve(promise).catch(() => {})
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}
