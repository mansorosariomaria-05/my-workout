export const textoGenero = (genero, masc, fem, neutro) => {
  if (genero === 'masculino') return masc
  if (genero === 'femenino') return fem
  return neutro || masc
}
