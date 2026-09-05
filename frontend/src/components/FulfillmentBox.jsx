import React from 'react'
import {
  KIND_LABEL,
  displayName,
  formatYan,
  sameAddr,
} from '../services/chain'
import EvidenceUploadBox from './EvidenceUploadBox'

/**
 * 按 kind + verifyMode 展示履约区：签到 / 上传图片 / 链上还款。
 * 非立约人也看得到模块，但不能操作。
 */
export default function FulfillmentBox({
  vow,
  me,
  epoch = 0,
  epochLen = 86400,
  activities = [],
  busy,
  confirmingAction,
  evidenceDraft,
  onEvidenceDraftChange,
  onCheckIn,
  onSubmitEvidence,
  onFulfillPay,
  compact = false,
}) {
  const isMaker = Boolean(me) && sameAddr(me, vow.maker)
  const isDaily = (vow.kind || 0) === 0
  const isDeadline = vow.kind === 1
  const needsEvidence = vow.verifyMode === 1
  const isPay = vow.verifyMode === 2
  const pending = vow.status === 1
  const active = vow.status === 2
  const closed = vow.status >= 3
  const evidenceCount = vow.evidenceCount || (vow.evidences || []).length
  const alreadyChecked =
    isDaily && Number(epoch) > 0 && Number(vow.lastCheckEpoch) === Number(epoch)
  const alreadyDone = isDeadline && Number(vow.daysChecked) >= Number(vow.daysRequired)
  const missed = Boolean(vow.pastDue)
  const actionBusy = (action) => confirmingAction === action
  const btnCls = (action) => `yan-btn${actionBusy(action) ? ' is-busy' : ''}`
  const labelFor = (action, fallback) => (actionBusy(action) ? '确认中…' : fallback)

  if (vow.status === 0) return null
  if (closed && !(needsEvidence && evidenceCount > 0) && !isPay) return null

  const canDailyEvidence = active && isMaker && isDaily && needsEvidence
  const canDeadlineEvidence = active && isMaker && isDeadline && needsEvidence
  const showEvidence =
    needsEvidence && (canDailyEvidence || canDeadlineEvidence || evidenceCount > 0 || pending || active)

  if (isPay) {
    const paid = formatYan(vow.paidAmount || 0n)
    const need = formatYan(vow.payAmount || 0n)
    const canPay = active && isMaker
    return (
      <section className="yan-fulfill" style={{ ...styles.box, ...styles.boxPay, ...(compact ? styles.compact : {}) }}>
        <div style={styles.head}>
          <span style={{ ...styles.title, color: '#93c5fd' }}>履约 · 链上还款</span>
          <span style={{ ...styles.badge, color: '#1e3a8a', background: 'rgba(147, 197, 253, 0.35)' }}>
            合约验收
          </span>
        </div>
        <div style={styles.meta}>
          还给 {displayName(vow.payee)} · 已付 {paid}/{need} YAN
        </div>
        {statusLine({ pending, active, closed, isMaker, maker: vow.maker, verb: '还款' })}
        <RecordList vow={vow} activities={activities} />
        {canPay && (
          <button
            type="button"
            disabled={busy}
            onClick={onFulfillPay}
            className={btnCls('fulfillPay')}
            style={styles.payCta}
          >
            {labelFor('fulfillPay', `还款 ${need} YAN`)}
          </button>
        )}
        <div style={styles.gas}>需授权 YAN，并付少量 MON Gas。不额外扣押金。</div>
      </section>
    )
  }

  if (showEvidence) {
    return (
      <div className="yan-fulfill">
        {statusLine({
          pending,
          active,
          closed,
          isMaker,
          maker: vow.maker,
          verb: '上传证据',
        })}
        {isDaily ? <DayTrack daysChecked={vow.daysChecked} daysRequired={vow.daysRequired} /> : null}
        <RecordList vow={vow} activities={activities} />
        <EvidenceUploadBox
          compact={compact}
          draft={evidenceDraft}
          onDraftChange={onEvidenceDraftChange}
          busy={busy}
          confirmingAction={confirmingAction}
          evidences={vow.evidences || []}
          showDailyCheckIn={canDailyEvidence}
          showDeadlineSubmit={canDeadlineEvidence}
          onCheckIn={onCheckIn}
          onSubmitEvidence={onSubmitEvidence}
          pickEnabled={canDailyEvidence || canDeadlineEvidence}
        />
      </div>
    )
  }

  const canPunch =
    active && isMaker && !alreadyChecked && !alreadyDone && !missed && !needsEvidence && !isPay
  const kindName = KIND_LABEL[vow.kind || 0]
  const progress = `${vow.daysChecked}/${vow.daysRequired}${isDeadline ? ' 天期限' : ' 天签到'}`

  let stateText = ''
  if (pending) stateText = isMaker ? '等待别人担保后，即可在此签到。' : '担保开工后，立约人可在此签到。'
  else if (closed) stateText = '本条已结束。'
  else if (!isMaker) stateText = `仅立约人 ${displayName(vow.maker)} 可签到。切换该钱包后操作。`
  else if (alreadyChecked) stateText = '今日已签到，明天再来。'
  else if (alreadyDone) stateText = '已确认完成。'
  else if (missed)
    stateText = '已错过当天签到窗口，这条不能再签，可能被食言结算。'
  else
    stateText = isDeadline
      ? '截止前点一次即可验收。'
      : '今天还没签到。当天结束前点「今日签到」即可。'

  return (
    <section className="yan-fulfill" style={{ ...styles.box, ...(compact ? styles.compact : {}) }}>
      <div style={styles.head}>
        <span style={styles.title}>履约 · {kindName}</span>
        <span style={styles.badge}>上链打卡</span>
      </div>
      <div style={styles.meta}>{progress}</div>
      <DayTrack daysChecked={vow.daysChecked} daysRequired={vow.daysRequired} />
      <RecordList vow={vow} activities={activities} />
      <p style={styles.help}>{stateText}</p>
      {canPunch && (
        <button
          type="button"
          disabled={busy}
          onClick={onCheckIn}
          className={btnCls('checkIn')}
          style={styles.checkCta}
        >
          {labelFor('checkIn', isDeadline ? '到期确认完成' : '今日签到')}
        </button>
      )}
      {!canPunch && active && isMaker && !missed && (alreadyChecked || alreadyDone) && (
        <div style={styles.doneChip}>{alreadyChecked ? '今日已签到' : '已确认完成'}</div>
      )}
      <div style={styles.gas}>钱包确认后消耗少量 MON Gas，不扣 YAN。</div>
    </section>
  )
}

