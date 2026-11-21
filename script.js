const form = document.getElementById("reactionForm");
const urlInput = document.getElementById("url");
const reactionInput = document.getElementById("reaction");
const submitBtn = document.getElementById("submitBtn");
const statusBox = document.getElementById("status");
const limitText = document.getElementById("limitText");

const menuToggle = document.getElementById("menuToggle");
const menuPanel = document.getElementById("menuPanel");
const modalOverlay = document.getElementById("modalOverlay");
const modalClose = document.getElementById("modalClose");
const modalBody = document.getElementById("modalBody");

const CHANNEL_URL = "https://whatsapp.com/channel/0029Vb8gmt1HwXbFTbXXY43y";
const PROFILE_URL = "https://denncode.vercel.app/";
const DAILY_LIMIT = 3;

const MODAL_CONTENT = {
  info: `
    <h2>Informasi Layanan</h2>
    <p class="modal-sub">Panduan singkat penggunaan DennCode Reaction.</p>
    <div class="info-box">
      <p><strong>Limit harian: ${DAILY_LIMIT}x per 24 jam</strong>, dihitung per perangkat (IP). Kuota direset otomatis 24 jam sejak pemakaian pertama.</p>
    </div>
    <p><strong>Cara mendapatkan link pesan saluran:</strong></p>
    <ul>
      <li>Buka pesan di channel WhatsApp yang ingin direaksi.</li>
      <li>Tekan lama pesan tersebut, lalu pilih <strong>Salin Tautan</strong>.</li>
      <li>Tempel link di kolom input, pilih emoji, lalu kirim.</li>
    </ul>
    <p><strong>Reaction yang didukung:</strong> semua emoji standar WhatsApp (🔥, ❤️, 👍, 😂, dll).</p>
    <p style="font-size:12px;color:#6B7280;">Pastikan link diawali <code>https://whatsapp.com/channel/...</code>.</p>
  `,
  developer: `
    <h2>Channel Developer</h2>
    <p class="modal-sub">Ikuti channel resmi DennCode untuk update & info terbaru.</p>
    <div class="info-box">
      <p>Channel ini berisi pengumuman fitur baru, maintenance, dan tips seputar WhatsApp automation.</p>
    </div>
    <div class="btn-row">
      <a class="btn-modal primary" href="${CHANNEL_URL}" target="_blank" rel="noopener">Gabung Channel</a>
      <button class="btn-modal ghost" id="copyChannelUrl" type="button">Salin Link</button>
    </div>
  `,
  profile: `
    <h2>Profil Developer</h2>
    <p class="modal-sub">Kenali pembuat DennCode lebih dekat.</p>
    <div class="profile-url">${PROFILE_URL}</div>
    <div class="btn-row">
      <a class="btn-modal primary" href="${PROFILE_URL}" target="_blank" rel="noopener">Buka Website</a>
      <button class="btn-modal ghost" id="copyProfileUrl" type="button">Salin URL</button>
    </div>
  `
};

function updateLimitDisplay(remaining, resetIn = 0) {
  if (remaining <= 0) {
    const hours = resetIn > 0 ? Math.ceil(resetIn / 3600) : 24;
    limitText.textContent = `Limit habis • Reset ${hours} jam`;
  } else {
    limitText.textContent = `Sisa ${remaining}/${DAILY_LIMIT} hari ini`;
  }
}

async function loadLimitStatus() {
  try {
    const res = await fetch("/api/reaction", { method: "GET" });
    const data = await res.json();
    updateLimitDisplay(data.remaining ?? DAILY_LIMIT, data.resetIn ?? 0);
  } catch {
    updateLimitDisplay(DAILY_LIMIT);
  }
}

function toggleMenu(force) {
  const open = typeof force === "boolean" ? force : !menuPanel.classList.contains("open");
  menuPanel.classList.toggle("open", open);
  menuToggle.classList.toggle("open", open);
  menuToggle.setAttribute("aria-expanded", String(open));
}

function bindCopy(btnId, text) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const original = btn.textContent;
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = "Tersalin!";
    } catch {
      btn.textContent = "Gagal salin";
    }
    setTimeout(() => { btn.textContent = original; }, 1500);
  });
}

function openModal(key) {
  modalBody.innerHTML = MODAL_CONTENT[key] || "<p>Konten tidak ditemukan.</p>";
  modalOverlay.classList.add("open");
  document.body.style.overflow = "hidden";
  bindCopy("copyChannelUrl", CHANNEL_URL);
  bindCopy("copyProfileUrl", PROFILE_URL);
}

function closeModal() {
  modalOverlay.classList.remove("open");
  document.body.style.overflow = "";
}

menuToggle.addEventListener("click", (e) => { e.stopPropagation(); toggleMenu(); });
document.addEventListener("click", (e) => {
  if (!menuPanel.contains(e.target) && !menuToggle.contains(e.target)) toggleMenu(false);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { toggleMenu(false); closeModal(); }
});
menuPanel.querySelectorAll("a[data-modal]").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    toggleMenu(false);
    openModal(link.dataset.modal);
  });
});
modalClose.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});

function showStatus(message, type = "") {
  statusBox.textContent = message;
  statusBox.className = `status ${type}`.trim();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const url = urlInput.value.trim();
  const reaction = reactionInput.value.trim();

  if (!url || !reaction) {
    showStatus("Link pesan dan emoji wajib diisi.", "error");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Mengirim...";

  try {
    const response = await fetch("/api/reaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, reaction })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 429) {
        updateLimitDisplay(0, data.resetIn || 86400);
      }
      throw new Error(data.message || `Server error (${response.status})`);
    }

    updateLimitDisplay(data.remaining ?? 0);
    showStatus(data.message || "Reaction berhasil dikirim.", "success");
  } catch (error) {
    showStatus(error.message || "Gagal menghubungi server.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Kirim Sekarang";
  }
});

loadLimitStatus();