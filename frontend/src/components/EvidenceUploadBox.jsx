import React, { useRef, useState } from 'react'
import {
  MAX_EVIDENCE_FILE_BYTES,
  cacheEvidencePreview,
  fileToPreview,
  getEvidencePreview,
  hashFile,
  normalizeEvidenceDraft,
  resolveEvidenceHash,
  shortHash,
} from '../services/chain'

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'

/**
 * 选图 → 本地预览；keccak(文件字节) 上链（非整张图进合约）。
 */
export default function EvidenceUploadBox({
  draft,
  onDraftChange,
  busy,
  confirmingAction,
  evidences = [],
  showDailyCheckIn,
  showDeadlineSubmit,
  onCheckIn,
  onSubmitEvidence,
  compact = false,
  pickEnabled = true,
}) {
  const inputRef = useRef(null)
  const [pickErr, setPickErr] = useState('')
  const [picking, setPicking] = useState(false)
  const d = normalizeEvidenceDraft(draft)
  const hasProof = Boolean(d.hash || d.text.trim())
  const previewHash = hasProof ? shortHash(resolveEvidenceHash(d)) : null
  const actionBusy = (action) => confirmingAction === action
  const btnCls = (action) => `yan-btn${actionBusy(action) ? ' is-busy' : ''}`
  const labelFor = (action, fallback) => (actionBusy(action) ? '确认中…' : fallback)
  const canAct = showDailyCheckIn || showDeadlineSubmit

  async function onPick(file) {
    setPickErr('')
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setPickErr('请选择图片（jpg / png / webp / gif）')
      return
    }
    if (file.size > MAX_EVIDENCE_FILE_BYTES) {
      setPickErr('图片请小于 8MB')
      return
    }
    setPicking(true)
    try {
      const hash = await hashFile(file)
      const preview = await fileToPreview(file)
      cacheEvidencePreview(hash, preview)
      onDraftChange({ ...d, hash, preview, fileName: file.name })
    } catch (err) {
      setPickErr(err?.message || '读取图片失败')
    } finally {
      setPicking(false)
    }
  }

  function clearFile() {
    setPickErr('')
    onDraftChange({ ...d, hash: '', preview: '', fileName: '' })
  }

  return (
    <div
      className="yan-evidence-box"
      style={{ ...styles.box, ...(compact ? styles.boxCompact : {}) }}
    >
      <div style={styles.head}>
        <span style={styles.title}>上传证据</span>
        <span style={styles.badge}>图片哈希上链</span>
      </div>
      <p style={styles.help}>
        选一张完成截图。原图只在本地预览；上链的是文件 keccak 哈希，Explorer 可查。
        整张图进合约 Gas 会过高，不适合日签。
      </p>

      {evidences.length > 0 && (
        <ol style={styles.hashList}>
          {evidences.map((h, i) => {
            const thumb = getEvidencePreview(h)
            return (
              <li key={`${h}-${i}`} style={styles.hashItem}>
                {thumb ? (
                  <img src={thumb} alt={`证据 ${i + 1}`} style={styles.thumb} />
                ) : (
                  <span style={styles.thumbEmpty}>#{i + 1}</span>
                )}
                <code style={styles.hashCode} title={h}>
                  {h}
                </code>
                <span style={styles.hashShort}>{shortHash(h)}</span>
              </li>
            )
          })}
        </ol>
      )}

      {canAct ? (
        <>
          <div style={styles.pickRow}>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                onPick(file)
              }}
            />
            <button
              type="button"
              className="yan-btn"
              style={styles.pickBtn}
              disabled={busy || picking || !pickEnabled}
              onClick={() => inputRef.current?.click()}
            >
              {picking ? '处理图片…' : d.fileName ? '更换图片' : '选择图片'}
            </button>
            {d.fileName ? (
              <button type="button" className="yan-btn" style={styles.clearBtn} disabled={busy} onClick={clearFile}>
                清除
              </button>
            ) : null}
            <span style={styles.fileName}>{d.fileName || '未选图 · 也可只填说明'}</span>
          </div>

          {d.preview ? (
            <img className="yan-fulfill-preview" src={d.preview} alt="证据预览" style={styles.previewImg} />
          ) : null}

          {pickErr ? <div style={styles.err}>{pickErr}</div> : null}

          <label style={styles.label}>
            说明（选填）
            <input
              className="yan-input"
              style={styles.input}
              placeholder="例如：今日读完第 30 页"
              value={d.text}
              onChange={(e) => onDraftChange({ ...d, text: e.target.value })}
              disabled={busy}
            />
          </label>
          <div style={styles.preview}>
            {previewHash
              ? `将上链哈希：${previewHash}${d.hash ? ' · 来自图片' : ' · 来自说明'}`
              : '选图或填写说明后生成 keccak 哈希，钱包确认后写入链上'}
          </div>
          <div style={styles.gas}>钱包确认后消耗少量 MON Gas，不扣 YAN。</div>
          <div style={styles.actions}>
            {showDailyCheckIn && (
              <button
                type="button"
                disabled={busy || !hasProof}
                onClick={onCheckIn}
                className={btnCls('checkIn')}
                style={styles.cta}
              >
                {labelFor('checkIn', '签到并上链证据')}
              </button>
            )}
            {showDeadlineSubmit && (
              <button
                type="button"
                disabled={busy || !hasProof}
                onClick={onSubmitEvidence}
                className={btnCls('submitEvidence')}
                style={styles.cta}
              >
                {labelFor('submitEvidence', '提交证据上链')}
              </button>
            )}
          </div>
        </>
      ) : evidences.length === 0 ? (
        <div style={styles.muted}>尚无链上证据哈希。</div>
      ) : null}
    </div>
  )
}

