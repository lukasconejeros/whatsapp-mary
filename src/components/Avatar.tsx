'use client'

import { useState, useEffect } from 'react'
import { User } from 'lucide-react'

// Avatar del contacto: muestra la foto de perfil si existe; si no hay o no carga,
// muestra el círculo gris con silueta blanca, igual que WhatsApp.
//
// `prioritaria` = esta foto se ve seguro y ya (la cabecera del chat abierto). El resto —las
// de la lista— van perezosas: el navegador solo pide la de las filas que están en pantalla.
// Sin esto, abrir el inbox con 339 chats disparaba ~104 descargas de golpe (5,9 MB) y, como
// el navegador solo abre 6 conexiones por dominio, los toques del usuario quedaban EN COLA
// detrás de las fotos → "aprieto Calendario y no pasa nada" (medido 11-08-2026).
export function Avatar({ src, size = 44, prioritaria = false }: { src?: string | null; size?: number; prioritaria?: boolean }) {
  const [err, setErr] = useState(false)
  useEffect(() => { setErr(false) }, [src]) // si cambia la foto, reintenta
  const mostrarFoto = !!src && !err
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
      background: '#CFD9DE', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {mostrarFoto
        ? <img src={src!} alt="" onError={() => setErr(true)}
            loading={prioritaria ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={prioritaria ? 'auto' : 'low'}
            width={size} height={size}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        : <User size={Math.round(size * 0.62)} color="#FFFFFF" fill="#FFFFFF" strokeWidth={0} />}
    </div>
  )
}
