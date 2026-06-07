# Reglas para generar prompts de Claude Code

## Contexto
- Claude Code ya tiene acceso al proyecto completo
- Siempre empezar cada sesión nueva con: "Leé CONTEXTO.md antes de empezar"
- No incluir contexto de la app dentro de los prompts — solo las instrucciones del cambio puntual

## Al final de cada prompt, siempre incluir en este orden:
1. Commit y push a GitHub con un mensaje descriptivo. Ejemplos de formato:
   - "feat: descripción de funcionalidad nueva"
   - "fix: descripción del bug corregido"
   - "docs: descripción de documentación agregada"
   - "refactor: descripción de mejora de código"
2. Deploy completo con Firebase Hosting
3. Confirmación de la URL final cuando esté listo

## Fraccionamiento de prompts
- Si hay muchos cambios, separarlos en prompts individuales
- Cada prompt debe tener un solo foco claro
- Cambios de datos van separados de cambios de lógica
- Cambios de UI van separados de cambios de funcionalidad

## Convenciones del proyecto
- El proyecto usa React + Firebase
- Los estilos usan Tailwind CSS
- La app es una PWA
- URL de deploy: my-workout-ro.web.app
- Repositorio: https://github.com/mansorosariomaria-05/my-workout.git
