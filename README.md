# Khairul Irsyad — Personal Portfolio

Website portfolio statis menggunakan HTML, CSS, dan JavaScript murni. Tidak membutuhkan framework, server, database, atau build step — termasuk halaman admin-nya.

## Menjalankan website
1. Buka `index.html` di browser untuk melihat situs.
2. Buka `admin.html` untuk mengelola isi (proyek, kategori, layanan, testimoni, identitas, kontak).
3. Upload seluruh isi folder ke hosting statis (GitHub Pages, Netlify, Cloudflare Pages, atau hosting biasa).

## File
| File | Isi |
|---|---|
| `index.html` | struktur halaman publik |
| `style.css` | desain & responsive layout situs |
| `script.js` | merender seluruh isi dari data: hero, proyek + filter, layanan, testimoni, kontak, popup video |
| `portfolio-data.js` | **satu-satunya sumber isi** (`window.PORTFOLIO`). Ditulis oleh `admin.html`, tetap boleh disunting manual |
| `shared.js` | utilitas bersama situs & admin (pembaca URL YouTube, draf) |
| `admin.html`, `admin.js`, `admin.css` | halaman admin |
| `admin-gate.js` | gerbang PIN admin |
| `admin-config.js` | hash PIN admin (ditulis oleh admin.html, tanpa PIN asli) |

## PIN admin
1. Saat `admin.html` pertama dibuka, muncul layar **Buat PIN admin** (min. 6 karakter, tidak boleh angka berulang/berurutan).
2. Klik **Simpan PIN**, lalu pilih/timpa `admin-config.js` di folder ini (Firefox/Safari: berkasnya diunduh — timpakan manual). **Unggah `admin-config.js` ke hosting.**
3. Berikutnya admin meminta PIN. Setelah benar, admin tetap terbuka sampai tab ditutup. Lima kali salah → dijeda 30 detik, makin lama bila terus salah.
4. Menu **⋯** → **Ganti PIN admin…** atau **Kunci admin**.
5. **Lupa PIN:** buka `admin-config.js`, kosongkan nilai `"pinHash"`, lalu buka `admin.html` untuk membuat PIN baru.

⚠️ PIN ini penghalang untuk pengunjung iseng, bukan pengamanan sungguhan — situs statis tidak punya server untuk memeriksanya. Yang terlindungi hanya tampilan admin; admin memang tidak bisa mengubah situs online. Perlindungan terkuat tetap: **jangan unggah berkas `admin*` ke hosting.**

## Mengelola isi lewat admin.html
1. Buka `admin.html` (sebaiknya di **Chrome atau Edge**).
2. Tambah/ubah/hapus/urutkan item di tab **Proyek, Kategori, Layanan, Testimoni, Identitas, Kontak**.
   Setiap perubahan otomatis tersimpan sebagai **draf** di browser ini — menutup tab tidak menghilangkannya.
3. Klik **Pratinjau ↗** untuk melihat situs dengan draf tersebut (`index.html?preview=1`, ada bilah "MODE PRATINJAU" di bawah). Pengunjung lain tidak pernah melihat draf.
4. Klik **Simpan ke berkas** (atau Ctrl+S). Pertama kali, pilih berkas `portfolio-data.js` di folder ini lalu izinkan browser menimpanya. Kunjungan berikutnya cukup klik izinkan.
   - Firefox/Safari tidak bisa menulis berkas langsung: berkas `portfolio-data.js` diunduh — timpakan ke folder ini.
5. **Upload `portfolio-data.js` ke hosting.** Selama belum diupload, situs online tetap menampilkan isi lama.

Menu **⋯** berisi: Unduh portfolio-data.js (cadangan), Impor berkas data (memuat `portfolio-data.js` format lama maupun baru), dan Buang draf.

### Aturan yang dijaga admin
- **Proyek**: judul, kategori, dan URL YouTube wajib; URL non-YouTube ditolak. Thumbnail boleh kosong — otomatis diambil dari YouTube. Proyek bisa **disembunyikan** (draf) atau **diduplikat**. Peran, software, dan deskripsi tampil di bawah video saat diputar.
- **Kategori**: menjadi tombol filter. Ganti nama ikut memperbarui semua proyeknya; kategori yang masih dipakai tidak bisa dihapus; nama "All" dicadangkan.
- **Testimoni**: wajib mencentang izin klien. Bagian testimoni di situs muncul otomatis bila ada isinya.
- **Kontak**: nomor WhatsApp disimpan sebagai angka saja (format internasional 62…), ada tautan uji wa.me.

## Catatan
- `admin.html` tidak bisa mengubah situs online, hanya berkas di komputer pemakainya. Bila tidak ingin terlihat, jangan upload berkas `admin*` (situs tetap berjalan).
- **Video tidak berputar (Error 153)?** YouTube menolak pemutar dari halaman yang dibuka langsung dengan klik ganda (`file://`). Buka lewat server lokal (mis. ekstensi Live Server di VS Code) atau dari hosting. Dari `file://`, pemutar diganti tombol "Tonton di YouTube".
- **Bentuk kartu:** video Shorts otomatis tampil tegak 9:16 (8 per baris). Untuk video tegak yang diunggah sebagai video biasa, pilih "Portrait" di form proyek admin.
- Video YouTube harus mengizinkan embedding. Google Fonts & YouTube memerlukan koneksi internet.
- Foto/thumbnail sendiri: simpan di folder `images/` lalu isi path relatif, mis. `images/portrait.webp`. Kompres ke WebP agar cepat.
- Jangan memasukkan testimoni tanpa izin klien.
