import React, { useMemo } from 'react'
import { ethers } from 'ethers'
import { KIND_LABEL, STATUS, VERIFY_LABEL, displayName, formatYan } from '../services/chain'

function isAddr(addr) {
  return Boolean(addr) && addr !== ethers.ZeroAddress
}

function asWei(value) {
  try {
    return BigInt(value || 0)
  } catch {
    return 0n
  }
}

function fadeWei(vow) {
  return (vow.fades || []).reduce((sum, fade) => sum + asWei(fade.amount), 0n)
}

function settleNote(status) {
  if (status === 4) return '食言已结算：看衰按押金分走立约与担保'
  if (status === 3) return '守诺已结算：看衰池分给立约与担保'
  if (status === 2) return '履约中，尚未结算'
  if (status === 1) return '等待担保，合约尚未开工'
  return ''
}

export default function StakeLedger({ vows }) {
  const ordered = useMemo(
    () => [...(vows || [])].sort((a, b) => Number(b.id) - Number(a.id)),
    [vows],
  )

  const totals = useMemo(() => {
    let trust = 0n
    let fade = 0n
    let self = 0n
    let legs = 0
    let pending = 0
    let active = 0
    for (const vow of ordered) {
      if (vow.status === 1) pending += 1
      if (vow.status === 2) active += 1
      self += asWei(vow.stakeMaker)
      if (asWei(vow.stakeMaker) > 0n) legs += 1
      if (isAddr(vow.guarantor) && asWei(vow.stakeGuarantor) > 0n) {
        trust += asWei(vow.stakeGuarantor)
        legs += 1
      }
      const fades = vow.fades || []
      fade += fadeWei(vow)
      legs += fades.length
    }
    return { trust, fade, self, legs, pending, active, total: ordered.length }
  }, [ordered])

  return (
    <section className="yan-ledger" aria-labelledby="stake-ledger-title">
      <div className="yan-ledger-head">
        <h2 id="stake-ledger-title" className="yan-ledger-title">
          押注事实
        </h2>
        <p className="yan-ledger-totals">
          信 {formatYan(totals.trust)} YAN
          <span aria-hidden="true"> · </span>
          衰 {formatYan(totals.fade)} YAN
          <span aria-hidden="true"> · </span>
          自押 {formatYan(totals.self)} YAN
          <span aria-hidden="true"> · </span>
          {totals.legs} 笔
        </p>
      </div>

      <p className="yan-ledger-summary">
        链上共 <b>{totals.total}</b> 条言约
        <span aria-hidden="true"> · </span>
        <b>{totals.pending}</b> 条待担保（可点言约市场「我信他」开工）
        <span aria-hidden="true"> · </span>
        <b>{totals.active}</b> 条履约中
      </p>
      <p className="yan-ledger-hint">
        这里是钱的流水账：谁押了自己、谁押「我信你」、谁押「你做不到」。想担保别人，先看待担保行，再到左侧图谱下方的言约市场点「我信他」。
      </p>

      {ordered.length === 0 ? (
        <p className="yan-ledger-empty">还没有言约。有人发起立约后，会出现在这里，等待别人担保开工。</p>
      ) : (
        <ol className="yan-ledger-list">
          {ordered.map((vow) => (
            <VowLegs key={vow.id} vow={vow} />
          ))}
        </ol>
      )}
    </section>
  )
}

function VowLegs({ vow }) {
  const maker = displayName(vow.maker)
  const guarantor = isAddr(vow.guarantor) ? displayName(vow.guarantor) : ''
  const status = STATUS[vow.status] || '—'
  const note = settleNote(vow.status)
  const fades = vow.fades || []

  return (
    <li className={`yan-ledger-vow yan-ledger-vow--${vow.status}`}>
      <div className="yan-ledger-vow-h">
        <span className="yan-ledger-id">#{vow.id}</span>
        <span className={`status-pill status-pill--${vow.status}`}>{status}</span>
        <span className="yan-ledger-meta">
          {vow.statement ? `「${vow.statement}」 · ` : ''}
          {KIND_LABEL[vow.kind || 0]} · {VERIFY_LABEL[vow.verifyMode || 0]}
        </span>
        {note ? <span className="yan-ledger-settle">{note}</span> : null}
      </div>
      <ul className="yan-ledger-legs">
        {isAddr(vow.guarantor) && asWei(vow.stakeGuarantor) > 0n && (
          <Leg
            kind="trust"
            kindLabel="信"
            from={guarantor}
            fromAddr={vow.guarantor}
            to={maker}
            toAddr={vow.maker}
            amount={vow.stakeGuarantor}
          />
        )}
        {fades.map((fade, index) => (
          <Leg
            key={`${fade.better}-${index}`}
            kind="fade"
            kindLabel="衰"
            from={displayName(fade.better)}
            fromAddr={fade.better}
            to={maker}
            toAddr={vow.maker}
            amount={fade.amount}
            extra={fade.paid ? '已获赔' : ''}
          />
        ))}
        {asWei(vow.stakeMaker) > 0n && (
          <Leg
            kind="self"
            kindLabel="押"
            from={maker}
            fromAddr={vow.maker}
            self
            amount={vow.stakeMaker}
          />
        )}
        {!isAddr(vow.guarantor) && fades.length === 0 && (
          <li className="yan-ledger-waiting">已立约，尚无担保或看衰</li>
        )}
      </ul>
    </li>
  )
}

function Leg({ kind, kindLabel, from, fromAddr, to, toAddr, amount, extra, self }) {
  return (
    <li className={`yan-ledger-leg yan-ledger-leg--${kind}`}>
      <span className={`yan-ledger-kind yan-ledger-kind--${kind}`}>{kindLabel}</span>
      <span className="yan-ledger-from" title={fromAddr}>
        {from}
      </span>
      {self ? (
        <span className="yan-ledger-dir">自押</span>
      ) : (
        <>
          <span className="yan-ledger-dir" aria-hidden="true">
            →
          </span>
          <span className="yan-ledger-to" title={toAddr}>
            {to}
          </span>
        </>
      )}
      <span className="yan-ledger-amt">{formatYan(amount)} YAN</span>
      {extra ? <span className="yan-ledger-extra">{extra}</span> : null}
    </li>
  )
}
