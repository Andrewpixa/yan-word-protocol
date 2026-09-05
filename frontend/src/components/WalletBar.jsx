import React from 'react'
import {
  DEMO_WALLETS,
  FAUCET_URL,
  NETWORK_OPTIONS,
  formatYan,
  shortAddr,
} from '../services/chain'

export default function WalletBar({
  walletMode,
  walletId,
  onChangeWallet,
  networkId,
  onChangeNetwork,
  address,
  balance,
  mmChainId,
  refreshing,
  onRefresh,
  onSwitchNetwork,
  onClaim,
  onAddToken,
  onConnectMetaMask,
  onUseDemo,
  onDisconnect,
  onBackIntro,
}) {
  const disconnected = walletMode === 'disconnected'
  const usingDemo = walletMode === 'demo'
  const usingMetaMask = walletMode === 'metamask'
  const activeNet = NETWORK_OPTIONS.find((n) => n.id === networkId) || NETWORK_OPTIONS[0]
  const networkOk = usingDemo || (usingMetaMask && mmChainId === activeNet.chainId)
  const networkLabel = usingDemo
    ? `${activeNet.name} · 演示`
    : networkOk
      ? activeNet.name
      : mmChainId
        ? `网络不符 · ${mmChainId}`
        : '检测网络中'

  return (
    <div style={styles.bar}>
      <button
        type="button"
        onClick={onBackIntro}
        style={styles.brand}
        title="回到介绍页"
        aria-label="回到介绍页"
      >
        <div style={styles.mark}>言</div>
        <div style={styles.brandText}>
          <div style={styles.title}>言</div>
          <div style={styles.sub}>链上履约协议</div>
        </div>
      </button>

      <div style={styles.cluster}>
        <select
          value={networkId}
          onChange={(e) => onChangeNetwork?.(e.target.value)}
          className="yan-select"
          style={styles.networkSelect}
          title="切换应用网络"
          aria-label="选择网络"
        >
          {NETWORK_OPTIONS.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name}
            </option>
          ))}
        </select>

        {!disconnected && (
          <>
            {networkOk ? (
              <div style={styles.chipOk}>
                <span style={styles.dot} />
                {networkLabel}
              </div>
            ) : (
              <button type="button" className="yan-btn" style={styles.switchBtn} onClick={onSwitchNetwork}>
                切换到 {activeNet.name}
              </button>
            )}

            <div style={styles.statPill}>
              <span style={styles.statK}>余额</span>
              <span style={styles.statV}>{formatYan(balance)} YAN</span>
              <button
                type="button"
                className="yan-btn"
                style={styles.iconBtn}
                onClick={onRefresh}
                title="刷新"
                aria-label="刷新余额"
              >
                {refreshing ? '…' : '↻'}
              </button>
            </div>

            {usingMetaMask && (
              <>
                <button type="button" className="yan-btn" style={styles.addTokenBtn} onClick={onAddToken} title="添加到 MetaMask">
                  + YAN
                </button>
                <button type="button" className="yan-btn" style={styles.claimBtn} onClick={onClaim} disabled={refreshing}>
                  领取测试 YAN
                </button>
              </>
            )}

            {activeNet.chainId === 10143 && usingMetaMask && (
              <a href={FAUCET_URL} target="_blank" rel="noreferrer" style={styles.faucet}>
                MON Faucet
              </a>
            )}
          </>
        )}

        {usingDemo && (
          <select
            value={walletId}
            onChange={(e) => onChangeWallet(e.target.value)}
            className="yan-select"
            style={styles.select}
            title="切换演示钱包"
          >
            {DEMO_WALLETS.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} · {shortAddr(w.address)}
              </option>
            ))}
          </select>
        )}

        {usingMetaMask && (
          <div style={styles.addrPill} title={address || ''}>
            <span style={styles.addrDot} />
            {address ? shortAddr(address) : '同步中…'}
          </div>
        )}

        {disconnected ? (
          <>
            <button type="button" className="yan-btn" style={styles.connectOutline} onClick={onConnectMetaMask}>
              连接 MetaMask
            </button>
            <button type="button" className="yan-btn" style={styles.secondary} onClick={onUseDemo}>
              使用演示模式
            </button>
          </>
        ) : (
          <>
            {usingDemo && (
              <button type="button" className="yan-btn" style={styles.secondary} onClick={onConnectMetaMask}>
                连接 MetaMask
              </button>
            )}
            {usingMetaMask && (
              <button type="button" className="yan-btn" style={styles.secondary} onClick={onUseDemo}>
                演示模式
              </button>
            )}
            <button type="button" className="yan-btn" style={styles.danger} onClick={onDisconnect}>
              断开
            </button>
          </>
        )}
      </div>
    </div>
  )
}

