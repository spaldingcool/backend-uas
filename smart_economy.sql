-- ============================================
-- SMART ECONOMY - Database Schema
-- MySQL 8.0+
-- ============================================

CREATE DATABASE IF NOT EXISTS smart_economy
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE smart_economy;

-- ------------------------------------------------
-- 1. PENGGUNA / USERS
-- ------------------------------------------------
CREATE TABLE users (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nama         NVARCHAR(100)        NOT NULL,
  email        NVARCHAR(150)        NOT NULL UNIQUE,
  password     NVARCHAR(255)        NOT NULL,
  peran        ENUM('admin','pelaku_usaha','konsumen') NOT NULL DEFAULT 'konsumen',
  dibuat_pada  TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  diperbarui   TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ------------------------------------------------
-- 2. KATEGORI USAHA
-- ------------------------------------------------
CREATE TABLE kategori_usaha (
  id     SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nama   NVARCHAR(80) NOT NULL UNIQUE
);

INSERT INTO kategori_usaha (nama) VALUES
  ('Perdagangan Digital'),
  ('Keuangan & Fintech'),
  ('Logistik & Rantai Pasok'),
  ('Pertanian Cerdas'),
  ('Pariwisata Digital');

-- ------------------------------------------------
-- 3. USAHA / BISNIS
-- ------------------------------------------------
CREATE TABLE usaha (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id      INT UNSIGNED        NOT NULL,
  kategori_id  SMALLINT UNSIGNED   NOT NULL,
  nama_usaha   NVARCHAR(150)        NOT NULL,
  deskripsi    TEXT,
  kota         NVARCHAR(80),
  omzet_bulan  DECIMAL(15,2)       DEFAULT 0.00,
  status       ENUM('aktif','nonaktif','menunggu') NOT NULL DEFAULT 'menunggu',
  dibuat_pada  TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_usaha_user      FOREIGN KEY (user_id)     REFERENCES users(id)          ON DELETE CASCADE,
  CONSTRAINT fk_usaha_kategori  FOREIGN KEY (kategori_id) REFERENCES kategori_usaha(id) ON DELETE RESTRICT
);

-- ------------------------------------------------
-- 4. PRODUK
-- ------------------------------------------------
CREATE TABLE produk (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usaha_id     INT UNSIGNED   NOT NULL,
  nama_produk  NVARCHAR(150)   NOT NULL,
  harga        DECIMAL(12,2)  NOT NULL DEFAULT 0.00,
  stok         INT UNSIGNED   NOT NULL DEFAULT 0,
  satuan       NVARCHAR(20)    NOT NULL DEFAULT 'pcs',
  dibuat_pada  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_produk_usaha FOREIGN KEY (usaha_id) REFERENCES usaha(id) ON DELETE CASCADE
);

-- ------------------------------------------------
-- 5. TRANSAKSI
-- ------------------------------------------------
CREATE TABLE transaksi (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  produk_id       INT UNSIGNED        NOT NULL,
  pembeli_id      INT UNSIGNED        NOT NULL,
  jumlah          INT UNSIGNED        NOT NULL DEFAULT 1,
  total_harga     DECIMAL(15,2)       NOT NULL,
  metode_bayar    ENUM('transfer','dompet_digital','tunai','paylater') NOT NULL DEFAULT 'dompet_digital',
  status          ENUM('pending','dibayar','dikirim','selesai','batal') NOT NULL DEFAULT 'pending',
  dibuat_pada     TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_trx_produk  FOREIGN KEY (produk_id)  REFERENCES produk(id) ON DELETE RESTRICT,
  CONSTRAINT fk_trx_pembeli FOREIGN KEY (pembeli_id) REFERENCES users(id)  ON DELETE RESTRICT
);

-- ------------------------------------------------
-- 6. ANALITIK EKONOMI (ringkasan harian)
-- ------------------------------------------------
CREATE TABLE analitik_harian (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tanggal         DATE          NOT NULL UNIQUE,
  total_transaksi INT UNSIGNED  NOT NULL DEFAULT 0,
  total_nilai     DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  usaha_aktif     INT UNSIGNED  NOT NULL DEFAULT 0,
  pengguna_baru   INT UNSIGNED  NOT NULL DEFAULT 0
);

-- ------------------------------------------------
-- INDEX TAMBAHAN
-- ------------------------------------------------
CREATE INDEX idx_usaha_status   ON usaha(status);
CREATE INDEX idx_produk_usaha   ON produk(usaha_id);
CREATE INDEX idx_trx_status     ON transaksi(status);
CREATE INDEX idx_trx_tanggal    ON transaksi(dibuat_pada);
CREATE INDEX idx_analitik_tgl   ON analitik_harian(tanggal);

-- ------------------------------------------------
-- DATA CONTOH
-- ------------------------------------------------
INSERT INTO users (nama, email, password, peran) VALUES
  ('Admin Sistem', 'admin@smarteconomy.id', SHA2('admin123', 256), 'admin'),
  ('Budi Santoso',  'budi@mail.com',         SHA2('budi123',  256), 'pelaku_usaha'),
  ('Siti Rahma',    'siti@mail.com',         SHA2('siti123',  256), 'konsumen');

INSERT INTO usaha (user_id, kategori_id, nama_usaha, deskripsi, kota, omzet_bulan, status) VALUES
  (2, 1, 'Toko Digital Budi', 'Jual produk UMKM secara online', 'Medan', 15000000.00, 'aktif');

INSERT INTO produk (usaha_id, nama_produk, harga, stok, satuan) VALUES
  (1, 'Kopi Gayo Premium', 85000.00, 200, 'kg'),
  (1, 'Tenun Batak Motif Ulos', 350000.00, 50, 'lembar');

-- ------------------------------------------------
-- MIGRASI: sinkronisasi ENUM status
-- Jalankan pada database yang sudah ada
-- ------------------------------------------------
ALTER TABLE usaha
  MODIFY COLUMN status ENUM('aktif','nonaktif','menunggu') NOT NULL DEFAULT 'menunggu';

-- Konversi data lama sebelum alter transaksi
UPDATE transaksi SET status = 'pending'  WHERE status = 'menunggu';
UPDATE transaksi SET status = 'batal'    WHERE status = 'dibatalkan';

ALTER TABLE transaksi
  MODIFY COLUMN status ENUM('pending','dibayar','dikirim','selesai','batal') NOT NULL DEFAULT 'pending';