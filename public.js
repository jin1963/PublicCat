/* public.js — DApp ฝั่งผู้ใช้ทั่วไป (CAT)
   ฟังก์ชันหลัก:
   - เชื่อมต่อกระเป๋า (MetaMask/Bitget/ฯลฯ)
   - บันทึก/อ่าน Referrer จาก URL/localStorage
   - แสดงแพ็กเกจ + ซื้อ (approve USDT → buyPackage)
   - เคลม Referral (USDT)
   - แสดงรายการ Stake + เคลมผลตอบแทน + Unstake
*/

let web3, provider, account;
let sale, usdt, catToken; // สัญญาหลัก, USDT, CAT(Stake Token)

// ---------- Helpers ----------
const el = (id) => document.getElementById(id);
const DEC_USDT = () => (window.DECIMALS?.USDT ?? 18);
const DEC_CAT  = () => (window.DECIMALS?.CAT  ?? 18);

const fmt = (v, dec = 18, dp = 6) => {
  try {
    const s = BigInt(v).toString();
    if (dec === 0) return s;
    const neg = s.startsWith("-");
    const raw = neg ? s.slice(1) : s;
    const pad = raw.padStart(dec + 1, "0");
    const a = pad.slice(0, pad.length - dec);
    const b = pad.slice(pad.length - dec).replace(/0+$/, "");
    const out = b ? `${a}.${b}` : a;
    const [i, d = ""] = out.split(".");
    return (neg ? "-" : "") + (d ? `${i}.${d.slice(0, dp)}` : i);
  } catch {
    return v?.toString?.() ?? String(v);
  }
};
const toWei = (numStr, dec = 18) => {
  const [i, d = ""] = String(numStr).trim().split(".");
  const frac = (d + "0".repeat(dec)).slice(0, dec);
  return (BigInt(i || 0) * (10n ** BigInt(dec)) + BigInt(frac || 0)).toString();
};
const fmtDateTime = (ts) => (Number(ts) > 0 ? new Date(Number(ts) * 1000).toLocaleString() : "-");

function toast(msg, type = "info") {
  const box = el("toast");
  if (!box) return alert(msg);
  box.style.display = "block";
  box.innerHTML = msg;
  box.style.borderColor = type === "ok" ? "#225b2a" : type === "err" ? "#5b2222" : "#1b1c25";
  setTimeout(() => (box.style.display = "none"), 4200);
}

// ---------- Connect ----------
async function connect() {
  try {
    provider = window.ethereum;
    if (!provider) return toast("❌ ไม่พบกระเป๋า — โปรดเปิดด้วย DApp Browser", "err");
    await provider.request({ method: "eth_requestAccounts" });
    web3 = new Web3(provider);

    const chainId = await web3.eth.getChainId();
    if (web3.utils.toHex(chainId) !== window.NETWORK.chainIdHex) {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: window.NETWORK.chainIdHex }],
      });
    }

    const accs = await web3.eth.getAccounts();
    account = accs[0];
    el("wallet").textContent = `✅ ${account.slice(0, 6)}...${account.slice(-4)}`;
    el("ca").textContent = window.ADDR.CONTRACT;

    sale    = new web3.eth.Contract(window.SALE_ABI,      window.ADDR.CONTRACT);
    usdt    = new web3.eth.Contract(window.ERC20_MINI_ABI, window.ADDR.USDT);
    catToken= new web3.eth.Contract(window.ERC20_MINI_ABI, window.ADDR.CAT);

    hydrateRef();
    updateMyRefLink();

    await loadPackages();
    await refreshRewards();
    await loadStakes();

    provider.on?.("accountsChanged", () => location.reload());
    provider.on?.("chainChanged",   () => location.reload());
  } catch (e) {
    console.error(e);
    toast(`เชื่อมต่อไม่สำเร็จ: ${e?.message || e}`, "err");
  }
}

// ---------- Referrer ----------
function hydrateRef() {
  const url = new URL(location.href);
  const found = url.searchParams.get("ref") || localStorage.getItem("cat_ref") || "";
  if (found && web3.utils.isAddress(found)) {
    el("refInput").value = found;
    localStorage.setItem("cat_ref", found);
  }
}
function lockRef() {
  const r = el("refInput").value.trim();
  if (!r) return toast("⚠️ กรุณาใส่ Referrer", "err");
  if (!web3.utils.isAddress(r)) return toast("❌ Referrer ไม่ถูกต้อง", "err");
  localStorage.setItem("cat_ref", r);
  toast("✅ บันทึก Referrer แล้ว", "ok");
}
function updateMyRefLink() {
  if (!account) return;
  const link = `${location.origin}${location.pathname}?ref=${account}`;
  el("myRefLink").value = link;
  el("btnCopyMyRef").onclick = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast("คัดลอกลิงก์แล้ว ✅", "ok");
    } catch {
      toast("คัดลอกลิงก์ไม่สำเร็จ", "err");
    }
  };
}

