// ==========================
// 🌐 NETWORK CONFIG
// ==========================
window.NETWORK = {
  chainIdHex: "0x38", // ✅ BNB Smart Chain Mainnet (ถ้า Testnet ใช้ "0x61")
  chainName: "BNB Smart Chain",
};

// ==========================
// 🧩 CONTRACT ADDRESSES
// ==========================
window.ADDR = {
  CONTRACT: "0x69975B4212516FD869cF5e44CFc10FEB1aa7BFcd", // 🔥 UniversalReferralAutoStake (CAT)
  USDT: "0x55d398326f99059fF775485246999027B3197955",     // 💵 USDT (BEP20)
  STAKE: "0xd1961485ad351D140DFB231De85d6D6Ec30AC6d5",    // 🐱 CAT Token
};

// ==========================
// 💎 TOKEN SYMBOL
// ==========================
window.TOKEN_SYMBOL = "CAT";

// ==========================
// 🧠 ERC20 Minimal ABI
// ==========================
window.ERC20_MINI_ABI = [
  {
    "constant": true,
    "inputs": [{ "name": "account", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "name": "", "type": "uint256" }],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "decimals",
    "outputs": [{ "name": "", "type": "uint8" }],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      { "name": "spender", "type": "address" },
      { "name": "amount", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [{ "name": "", "type": "bool" }],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      { "name": "owner", "type": "address" },
      { "name": "spender", "type": "address" }
    ],
    "name": "allowance",
    "outputs": [{ "name": "", "type": "uint256" }],
    "type": "function"
  }
];

// ==========================
// ⚙️ UniversalReferralAutoStake ABI (ย่อไว้, คุณแทนที่ด้วย ABI เต็มได้)
// ==========================
window.SALE_ABI = [
  // ---- core params ----
  { "inputs": [], "name": "REWARD_APR_BPS", "outputs": [{ "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "CLAIM_INTERVAL_STAKE", "outputs": [{ "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "LOCK_DURATION", "outputs": [{ "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "REF1_BPS", "outputs": [{ "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "REF2_BPS", "outputs": [{ "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "REF3_BPS", "outputs": [{ "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "REF_CLAIM_INTERVAL", "outputs": [{ "type": "uint256" }], "stateMutability": "view", "type": "function" },

  // ---- owner controls ----
  {
    "inputs": [
      { "name": "aprBps", "type": "uint256" },
      { "name": "claimInt", "type": "uint256" },
      { "name": "lockDur", "type": "uint256" },
      { "name": "ref1", "type": "uint256" },
      { "name": "ref2", "type": "uint256" },
      { "name": "ref3", "type": "uint256" },
      { "name": "refClaimInt", "type": "uint256" }
    ],
    "name": "setParams",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },

  // ---- packages ----
  {
    "inputs": [
      { "name": "id", "type": "uint256" },
      { "name": "usdtIn", "type": "uint256" },
      { "name": "tokenOut", "type": "uint256" },
      { "name": "active", "type": "bool" }
    ],
    "name": "setPackage",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },

  // ---- withdraw ----
  {
    "inputs": [
      { "name": "amount", "type": "uint256" },
      { "name": "to", "type": "address" }
    ],
    "name": "ownerWithdrawUSDT",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "name": "amount", "type": "uint256" },
      { "name": "to", "type": "address" }
    ],
    "name": "ownerWithdrawStakeToken",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },

  // ---- airdrop ----
  {
    "inputs": [
      { "name": "users", "type": "address[]" },
      { "name": "amounts", "type": "uint256[]" },
      { "name": "startTime", "type": "uint256" }
    ],
    "name": "airdropStakes",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },

  // ---- extra ----
  { "inputs": [], "name": "paused", "outputs": [{ "type": "bool" }], "stateMutability": "view", "type": "function" },
];