function matchesVow(item, vowId) {
  if (item?.vowId === vowId) return true
  return String(item?.detail || '').includes(`#${vowId}`)
}

function DayTrack({ daysChecked, daysRequired }) {
  const need = Math.max(0, Number(daysRequired) || 0)
  const done = Math.min(need, Number(daysChecked) || 0)
  if (need <= 0) return null
  return (
    <div style={styles.track} aria-label={`已签 ${done}/${need}`}>
      {Array.from({ length: need }, (_, i) => (
        <span
          key={i}
          style={{
            ...styles.dot,
            ...(i < done ? styles.dotOn : styles.dotOff),
          }}
          title={i < done ? `第 ${i + 1} 天已签` : `第 ${i + 1} 天未签`}
        />
      ))}
      <span style={styles.trackLabel}>已签 {done}/{need}</span>
    </div>
  )
}

function RecordList({ vow, activities }) {
  const rows = (activities || []).filter((item) =>
    matchesVow(item, vow.id) && /签到|打卡|证据|还款/.test(item.label || ''),
  )
  if (rows.length === 0 && Number(vow.daysChecked) === 0 && !(vow.evidences || []).length) {
    return <div style={styles.recordEmpty}>还没有履约记录。签到或上传证据后会出现在这里，右侧「近日链上动作」也能看到。</div>
  }
  return (
    <ul style={styles.recordList}>
      {Number(vow.daysChecked) > 0 && rows.length === 0 ? (
        <li style={styles.recordItem}>链上已记 {vow.daysChecked} 次签到</li>
      ) : null}
      {rows.map((item) => (
        <li key={item.id || item.hash} style={styles.recordItem}>
          <span style={styles.recordLabel}>{item.label}</span>
          {item.time ? <span style={styles.recordTime}>{item.time}</span> : null}
          {item.detail ? <span style={styles.recordDetail}>{item.detail}</span> : null}
        </li>
      ))}
    </ul>
  )
}

