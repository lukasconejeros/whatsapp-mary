# Activar las notificaciones (Arteluk + Meta)

Las notificaciones avisan a Mary cuando le escribe un **cliente de Arteluk** o un **lead de Meta**.
Funcionan de dos formas: aviso al instante con la app abierta, y notificación real con la app cerrada.

Son **2 pasos**: uno tuyo (Lukas, una vez) y uno de Mary (en su iPhone, una vez).

---

## Paso 1 — Lukas: poner las claves en EasyPanel (una vez)

En EasyPanel → servicio **`arteluk`** → pestaña **Environment**, agrega estas 3 variables:

```
VAPID_PUBLIC_KEY=BNNgNllhEabRyx6lGljcu7u_GOJfQKTws6BDsw9G1pHancjDShRsbxn1hglhsOrd77uxkTiD9qUFAeioq24m28o
VAPID_PRIVATE_KEY=EIGqH3Jlo9BnYNYdTjSiEpYqrn-PE9xJGFM89dnG6x8
VAPID_SUBJECT=mailto:lukas@conejeros.cl
```

(Puedes cambiar el mailto por tu correo. La clave privada es un secreto — no la compartas.
Si quieres otras claves nuevas: `npx web-push generate-vapid-keys`.)

Guarda y **Desplegar**. Sin estas claves, la notificación con app cerrada no funciona
(el aviso con app abierta sí).

---

## Paso 2 — Mary en el iPhone (una vez)

La notificación con la app **cerrada** en iPhone SOLO funciona si la app está instalada en la
pantalla de inicio. Es una regla de Apple. Pasos:

1. Abre **Safari** y entra a la app (la URL de Arteluk). Inicia sesión con la contraseña.
2. Toca el botón **Compartir** (el cuadrito con la flecha hacia arriba, abajo al centro).
3. Baja y toca **"Agregar a inicio"** (o "Add to Home Screen") → **Agregar**.
4. Cierra Safari y abre la app desde el **ícono nuevo** en la pantalla de inicio.
5. Arriba en **Chats**, toca **🔔 "Activar avisos"** y acepta el permiso cuando lo pida.
6. Listo: el botón queda en **"Avisos ✓"** (verde).

**Prueba:** que alguien (desde OTRO teléfono, un número que sea cliente o lead) le escriba al
WhatsApp de Arteluk. Debería llegarle la notificación al iPhone de Mary, incluso con la app cerrada.

---

## Si algo no llega
- **iOS solo permite ~pocos avisos si la suscripción se “vence”**: si dejan de llegar, volver a
  tocar "Activar avisos" re-suscribe.
- Revisa que en **Ajustes → Notificaciones → Arteluk** estén permitidas.
- Si el botón dice **"Bloqueados"**: Mary negó el permiso; se reactiva en Ajustes del iPhone.
- Recuerda: solo avisa por **Arteluk** y **Meta**; los de la columna "Mary" (desconocidos) no.
