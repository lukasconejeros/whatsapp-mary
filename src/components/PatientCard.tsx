'use client'

import { useState } from 'react'
import { Conversation, CHANNEL_CONFIG, CATEGORIA_ORDER, CATEGORIA_CONFIG } from '@/lib/types'

function timeAgo(ts: string | number): string {
  if (!ts) return ''
  const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts)
  const s = (Date.now() - d.getTime()) / 1000
  if (s < 60) return 'ahora'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

const HUE = ['#EC4899','#8B5CF6','#EC4899','#10B981','#F59E0B','#6366F1']
function avatarBg(name: string) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % HUE.length
  return HUE[Math.abs(h)]
}
function ini(n: string) { return n.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') }

const CHANNEL_DOT: Record<string, string> = {
  whatsapp: '#22C55E', instagram: '#A855F7', messenger: '#EC4899', tiktok: '#0F172A', unknown: '#94A3B8',
}

export default function PatientCard({ conv, selected, onSelect, onCategoriaChange }: {
  conv: Conversation; selected: boolean
  onSelect: () => void
  onCategoriaChange: (id: number, categoria: Conversation['categoria']) => void
}) {
  const [moving, setMoving] = useState(false)
  const ch = CHANNEL_CONFIG[conv.channel]

  async function move(e: React.ChangeEvent<HTMLSelectElement>) {
    e.stopPropagation()
    const categoria = e.target.value as Conversation['categoria']
    if (moving || categoria === conv.categoria) return
    setMoving(true)
    try {
      const r = await fetch(`/api/categoria/${conv.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoria }),
      })
      const d = await r.json()
      if (d.ok) onCategoriaChange(conv.id, categoria)
    } finally { setMoving(false) }
  }

  return (
    <div onClick={onSelect} role="button" tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onSelect() }}
      style={{ display:'block', padding:'10px 14px', background: selected ? '#FDE7F1' : 'transparent',
        borderBottom:'1px solid #FDE7F1', borderLeft: selected ? '2px solid #EC4899' : '2px solid transparent',
        cursor:'pointer', outline:'none', transition:'background .1s', width:'100%', textAlign:'left' }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = '#FFF4FA' }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
        <div style={{ width:34, height:34, borderRadius:'50%', background:avatarBg(conv.contact.name),
          color:'#fff', fontSize:11, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          {ini(conv.contact.name)}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:6, marginBottom:3 }}>
            <span style={{ fontSize:13, fontWeight:600, color:'#0F172A', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {conv.contact.name}
            </span>
            <span style={{ fontSize:11, color:'#94A3B8', whiteSpace:'nowrap', flexShrink:0 }}>
              {timeAgo(conv.lastMessage.createdAt || conv.updatedAt)}
            </span>
          </div>
          <p style={{ fontSize:12, color:'#475569', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:6 }}>
            {conv.lastMessage.content || '—'}
          </p>
          {conv.ctwaReferral && (
            <span style={{ display:'inline-block', fontSize:10, fontWeight:600, color:'#BE185D',
              background:'#FDE7F1', borderRadius:6, padding:'1px 6px', marginBottom:6 }}>
              📣 vino de anuncio
            </span>
          )}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#94A3B8' }}>
              <span style={{ width:5, height:5, borderRadius:'50%', background:CHANNEL_DOT[conv.channel], display:'inline-block', flexShrink:0 }}/>
              {ch.label}
            </span>
            <select value={conv.categoria} onChange={move} onClick={e => e.stopPropagation()} disabled={moving}
              title="Mover de columna"
              style={{ fontSize:11, color:'#B0708C', border:'1px solid #FAD1E5', borderRadius:6,
                background:'#fff', padding:'2px 4px', cursor: moving ? 'wait' : 'pointer', fontFamily:'inherit', opacity: moving ? 0.5 : 1, maxWidth:130 }}>
              {CATEGORIA_ORDER.map(cat => (
                <option key={cat} value={cat}>{CATEGORIA_CONFIG[cat].label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}
