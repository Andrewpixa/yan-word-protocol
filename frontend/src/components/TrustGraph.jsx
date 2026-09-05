import React, { useMemo, useState } from 'react'
import { ethers } from 'ethers'
import { STATUS, displayShort } from '../services/chain'

const ALL = 'all'

export default function TrustGraph({ vows, brokenFlashId }) {
  const sorted = useMemo(
    () => [...(vows || [])].sort((a, b) => Number(b.id) - Number(a.id)),
    [vows],
  )

  // null = 跟随最新一条；用户选「全部」或某条后会固定下来
  const [selectedId, setSelectedId] = useState(null)

  const effectiveId = useMemo(() => {
    if (sorted.length === 0) return ALL
    const latest = String(sorted[0].id)
    if (selectedId == null) return latest
    if (selectedId === ALL) return ALL
    if (sorted.some((v) => String(v.id) === String(selectedId))) return String(selectedId)
    return latest
  }, [sorted, selectedId])

  const focusedVows = useMemo(() => {
    if (effectiveId === ALL) return sorted
    return sorted.filter((v) => String(v.id) === String(effectiveId))
  }, [sorted, effectiveId])

  const selectedVow =
    effectiveId === ALL ? null : sorted.find((v) => String(v.id) === String(effectiveId)) || null

  const { nodes, edges } = useMemo(() => buildGraph(focusedVows), [focusedVows])

  const width = 640
  const height = 520
  const cx = width / 2
  const cy = height / 2
  const radius = Math.min(width, height) * 0.32

  const placed = nodes.map((node, i) => {
    const angle = nodes.length === 0 ? 0 : (Math.PI * 2 * i) / nodes.length - Math.PI / 2
    return {
      ...node,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    }
  })
  const byId = Object.fromEntries(placed.map((n) => [n.id, n]))

  return (
    <div className="yan-graph" style={styles.wrap}>
      <div style={styles.caption}>担保图谱</div>
      <div style={styles.pickerRow}>
        <label style={styles.pickerLabel} htmlFor="yan-graph-vow">
          展示言约
        </label>
        <select
          id="yan-graph-vow"
          className="yan-select"
          style={styles.picker}
          value={effectiveId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={sorted.length === 0}
        >
          <option value={ALL}>全部言约（总览）</option>
          {sorted.map((v) => (
            <option key={v.id} value={String(v.id)}>
              #{v.id} · {STATUS[v.status] || ''} · {summarize(v.statement)}
            </option>
          ))}
        </select>
      </div>
      {selectedVow && (
        <div style={styles.focusHint} title={selectedVow.statement || ''}>
          当前：#{selectedVow.id} {STATUS[selectedVow.status]}
          {selectedVow.statement ? ` · ${selectedVow.statement}` : ''}
        </div>
      )}
      {effectiveId === ALL && sorted.length > 0 && (
        <div style={styles.focusHint}>总览 · {sorted.length} 条言约叠在同一张图</div>
      )}
      <svg viewBox={`0 0 ${width} ${height}`} className="yan-graph-svg" style={styles.svg}>
        <defs>
          <radialGradient id="glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#d4af37" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#d4af37" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r={radius + 70} fill="url(#glow)" />
        {placed.length === 0 && (
          <text x={cx} y={cy} textAnchor="middle" fill="#8a8376" fontSize="16">
            {sorted.length === 0
              ? '还没有言约。没有第二个人，合约不开工。'
              : '这条言约还没有担保或看衰关系'}
          </text>
        )}
        {edges.map((e) => {
          const from = byId[e.from]
          const to = byId[e.to]
          if (!from || !to) return null
          const broken = e.kind === 'broken' || (e.vowId === brokenFlashId && e.kind === 'guarantee')
          return (
            <line
              key={`${e.from}-${e.to}-${e.kind}-${e.vowId}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={broken ? '#ff4d4d' : e.color}
              strokeWidth={broken ? 4 : e.width}
              strokeDasharray={e.dashed ? '7 7' : undefined}
              opacity={broken ? 1 : 0.9}
              className={broken ? 'edge-break' : undefined}
            />
          )
        })}
        {placed.map((n) => (
          <g key={n.id} transform={`translate(${n.x}, ${n.y})`}>
            <circle r="28" fill="#111118" stroke={n.color} strokeWidth="2.5" />
            <text y="4" textAnchor="middle" fill="#f4efe4" fontSize="11" fontWeight="600">
              {n.label}
            </text>
          </g>
        ))}
      </svg>
      <div style={{ ...styles.legend, flexWrap: 'wrap' }}>
        <span><i style={{ ...styles.dot, background: '#d4af37' }} />担保</span>
        <span><i style={{ ...styles.dot, background: '#7aa2ff' }} />看衰</span>
        <span><i style={{ ...styles.dot, background: '#ff4d4d' }} />食言断裂</span>
      </div>
    </div>
  )
}

function summarize(statement, max = 18) {
  const text = String(statement || '').trim() || '（未写承诺）'
  if (text.length <= max) return text
  return `${text.slice(0, max)}…`
}

function buildGraph(vows) {
  const nodeMap = new Map()
  const edges = []

  const addNode = (address, color) => {
    if (!address || address === ethers.ZeroAddress) return
    const id = address.toLowerCase()
    if (!nodeMap.has(id)) {
      nodeMap.set(id, { id, address, label: displayShort(address), color: color || '#d4af37' })
    }
  }

  for (const v of vows) {
    addNode(v.maker, '#d4af37')
    addNode(v.guarantor, '#e8d48b')
    for (const f of v.fades || []) addNode(f.better, '#7aa2ff')

    if (v.guarantor && v.guarantor !== ethers.ZeroAddress) {
      edges.push({
        from: v.guarantor.toLowerCase(),
        to: v.maker.toLowerCase(),
        kind: v.status === 4 ? 'broken' : 'guarantee',
        color: v.status === 3 ? '#d4af37' : '#c4a574',
        width: 3,
        vowId: v.id,
      })
    }
    for (const f of v.fades || []) {
      edges.push({
        from: f.better.toLowerCase(),
        to: v.maker.toLowerCase(),
        kind: 'fade',
        color: '#7aa2ff',
        width: 2,
        dashed: true,
        vowId: v.id,
      })
    }
  }

  return { nodes: [...nodeMap.values()], edges }
}

const styles = {
  wrap: {
    background: 'linear-gradient(180deg, rgba(18,18,24,0.95), rgba(10,10,14,0.95))',
    border: '1px solid rgba(212,175,55,0.18)',
    borderRadius: 18,
    padding: '16px 16px 12px',
    minHeight: 560,
  },
  caption: {
    fontFamily: '"Cormorant Garamond", serif',
    fontSize: 22,
    letterSpacing: 4,
    color: '#d4af37',
    textAlign: 'center',
  },
  pickerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    marginBottom: 6,
  },
  pickerLabel: {
    flex: '0 0 auto',
    color: '#9a9488',
    fontSize: 12,
    letterSpacing: 1,
  },
  picker: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    padding: '8px 10px',
  },
  focusHint: {
    color: '#8a8376',
    fontSize: 12,
    lineHeight: 1.45,
    marginBottom: 4,
    padding: '0 2px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  svg: {
    width: '100%',
    height: 500,
    display: 'block',
  },
  legend: {
    display: 'flex',
    justifyContent: 'center',
    gap: 18,
    color: '#9a9488',
    fontSize: 12,
  },
  dot: {
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: 99,
    marginRight: 6,
  },
}
