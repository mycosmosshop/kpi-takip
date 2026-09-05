// Excel/PDF kütüphaneleri açılışta 594 KB (gzip) indiriliyordu; hat ~38 KB/s
// olduğunda bu tek başına ~16 saniye. Artık ilk kullanımda yüklenirler.
type Ad = 'XLSX' | 'ExcelJS' | 'html2pdf';

const YOL: Record<Ad, string> = {
    XLSX: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    ExcelJS: 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js',
    html2pdf: 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
};

const bekleyen: Partial<Record<Ad, Promise<any>>> = {};

/** Kütüphaneyi ilk kullanımda yükler. Aynı kütüphane için tek indirme yapılır;
 *  indirme başarısız olursa yeniden denenebilsin diye söz kaydı silinir. */
export const kutuphaneYukle = (ad: Ad): Promise<any> => {
    const w = window as any;
    if (w[ad]) return Promise.resolve(w[ad]);
    if (!bekleyen[ad]) {
        bekleyen[ad] = new Promise((coz, red) => {
            const s = document.createElement('script');
            s.src = YOL[ad];
            s.onload = () => w[ad]
                ? coz(w[ad])
                : red(new Error(ad + ' yüklendi ama tanımlı değil.'));
            s.onerror = () => {
                delete bekleyen[ad];
                red(new Error(ad + ' kütüphanesi indirilemedi (internet bağlantısını kontrol edin).'));
            };
            document.head.appendChild(s);
        });
    }
    return bekleyen[ad]!;
};