// ---------- Packages ----------
async function ensureAllowance(spender, amount) {
  const allow = await usdt.methods.allowance(account, spender).call();
  if (BigInt(allow) >= BigInt(amount)) return true;
  toast("⏳ กำลังอนุมัติ USDT...");
  await usdt.methods.approve(spender, amount).send({ from: account });
  toast("✅ อนุมัติ USDT สำเร็จ", "ok");
  return true;
}

async function loadPackages() {
  const wrap = el("pkgWrap");
  wrap.innerHTML = "⏳ กำลังโหลดแพ็กเกจ...";
  try {
    const countRaw = await sale.methods.packageCount().call();
    const count = Number(countRaw);
    const decU = DEC_USDT();
    const decT = DEC_CAT();

    // อ่าน 1 index ให้ทนทานต่อรูปแบบ field
    const readOne = async (i) => {
      try {
        const p = await sale.methods.packages(i).call();
        const usdtIn = p.usdtIn ?? p[0] ?? "0";
        const out    = p.tokenOut ?? p.kjcOut ?? p[1] ?? "0";
        const active = typeof p.active === "boolean" ? p.active : Boolean(p[2]);
        return { id: i, usdtIn, out, active };
      } catch {
        return null;
      }
    };

    // ลองทั้ง index แบบเริ่ม 1 และ 0 + probe เพิ่มอีกเล็กน้อย
    const tryIds = new Set();
    if (count >= 0) {
      for (let i = 1; i <= count; i++) tryIds.add(i);
      for (let i = 0; i <= Math.max(0, count); i++) tryIds.add(i);
    }
    for (let i = count + 1; i <= count + 5; i++) tryIds.add(i);

    const rows = [];
    for (const i of tryIds) {
      const r = await readOne(i);
      if (r) rows.push(r);
    }

    const uniq = Object.values(
      rows.reduce((acc, r) => ((acc[r.id] = r), acc), {})
    ).sort((a, b) => Number(a.id) - Number(b.id));

    if (uniq.length === 0) {
      // fallback UI
      wrap.innerHTML = "";
      const fb = window.UI_CONST?.FALLBACK_PACKAGES || [];
      if (fb.length === 0) {
        wrap.innerHTML = `<div class="muted">ยังไม่มีแพ็กเกจ (packageCount=${count})</div>`;
        return;
      }
      fb.forEach((p) => {
        const card = document.createElement("div");
        card.className = "pkg";
        card.innerHTML = `
          <h3>แพ็กเกจ (fallback) #${p.id}</h3>
          <div>จ่าย: <b>${fmt(p.usdt, decU)}</b> USDT</div>
          <div>รับ: <b>${fmt(p.cat,  decT)}</b> CAT</div>
          <button disabled>ปิดการขาย</button>
        `;
        wrap.appendChild(card);
      });
      const info = document.createElement("div");
      info.className = "muted";
      info.style.marginTop = "8px";
      info.textContent = `ไม่สามารถอ่าน packages จากสัญญาได้ (packageCount=${count}). แสดง fallback แทน`;
      wrap.prepend(info);
      return;
    }

    wrap.innerHTML = "";
    let activeCnt = 0, inactiveCnt = 0;
    uniq.forEach((r) => {
      r.active ? activeCnt++ : inactiveCnt++;
      const card = document.createElement("div");
      card.className = "pkg";
      card.innerHTML = `
        <h3>แพ็กเกจ #${r.id} ${r.active ? "" : "<span class='muted'>(inactive)</span>"}</h3>
        <div>จ่าย: <b>${fmt(r.usdtIn, decU)}</b> USDT</div>
        <div>รับ: <b>${fmt(r.out,    decT)}</b> CAT</div>
        <button class="btnBuy" data-id="${r.id}" ${r.active ? "" : "disabled"}>
          ${r.active ? "ซื้อแพ็กเกจ" : "ปิดการขาย"}
        </button>
      `;
      wrap.appendChild(card);
    });

    const info = document.createElement("div");
    info.className = "muted";
    info.style.marginTop = "8px";
    info.textContent = `packageCount=${count} • พบ ${uniq.length} รายการ (active ${activeCnt}, inactive ${inactiveCnt})`;
    wrap.prepend(info);

    document.querySelectorAll(".btnBuy").forEach((b) =>
      b.addEventListener("click", () => buyPackage(Number(b.dataset.id)))
    );
  } catch (e) {
    console.error(e);
    wrap.innerHTML = "❌ โหลดแพ็กเกจไม่สำเร็จ";
  }
}

async function buyPackage(id) {
  try {
    const p = await sale.methods.packages(id).call();
    const active = typeof p.active === "boolean" ? p.active : Boolean(p[2]);
    const usdtIn = p.usdtIn ?? p[0];
    if (!active) return toast("แพ็กเกจนี้ถูกปิดแล้ว", "err");

    const ref =
      el("refInput").value.trim() ||
      localStorage.getItem("cat_ref") ||
      "0x0000000000000000000000000000000000000000";

    if (ref && !web3.utils.isAddress(ref)) return toast("Referrer ไม่ถูกต้อง", "err");

    await ensureAllowance(window.ADDR.CONTRACT, usdtIn);
    toast("⏳ ส่งธุรกรรมซื้อ...");
    await sale.methods.buyPackage(id, ref).send({ from: account });
    toast("🎉 ซื้อสำเร็จและ Stake อัตโนมัติ", "ok");

    localStorage.setItem("cat_ref", ref);
    await refreshRewards();
    await loadStakes();
  } catch (e) {
    console.error(e);
    toast(`❌ ซื้อไม่สำเร็จ: ${e?.message || e}`, "err");
  }
}

