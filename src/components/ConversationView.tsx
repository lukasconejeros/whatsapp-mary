'use client'

import { useEffect, useRef, useState } from 'react'
import { Conversation, Message, CHANNEL_CONFIG } from '@/lib/types'
import { Send, Smile, Mic, Trash2, Image as ImageIcon } from 'lucide-react'
import { ImageNote, AudioNote, VideoNote } from './MediaContent'
import { Avatar } from './Avatar'

const EMOJIS = ['😀','😃','😄','😁','😊','🙂','😉','😍','🥰','😘','😅','😂','🤣','😌','😎','🤩','🥳','😇','🤗','🤔','🙃','😢','😭','👍','👎','👏','🙏','💪','🎉','✨','🔥','❤️','💕','💖','💐','🌸','🎨','🖌️','👋','🙌','✅','❌','📅','📸','💬','⭐','😴','🤝']

// Elige un formato de grabación SOPORTADO por el navegador. Safari iOS (el de Mary)
// NO soporta webm: graba audio/mp4. Chrome/Android prefieren webm/opus. Devolver ''
// deja que el navegador elija su default.
function pickAudioMime(): string {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return ''
  for (const c of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/mpeg']) {
    if (MediaRecorder.isTypeSupported(c)) return c
  }
  return ''
}
function extDeMime(mt: string): string {
  if (mt.includes('mp4') || mt.includes('m4a') || mt.includes('aac')) return 'm4a'
  if (mt.includes('mpeg')) return 'mp3'
  if (mt.includes('ogg')) return 'ogg'
  return 'webm'
}

function fmt(ts: number | string) {
  const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts)
  return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}
function fmtDate(ts: number | string) {
  const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts)
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Ayer'
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
}

const CHANNEL_DOT: Record<string, string> = {
  whatsapp: '#22C55E', instagram: '#A855F7', messenger: '#EC4899', tiktok: '#0F172A', unknown: '#94A3B8',
}

// Placeholders genéricos que ponemos cuando no se pudo describir/transcribir un
// medio. Si el mensaje trae media Y el texto es solo un placeholder, no lo mostramos
// (ya se ve la foto/audio). Si trae una descripción o caption real, sí se muestra.
const PLACEHOLDER = /^(📷\s*foto|🎤\s*audio|🎥\s*video|🌟\s*sticker)$/i
function showText(m: Message): boolean {
  if (!m.content) return false
  if (m.media && PLACEHOLDER.test(m.content.trim())) return false
  return true
}

