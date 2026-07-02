'use client'

import { useState, useEffect } from 'react'
import { User } from 'lucide-react'

// Avatar del contacto: muestra la foto de perfil si existe; si no hay o no carga,
// muestra el círculo gris con silueta blanca, igual que WhatsApp.
export function Avatar({ src, size = 44 }: { src?: string | null; size?: number }) {
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
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        : <User size={Math.round(size * 0.62)} color="#FFFFFF" fill="#FFFFFF" strokeWidth={0} />}
    </div>
  )
}