const styles = {
  box: {
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    border: '1px solid rgba(110, 231, 183, 0.28)',
    background: 'linear-gradient(180deg, rgba(16, 40, 32, 0.55) 0%, rgba(8, 12, 10, 0.4) 100%)',
  },
  boxCompact: {
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
    color: '#6ee7b7',
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: 0.5,
  },
  badge: {
    fontSize: 10,
    color: '#065f46',
    background: 'rgba(110, 231, 183, 0.35)',
    padding: '2px 8px',
    borderRadius: 999,
    letterSpacing: 0.5,
  },
  help: {
    margin: '0 0 10px',
    color: '#9a9488',
    fontSize: 11,
    lineHeight: 1.55,
  },
  hashList: { margin: '0 0 10px', padding: 0, listStyle: 'none' },
  hashItem: {
    display: 'grid',
    gridTemplateColumns: '40px 1fr auto',
    gap: 8,
    alignItems: 'center',
    padding: '6px 0',
    borderBottom: '1px solid rgba(244,239,228,0.06)',
    fontSize: 11,
  },
  thumb: {
    width: 40,
    height: 40,
    objectFit: 'cover',
    borderRadius: 6,
    border: '1px solid rgba(110, 231, 183, 0.25)',
  },
  thumbEmpty: {
    width: 40,
    height: 40,
    display: 'grid',
    placeItems: 'center',
    borderRadius: 6,
    background: 'rgba(110, 231, 183, 0.08)',
    color: '#6ee7b7',
    fontSize: 10,
  },
  hashCode: {
    color: '#c8c2b4',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  hashShort: { color: '#8a8376' },
  pickRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  pickBtn: {
    background: 'rgba(110, 231, 183, 0.16)',
    color: '#6ee7b7',
    border: '1px solid rgba(110, 231, 183, 0.35)',
    fontWeight: 600,
  },
  clearBtn: {
    background: 'transparent',
    color: '#9a9488',
    border: '1px solid rgba(244,239,228,0.12)',
  },
  fileName: { color: '#8a8376', fontSize: 11 },
  previewImg: {
    width: '100%',
    maxHeight: 168,
    objectFit: 'cover',
    borderRadius: 8,
    marginBottom: 8,
    border: '1px solid rgba(110, 231, 183, 0.2)',
  },
  err: { color: '#f0a0a0', fontSize: 11, marginBottom: 8 },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    color: '#c8c2b4',
    fontSize: 12,
  },
  input: { width: '100%' },
  preview: { marginTop: 8, color: '#8a8376', fontSize: 11, lineHeight: 1.5 },
  gas: { marginTop: 4, color: '#6e685c', fontSize: 11 },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  cta: {
    background: 'linear-gradient(90deg, #34d399, #059669)',
    color: '#042f2e',
    border: 'none',
    fontWeight: 600,
  },
  muted: { color: '#6e685c', fontSize: 12 },
}