export default function ConversationView({ conv }: { conv: Conversation }) {
  const [msgs, setMsgs] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [redactando, setRedactando] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [grabando, setGrabando] = useState(false)
  const [segundos, setSegundos] = useState(0)
  const [sendError, setSendError] = useState('')
  const recRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const cancelRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedAtRef = useRef(0)
  const fotoInputRef = useRef<HTMLInputElement | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  // Al desmontar (cambiar de chat/volver), soltar micrófono, grabación y cronómetro
  // para que el micro no quede ENCENDIDO si Mary cambia de chat mientras graba.
  useEffect(() => () => {
    try { recRef.current?.stop() } catch { /* noop */ }
    streamRef.current?.getTracks().forEach(t => t.stop())
    if (timerRef.current) clearInterval(timerRef.current)
  }, [])
  const ch = CHANNEL_CONFIG[conv.channel]

  useEffect(() => {
    setLoading(true); setMsgs([])
    fetch(`/api/conversations/${conv.id}`).then(r=>r.json()).then(d=>{ if(d.ok) setMsgs(d.messages) }).finally(()=>setLoading(false))
  }, [conv.id])

  // Chat EN VIVO: refresca los mensajes cada 7s para ver lo que responde el apoderado
  // sin tener que cerrar y reabrir el chat.
  useEffect(() => {
    const t = setInterval(() => {
      fetch(`/api/conversations/${conv.id}`).then(r=>r.json()).then(d=>{ if(d.ok) setMsgs(d.messages) }).catch(()=>{})
    }, 7000)
    return () => clearInterval(t)
  }, [conv.id])

  useEffect(() => { ref.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])


  // Toma la nota que Mary escribió en la caja y la convierte en un mensaje bonito
  // (con el nombre del apoderado y del niño). Deja el resultado en la caja, editable.
  async function redactarBonito() {
    const base = reply.trim()
    if (redactando) return
    if (!base) { setSendError('Primero escribe qué quieres decir (ej: "hoy hizo un cuadro precioso").'); return }
    setRedactando(true); setSendError('')
    try {
      const r = await fetch('/api/redactar', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: conv.id, texto: base }) })
      const d = await r.json()
      if (d.ok && d.mensaje) setReply(d.mensaje)
      else setSendError(d.error || 'No se pudo redactar')
    } catch {
      setSendError('No se pudo redactar. Revisa tu internet.')
    } finally {
      setRedactando(false)
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!reply.trim() || sending) return
    setSending(true); const text = reply.trim(); setReply('')
    const tmp: Message = { id: Date.now(), content: text, messageType: 1, senderName: 'Tú', senderType: 'human', createdAt: Date.now()/1000, isPrivate: false }
    setMsgs(p=>[...p,tmp])
    try {
      const r = await fetch('/api/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({conversationId:conv.id,message:text})})
      if(!r.ok){setMsgs(p=>p.filter(m=>m.id!==tmp.id));setReply(text);setSendError('No se pudo enviar, reintenta.')}
      else setSendError('')
    } catch { setMsgs(p=>p.filter(m=>m.id!==tmp.id));setReply(text);setSendError('No se pudo enviar. Revisa tu internet.') }
    finally { setSending(false) }
  }

  // NOTA DE VOZ al contacto (no necesita transcripción). Muestra que se está
  // grabando (con cronómetro), permite CANCELAR o ENVIAR al soltar.
  async function iniciarGrabacion() {
    if (grabando) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mime = pickAudioMime()
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      chunksRef.current = []
      cancelRef.current = false
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
        // Duración REAL medida por reloj (no por el estado, que puede ir atrasado).
        // Es la red de seguridad contra el "0:00": el servidor la usa si ffprobe falla
        // (típico con el mp4 fragmentado de Safari iOS).
        const durSeg = Math.max(1, Math.round((Date.now() - (startedAtRef.current || Date.now())) / 1000))
        setGrabando(false); setSegundos(0)
        if (cancelRef.current) { chunksRef.current = []; return } // cancelado: no se envía
        const tipo = rec.mimeType || mime || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: tipo })
        if (blob.size === 0) return
        setSending(true)
        try {
          const form = new FormData()
          form.append('conversationId', String(conv.id))
          form.append('file', blob, `nota-voz.${extDeMime(tipo)}`)
          form.append('segundos', String(durSeg))
          const d = await fetch('/api/send-media', { method: 'POST', body: form }).then(r => r.json())
          if (d.ok) {
            setSendError('')
            const tmp: Message = { id: Date.now(), content: '🎤 Audio', media: d.media, messageType: 1, senderName: 'Tú', senderType: 'human', createdAt: Date.now() / 1000, isPrivate: false }
            setMsgs(p => [...p, tmp])
          } else {
            setSendError('No se pudo enviar el audio, reintenta.')
          }
        } catch {
          setSendError('No se pudo enviar el audio, reintenta.')
        } finally { setSending(false) }
      }
      rec.start()
      recRef.current = rec
      startedAtRef.current = Date.now()
      setGrabando(true); setSegundos(0)
      timerRef.current = setInterval(() => setSegundos(s => s + 1), 1000)
    } catch {
      setGrabando(false)
    }
  }

  // Enviar una FOTO al contacto desde el chat. Reusa /api/send-media (rama imagen).
  async function enviarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // permite volver a elegir la misma foto
    if (!file) return
    if (!file.type.startsWith('image/')) { setSendError('Eso no es una imagen.'); return }
    setSending(true)
    try {
      const form = new FormData()
      form.append('conversationId', String(conv.id))
      form.append('file', file, file.name || 'foto.jpg')
      const d = await fetch('/api/send-media', { method: 'POST', body: form }).then(r => r.json())
      if (d.ok) {
        setSendError('')
        const tmp: Message = { id: Date.now(), content: '📷 Foto', media: d.media, messageType: 1, senderName: 'Tú', senderType: 'human', createdAt: Date.now() / 1000, isPrivate: false }
        setMsgs(p => [...p, tmp])
      } else {
        setSendError('No se pudo enviar la foto, reintenta.')
      }
    } catch {
      setSendError('No se pudo enviar la foto, reintenta.')
    } finally { setSending(false) }
  }
  function enviarGrabacion() { cancelRef.current = false; recRef.current?.stop() }
  function cancelarGrabacion() { cancelRef.current = true; recRef.current?.stop() }
  const mmss = `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`

  const grouped: { date: string; msgs: Message[] }[] = []
  msgs.filter(m=>!m.isPrivate&&m.content).forEach(m=>{
    const date=fmtDate(m.createdAt); const last=grouped[grouped.length-1]
    if(last?.date===date) last.msgs.push(m); else grouped.push({date,msgs:[m]})
  })

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', fontFamily:'inherit' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px', borderBottom:'1px solid #FDE7F1', background:'#fff', flexShrink:0 }}>
        <Avatar src={conv.contact.avatar} size={32} />
        <div style={{ flex:1, minWidth:0 }}>
          <p style={{ fontSize:13,fontWeight:600,color:'#0F172A',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{conv.contact.name}</p>
          <div style={{ display:'flex',alignItems:'center',gap:6,marginTop:2 }}>
            <span style={{ display:'inline-flex',alignItems:'center',gap:4,fontSize:11,color:'#94A3B8' }}>
              <span style={{width:5,height:5,borderRadius:'50%',background:CHANNEL_DOT[conv.channel] ?? ch.dot,display:'inline-block'}}/>
              {ch.label}
            </span>
            {conv.contact.phone && <span style={{fontSize:11,color:'#94A3B8'}}>{conv.contact.phone}</span>}
          </div>
        </div>
        <span style={{ display:'flex',alignItems:'center',gap:4,fontSize:11,fontWeight:500,padding:'4px 9px',borderRadius:8,border:'1px solid #FAD1E5',color: conv.botActive ? '#EC4899' : '#94A3B8',background:'#FFF4FA',flexShrink:0 }}>
          {conv.botActive ? '● Bot activo' : '○ Bot apagado'}
        </span>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'14px 16px', background:'#FFFFFF' }}>
        {loading ? (
          <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100%',gap:6,color:'#94A3B8' }}>
            <div style={{ width:13,height:13,border:'2px solid #FAD1E5',borderTopColor:'#EC4899',borderRadius:'50%',animation:'spin 0.6s linear infinite' }}/>
            <span style={{fontSize:12}}>Cargando...</span>
          </div>
        ) : grouped.length===0 ? (
          <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100%' }}>
            <p style={{fontSize:12,color:'#F7CFE1'}}>Sin mensajes</p>
          </div>
        ) : grouped.map(g=>(
          <div key={g.date}>
            <div style={{ display:'flex',alignItems:'center',gap:8,margin:'14px 0 10px' }}>
              <div style={{flex:1,height:1,background:'#FDE7F1'}}/>
              <span style={{fontSize:11,color:'#94A3B8',fontWeight:500}}>{g.date}</span>
              <div style={{flex:1,height:1,background:'#FDE7F1'}}/>
            </div>
            {g.msgs.map((m,i)=>{
              const isOut = m.messageType===1
              const showName = !isOut&&(i===0||g.msgs[i-1]?.messageType===1)
              return (
                <div key={m.id} style={{ display:'flex', justifyContent: isOut?'flex-end':'flex-start', marginBottom:3 }}>
                  <div style={{ maxWidth:'76%' }}>
                    {showName && <p style={{fontSize:11,color:'#94A3B8',marginBottom:3,marginLeft:2}}>{conv.contact.name.split(' ')[0]}</p>}
                    <div style={{ borderRadius:12, padding:'8px 12px', fontSize:13, lineHeight:1.55,
                      ...(isOut ? { background:'#EC4899', color:'#fff', borderBottomRightRadius:4 }
                               : { background:'#FFF4FA', color:'#0F172A', border:'1px solid #FAD1E5', borderBottomLeftRadius:4 }) }}>
                      {m.media && (
                        <div style={{ marginBottom: showText(m) ? 6 : 0 }}>
                          {/\.(ogg|opus|mp3|m4a)$/i.test(m.media)
                            ? <AudioNote src={m.media} />
                            : /\.(mp4|webm|mov|3gp)$/i.test(m.media)
                              ? <VideoNote src={m.media} />
                              : <ImageNote src={m.media} />}
                        </div>
                      )}
                      {showText(m) && <span style={{ whiteSpace:'pre-wrap' }}>{m.content}</span>}
                    </div>
                    <p style={{fontSize:10,color:'#E9A9CC',marginTop:3,textAlign:isOut?'right':'left',paddingInline:2}}>
                      {fmt(m.createdAt)}{isOut&&m.senderName&&m.senderName!=='Tú'&&` · ${m.senderName}`}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
        <div ref={ref}/>
      </div>

      <form onSubmit={send} style={{ display:'flex',flexDirection:'column',gap:6,padding:'10px 12px',background:'#fff',borderTop:'1px solid #FDE7F1',flexShrink:0 }}>
        {sendError && (
          <div style={{ display:'flex',alignItems:'center',gap:6,padding:'6px 10px',borderRadius:9,border:'1px solid #FCA5A5',background:'#FEF2F2',color:'#DC2626',fontSize:12 }}>
            <span style={{ flexShrink:0 }}>⚠</span>
            <span style={{ flex:1 }}>{sendError}</span>
            <button type="button" onClick={()=>setSendError('')} title="Ocultar" style={{ flexShrink:0,background:'none',border:'none',cursor:'pointer',color:'#DC2626',fontSize:14,lineHeight:1,padding:0 }}>×</button>
          </div>
        )}
        {!conv.botActive && (
          <div style={{ display:'flex',gap:6,flexWrap:'wrap' }}>
            <button type="button" onClick={redactarBonito} disabled={redactando}
              title="Escribe tu nota arriba y esto la convierte en un mensaje bonito con el nombre"
              style={{ display:'flex',alignItems:'center',gap:5,padding:'4px 10px',borderRadius:8,border:'1px solid #FBCFE8',background:'#FCE7F3',color:'#BE185D',fontSize:11,fontWeight:600,cursor:redactando?'wait':'pointer',opacity:redactando?0.6:1,fontFamily:'inherit' }}>
              {redactando ? '⟳ Redactando…' : '✨ Redactar bonito'}
            </button>
          </div>
        )}
        {grabando ? (
          <div style={{ display:'flex',alignItems:'center',gap:10,padding:'3px 2px' }}>
            <button type="button" onClick={cancelarGrabacion} title="Cancelar audio"
              style={{ width:40,height:40,borderRadius:'50%',border:'none',background:'#FEE2E2',color:'#DC2626',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
              <Trash2 size={17}/>
            </button>
            <div style={{ flex:1,display:'flex',alignItems:'center',gap:8,fontSize:14,fontWeight:600,color:'#DC2626' }}>
              <span className="pulse-red" style={{ width:10,height:10,borderRadius:'50%',background:'#DC2626',display:'inline-block',flexShrink:0 }}/>
              <span>Grabando…</span>
              <span style={{ marginLeft:'auto',color:'#9D174D',fontVariantNumeric:'tabular-nums' }}>{mmss}</span>
            </div>
            <button type="button" onClick={enviarGrabacion} title="Enviar audio"
              style={{ width:42,height:42,borderRadius:'50%',border:'none',background:'#EC4899',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,boxShadow:'0 4px 12px rgba(236,72,153,0.35)' }}>
              <Send size={16}/>
            </button>
          </div>
        ) : (
        <div style={{ display:'flex',alignItems:'flex-end',gap:8,position:'relative' }}>
          {showEmoji && (
            <div style={{ position:'absolute',bottom:42,left:0,background:'#fff',border:'1px solid #FAD1E5',borderRadius:12,padding:8,boxShadow:'0 8px 24px rgba(190,24,93,0.18)',display:'grid',gridTemplateColumns:'repeat(8, 1fr)',gap:2,width:290,maxHeight:190,overflowY:'auto',zIndex:20 }}>
              {EMOJIS.map(em => (
                <button key={em} type="button" onClick={()=>{setReply(r=>r+em)}}
                  style={{ fontSize:20,lineHeight:1.4,padding:2,background:'none',border:'none',cursor:'pointer',borderRadius:6 }}
                  onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='#FDE7F1'}
                  onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='none'}>{em}</button>
              ))}
            </div>
          )}
          <button type="button" onClick={()=>setShowEmoji(s=>!s)} title="Emojis"
            style={{ width:34,height:34,borderRadius:8,border:'1px solid #FAD1E5',background: showEmoji?'#FDE7F1':'#FFF4FA',color:'#EC4899',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
            <Smile size={17}/>
          </button>
          <input ref={fotoInputRef} type="file" accept="image/*" onChange={enviarFoto} style={{ display:'none' }} />
          <button type="button" onClick={()=>fotoInputRef.current?.click()} disabled={sending} title="Enviar foto"
            style={{ width:34,height:34,borderRadius:8,border:'1px solid #FAD1E5',background:'#FFF4FA',color: sending?'#F7CFE1':'#EC4899',cursor: sending?'default':'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
            <ImageIcon size={17}/>
          </button>
          <textarea value={reply} onChange={e=>setReply(e.target.value)}
            onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send(e as unknown as React.FormEvent)}}}
            placeholder="Escribe un mensaje..." rows={2}
            style={{ flex:1,resize:'none',borderRadius:8,padding:'8px 11px',fontSize:13,border:'1px solid #FAD1E5',background:'#FFF4FA',color:'#0F172A',outline:'none',fontFamily:'inherit',lineHeight:1.5 }}
            onFocus={e=>{e.target.style.borderColor='#EC4899';e.target.style.background='#fff'}}
            onBlur={e=>{e.target.style.borderColor='#FAD1E5';e.target.style.background='#FFF4FA'}}
          />
          {reply.trim() ? (
            <button type="submit" disabled={sending}
              style={{ width:38,height:38,borderRadius:'50%',border:'none',background:!sending?'#EC4899':'#FAD1E5',color:'#fff',cursor:!sending?'pointer':'default',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
              <Send size={15}/>
            </button>
          ) : (
            <button type="button" onClick={iniciarGrabacion} title="Grabar nota de voz"
              style={{ width:38,height:38,borderRadius:'50%',border:'none',background:'#EC4899',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
              <Mic size={17}/>
            </button>
          )}
        </div>
        )}
      </form>
    </div>
  )
}
