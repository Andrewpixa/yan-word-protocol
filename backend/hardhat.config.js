require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const MONAD_RPC_URL = process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz/";
const PRIVATE_KEY = process.env.PRIVATE_KEY
  ? (process.env.PRIVATE_KEY.startsWith("0x") ? process.env.PRIVATE_KEY : "0x" + process.env.PRIVATE_KEY)
  : null;

const mnemonicAccounts = {
  mnemonic: "test test test test test test test test test test test junk",
  path: "m/44'/60'/0'/0",
  initialIndex: 0,
  count: 20,
  passphrase: "",
};

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 31337,
      accounts: { mnemonic: mnemonicAccounts.mnemonic },
    },
    local: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      accounts: mnemonicAccounts,
    },
    monad_testnet: {
      url: MONAD_RPC_URL,
      accounts: PRIVATE_KEY && PRIVATE_KEY !== "0xYOUR_PRIVATE_KEY_HERE"
        ? [PRIVATE_KEY]
        : mnemonicAccounts,
      chainId: 10143,
      timeout: 60000,
    },
  },
};
