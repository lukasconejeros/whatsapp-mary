import { redirect } from 'next/navigation'

// La raíz redirige SIEMPRE a los chats (a esta altura el usuario ya pasó el login del
// middleware). Antes "/" era una pantalla cliente que, mientras consultaba el estado,
// mostraba "Generando código QR…" 1-2s en cada apertura → parpadeo molesto aunque todo
// estuviera conectado. La vinculación de WhatsApp (QR) vive ahora solo en /conexion
// (accesible desde el aviso de "WhatsApp desconectado" del menú).
export default function Home() {
  redirect('/inbox')
}
