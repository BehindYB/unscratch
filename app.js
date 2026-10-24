(function () {
  const data = window.UNSCRATCH_DATA || [];
  const wins = window.UNSCRATCH_WINS || [];
  let selectedId = data.find((x) => x.id === "doppia-sfida-classic")?.id || (data[0] ? data[0].id : null);
  let filterPrice = "all";
  let searchQuery = "";
  let sortMode = "rtp_desc";
  let showNetTax = true;

  const fmtEur = (n) =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);
  const fmtInt = (n) => new Intl.NumberFormat("it-IT").format(n);
  const fmtDec = (n, d = 2) =>
    new Intl.NumberFormat("it-IT", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);

  function getFilteredAndSorted() {
    let list = data.filter((t) => {
      const matchPrice = filterPrice === "all" || t.price === Number(filterPrice);
      const matchSearch =
        !searchQuery || t.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchPrice && matchSearch;
    });

    list.sort((a, b) => {
      const rtpA = showNetTax ? a.rtp_net : a.rtp_gross;
      const rtpB = showNetTax ? b.rtp_net : b.rtp_gross;
      if (sortMode === "rtp_desc") return rtpB - rtpA;
      if (sortMode === "gain_desc") return b.pct_gain - a.pct_gain;
      if (sortMode === "price_asc") return a.price - b.price || rtpB - rtpA;
      if (sortMode === "price_desc") return b.price - a.price || rtpB - rtpA;
      return 0;
    });
    return list;
  }

  function renderPricePills() {
    const container = document.getElementById("price-pills");
    if (!container) return;
    const prices = ["all", 0.5, 1, 2, 3, 5, 10, 15, 20, 25];
    container.innerHTML = prices
      .map((p) => {
        const isAll = p === "all";
        const isActive = isAll ? filterPrice === "all" : Number(filterPrice) === p;
        const count = isAll ? data.length : data.filter((t) => t.price === p).length;
        const label = isAll ? `Tutti (${count})` : `${fmtEur(p)} (${count})`;
        return `<button type="button" class="price-pill ${isActive ? "active" : ""}" data-price="${p}">${label}</button>`;
      })
      .join("");

    container.querySelectorAll(".price-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        const p = btn.getAttribute("data-price");
        if (p === "all" || filterPrice === p) {
          filterPrice = "all";
        } else {
          filterPrice = p;
          const currentTicket = data.find((x) => x.id === selectedId);
          if (!currentTicket || currentTicket.price !== Number(p)) {
            const filteredForPrice = getFilteredAndSorted();
            if (filteredForPrice.length > 0) {
              selectedId = filteredForPrice[0].id;
            }
          }
        }
        renderAll();
      });
    });
  }

  function renderTable() {
    renderPricePills();
    const tbody = document.getElementById("catalog-body");
    const filtered = getFilteredAndSorted();
    const countLabel = document.getElementById("catalog-count-label");
    if (countLabel) {
      countLabel.textContent = `Catalogo Attivo (${filtered.length} su ${data.length} Biglietti)`;
    }

    tbody.innerHTML = filtered
      .map((t) => {
        const isSel = t.id === selectedId ? "selected" : "";
        const rtp = showNetTax ? t.rtp_net : t.rtp_gross;
        const ev = showNetTax ? t.ev_net : t.ev_gross;
        const loss = t.price - ev;
        const maxDisplay = showNetTax ? t.max_prize_net : t.max_prize;
        const evenMain = t.prob_even_one_in > 0 ? `1 su ${fmtDec(t.prob_even_one_in)}` : "Assente";
        const evenSub = t.prob_even_one_in > 0 ? `${fmtDec(t.pct_even)}% del lotto` : "Solo premi > costo";

        return `
        <tr class="clickable ${isSel}" data-id="${t.id}">
          <td data-label="Biglietto">
            <span class="cell-main">${t.name} <span style="color:var(--accent);font-family:var(--font-mono)">(${fmtEur(t.price)})</span></span>
            <span class="cell-sub">Max: ${fmtEur(maxDisplay)} (1 su ${fmtInt(t.max_prize_one_in)})</span>
          </td>
          <td class="num" data-label="Vincita (>Costo)">
            <span class="cell-main" style="color:var(--gain)">1 su ${fmtDec(t.prob_gain_one_in)}</span>
            <span class="cell-sub">${fmtDec(t.pct_gain)}% del lotto</span>
          </td>
          <td class="num" data-label="Pareggio (=Costo)">
            <span class="cell-main" style="color:var(--even)">${evenMain}</span>
            <span class="cell-sub">${evenSub}</span>
          </td>
          <td class="num" data-label="RTP & Ritorno">
            <span class="cell-main">${fmtDec(rtp)}%</span>
            <span class="cell-sub">${showNetTax ? "Netto" : "Lordo"} (${fmtEur(ev)})</span>
          </td>
          <td class="num" data-label="Perdita Media">
            <span class="cell-main" style="color:var(--loss)">-${fmtEur(loss)}</span>
            <span class="cell-sub">per biglietto</span>
          </td>
        </tr>`;
      })
      .join("");

    tbody.querySelectorAll("tr").forEach((row) => {
      row.addEventListener("click", () => {
        const clickedId = row.getAttribute("data-id");
        const clickedTicket = data.find((x) => x.id === clickedId);
        if (!clickedTicket) return;

        if (clickedId === selectedId && filterPrice !== "all") {
          filterPrice = "all";
        } else {
          selectedId = clickedId;
          filterPrice = String(clickedTicket.price);
        }
        renderAll();
      });
    });
  }

  function renderPriceTierChart() {
    const container = document.getElementById("price-tier-chart");
    if (!container) return;

    const prices = [0.5, 1, 2, 3, 5, 10, 15, 20, 25];
    const currentTicket = data.find((x) => x.id === selectedId);

    container.innerHTML = prices
      .map((p) => {
        const group = data.filter((t) => t.price === p);
        if (!group.length) return "";
        const avgRtp =
          group.reduce((sum, t) => sum + (showNetTax ? t.rtp_net : t.rtp_gross), 0) /
          group.length;

        const isFilteredPrice = filterPrice !== "all" && Number(filterPrice) === p;
        const isCurrentTicketPrice = currentTicket && currentTicket.price === p;
        const isHighlighted = filterPrice === "all" ? isCurrentTicketPrice : isFilteredPrice;

        const fillStyle = isHighlighted
          ? "background: linear-gradient(90deg, #10b981, #38bdf8);"
          : filterPrice === "all"
          ? "background: linear-gradient(90deg, #0284c7, #38bdf8); opacity: 0.72;"
          : "background: linear-gradient(90deg, #1e293b, #475569); opacity: 0.55;";
        const labelStyle = isHighlighted
          ? "font-weight:700; color:var(--accent);"
          : "color:var(--text);";
        const activeTag = isFilteredPrice ? " [Filtro attivo ✕]" : "";

        return `
        <div class="hbar-row" style="cursor:pointer" data-price="${p}" title="Clicca per filtrare o rimuovere il filtro">
          <div style="${labelStyle}">Taglio ${fmtEur(p)} <span style="color:var(--muted);font-size:11px">(${group.length})${activeTag}</span></div>
          <div class="hbar-track">
            <div class="hbar-fill" style="width:${avgRtp}%; ${fillStyle}"></div>
          </div>
          <div class="num" style="${labelStyle}">${fmtDec(avgRtp)}%</div>
        </div>`;
      })
      .join("");

    container.querySelectorAll(".hbar-row").forEach((row) => {
      row.addEventListener("click", () => {
        const p = row.getAttribute("data-price");
        if (filterPrice === p) {
          filterPrice = "all";
        } else {
          filterPrice = p;
          const currentTicket = data.find((x) => x.id === selectedId);
          if (!currentTicket || currentTicket.price !== Number(p)) {
            const filteredForPrice = getFilteredAndSorted();
            if (filteredForPrice.length > 0) {
              selectedId = filteredForPrice[0].id;
            }
          }
        }
        renderAll();
      });
    });
  }

  function renderRecentWins() {
    const el = document.getElementById("recent-wins-list");
    if (!el) return;
    if (!wins.length) {
      el.textContent = "Nessun bollettino recente disponibile.";
      return;
    }
    el.innerHTML = wins
      .map(
        (w) => `
      <div style="padding:7px 0; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; gap:10px; align-items:center;">
        <span style="color:var(--text)">${w.slug}</span>
        <a href="${w.url}" target="_blank" rel="noopener" style="color:var(--accent); font-family:var(--font-mono); font-size:11px; text-decoration:none; white-space:nowrap;">Bollettino &nearr;</a>
      </div>`
      )
      .join("");
  }

  function renderDetail() {
    const t = data.find((x) => x.id === selectedId) || data[0];
    if (!t) return;

    const rtp = showNetTax ? t.rtp_net : t.rtp_gross;
    const ev = showNetTax ? t.ev_net : t.ev_gross;
    const loss = t.price - ev;
    const upfrontCutPct = 100 - t.rtp_gross;
    const tax20ImpactPct = t.rtp_gross - t.rtp_net;

    document.getElementById("det-title").textContent = `${t.name} (${fmtEur(t.price)})`;
    document.getElementById("det-lotto").textContent = `Lotto iniziale: ${fmtInt(t.lotto)} biglietti · Raccolta: ${fmtEur(t.lotto * t.price)}`;
    const srcLink = document.getElementById("det-source-link");
    if (srcLink) {
      srcLink.href = t.url;
      srcLink.textContent = `Scheda Ufficiale (${t.source}) ↗`;
    }

    document.getElementById("kpi-rtp").textContent = `${fmtDec(rtp)}%`;
    document.getElementById("kpi-rtp-sub").textContent = showNetTax
      ? `Netto reale (inclusa tassa 20% oltre 500€)`
      : `Lordo nominale prima della tassa 20%`;

    document.getElementById("kpi-ev").textContent = `-${fmtEur(loss)}`;
    document.getElementById("kpi-ev-sub").textContent = `Ritorno medio: ${fmtEur(ev)} ogni ${fmtEur(t.price)} spesi`;

    document.getElementById("kpi-gain").textContent = `${fmtDec(t.pct_gain)}%`;
    document.getElementById("kpi-gain-sub").textContent = `1 biglietto ogni ${fmtDec(t.prob_gain_one_in)} va in attivo`;

    document.getElementById("kpi-even").textContent = `${fmtDec(t.pct_even)}%`;
    document.getElementById("kpi-even-sub").textContent =
      t.prob_even_one_in > 0
        ? `1 ogni ${fmtDec(t.prob_even_one_in)} restituisce solo i ${fmtEur(t.price)}`
        : `Nessuna fascia di pareggio su questo biglietto`;

    document.getElementById("split-bar").innerHTML = `
      <div class="split-loss" style="width:${t.pct_loss}%">${fmtDec(t.pct_loss)}% (0 €)</div>
      ${t.pct_even > 0 ? `<div class="split-even" style="width:${t.pct_even}%">${fmtDec(t.pct_even)}%</div>` : ""}
      <div class="split-gain" style="width:${t.pct_gain}%">${fmtDec(t.pct_gain)}%</div>
    `;

    document.getElementById("tax-erosion-box").innerHTML = `
      <strong>Doppia Erosione su ${t.name}:</strong>
      1) Trattenuta a monte (Stato/Concessionario/Tabaccaio): <strong>${fmtDec(upfrontCutPct)}%</strong> della raccolta (${fmtEur(t.price - t.ev_gross)} a biglietto).
      2) Prelievo aggiuntivo "Tassa sulla Fortuna" (20% sulla quota &gt; 500€): erode un ulteriore <strong>${fmtDec(tax20ImpactPct)}%</strong> del montepremi.
      <em>I premi fino a 500€ incassati in tabaccheria sono esenti dal 20%.</em>
    `;

    // Analisi comparativa: sul taglio selezionato (se c'è un filtro taglio attivo) oppure sull'intero catalogo
    const isGlobalScope = filterPrice === "all";
    const activePrice = isGlobalScope ? t.price : Number(filterPrice);
    const peers = isGlobalScope ? data : data.filter((x) => x.price === activePrice);
    const getRtp = (x) => (showNetTax ? x.rtp_net : x.rtp_gross);
    const getEv = (x) => (showNetTax ? x.ev_net : x.ev_gross);
    const getMax = (x) => (showNetTax ? x.max_prize_net : x.max_prize);

    const byRtp = [...peers].sort((a, b) => getRtp(b) - getRtp(a));
    const byGain = [...peers].sort((a, b) => b.pct_gain - a.pct_gain);
    const byJackpot = [...peers].sort(
      (a, b) => getMax(b) - getMax(a) || a.max_prize_one_in - b.max_prize_one_in
    );

    const bestRtp = byRtp[0];
    const worstRtp = byRtp[byRtp.length - 1];
    const bestGain = byGain[0];
    const bestJackpot = byJackpot[0];
    const rankRtp = byRtp.findIndex((x) => x.id === t.id) + 1;
    const scopeLabel = isGlobalScope
      ? `Analisi Globale (${peers.length} biglietti) — ${t.name} è #${rankRtp} per RTP assoluto`
      : `Analisi Taglio ${fmtEur(activePrice)} (${peers.length} biglietti) — ${t.name} è #${rankRtp} per RTP nel taglio`;

    const vTitle = document.getElementById("tier-verdict-title");
    if (vTitle) {
      vTitle.textContent = scopeLabel;
    }

    const vBox = document.getElementById("tier-verdict-box");
    if (vBox) {
      const scopeWord = isGlobalScope ? "Assoluto" : "del Taglio";
      vBox.innerHTML = `
        <div class="verdict-item" data-id="${bestRtp.id}">
          <span class="verdict-tag" style="color:var(--accent)">Miglior Ritorno (RTP) ${scopeWord}</span>
          <span class="cell-main">${bestRtp.name} (${fmtDec(getRtp(bestRtp))}%)</span>
          <span class="cell-sub">Taglio ${fmtEur(bestRtp.price)} · Ritorno medio ${fmtEur(getEv(bestRtp))} (perdita: -${fmtEur(bestRtp.price - getEv(bestRtp))})</span>
        </div>
        <div class="verdict-item" data-id="${bestGain.id}">
          <span class="verdict-tag" style="color:var(--gain)">Più Frequente in Attivo ${scopeWord}</span>
          <span class="cell-main">${bestGain.name} (1 su ${fmtDec(bestGain.prob_gain_one_in)})</span>
          <span class="cell-sub">Taglio ${fmtEur(bestGain.price)} · Il ${fmtDec(bestGain.pct_gain)}% dei biglietti paga più del costo</span>
        </div>
        <div class="verdict-item" data-id="${bestJackpot.id}">
          <span class="verdict-tag" style="color:var(--even)">Miglior Premio Massimo ${scopeWord}</span>
          <span class="cell-main">${bestJackpot.name} (${fmtEur(getMax(bestJackpot))})</span>
          <span class="cell-sub">Taglio ${fmtEur(bestJackpot.price)} · Probabilità Jackpot: 1 su ${fmtInt(bestJackpot.max_prize_one_in)}</span>
        </div>
        <div class="verdict-item" data-id="${worstRtp.id}">
          <span class="verdict-tag" style="color:var(--loss)">RTP Più Basso ${scopeWord}</span>
          <span class="cell-main">${worstRtp.name} (${fmtDec(getRtp(worstRtp))}%)</span>
          <span class="cell-sub">Taglio ${fmtEur(worstRtp.price)} · Perdita media: -${fmtEur(worstRtp.price - getEv(worstRtp))} (${fmtDec(100 - getRtp(worstRtp))}% del costo)</span>
        </div>
      `;
      vBox.querySelectorAll(".verdict-item").forEach((card) => {
        card.addEventListener("click", () => {
          selectedId = card.getAttribute("data-id");
          renderAll();
        });
      });
    }

    const tiersBody = document.getElementById("tiers-body");
    tiersBody.innerHTML = t.tiers
      .map((tier) => {
        const displayPrize = showNetTax ? tier.net_prize : tier.prize;
        const netProfit = displayPrize - t.price;

        let taxSub = "Esente (≤ 500€)";
        let taxColor = "var(--muted)";
        if (tier.excluded_by_law) {
          taxSub = "Pareggio (0€ utile)";
          taxColor = "var(--even)";
        } else if (tier.tax > 0 && showNetTax) {
          taxSub = `Tassa 20%: -${fmtEur(tier.tax)}`;
          taxColor = "var(--loss)";
        } else if (tier.tax > 0 && !showNetTax) {
          taxSub = `Lordo (Tassa esclusa)`;
        }

        const subLabel = tier.excluded_by_law
          ? `<span style="color:var(--even)">Omessa da ADM</span>`
          : `Utile netto: +${fmtEur(netProfit)}`;

        return `
        <tr>
          <td data-label="Fascia Premio">
            <span class="cell-main" style="font-family:var(--font-mono)">${fmtEur(tier.prize)}</span>
            <span class="cell-sub">${subLabel}</span>
          </td>
          <td class="num" data-label="Incasso Netto">
            <span class="cell-main">${fmtEur(displayPrize)}</span>
            <span class="cell-sub" style="color:${taxColor}">${taxSub}</span>
          </td>
          <td class="num" data-label="Biglietti nel Lotto">
            <span class="cell-main">${fmtInt(tier.winners)}</span>
            <span class="cell-sub">su ${fmtInt(t.lotto)}</span>
          </td>
          <td class="num" data-label="Probabilità">
            <span class="cell-main">1 su ${fmtDec(tier.one_in)}</span>
            <span class="cell-sub">${fmtDec(tier.pct, 5)}%</span>
          </td>
        </tr>`;
      })
      .join("");
  }

  function runSimulation(count) {
    const t = data.find((x) => x.id === selectedId) || data[0];
    if (!t) return;
    let spent = 0;
    let won = 0;
    let gainCount = 0;
    let evenCount = 0;
    const points = [0];
    const step = Math.max(1, Math.floor(count / 50));

    for (let i = 1; i <= count; i++) {
      spent += t.price;
      let r = Math.random() * t.lotto;
      let acc = 0;
      for (const tier of t.tiers) {
        acc += tier.winners;
        if (r < acc) {
          won += showNetTax ? tier.net_prize : tier.prize;
          if (tier.prize <= t.price) evenCount++;
          else gainCount++;
          break;
        }
      }
      if (i % step === 0 || i === count) points.push(won - spent);
    }

    const netBalance = won - spent;
    document.getElementById("sim-result").innerHTML = `
      Spesa: <strong>${fmtEur(spent)}</strong> (${fmtInt(count)} bigl.) |
      Vinto: <strong>${fmtEur(won)}</strong> |
      Bilancio Netto: <strong style="color:${netBalance >= 0 ? "var(--gain)" : "var(--loss)"}">${fmtEur(netBalance)}</strong>
      <span style="color:var(--muted); display:block; margin-top:4px; font-size:11.5px;">
        Esito biglietti: ${fmtInt(count - gainCount - evenCount)} perdenti (0€) · ${fmtInt(evenCount)} pareggi (${fmtEur(t.price)}) · ${fmtInt(gainCount)} in attivo (&gt;${fmtEur(t.price)})
      </span>
    `;

    const svg = document.getElementById("sim-chart");
    if (!svg) return;
    const minVal = Math.min(0, ...points);
    const maxVal = Math.max(10, ...points);
    const range = maxVal - minVal || 1;
    const w = 520, h = 110;
    const zeroY = h - ((0 - minVal) / range) * (h - 20) - 10;

    const coords = points
      .map((val, idx) => {
        const x = (idx / (points.length - 1)) * (w - 20) + 10;
        const y = h - ((val - minVal) / range) * (h - 20) - 10;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

    const strokeColor = netBalance >= 0 ? "var(--gain)" : "var(--loss)";
    svg.innerHTML = `
      <line x1="10" y1="${zeroY}" x2="${w - 10}" y2="${zeroY}" stroke="var(--border-strong)" stroke-dasharray="4 4" stroke-width="1"/>
      <polyline fill="none" stroke="${strokeColor}" stroke-width="2.2" points="${coords}"/>
      <text x="14" y="${Math.max(14, zeroY - 5)}" fill="var(--muted)" font-size="10" font-family="monospace">Pareggio (0 €)</text>
    `;
  }

  function renderAll() {
    renderTable();
    renderPriceTierChart();
    renderDetail();
    renderRecentWins();
    runSimulation(100);
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("search-input").addEventListener("input", (e) => {
      searchQuery = e.target.value;
      renderTable();
    });
    document.getElementById("sort-select").addEventListener("change", (e) => {
      sortMode = e.target.value;
      renderTable();
    });
    document.getElementById("tax-toggle").addEventListener("click", (e) => {
      showNetTax = !showNetTax;
      e.target.textContent = showNetTax ? "Calcolo: Netto (Tassa 20% inclusa)" : "Calcolo: Lordo (Senza tassa 20%)";
      e.target.classList.toggle("active", showNetTax);
      renderAll();
    });
    document.getElementById("theme-toggle").addEventListener("click", (e) => {
      const root = document.documentElement;
      const isDark = root.getAttribute("data-theme") === "dark";
      const nextTheme = isDark ? "light" : "dark";
      root.setAttribute("data-theme", nextTheme);
      e.target.textContent = nextTheme === "dark" ? "Tema: Scuro" : "Tema: Chiaro";
    });
    document.querySelectorAll(".sim-btn").forEach((btn) => {
      btn.addEventListener("click", () => runSimulation(Number(btn.getAttribute("data-n"))));
    });
    renderAll();
  });
})();