function statusLine({ pending, active, closed, isMaker, maker, verb }) {
  if (closed) return null
  if (pending) {
    return (
      <p style={styles.waitLine}>
        {isMaker ? `等待别人担保后，此处可${verb}。` : `担保开工后，立约人可${verb}。`}
      </p>
    )
  }
  if (active && !isMaker) {
    return (
      <p style={styles.waitLine}>
        {verb}由立约人 {displayName(maker)} 提交；切换该钱包后可操作。
      </p>
    )
  }
  return null
}

const styles = {
  box: {
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    border: '1px solid rgba(212, 175, 55, 0.32)',
    background: 'linear-gradient(180deg, rgba(40, 32, 12, 0.55) 0%, rgba(8, 12, 10, 0.4) 100%)',
  },
  boxPay: {
    border: '1px solid rgba(147, 197, 253, 0.28)',
    background: 'linear-gradient(180deg, rgba(16, 28, 48, 0.55) 0%, rgba(8, 12, 10, 0.4) 100%)',
  },
  compact: {
    marginTop: 10,
    padding: 12,
  },
  head: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  title: {
    color: '#e8d48b',
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: 0.5,
  },
  badge: {
    fontSize: 10,
    color: '#3f2f0c',
    background: 'rgba(212, 175, 55, 0.4)',
    padding: '2px 8px',
    borderRadius: 999,
    letterSpacing: 0.5,
  },
  meta: { color: '#c8c2b4', fontSize: 12, marginBottom: 6 },
  help: { margin: '0 0 10px', color: '#9a9488', fontSize: 12, lineHeight: 1.55 },
  waitLine: { margin: '0 0 8px', color: '#8a8376', fontSize: 12, lineHeight: 1.5 },
  gas: { marginTop: 8, color: '#6e685c', fontSize: 11, lineHeight: 1.45 },
  checkCta: {
    background: 'linear-gradient(90deg, #d4af37, #b8922a)',
    color: '#111',
    border: 'none',
    fontWeight: 600,
  },
  payCta: {
    background: 'linear-gradient(90deg, #60a5fa, #2563eb)',
    color: '#04111f',
    border: 'none',
    fontWeight: 600,
  },
  doneChip: {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 12,
    color: '#6ee7b7',
    border: '1px solid rgba(110, 231, 183, 0.28)',
  },
  track: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    margin: '4px 0 8px',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    display: 'inline-block',
  },
  dotOn: {
    background: '#e8d48b',
    boxShadow: '0 0 0 1px rgba(232, 212, 139, 0.35)',
  },
  dotOff: {
    background: 'transparent',
    border: '1px solid rgba(244, 239, 228, 0.28)',
  },
  trackLabel: { color: '#c8c2b4', fontSize: 11 },
  recordEmpty: {
    margin: '0 0 8px',
    color: '#8a8376',
    fontSize: 11,
    lineHeight: 1.5,
  },
  recordList: {
    margin: '0 0 8px',
    padding: 0,
    listStyle: 'none',
  },
  recordItem: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    color: '#c8c2b4',
    fontSize: 11,
    lineHeight: 1.5,
    padding: '3px 0',
    borderBottom: '1px solid rgba(244,239,228,0.06)',
  },
  recordLabel: { color: '#e8d48b', fontWeight: 600 },
  recordTime: { color: '#8a8376' },
  recordDetail: { color: '#9a9488' },
}
