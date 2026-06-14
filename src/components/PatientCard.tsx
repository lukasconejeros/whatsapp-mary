'use client'

import { useState } from 'react'
import { Conversation, CHANNEL_CONFIG } from '@/lib/types'

function timeAgo(ts: string | number): string {
  if (!ts) return ''
  const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts)
  const s = (Date.now() - d.getTime()) / 1000
  if (s < 60) return 'ahora'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

const HUE = ['#3B82F6','#8B5CF6','#EC4899','#10B981','#F59E0B','#6366F1']
function avatarBg(name: string) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % HUE.length
  return HUE[Math.abs(h)]
}
function ini(n: string) { return n.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') }

const CHANNEL_DOT: Record<string, string> = {
  whatsapp: '#22C55E', instagram: '#A855F7', messenger: '#2563EB', tiktok: '#0F172A', unknown: '#94A3B8',
}

export default function PatientCard({ conv, selected, onSelect, onBotToggle }: {
  conv: Conversation; selected: boolean
  onSelect: () => void
  onBotToggle: (id: number, labels: string[], botActive: boolean) => void
}) {
  const [toggling, setToggling] = useState(false)
  const ch = CHANNEL_CONFIG[conv.channel]

  async function toggle(e: React.MouseEvent) {
    e.stopPropagation()
    if (toggling) return
    setToggling(true)
    try {
      const r = await fetch('/api/toggle-bot', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: conv.id, currentLabels: conv.labels }) })
      const d = await r.json()
      if (d.ok) onBotToggle(conv.id, d.labels, d.botActive)
    } finally { setToggling(false) }
  }

  return (
    <div onClick={onSelect} role="button" tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onSelect() }}
      style={{ display:'block', padding:'10px 14px', background: selected ? '#EFF6FF' : 'transparent',
        borderBottom:'1px solid #F1F5F9', borderLeft: selected ? '2px solid #2563EB' : '2px solid transparent',
        cursor:'pointer', outline:'none', transition:'background .1s', width:'100%', textAlign:'left' }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = '#F8FAFC' }}
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
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#94A3B8' }}>
              <span style={{ width:5, height:5, borderRadius:'50%', background:CHANNEL_DOT[conv.channel], display:'inline-block', flexShrink:0 }}/>
              {ch.label}
            </span>
            <button onClick={toggle} disabled={toggling} title={conv.botActive ? 'Apagar bot' : 'Activar bot'}
              style={{ display:'flex', alignItems:'center', gap:5, padding:'2px 6px', borderRadius:4,
                border:'1px solid #E2E8F0', background:'transparent', fontSize:11, fontWeight:500,
                color: conv.botActive ? '#2563EB' : '#94A3B8', cursor: toggling ? 'wait' : 'pointer', opacity: toggling ? 0.5 : 1 }}>
              <span style={{ display:'inline-flex', alignItems:'center', width:22, height:12, borderRadius:99,
                background: conv.botActive ? '#2563EB' : '#E2E8F0', padding:'1px', transition:'background .15s', flexShrink:0 }}>
                <span style={{ width:10, height:10, borderRadius:'50%', background:'#fff',
                  transform: conv.botActive ? 'translateX(10px)' : 'translateX(0)', transition:'transform .15s', display:'block' }}/>
              </span>
              {toggling ? '...' : conv.botActive ? 'Bot' : 'Off'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
