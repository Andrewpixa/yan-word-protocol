import React, { useState } from 'react'

const CARDS = [
  {
    id: 'problem',
    title: '问题',
    summary: '发誓很容易',
    detail: '网上发誓很容易，爽约也没代价。',
  },
  {
    id: 'method',
    title: '做法',
    summary: '立约要有人押',
    detail: '谁都能立约；别人可以押「我信你」或「你做不到」。',
  },
  {
    id: 'result',
    title: '结果',
    summary: '食言，边断了',
    detail: '做不到，钱当场分走——担保图谱上的边断裂。',
  },
]

export default function IntroGate({ onEnter }) {
  const [openId, setOpenId] = useState(null)
  const [leaving, setLeaving] = useState(false)

  function enter() {
    if (leaving) return
    setLeaving(true)
    window.setTimeout(() => onEnter(), 520)
  }

  return (
    <div className={`intro-gate${leaving ? ' intro-gate--leaving' : ''}`} style={styles.page}>
      <div style={styles.glow} />

      <button
        type="button"
        className="intro-seal"
        onClick={enter}
        style={styles.sealBtn}
        aria-label="点击进入协议"
      >
        <span style={styles.sealMark}>言</span>
        <span style={styles.sealHint}>点击进入</span>
      </button>

      <h1 style={styles.title}>没有人担保，合约不开工。</h1>
      <p style={styles.sub}>
        立约必须有人押「我信你」。也可以有人押「你做不到」。
      </p>

      <div className="intro-cards" style={styles.cards}>
        {CARDS.map((card) => {
          const open = openId === card.id
          return (
            <button
              key={card.id}
              type="button"
              className="intro-card"
              onClick={() => setOpenId(open ? null : card.id)}
              style={{
                ...styles.card,
                ...(open ? styles.cardOpen : {}),
              }}
            >
              <div style={styles.cardTitle}>{card.title}</div>
              <div style={styles.cardSummary}>{open ? card.detail : card.summary}</div>
              <div style={styles.cardCue}>{open ? '收起' : '点开'}</div>
            </button>
          )
        })}
      </div>

      <button type="button" className="yan-btn intro-enter" onClick={enter} style={styles.enterBtn} disabled={leaving}>
        进入协议
      </button>

      <p style={styles.monad}>
        为什么是 Monad：日签钥匙少弹窗，便宜确认让天天打卡成立。
      </p>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px 48px',
    position: 'relative',
    overflow: 'hidden',
    background: 'radial-gradient(900px 480px at 50% 18%, #1a1408 0%, #07070a 58%)',
  },
  glow: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(212,175,55,0.16) 0%, transparent 70%)',
    top: '12%',
    pointerEvents: 'none',
  },
  sealBtn: {
    width: 108,
    height: 108,
    borderRadius: '50%',
    border: '1px solid #d4af37',
    background: 'rgba(12,12,16,0.92)',
    color: '#d4af37',
    display: 'grid',
    placeItems: 'center',
    gap: 2,
    boxShadow: '0 0 36px rgba(212,175,55,0.18)',
    zIndex: 1,
  },
  sealMark: {
    fontFamily: '"Cormorant Garamond", serif',
    fontSize: 44,
    lineHeight: 1,
    letterSpacing: 4,
  },
  sealHint: {
    fontSize: 11,
    color: '#8a8376',
    letterSpacing: 2,
  },
  title: {
    marginTop: 28,
    fontFamily: '"Cormorant Garamond", serif',
    fontSize: 'clamp(28px, 4vw, 42px)',
    letterSpacing: 4,
    color: '#f4efe4',
    textAlign: 'center',
    maxWidth: 720,
    zIndex: 1,
  },
  sub: {
    marginTop: 12,
    color: '#9a9488',
    fontSize: 15,
    lineHeight: 1.7,
    textAlign: 'center',
    maxWidth: 520,
    zIndex: 1,
  },
  cards: {
    marginTop: 36,
    zIndex: 1,
  },
  card: {
    textAlign: 'left',
    background: 'rgba(12,12,16,0.9)',
    border: '1px solid rgba(212,175,55,0.16)',
    borderRadius: 14,
    padding: '16px 14px',
    color: '#f4efe4',
    minHeight: 128,
    transition: 'border-color 0.2s ease, transform 0.2s ease',
  },
  cardOpen: {
    borderColor: 'rgba(212,175,55,0.55)',
    transform: 'translateY(-2px)',
  },
  cardTitle: {
    color: '#d4af37',
    fontSize: 13,
    letterSpacing: 3,
    marginBottom: 8,
  },
  cardSummary: {
    color: '#cfc6b8',
    fontSize: 13,
    lineHeight: 1.65,
    minHeight: 44,
  },
  cardCue: {
    marginTop: 12,
    fontSize: 11,
    color: '#6e685c',
  },
  enterBtn: {
    marginTop: 32,
    background: 'linear-gradient(90deg, #d4af37, #b8922a)',
    color: '#111',
    border: 'none',
    padding: '14px 36px',
    borderRadius: 10,
    fontWeight: 700,
    fontSize: 15,
    letterSpacing: 2,
    zIndex: 1,
  },
  monad: {
    marginTop: 18,
    color: '#8a8376',
    fontSize: 12,
    zIndex: 1,
  },
}
