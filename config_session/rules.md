# Reglas de trabajo

1. **No puedo modificar código sin autorización.**
2. **Solo estoy autorizado a trabajar con los archivos locales.**
3. **No ejecutar `git push` sin autorización escrita y explicita.**
4. **Checkpoint**
   -Debo hacer un commit tipo "checkpoint". Este commit debe ser hecho antes de comenzar cualquier tarea de modificación de código. Debo dejar por escrito en el archivo memory.md tanto el id del commit, y como su descripción.
5. **Rollback:**
   - Para solicitar un rollback, debo indicar qué checkpoint se requiere restaurar.
   - Solo después de ser autorizado explicitamente, ejecutaré automáticamente usando `git revert` o `git restore`.
   - Después del rollback ejecutaré `npm run build` para verificar que el estado restaurado es funcional.
6. **Memory file (`memory.md`):**
   - `memory.md` contiene el contexto compacto de la sesión para continuidad entre sesiones de OpenCode.
   - Debo actualizarlo al final de cada sesión o cuando se me solicite.
   - Vive en en la carpeta config_session junto a `rules.md`
7. **Opencode file (`opencode.json`):**
   - opencode.json vive en la raíz del proyecto.
8. **Consulta obligatoria antes de ejecutar acciones:**
   - No puedo iniciar/detener servicios (MySQL, servidor Node, etc.), modificar código, crear archivos, ejecutar scripts o probar la aplicación sin **autorización escrita y explícita**.
   - Debo preguntar: _"¿Lo hago yo o prefieres hacerlo tú?"_
   - Esto aplica a cualquier acción que afecte el estado del proyecto o del entorno de desarrollo.
9. **No asumir órdenes implícitas:** No debo cambiar nada del código sin autorización explícita escrita. No debo asumir acciones aunque parezcan obvias — todo debe ser autorizado explícitamente.
10. **No modificar UI sin autorización:** No implementar nuevas funciones, nuevas interfaces de usuario ni actualizar interfaces existentes sin previa autorización explícita.
11. **Preguntas**

- Si el chat comienza con la palabra "Duda:" solo debo responder la pregunta que se me hace, sin ejecutar ninguna acción, y menos modificar el código del proyecto.
12. **Scripts SQL para Supabase:**
   - Cada vez que necesite generar un script `.sql` para que el usuario lo ejecute en el Dashboard o en el SQL Editor de Supabase, debo crear el archivo en la carpeta `scripts/` como `.sql` (con copy/paste directo), en lugar de mostrarlo solo en el chat.
13. **Planes documentados:**
   - Cada plan que se requiera deberá ser escrito en un archivo `.md` y guardado en la carpeta `docs/`, para su posteriores revisiones.
   - Cada plan deberá estar dividido en **fases de ejecución** y dentro de cada fase por **tareas**, asignando a cada tarea su **nivel de complejidad** y el **riesgo inherente** de la misma (bajo, medio, alto).
