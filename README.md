# Piano Roll Local (tipo Synthesia)

Aplicacion web local para visualizar notas cayendo sobre un piano virtual.
https://memofrezzo.github.io/SheetMusic-to-PianoTutorial/

## Que hace
- Carga partitura en **MusicXML** (`.musicxml` o `.xml`) como formato principal.
- Acepta **MIDI** (`.mid`/`.midi`) como formato secundario.
- Muestra notas como barras que caen hacia un piano de 88 teclas.
- Dibuja notas con bordes redondeados.
- Separa visualmente notas repetidas consecutivas del mismo pitch.
- Las notas en teclas negras se dibujan mas oscuras y sin transparencia.
- Resalta teclas activas con el mismo color de la nota que esta cayendo.
- Permite reproducir un audio externo (`.mp3`/`.wav`) sincronizado con la animacion.
- Incluye **Melodias por defecto** que cargan automaticamente partitura + audio al hacer click (`Legends Never Die no Voice`, `Legends Never Die Voice`, `Fotografia La Plata`, `Epic Piano Music`).
- Las melodias por defecto se leen desde `melodias.json` (rutas explicitas, ideal para evitar problemas de mayusculas/minusculas en web).
- Incluye controles: **Reproducir**, **Pausar**, **Reiniciar** y carga de archivos.
- Permite elegir velocidad: `0.25x`, `0.5x`, `0.75x`, `1.0x`, `2.0x`.
- Permite ir a un momento exacto (`mm:ss`) y mover la posicion con una barra de tiempo.
- Incluye atajos de teclado: `Espacio` (play/pausa), `Flecha Izquierda` (-5s), `Flecha Derecha` (+5s).
- Incluye boton de pantalla completa (con fallback para mobile cuando la API nativa no esta disponible).
- En pantalla completa muestra un panel flotante moderno integrado con progreso, tiempo, play/pausa, reinicio y velocidad.
- Ese panel se puede ocultar/mostrar y ampliar/reducir.
- Colorea por rol/instrumento en MusicXML (voz: violeta, piano clave de sol/staff 1: verde, piano clave de fa/staff 2: azul).

## Limitaciones importantes
- La sincronizacion con audio externo es buena si el audio fue exportado del mismo proyecto/tempo de la partitura.
- Si el audio tiene rubato o variaciones libres de tempo, la app no hace analisis automatico de beat tracking.
- Se incluye un control de **Offset visual (s)** para ajuste manual fino.
- No soporta `MusicXML comprimido (.mxl)` en esta version.
- No lee PDF escaneado ni imagenes de partituras.
- No sintetiza sonido nota por nota (por diseno, foco visual).

## Mejor formato para exportar desde tu editor musical
Recomendado: **MusicXML no comprimido (`.musicxml`)**.

En MuseScore, por ejemplo:
1. `Archivo -> Exportar`
2. Elegir `Uncompressed MusicXML (*.musicxml)`

Formato secundario valido: `MIDI (.mid)`.

## Instalacion y ejecucion en Windows

### Opcion mas simple (sin instalar nada)
1. Abre `index.html` en Chrome o Edge.
2. Carga tu partitura y (opcional) el audio.
3. Nota: la seccion de **Melodias por defecto** puede no funcionar desde `file://` por restricciones del navegador.

### Opcion alternativa (servidor local simple)
1. Instala Python 3 (si no lo tienes).
2. Abre PowerShell en esta carpeta del proyecto.
3. Ejecuta:

```powershell
python -m http.server 8080
```

4. Abre en el navegador:

```text
http://localhost:8080
```

Tambien puedes usar el lanzador incluido:

```text
run_local_server.bat
```

Nota: ese lanzador requiere Python instalado.
Importante: para usar **Melodias por defecto** esta opcion es la recomendada.

## Uso
1. Carga la partitura (`.musicxml`/`.xml`, o `.mid`/`.midi`).
2. O usa la seccion **Melodias por defecto** para cargar automaticamente score + audio desde `Partituras/<nombre>.musicxml` y `Musicas/<nombre>.mp3`.
3. (Opcional) Carga o reemplaza el audio (`.mp3`/`.wav`).
4. Ajusta la velocidad de reproduccion.
5. Usa `Ir a tiempo` (`mm:ss`) o la barra de posicion para saltar a otra parte.
6. Ajusta `Offset visual (s)` si hace falta.
7. Usa `Reproducir`, `Pausar`, `Reiniciar` o los atajos de teclado.
8. Activa `Pantalla completa` para usar el panel flotante (ocultar/mostrar y cambiar tamano).

## Archivos del proyecto
- `index.html`: interfaz
- `styles.css`: estilos
- `app.js`: parseo MusicXML/MIDI, sincronizacion y render en canvas
- `melodias.json`: lista/rutas de las melodias por defecto
- `run_local_server.bat`: lanza servidor local en puerto 8080

## Como agregar o editar melodias por defecto
1. Abri `melodias.json`.
2. En `melodies`, agrega/edita objetos con:
- `label`
- `scorePath` (ej: `Partituras/Mi Tema.musicxml`)
- `audioPath` (ej: `Musicas/Mi Tema.mp3`)
3. Subi tambien esos archivos al repo/hosting con exactamente esas rutas.

