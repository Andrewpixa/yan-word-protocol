import React from 'react'

const STEPS = [
  {
    id: 1,
    title: '立约',
    actor: '钱包 A',
    detail: '发起一条言约，押上 YAN。',
  },
  {
    id: 2,
    title: '我信他',
    actor: '钱包 B',
    detail: '有人担保，合约才开工。',
  },
  {
    id: 3,
    title: '赌你做不到',
    actor: '钱包 C',
    detail: '旁人看衰，把钱押进看衰池。',
  },
  {
    id: 4,
    title: '时间走完',
    actor: '演示时钟',
    detail: '快进两天，模拟没来签到。',
  },
  {
    id: 5,
    title: '食言结算',
    actor: '协议',
    detail: '边断了，钱分给看衰的人。',
  },
]

export default function GuidedDemo({
  enabled,
  busy,
  step,
  onStart,
  onRunStep,
  onRestart,
}) {
  const done = step > STEPS.length
  const current = STEPS.find((s) => s.id === step)

  return (
    <div style={styles.wrap}>
      <div style={styles.head}>
        <div>
          <div style={styles.title}>分步演示 · 连续点击</div>
          <div style={styles.sub}>
            {enabled
              ? '每点一步，链上就执行一步。适合路演口述。'
              : '请先点顶部「使用演示模式」，再开始分步演示。'}
          </div>
        </div>
        {step === 0 && (
          <button
            type="button"
            disabled={!enabled || busy}
            onClick={onStart}
            className={`yan-btn${busy ? ' is-busy' : ''}`}
            style={{ ...styles.primary, ...(!enabled || busy ? styles.off : {}) }}
          >
            开始引导
          </button>
        )}
        {done && (
          <button
            type="button"
            disabled={!enabled || busy}
            onClick={onRestart}
            className={`yan-btn${busy ? ' is-busy' : ''}`}
            style={{ ...styles.primary, ...(!enabled || busy ? styles.off : {}) }}
          >
            再来一遍
          </button>
        )}
      </div>

      <ol style={styles.list}>
        {STEPS.map((s) => {
          const active = s.id === step
          const finished = step > s.id
          return (
            <li
              key={s.id}
              style={{
                ...styles.item,
                ...(active ? styles.itemActive : {}),
                ...(finished ? styles.itemDone : {}),
              }}
            >
              <div style={styles.num}>{finished ? '✓' : s.id}</div>
              <div style={styles.body}>
                <div style={styles.itemTitle}>
                  {s.title}
                  <span style={styles.actor}>{s.actor}</span>
                </div>
                <div style={styles.detail}>{s.detail}</div>
                {active && (
                  <button
                    type="button"
                    disabled={!enabled || busy}
                    onClick={() => onRunStep(s.id)}
                    style={{ ...styles.stepBtn, ...(!enabled || busy ? styles.off : {}) }}
                    className={`yan-btn${busy ? ' is-busy' : ''}`}
                  >
                    {busy ? '链上确认中…' : `点这里：执行「${s.title}」`}
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {done && (
        <div style={styles.done}>
          五步走完。看左侧图谱红边，以及「近日链上动作」里的哈希。
        </div>
      )}
    </div>
  )
}

const styles = {
  wrap: {
    border: '1px solid rgba(212,175,55,0.22)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    background: 'rgba(212,175,55,0.05)',
  },
  head: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  title: { color: '#d4af37', fontSize: 14, letterSpacing: 2, fontWeight: 700 },
  sub: { marginTop: 4, color: '#9a9488', fontSize: 12, lineHeight: 1.5 },
  list: {
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  item: {
    display: 'flex',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.06)',
    background: '#0a0a10',
    opacity: 0.72,
  },
  itemActive: {
    opacity: 1,
    borderColor: 'rgba(212,175,55,0.55)',
    boxShadow: '0 0 0 1px rgba(212,175,55,0.12)',
  },
  itemDone: {
    opacity: 0.9,
    borderColor: 'rgba(110,231,183,0.28)',
  },
  num: {
    width: 26,
    height: 26,
    borderRadius: '50%',
    border: '1px solid rgba(212,175,55,0.45)',
    color: '#d4af37',
    display: 'grid',
    placeItems: 'center',
    fontSize: 12,
    flex: '0 0 auto',
  },
  body: { flex: 1, minWidth: 0 },
  itemTitle: {
    color: '#f4efe4',
    fontSize: 13,
    fontWeight: 600,
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  actor: { color: '#8a8376', fontSize: 11, fontWeight: 400 },
  detail: { marginTop: 3, color: '#9a9488', fontSize: 12, lineHeight: 1.5 },
  stepBtn: {
    marginTop: 10,
    width: '100%',
    background: 'linear-gradient(90deg, #d4af37, #b8922a)',
    color: '#111',
    border: 'none',
    padding: '11px 14px',
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 14,
  },
  primary: {
    background: '#d4af37',
    color: '#111',
    border: 'none',
    padding: '8px 12px',
    borderRadius: 8,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  off: { opacity: 0.5, cursor: 'wait' },
  done: {
    marginTop: 10,
    color: '#e8d48b',
    fontSize: 13,
    lineHeight: 1.6,
  },
}
