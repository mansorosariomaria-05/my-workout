// Lee el aviso de inactividad ya respondido (o pendiente) del perfil. Solo lectura — el guardado
// vive en Inicio.jsx (donde se detecta y se arma el objeto), vía updateProfile del AuthContext.
export function getInactivityInfo(profile) {
  return profile?.inactividad ?? null
}
