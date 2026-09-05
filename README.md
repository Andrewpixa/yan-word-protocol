# Yan (言) — Word Protocol

**A vow cannot start without a guarantor.**

Chinese guide: [README_CN.md](README_CN.md) · Stage script: [PITCH_SCRIPT.md](PITCH_SCRIPT.md) · PPT: [pitch/index.html](pitch/index.html) · Blitz prep: [BLITZ_PREP.md](BLITZ_PREP.md)

### Monad Testnet (current)

| Contract | Address |
|---|---|
| YanToken | [`0xCAd6963B2667E01891775fF6EB6cFd716FD39E80`](https://testnet.monadexplorer.com/address/0xCAd6963B2667E01891775fF6EB6cFd716FD39E80) |
| WordProtocol | [`0x15282187E58cfdf3a936f5EE279Bd688E9Ee64b7`](https://testnet.monadexplorer.com/address/0x15282187E58cfdf3a936f5EE279Bd688E9Ee64b7) |
| Deployer (owner) | `0x2Bb51761CAba8cCafb04cB91DDAb647de8e92102` |

```bash
cd frontend && npm install && npm run dev
```

Open http://localhost:3000 — MetaMask on Monad Testnet → **+ YAN** → claim → vow.  
Demo tip: pre-run a broken vow, then point at the missSettle tx on Explorer. Optional: fund the session key with MON and check in once (fewer popups). Do not pitch the burst button on stage.

**Why Monad:** session keys cut popups; cheap confirms make daily check-ins possible.

Public demo:

```bash
cd frontend && npx vercel --prod
```

### Local multi-wallet demo

```bash
bash start-demo.sh
```
