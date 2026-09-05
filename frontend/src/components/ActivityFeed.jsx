import React from 'react'
import { shortAddr, txUrl } from '../services/chain'

const ACCENT = {
  发起言约: '#d4af37',
  我信他: '#d4af37',
  赌你做不到: '#7aa2ff',
  食言结算: '#ff8a8a',
  守诺结算: '#6ee7b7',
  确认未完成: '#ff8a8a',
  提交证据: '#6ee7b7',
  链上还款: '#6ee7b7',
  主张守诺: '#6ee7b7',
  裁判守诺: '#6ee7b7',
  裁判食言: '#ff8a8a',
  结算尝试: '#ffb080',
  今日签到: '#6ee7b7',
  签到并上链证据: '#6ee7b7',
  日签打卡: '#6ee7b7',
  授权日签: '#cfc6b8',
  授权言币: '#cfc6b8',
  快进一天: '#e8d48b',
  快进两天: '#e8d48b',
  链上连发汇总: '#d4af37',
  领取测试YAN: '#d4af37',
}

function accentFor(label) {
  if (ACCENT[label]) return ACCENT[label]
  if (String(label).startsWith('脉冲')) return '#d4af37'
  if (String(label).includes('领取')) return '#d4af37'
  return '#d4af37'
}

export default function ActivityFeed({ items }) {
  return (
    <div style={styles.wrap}>
      <div style={styles.title}>近日链上动作</div>
      {items.length === 0 && (
        <div style={styles.empty}>
          担保、看衰、结算上链后会出现在这里；刷新页面会从合约事件重建。点开可跳转 Explorer。
        </div>
      )}
      <ul style={styles.list}>
        {items.map((item, i) => (
          <li
            key={item.id}
            className={`activity-item${i === 0 ? ' activity-item--0' : ''}`}
            style={styles.item}
          >
            <div style={styles.row}>
              <span style={{ ...styles.label, color: accentFor(item.label) }}>{item.label}</span>
              <span style={styles.time}>{item.time}</span>
            </div>
            {(item.actor || item.detail) && (
              <div style={styles.meta}>
                {item.actor ? item.actor : ''}
                {item.actor && item.detail ? ' · ' : ''}
                {item.detail || ''}
              </div>
            )}
            {item.hash ? (
              <a
                href={txUrl(item.hash)}
                target="_blank"
                rel="noreferrer"
                className="activity-hash"
                style={styles.link}
              >
                Explorer {shortAddr(item.hash)} ↗
              </a>
            ) : (
              <span style={styles.noHash}>无哈希</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

const styles = {
  wrap: {
    marginTop: 18,
    borderTop: '1px solid rgba(255,255,255,0.06)',
    paddingTop: 14,
  },
  title: {
    fontSize: 14,
    color: '#d4af37',
    letterSpacing: 2,
    marginBottom: 10,
  },
  empty: { color: '#6e685c', fontSize: 12, lineHeight: 1.6 },
  list: {
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    maxHeight: 280,
    overflowY: 'auto',
  },
  item: {
    background: '#0a0a10',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: '10px 12px',
  },
  row: { display: 'flex', justifyContent: 'space-between', gap: 8 },
  label: { fontSize: 13, fontWeight: 600 },
  time: { color: '#6e685c', fontSize: 11, flex: '0 0 auto' },
  meta: { marginTop: 4, color: '#9a9488', fontSize: 12 },
  link: {
    display: 'inline-block',
    marginTop: 6,
    color: '#d4af37',
    fontSize: 12,
    textDecoration: 'none',
  },
  noHash: { display: 'inline-block', marginTop: 6, color: '#6e685c', fontSize: 11 },
}