// ---------- Rewards (Referral USDT) ----------
async function refreshRewards() {
  try {
    const amt = await sale.methods.accruedRefUSDT(account).call();
    el("refUsdt").textContent = `${fmt(amt, DEC_USDT())} USDT`;
  } catch {
    el("refUsdt").textContent = "-";
  }
}
async function claimReferral() {
  try {
    toast("⏳ ส่งธุรกรรมเคลมรางวัล...");
    await sale.methods.claimReferralReward().send({ from: account });
    toast("✅ เคลม Referral สำเร็จ", "ok");
    await refreshRewards();
  } catch (e) {
    console.error(e);
    toast(`❌ เคลมไม่สำเร็จ: ${e?.message || e}`, "err");
  }
}

// ---------- Stakes ----------
async function loadStakes() {
  const box = el("stakes");
  box.innerHTML = "⏳ กำลังโหลด stakes...";
  try {
    const n = await sale.methods.getStakeCount(account).call();
    const lockDur = await sale.methods.LOCK_DURATION().call();
    const now = Math.floor(Date.now() / 1000);
    let totalPrincipal = 0n;
    let totalPending = 0n;

    box.innerHTML = "";

    if (Number(n) === 0) {
      el("totals").textContent = "รวม Principal: 0 CAT • รอเคลม: 0 CAT";
      box.innerHTML = "<div class='muted'>ยังไม่มีรายการ stake</div>";
      return;
    }

    for (let i = 0; i < Number(n); i++) {
      const s = await sale.methods.stakes(account, i).call();
      const next = await sale.methods.nextStakeClaimTime(account, i).call();
      const canUn = await sale.methods.canUnstake(account, i).call().catch(()=>false);
      const pend = await sale.methods.pendingStakeReward(account, i).call();

      const amount = s.amount ?? s[0] ?? "0";
      const start  = s.startTime ?? s[1] ?? "0";

      totalPrincipal += BigInt(amount);
      totalPending  += BigInt(pend);

      const unlockTs = Number(start) + Number(lockDur);
      const daysRemain = Math.max(0, Math.ceil((unlockTs - now) / 86400));

      const div = document.createElement("div");
      div.className = "stake";
      div.innerHTML = `
        <div class="mono">Index #${i}</div>
        <div>Principal: ${fmt(amount, DEC_CAT())} CAT</div>
        <div>รอเคลม: ${fmt(pend, DEC_CAT())} CAT</div>
        <div class="muted">เริ่ม: ${fmtDateTime(start)}</div>
        <div class="muted">เคลมถัดไป: ${fmtDateTime(next)}</div>
        <div class="muted">ครบล็อก: ${fmtDateTime(unlockTs)} (${daysRemain} วัน)</div>
        <button class="btnClaim" data-i="${i}">เคลม</button>
        <button class="btnUnstake" data-i="${i}" ${!canUn ? "disabled" : ""}>Unstake</button>
      `;
      box.appendChild(div);
    }

    el("totals").textContent =
      `รวม Principal: ${fmt(totalPrincipal, DEC_CAT())} CAT • รอเคลม: ${fmt(totalPending, DEC_CAT())} CAT`;

    // bind buttons
    document.querySelectorAll(".btnClaim").forEach((b) =>
      b.addEventListener("click", async () => {
        const i = Number(b.dataset.i);
        try {
          toast("⏳ ส่งธุรกรรมเคลม...");
          await sale.methods.claimStakingReward(i).send({ from: account });
          toast("✅ เคลมสำเร็จ", "ok");
          await loadStakes();
        } catch (e) {
          console.error(e);
          toast(`❌ เคลมไม่สำเร็จ: ${e?.message || e}`, "err");
        }
      })
    );

    document.querySelectorAll(".btnUnstake").forEach((b) =>
      b.addEventListener("click", async () => {
        const i = Number(b.dataset.i);
        try {
          toast("⏳ ส่งธุรกรรม Unstake...");
          await sale.methods.unstake(i).send({ from: account });
          toast("✅ Unstake สำเร็จ", "ok");
          await loadStakes();
        } catch (e) {
          console.error(e);
          toast(`❌ Unstake ไม่สำเร็จ: ${e?.message || e}`, "err");
        }
      })
    );
  } catch (e) {
    console.error(e);
    box.innerHTML = "❌ โหลด stake ไม่สำเร็จ";
  }
}

// ---------- Wire ----------
window.addEventListener("DOMContentLoaded", () => {
  el("btnConnect")  ?.addEventListener("click", connect);
  el("btnLockRef")  ?.addEventListener("click", lockRef);
  el("btnClaimRef") ?.addEventListener("click", claimReferral);
});
