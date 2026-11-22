# Salud Conecta

Aplicación web sencilla que ayuda a pacientes con enfermedades crónicas (como hipertensión o diabetes) a **no olvidar sus medicamentos ni sus controles médicos**. Recuerda cada toma, permite confirmarla con un botón grande y, si no hay confirmación, prepara un aviso por WhatsApp para un cuidador o familiar.

Este es el **MVP (Producto Mínimo Viable)** del proyecto de emprendimiento del módulo *Emprendimiento de Base Tecnológica* del Politécnico Grancolombiano.

**Probar la aplicación:** https://COMPLETAR.vercel.app

**Repositorio:** https://github.com/ruthguzman667/salud_conecta

## ¿Qué hace?

- **Registro e ingreso:** crea la cuenta y, si se quiere, agrega a un cuidador.
- **Medicamentos y controles:** guarda nombre, dosis y una o varias horas por día, y las fechas de las citas.
- **Recordatorio:** a la hora indicada muestra una ventana con el nombre y la dosis, con sonido, vibración y notificación del navegador (si el usuario la autoriza).
- **Confirmación y aviso al cuidador:** el botón «Ya lo tomé» marca la toma. Si no se confirma en 5, 10, 15 o 30 minutos (a elección), se prepara un mensaje listo para enviar por WhatsApp o para copiar.
- **Pantalla «Prueba»:** mide tiempos y recordatorios confirmados y guarda la opinión de quien probó la aplicación.

La aplicación **no da diagnósticos ni sugiere dosis**: solo recuerda lo que el médico indicó.

## ¿Cómo probarla rápido?

1. Abre el enlace de arriba (funciona mejor en el celular).
2. Toca **«Ver la aplicación con datos de ejemplo»**.
3. Entra a **Cuidador** y usa **«Probar los recordatorios»**: crea una toma de prueba que suena en 20 segundos.
4. Si no confirmas con «Ya lo tomé», aparece el aviso para el cuidador.

## Tecnologías

| Parte | Herramienta |
|---|---|
| Interfaz y funcionamiento | HTML, CSS y JavaScript (un solo archivo, sin compilar) |
| Datos | `localStorage` del navegador (se guardan en el dispositivo del usuario) |
| Contraseña | Web Crypto (SHA-256), guardada cifrada |
| Instalación y uso sin conexión | PWA: `manifest.webmanifest` y `sw.js` |
| Publicación | Vercel (sitio estático) |

## Estructura del proyecto

```
salud_conecta/
├── index.html              # toda la aplicación
├── manifest.webmanifest    # datos para instalarla en el celular
├── sw.js                   # service worker (uso sin conexión)
├── icons/                  # íconos de la aplicación
├── vercel.json             # configuración de Vercel
└── README.md
```

## Ejecutar en el computador

1. Clona o descarga el repositorio.
2. Abre la carpeta en Visual Studio Code.
3. Instala la extensión **Live Server** y haz clic en **Go Live**.

También sirve cualquier servidor estático, por ejemplo `npx serve .`

## Limitaciones de esta versión

- Los recordatorios funcionan **mientras la aplicación está abierta**.
- El aviso al cuidador **no se envía solo**: queda escrito y listo para enviar por WhatsApp o para copiar.
- Los datos viven en el dispositivo; no hay cuentas en la nube ni acceso desde varios dispositivos.

## Próximos pasos

- Recordatorios con la aplicación cerrada (notificaciones push desde un servidor).
- Aviso automático al cuidador por correo o mensaje.
- Datos en la nube y acceso desde otros dispositivos.
- Piloto con una IPS o consultorio.

## Equipo (Grupo 5)

- Nicol Liceth Cotrina Cotrina
- Ruth Guzman Giraldo
- Dairon Betancourt Arenas

Tutor: Ricardo Antonio Botero Ríos

## Aviso

Prototipo académico. Salud Conecta no reemplaza la consulta médica. No subas al repositorio datos reales de pacientes.