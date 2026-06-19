# KPI Takip Tablosu

Kapsamlı bir KPI (Anahtar Performans Göstergesi) takip uygulaması. Proses ve KPI
bilgilerini, aylık hedefleri ve gerçekleşmeleri izler; renk kodlaması ve sembollerle
hedef başarı durumunu görselleştirir, risk analizi yapar ve düzeltici faaliyetlerin
(DÖF) yönetilmesine olanak tanır.

- **Stack:** Vite + React 19 + TypeScript
- **Veri:** Tamamen tarayıcıda (localStorage); JSON içe/dışa aktarma desteği
- **Dağıtım:** GitHub Pages (Actions ile otomatik) — ERP Portal modülü olarak kullanılır

## Yerel çalıştırma

**Önkoşul:** Node.js

```bash
npm install
npm run dev
```

## Derleme

```bash
npm run build
```

Çıktı `dist/` klasörüne üretilir. `main` dalına push yapıldığında GitHub Actions
otomatik olarak GitHub Pages'e dağıtır (`.github/workflows/deploy.yml`).