const styles = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: '14px 20px',
    borderBottom: '1px solid rgba(212,175,55,0.18)',
    background:
      'linear-gradient(180deg, rgba(18,16,12,0.96) 0%, rgba(8,8,12,0.94) 100%)',
    backdropFilter: 'blur(12px)',
    position: 'sticky',
    top: 0,
    zIndex: 10,
    flexWrap: 'wrap',
    boxShadow: '0 10px 40px rgba(0,0,0,0.35)',
  },
  brand: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    background: 'transparent',
    border: 'none',
    color: 'inherit',
    padding: 0,
    textAlign: 'left',
    cursor: 'pointer',
  },
  mark: {
    width: 44,
    height: 44,
    border: '1px solid #d4af37',
    borderRadius: 10,
    display: 'grid',
    placeItems: 'center',
    fontFamily: '"Cormorant Garamond", serif',
    fontSize: 24,
    color: '#d4af37',
    boxShadow: '0 0 24px rgba(212,175,55,0.18)',
    background: 'rgba(212,175,55,0.06)',
  },
  brandText: { display: 'flex', flexDirection: 'column' },
  title: {
    fontFamily: '"Cormorant Garamond", serif',
    fontSize: 22,
    letterSpacing: 4,
    color: '#f4efe4',
    lineHeight: 1.1,
  },
  sub: { color: '#8a8376', fontSize: 11, letterSpacing: 1 },
  cluster: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  networkSelect: {
    minWidth: 132,
    fontWeight: 600,
    color: '#e8d48b',
    borderColor: 'rgba(212,175,55,0.45)',
  },
  chipOk: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    borderRadius: 999,
    border: '1px solid rgba(110,231,183,0.35)',
    background: 'rgba(16,40,32,0.65)',
    color: '#6ee7b7',
    fontSize: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#34d399',
    boxShadow: '0 0 8px rgba(52,211,153,0.8)',
  },
  switchBtn: {
    background: 'linear-gradient(90deg, #d4af37, #b8922a)',
    color: '#111',
    border: 'none',
    fontWeight: 600,
    fontSize: 12,
  },
  statPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 8px 6px 12px',
    borderRadius: 999,
    border: '1px solid rgba(212,175,55,0.22)',
    background: 'rgba(8,8,12,0.7)',
  },
  statK: { color: '#8a8376', fontSize: 11 },
  statV: { color: '#e8d48b', fontSize: 13, fontWeight: 600 },
  iconBtn: {
    width: 28,
    height: 28,
    padding: 0,
    borderRadius: 999,
    background: 'transparent',
    border: '1px solid rgba(212,175,55,0.28)',
    color: '#d4af37',
    fontSize: 14,
  },
  addTokenBtn: {
    background: 'transparent',
    border: '1px solid rgba(212,175,55,0.35)',
    color: '#e8d48b',
    fontSize: 12,
  },
  claimBtn: {
    background: 'rgba(212,175,55,0.12)',
    border: '1px solid rgba(212,175,55,0.35)',
    color: '#e8d48b',
    fontSize: 12,
  },
  faucet: {
    color: '#9a9488',
    fontSize: 12,
    textDecoration: 'underline',
    textUnderlineOffset: 3,
  },
  select: { minWidth: 140 },
  addrPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    borderRadius: 999,
    border: '1px solid rgba(244,239,228,0.12)',
    background: 'rgba(8,8,12,0.75)',
    color: '#cfc6b8',
    fontSize: 12,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  addrDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: '#d4af37',
  },
  primary: {
    background: 'linear-gradient(90deg, #d4af37, #b8922a)',
    color: '#111',
    border: 'none',
    fontWeight: 600,
  },
  connectOutline: {
    background: 'rgba(8,8,12,0.7)',
    color: '#e8d48b',
    border: '1px solid rgba(212,175,55,0.45)',
    fontWeight: 600,
  },
  secondary: {
    background: 'transparent',
    color: '#e8d48b',
    border: '1px solid rgba(212,175,55,0.4)',
  },
  danger: {
    background: 'transparent',
    color: '#f0a0a0',
    border: '1px solid rgba(240,160,160,0.35)',
  },
}
