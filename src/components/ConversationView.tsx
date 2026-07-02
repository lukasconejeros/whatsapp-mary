'use client'

import { useEffect, useRef, useState } from 'react'
import { Conversation, Message, CHANNEL_CONFIG } from '@/lib/types'
import { Send, Smile } from 'lucide-react'

const EMOJIS = ['😀','😃','😄','😁','😊','🙂','😉','😍','🥰','😘','😅','😂','🤣','😌','😎','🤩','🥳','😇','🤗','🤔','🙃','😢','😭','👍','👎','👏','🙏','💪','🎉','✨','🔥','❤️','💕','💖','💐','🌸','🎨','🖌️','👋','🙌','✅','❌','📅','📸','💬','⭐','😴','🤝']

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

const AVATAR_COLORS = ['#EC4899','#8B5CF6','#F48FC0','#10B981','#F59E0B','#F43F5E']
function avatarBg(name: string) {
  let h = 0; for (const c of name) h = (h*31+c.charCodeAt(0)) % AVATAR_COLORS.length
  return AVATAR_COLORS[Math.abs(h)]
}
function ini(n: string) { return n.split(' ').filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join('') }

const CHANNEL_DOT: Record<string, string> = {
  whatsapp: '#22C55E', instagram: '#A855F7', messenger: '#EC4899', tiktok: '#0F172A', unknown: '#94A3B8',
}

export default function ConversationView({ conv }: { conv: Conversation }) {
  const [msgs, setMsgs] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const ch = CHANNEL_CONFIG[conv.channel]

  useEffect(() => {
    setLoading(true); setMsgs([])
    fetch(`/api/conversations/${conv.id}`).then(r=>r.json()).then(d=>{ if(d.ok) setMsgs(d.messages) }).finally(()=>setLoading(false))
  }, [conv.id])

  useEffect(() => { ref.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  async function suggest() {
    if (suggesting || msgs.length === 0) return
    setSuggesting(true)
    try {
      const r = await fetch('/api/suggest', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: msgs.slice(-10).map(m => ({ role: m.senderType === 'user' ? 'user' : 'assistant', content: m.content })), contactName: conv.contact.name }) })
      const d = await r.json()
      if (d.ok && d.suggestion) setReply(d.suggestion)
    } finally { setSuggesting(false) }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!reply.trim() || sending) return
    setSending(true); const text = reply.trim(); setReply('')
    const tmp: Message = { id: Date.now(), content: text, messageType: 1, senderName: 'Tú', senderType: 'human', createdAt: Date.now()/1000, isPrivate: false }
    setMsgs(p=>[...p,tmp])
    try {
      const r = await fetch('/api/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({conversationId:conv.id,message:text})})
      if(!r.ok){setMsgs(p=>p.filter(m=>m.id!==tmp.id));setReply(text)}
    } catch { setMsgs(p=>p.filter(m=>m.id!==tmp.id));setReply(text) }
    finally { setSending(false) }
  }

  const grouped: { date: string; msgs: Message[] }[] = []
  msgs.filter(m=>!m.isPrivate&&m.content).forEach(m=>{
    const date=fmtDate(m.createdAt); const last=grouped[grouped.length-1]
    if(last?.date===date) last.msgs.push(m); else grouped.push({date,msgs:[m]})
  })

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', fontFamily:'inherit' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px', borderBottom:'1px solid #FDE7F1', background:'#fff', flexShrink:0 }}>
        <div style={{ width:32,height:32,borderRadius:'50%',background:avatarBg(conv.contact.name),color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,flexShrink:0 }}>
          {ini(conv.contact.name)}
        </div>
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

      <div style={{ flex:1, overflowY:'auto', padding:'14px 16px', background:'#FFF4FA' }}>
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
                               : { background:'#FFFFFF', color:'#0F172A', border:'1px solid #FAD1E5', borderBottomLeftRadius:4 }) }}>
                      {m.content}
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
        {!conv.botActive && (
          <button type="button" onClick={suggest} disabled={suggesting}
            style={{ alignSelf:'flex-start',display:'flex',alignItems:'center',gap:5,padding:'4px 10px',borderRadius:8,border:'1px solid #FAD1E5',background:'#FDE7F1',color:'#EC4899',fontSize:11,fontWeight:500,cursor:suggesting?'wait':'pointer',opacity:suggesting?0.6:1,fontFamily:'inherit' }}>
            {suggesting ? '⟳ Pensando...' : '✦ Sugerir respuesta'}
          </button>
        )}
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
          <textarea value={reply} onChange={e=>setReply(e.target.value)}
            onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send(e as unknown as React.FormEvent)}}}
            placeholder="Escribe un mensaje..." rows={2}
            style={{ flex:1,resize:'none',borderRadius:8,padding:'8px 11px',fontSize:13,border:'1px solid #FAD1E5',background:'#FFF4FA',color:'#0F172A',outline:'none',fontFamily:'inherit',lineHeight:1.5 }}
            onFocus={e=>{e.target.style.borderColor='#EC4899';e.target.style.background='#fff'}}
            onBlur={e=>{e.target.style.borderColor='#FAD1E5';e.target.style.background='#FFF4FA'}}
          />
          <button type="submit" disabled={!reply.trim()||sending}
            style={{ width:34,height:34,borderRadius:8,border:'none',background:reply.trim()&&!sending?'#EC4899':'#FAD1E5',color:'#fff',cursor:reply.trim()&&!sending?'pointer':'default',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
            <Send size={13}/>
          </button>
        </div>
      </form>
    </div>
  )
}
