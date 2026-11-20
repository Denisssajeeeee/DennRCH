const form = document.getElementById("reactionForm");
const urlInput = document.getElementById("url");
const reactionInput = document.getElementById("reaction");
const submitBtn = document.getElementById("submitBtn");
const statusBox = document.getElementById("status");

const menuToggle = document.getElementById("menuToggle");
const menuPanel = document.getElementById("menuPanel");

const modalOverlay = document.getElementById("modalOverlay");
const modalClose = document.getElementById("modalClose");
const modalBody = document.getElementById("modalBody");

const LIMIT_KEY = "denn_reaction_last";
const LIMIT_MS = 24 * 60 * 60 * 1000;

const CHANNEL_URL = "https://whatsapp.com/channel/0029Vb8gmt1HwXbFTbXXY43y";
const PROFILE_URL = "https://denncode.vercel.app/";

const MODAL_CONTENT = {
  info: `
    <h2>Informasi Layanan</h2>
    <p class="modal-sub">Panduan singkat penggunaan DennCode Reaction.</p>

    <div class="info-box">
      <p><strong>Limit harian: 1 reaction per 24 jam.</strong> Kuota direset otomatis setelah 24 jam sejak pengiriman terakhir.</p>
    </div>

    <p><strong>Cara mendapatkan link pesan saluran:</strong></p>
    <ul>
      <li>Buka pesan di channel WhatsApp yang ingin direaksi.</li>
      <li>Tekan lama pesan tersebut, lalu pilih <strong>Salin Tautan</strong> (Copy Link).</li>
      <li>Tempel link di kolom input, lalu pilih emoji dan kirim.</li>
    </ul>

    <p><strong>Reaction yang didukung:</strong> semua emoji standar WhatsApp (🔥, ❤️, 👍, 😂, dll).</p>

    <p style="font-size:12px;color:#6B7280;">Pastikan link diawali <code>https://whatsapp.com/channel/...</code> agar valid.</p>
  `,

  developer: `
    <h2>Channel Developer</h2>
    <p class="modal-sub">Ikuti channel resmi DennCode untuk update & info terbaru.</p>

    <div class="info-box">
      <p>Channel ini berisi pengumuman fitur baru, maintenance, dan tips seputar WhatsApp automation.</p>
    </div>

    <p>Klik tombol di bawah untuk bergabung ke channel developer:</p>

    <div class="btn-row">
      <a class="btn-modal primary" href="${CHANNEL_URL}" target="_blank" rel="noopener">
        Gabung Channel
      </a>
      <button class="btn-modal ghost" id="copyChannelUrl" type="button">Salin Link</button>
    </div>
  `,

  profile: `
    <h2>Profil Developer</h2>
    <p class="modal-sub">Kenali pembuat DennCode lebih dekat.</p>

    <div class="profile-url">${PROFILE_URL}</div>

    <p>Website pribadi DennCode berisi portfolio, project, dan informasi kontak. Kunjungi untuk melihat karya lainnya.</p>

    <div class="btn-row">
      <a class="btn-modal primary" href="${PROFILE_URL}" target="_blank" rel="noopener">
        Buka Website
      </a>
      <button class="btn-modal ghost" id="copyProfileUrl" type="button">Salin URL</button>
    </div>
  `
};

function toggleMenu(forceState) {
  const isOpen = typeof forceState === "boolean"
    ? forceState
    : !menuPanel.classList.contains("open");

  menuPanel.classList.toggle("open", isOpen);
  menuToggle.classList.toggle("open", isOpen);
  menuToggle.setAttribute("aria-expanded", String(isOpen));
}

function bindCopyButton(buttonId, text) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = "Tersalin!";
      setTimeout(() => { btn.textContent = buttonId === "copyChannelUrl" ? "Salin Link" : "Salin URL"; }, 1500);
    } catch {
      btn.textContent = "Gagal salin";
      setTimeout(() => { btn.textContent = buttonId === "copyChannelUrl" ? "Salin Link" : "Salin URL"; }, 1500);
    }
  });
}

function openModal(key) {
  modalBody.innerHTML = MODAL_CONTENT[key] || "<p>Konten tidak ditemukan.</p>";
  modalOverlay.classList.add("open");
  document.body.style.overflow = "hidden";

  bindCopyButton("copyChannelUrl", CHANNEL_URL);
  bindCopyButton("copyProfileUrl", PROFILE_URL);
}

function closeModal() {
  modalOverlay.classList.remove("open");
  document.body.style.overflow = "";
}

menuToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleMenu();
});

document.addEventListener("click", (e) => {
  if (!menuPanel.contains(e.target) && !menuToggle.contains(e.target)) {
    toggleMenu(false);
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    toggleMenu(false);
    closeModal();
  }
});

menuPanel.querySelectorAll("a[data-modal]").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const key = link.dataset.modal;
    toggleMenu(false);
    openModal(key);
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

function getRemaining() {
  const last = Number(localStorage.getItem(LIMIT_KEY) || 0);
  if (!last) return 0;
  return Math.max(0, LIMIT_MS - (Date.now() - last));
}

function formatRemaining(ms) {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return `${hours} jam ${minutes} menit`;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const remaining = getRemaining();
  if (remaining > 0) {
    showStatus(`Limit harian sudah digunakan. Coba lagi dalam ${formatRemaining(remaining)}.`, "error");
    return;
  }

  const url = urlInput.value.trim();
  const reaction = reactionInput.value.trim();

  if (!url || !reaction) {
    showStatus("Link pesan dan emoji wajib diisi.", "error");
    return;
  }

  if (!/^https?:\/\//i.test(url)) {
    showStatus("Masukkan link WhatsApp yang valid.", "error");
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
      throw new Error(data.message || data.error || `Server error (${response.status})`);
    }

    localStorage.setItem(LIMIT_KEY, String(Date.now()));
    showStatus(data.message || "Reaction berhasil dikirim.", "success");
  } catch (error) {
    showStatus(error.message || "Gagal menghubungi server.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Kirim Sekarang";
  }
});