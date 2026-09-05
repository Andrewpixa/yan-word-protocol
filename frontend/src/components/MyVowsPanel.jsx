import React, { useMemo } from 'react'
import { ethers } from 'ethers'
import {
  KIND_LABEL,
  STATUS,
  VERIFY_LABEL,
  displayName,
  formatYan,
  sameAddr,
} from '../services/chain'
import FulfillmentBox from './FulfillmentBox'

/**
 * 全部言约：列出链上所有言约；签到 / 上传证据仅立约人可操作。
 */
export default function MyVowsPanel({
  vows,
  me,
  epoch,
  epochLen,
  activities,
  connected,
  busy,
  pending,
  expandedId,
  onExpand,
  onCheckIn,
  onSubmitEvidence,
  onClaimKept,
  onFulfillPay,
  onScrollCreate,
  getEvidenceDraft,
  setEvidenceDraft,
  clearEvidenceDraft,
}) {
  const list = useMemo(
    () => [...(vows || [])].sort((a, b) => b.id - a.id),
    [vows],
  )

  return (
    <div id="my-vows" style={styles.wrap}>
      <div style={styles.head}>
        <h3 style={styles.title}>全部言约</h3>
        <span style={styles.count}>{list.length} 条</span>
      </div>
      <p style={styles.help}>
        链上所有言约一览。签到约会显示打卡按钮，证据约可在此选图上传；
        <b>签到 / 上传 / 主张守诺</b>仅立约人可操作。
      </p>

      {list.length === 0 ? (
        <div style={styles.emptyBox}>
          <div style={styles.emptyTitle}>链上还没有言约</div>
          <div style={styles.emptyBody}>任何人发起后都会出现在这里。</div>
          <button type="button" className="yan-btn" style={styles.cta} onClick={onScrollCreate}>
            去发起言约
          </button>
        </div>
      ) : (
        <div style={styles.list}>
          {list.map((vow) => (
            <VowRow
              key={vow.id}
              vow={vow}
              me={me}
              epoch={epoch}
              epochLen={epochLen}
              activities={activities}
              connected={connected}
              open={expandedId === vow.id}
              busy={busy}
              confirmingAction={pending?.vowId === vow.id ? pending.action : null}
              draft={getEvidenceDraft(vow.id)}
              onDraftChange={(next) => setEvidenceDraft(vow.id, next)}
              onToggle={() => onExpand(expandedId === vow.id ? null : vow.id)}
              onCheckIn={async () => {
                await onCheckIn(vow, getEvidenceDraft(vow.id))
                clearEvidenceDraft(vow.id)
              }}
              onSubmitEvidence={async () => {
                await onSubmitEvidence(vow, getEvidenceDraft(vow.id))
                clearEvidenceDraft(vow.id)
              }}
              onClaimKept={() => onClaimKept(vow)}
              onFulfillPay={() => onFulfillPay(vow)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function VowRow({
  vow,
  me,
  epoch,
  epochLen,
  activities,
  connected,
  open,
  busy,
  confirmingAction,
  draft,
  onDraftChange,
  onToggle,
  onCheckIn,
  onSubmitEvidence,
  onClaimKept,
  onFulfillPay,
}) {
  const isMaker = connected && sameAddr(me, vow.maker)
  const isDeadline = vow.kind === 1
  const needsEvidence = vow.verifyMode === 1
  const active = vow.status === 2
  const evidences = vow.evidences || []
  const actionBusy = (action) => confirmingAction === action
  const btnClsFor = (action) => `yan-btn${actionBusy(action) ? ' is-busy' : ''}`
  const labelFor = (action, fallback) => (actionBusy(action) ? '确认中…' : fallback)

  const canClaim =
    isMaker &&
    active &&
    needsEvidence &&
    evidences.length > 0 &&
    (isDeadline || vow.daysChecked >= vow.daysRequired)

  return (
    <div style={{ ...styles.card, ...(open ? styles.cardOpen : {}) }}>
      <button type="button" style={styles.rowBtn} onClick={onToggle} aria-expanded={open}>
        <span style={styles.rowLeft}>
          <span style={styles.id}>#{vow.id}</span>
          <span className={`status-pill status-pill--${vow.status}`}>{STATUS[vow.status]}</span>
          <span style={styles.statement}>{vow.statement || '（未写承诺）'}</span>
          <span style={styles.meta}>
            {displayName(vow.maker)}
            {isMaker ? ' · 我发起' : ''}
            {' · '}
            {KIND_LABEL[vow.kind || 0]} · {VERIFY_LABEL[vow.verifyMode || 0]}
          </span>
        </span>
        <span style={styles.rowRight}>
          {vow.daysChecked}/{vow.daysRequired}{' '}
          {isDeadline ? '天期限' : '天签到'}
          <span style={styles.chev}>{open ? '收起' : '展开'}</span>
        </span>
      </button>

      {open && (
        <div style={styles.detail}>
          <div style={styles.detailLine}>
            <b style={styles.quote}>{vow.statement || '（未写承诺）'}</b>
          </div>
          <div style={styles.detailLine}>
            立约人 {displayName(vow.maker)} · 押金 {formatYan(vow.stakeMaker)} YAN
            {vow.guarantor && vow.guarantor !== ethers.ZeroAddress
              ? ` · 担保人 ${displayName(vow.guarantor)}`
              : ' · 等待担保'}
            {vow.referee && vow.referee !== ethers.ZeroAddress
              ? ` · 裁判 ${displayName(vow.referee)}`
              : needsEvidence
                ? ' · 无裁判（可主张守诺）'
                : ''}
          </div>

          <FulfillmentBox
            vow={vow}
            me={connected ? me : ''}
            epoch={epoch}
            epochLen={epochLen}
            activities={activities}
            busy={busy}
            confirmingAction={confirmingAction}
            evidenceDraft={draft}
            onEvidenceDraftChange={onDraftChange}
            onCheckIn={onCheckIn}
            onSubmitEvidence={onSubmitEvidence}
            onFulfillPay={onFulfillPay}
          />

          <div style={styles.actions}>
            {canClaim && (
              <button
                type="button"
                disabled={busy}
                onClick={onClaimKept}
                className={btnClsFor('claimKept')}
                style={styles.secondary}
              >
                {labelFor('claimKept', '主张守诺')}
              </button>
            )}
            {vow.status === 1 && <span style={styles.wait}>等待别人担保后开工</span>}
            {vow.status >= 3 && <span style={styles.wait}>{STATUS[vow.status]}</span>}
            {active && !isMaker && !canClaim && (
              <span style={styles.wait}>履约中 · 只读</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  wrap: {
    marginTop: 18,
    padding: 16,
    borderRadius: 16,
    border: '1px solid rgba(212,175,55,0.22)',
    background: 'rgba(212,175,55,0.04)',
  },
  head: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    margin: 0,
    fontFamily: '"Cormorant Garamond", serif',
    fontSize: 22,
    letterSpacing: 2,
    color: '#d4af37',
  },
  count: { color: '#8a8376', fontSize: 12 },
  help: { color: '#9a9488', fontSize: 12, lineHeight: 1.6, margin: '8px 0 12px' },
  emptyBox: {
    padding: '16px 14px',
    borderRadius: 12,
    border: '1px dashed rgba(212,175,55,0.28)',
    color: '#9a9488',
    fontSize: 13,
    lineHeight: 1.6,
  },
  emptyTitle: { color: '#e8d48b', fontWeight: 600, marginBottom: 4 },
  emptyBody: { marginBottom: 12 },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  card: {
    borderRadius: 12,
    border: '1px solid rgba(244,239,228,0.1)',
    background: 'rgba(8,8,12,0.65)',
    overflow: 'hidden',
  },
  cardOpen: {
    borderColor: 'rgba(212,175,55,0.35)',
  },
  rowBtn: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: '12px 14px',
    background: 'transparent',
    border: 'none',
    color: '#f4efe4',
    cursor: 'pointer',
    textAlign: 'left',
  },
  rowLeft: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  rowRight: { color: '#9a9488', fontSize: 12, whiteSpace: 'nowrap' },
  id: { color: '#d4af37', fontWeight: 600 },
  statement: { color: '#e8d48b', fontSize: 13, fontWeight: 600 },
  quote: { color: '#e8d48b', fontWeight: 600 },
  meta: { color: '#8a8376', fontSize: 12 },
  chev: { marginLeft: 8, color: '#d4af37' },
  detail: { padding: '0 14px 14px', borderTop: '1px solid rgba(244,239,228,0.08)' },
  detailLine: { color: '#9a9488', fontSize: 12, marginTop: 10, lineHeight: 1.5 },
  muted: { color: '#6e685c', fontSize: 12, lineHeight: 1.5, marginTop: 8 },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  cta: {
    background: 'linear-gradient(90deg, #d4af37, #b8922a)',
    color: '#111',
    border: 'none',
    fontWeight: 600,
  },
  secondary: {
    background: 'transparent',
    color: '#e8d48b',
    border: '1px solid rgba(212,175,55,0.4)',
  },
  wait: { color: '#8a8376', fontSize: 12 },
}
