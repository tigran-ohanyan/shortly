(function () {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const fmtDate = (iso) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  let toastTimer;
  const toast = (m) => { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2000); };
  const keyHeader = () => { const k = $("input[name=api_key]").value.trim(); return k ? { "X-API-Key": k } : {}; };

  async function api(path, options = {}) {
    const res = await fetch("/api" + path, { ...options, headers: { "Content-Type": "application/json", ...keyHeader(), ...(options.headers || {}) } });
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
  }

  // shorten --------------------------------------------------------------
  const form = $("#shorten-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    $("#form-error").textContent = "";
    const body = { url: form.url.value.trim() };
    if (form.slug.value.trim()) body.slug = form.slug.value.trim();
    if (form.expires_in_days.value) body.expires_in_days = Number(form.expires_in_days.value);
    if (!body.url) { $("#form-error").textContent = "Paste a URL first."; return; }
    $("#shorten-btn").disabled = true;
    try {
      const link = await api("/links", { method: "POST", body: JSON.stringify(body) });
      $("#result-link").textContent = link.short_url; $("#result-link").href = link.short_url;
      $("#result-meta").textContent = `→ ${link.url}${link.expires_at ? ` · expires ${fmtDate(link.expires_at)}` : ""}`;
      $("#result").hidden = false;
      form.url.value = ""; form.slug.value = "";
      $("#stats-slug").value = link.slug;
      await Promise.all([loadStats(link.slug), loadRecent()]);
    } catch (err) { $("#form-error").textContent = err.message; }
    finally { $("#shorten-btn").disabled = false; }
  });
  $("#copy-btn").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText($("#result-link").href); toast("Copied"); }
    catch { toast("Copy failed, select the link manually"); }
  });

  // stats ------------------------------------------------------------------
  async function loadStats(slug) {
    const body = $("#stats-body");
    try {
      const link = await api(`/links/${encodeURIComponent(slug)}`);
      const s = link.stats, max = Math.max(1, ...s.per_day.map((d) => d.count));
      const list = (rows, key) => rows.length ? `<ul class="list">${rows.map((r) => `<li><div class="row"><span>${esc(r[key])}</span><span class="muted">${r.count}</span></div><div class="track"><i style="width:${(r.count / rows[0].count) * 100}%"></i></div></li>`).join("")}</ul>` : `<p class="muted small">No data yet</p>`;
      body.innerHTML = `
        <div class="stats-head">
          <div><a href="${esc(link.short_url)}" target="_blank" rel="noopener"><strong>${esc(link.short_url)}</strong></a><div class="muted small">→ ${esc(link.url)}</div></div>
          <div><span class="total">${s.total}</span> <span class="muted">clicks${s.last_click ? ` · last ${fmtDate(s.last_click)}` : ""}</span></div>
        </div>
        <div class="stats-grid">
          <div><h3>Last 7 days</h3><div class="bars">${s.per_day.map((d) => `<div class="bar"><div class="fill" data-count="${d.count}" style="height:${(d.count / max) * 100}%"></div><span>${fmtDate(d.day).split(" ")[0]}</span></div>`).join("")}</div></div>
          <div><h3>Referrers</h3>${list(s.referrers, "referrer")}</div>
          <div><h3>Browsers</h3>${list(s.browsers, "browser")}</div>
        </div>`;
    } catch (err) { body.innerHTML = `<p class="error">${esc(err.message)}</p>`; }
  }
  $("#stats-form").addEventListener("submit", (e) => { e.preventDefault(); const slug = $("#stats-slug").value.trim().split("/").pop(); if (slug) loadStats(slug); });

  // recent -------------------------------------------------------------------
  async function loadRecent() {
    const tbody = $("#recent-table tbody");
    try {
      const links = await api("/links?limit=20");
      $("#recent-note").textContent = links.length ? "" : "No links yet.";
      tbody.innerHTML = links.map((l) => `<tr>
        <td><a href="${esc(l.short_url)}" target="_blank" rel="noopener">/${esc(l.slug)}</a></td>
        <td class="dest" title="${esc(l.url)}">${esc(l.url)}</td>
        <td class="num">${l.clicks}</td>
        <td class="muted">${fmtDate(l.created_at)}</td>
        <td><button data-stats="${esc(l.slug)}">Stats</button> <button data-del="${esc(l.slug)}">Delete</button></td></tr>`).join("");
    } catch (err) { tbody.innerHTML = ""; $("#recent-note").textContent = err.message === "API key required" ? "Enter the API key in Options to see and manage links." : err.message; }
  }
  $("#recent-table").addEventListener("click", async (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.stats) { $("#stats-slug").value = b.dataset.stats; await loadStats(b.dataset.stats); $("#stats").scrollIntoView({ behavior: "smooth" }); }
    if (b.dataset.del) { try { await api(`/links/${b.dataset.del}`, { method: "DELETE" }); toast("Deleted"); await loadRecent(); } catch (err) { toast(err.message); } }
  });
  $("#refresh-recent").addEventListener("click", loadRecent);
  $("input[name=api_key]").addEventListener("change", loadRecent);
  loadRecent();
})();
