let web3, sale, usdt, stake, account;
let usdtDec=18, stakeDec=18;

const $ = (id)=>document.getElementById(id);
const toast = (m,ms=2000)=>{ const t=$("toast"); t.textContent=m; t.style.display="block"; setTimeout(()=>t.style.display="none",ms); };
const toBN = (x)=>web3.utils.toBN(x);
const toWeiDec = (n,dec)=> toBN(Math.floor(Number(n)*10**dec).toString());
const fmt = (raw,dec,max=4)=> (!raw?"0":(Number(raw)/10**Number(dec)).toLocaleString(undefined,{maximumFractionDigits:max}));

async function ensureChain(){
  const cid = await window.ethereum.request({method:"eth_chainId"});
  if (cid.toLowerCase()!==window.NETWORK.chainIdHex.toLowerCase()){
    await window.ethereum.request({method:"wallet_switchEthereumChain",params:[{chainId:window.NETWORK.chainIdHex}]});
  }
}

$("btnConnect").addEventListener("click", async ()=>{
  try{
    await window.ethereum.request({method:"eth_requestAccounts"});
    await ensureChain();
    web3 = new Web3(window.ethereum);
    account = (await web3.eth.getAccounts())[0];

    sale  = new web3.eth.Contract(window.SALE_ABI,  window.ADDR.CONTRACT);
    usdt  = new web3.eth.Contract(window.ERC20_MINI_ABI, window.ADDR.USDT);
    stake = new web3.eth.Contract(window.ERC20_MINI_ABI, window.ADDR.STAKE);

    usdtDec  = Number(await usdt.methods.decimals().call());
    stakeDec = Number(await stake.methods.decimals().call());

    $("contractAddr").textContent = window.ADDR.CONTRACT;
    $("symStake").textContent = window.TOKEN_SYMBOL;
    $("connState").textContent = `Connected: ${account.slice(0,6)}…${account.slice(-4)}`;

    // auto-read ref จาก URL ( ?ref=0x... )
    const refQ = new URLSearchParams(location.search).get("ref");
    if (refQ && !$("refAddr").value) $("refAddr").value = refQ;

    await Promise.all([loadPackages(), refreshBalances(), refreshRef()]);
    await renderStakes();
    setInterval(refreshBalances, 20000);

    toast("เชื่อมต่อสำเร็จ");
  }catch(e){ console.error(e); toast("เชื่อมต่อไม่สำเร็จ"); }
});

async function refreshBalances(){
  try{
    const [ub, sb] = await Promise.all([
      usdt.methods.balanceOf(account).call(),
      stake.methods.balanceOf(account).call()
    ]);
    $("myUsdt").textContent  = fmt(ub, usdtDec)+" USDT";
    $("myStake").textContent = fmt(sb, stakeDec)+" "+window.TOKEN_SYMBOL;
  }catch(e){ console.error(e); }
}

async function refreshRef(){
  try{
    const [acc, rInt, last] = await Promise.all([
      sale.methods.accruedRefUSDT(account).call(),
      sale.methods.REF_CLAIM_INTERVAL().call(),
      sale.methods.lastRefClaimAt(account).call()
    ]);
    $("myRefAcc").textContent = fmt(acc, usdtDec)+" USDT";
    $("refInt").textContent   = Number(rInt)===0 ? "Real-Time" : `${rInt} วินาที (ล่าสุด: ${last})`;
  }catch(e){ console.error(e); }
}

async function loadPackages(){
  try{
    const cnt = Number(await sale.methods.packageCount().call());
    const list = $("pkgList"); list.innerHTML = "";
    for(let i=0;i<cnt;i++){
      const p = await sale.methods.packages(i).call();
      if(!p.active) continue;
      const div = document.createElement("div");
      div.className = "pkg";
      div.innerHTML = `
        <div><b>แพ็กเกจ #${i}</b></div>
        <div>จ่าย: <b>${fmt(p.usdtIn, usdtDec)} USDT</b></div>
        <div>ได้รับ: <b>${fmt(p.tokenOut, stakeDec)} ${window.TOKEN_SYMBOL}</b></div>
        <button data-id="${i}">ซื้อแพ็กเกจนี้</button>
      `;
      div.querySelector("button").addEventListener("click", ()=>buy(i, p.usdtIn));
      list.appendChild(div);
    }
  }catch(e){ console.error(e); }
}

async function ensureAllowance(spender, need){
  const a = await usdt.methods.allowance(account, spender).call();
  if (toBN(a).lt(toBN(need))){
    await usdt.methods.approve(spender, need).send({from:account});
  }
}

async function buy(id, usdtInRaw){
  try{
    const ref = $("refAddr").value.trim() || "0x0000000000000000000000000000000000000000";
    await ensureAllowance(window.ADDR.CONTRACT, usdtInRaw);
    await sale.methods.buyPackage(id, ref).send({from:account});
    toast("ซื้อ + auto stake สำเร็จ");
    await Promise.all([refreshBalances(), renderStakes(), refreshRef()]);
  }catch(e){ console.error(e); toast("ซื้อไม่สำเร็จ"); }
}

$("btnClaimStake").addEventListener("click", async ()=>{
  try{
    const idx = Number($("claimIndex").value||0);
    await sale.methods.claimStakingReward(idx).send({from:account});
    toast("เคลมดอกเบี้ยสำเร็จ");
    await renderStakes();
  }catch(e){ console.error(e); toast("เคลมดอกเบี้ยไม่สำเร็จ"); }
});

$("btnClaimRef").addEventListener("click", async ()=>{
  try{
    await sale.methods.claimReferralReward().send({from:account});
    toast("เคลมรีเฟอร์รัลสำเร็จ");
    await refreshRef();
  }catch(e){ console.error(e); toast("เคลมรีเฟอร์รัลไม่สำเร็จ"); }
});

$("btnUnstake").addEventListener("click", async ()=>{
  try{
    const idx = Number($("unstakeIndex").value||0);
    await sale.methods.unstake(idx).send({from:account});
    toast("ถอนต้นสำเร็จ");
    await renderStakes();
  }catch(e){ console.error(e); toast("ถอนต้นไม่สำเร็จ"); }
});

async function renderStakes(){
  try{
    const cnt = Number(await sale.methods.getStakeCount(account).call());
    const box = $("stakeList"); box.innerHTML="";
    for(let i=0;i<cnt;i++){
      const s = await sale.methods.stakes(account, i).call();
      const pend = await sale.methods.pendingStakeReward(account, i).call();
      const next = await sale.methods.nextStakeClaimTime(account, i).call();
      const div = document.createElement("div");
      div.className = "pkg";
      div.innerHTML = `
        <div><b>Stake #${i}</b> — withdrawn: ${s.withdrawn}</div>
        <div>Principal: <b>${fmt(s.amount, stakeDec)} ${window.TOKEN_SYMBOL}</b></div>
        <div>Pending Reward: <b>${fmt(pend, stakeDec)} ${window.TOKEN_SYMBOL}</b></div>
        <div>Next claim at (unix): <span class="mono">${next}</span></div>
      `;
      box.appendChild(div);
    }
  }catch(e){ console.error(e); }
}
