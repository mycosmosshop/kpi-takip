// Yeni sürüm yayınlandığında kullanıcıyı uyarır.
//
// NEDEN: GitHub Pages index.html'i 10 dakika önbellekliyor ve tarayıcı açık
// sekmede eski sürümü çalıştırmaya devam ediyor. Kullanıcı yaptığımız
// değişikliği göremeyip "yapılmamış" sanıyordu (6 kez yaşandı); tek çare
// elle Ctrl+Shift+R idi. Artık uygulama kendi sürümünü izliyor.
//
// Nasıl: Vite her yapıda JS dosyasına yeni bir hash veriyor
// (assets/index-<hash>.js). index.html önbelleksiz çekilip içindeki dosya
// adı, ŞU AN çalışan dosyanın adıyla karşılaştırılıyor.

const dosyaAdi = (metin: string): string | null => {
    const m = /assets\/index-[A-Za-z0-9_-]+\.js/.exec(metin);
    return m ? m[0] : null;
};

// Şu an çalışan paketin adı. import.meta.url derlemede gerçek dosya URL'si
// olur; bulunamazsa DOM'daki script etiketine düşülür.
export const calisanSurum = (kendiUrl: string, belge?: Document): string | null => {
    const kendi = dosyaAdi(kendiUrl || '');
    if (kendi) return kendi;
    try {
        const s = (belge || document).querySelector('script[src*="assets/index-"]');
        return s ? dosyaAdi(s.getAttribute('src') || '') : null;
    } catch { return null; }
};

// index.html'deki sürüm, çalışandan farklı mı? Fark YOKSA ya da okunamazsa
// false — şüphede uyarı göstermek, sürekli yanlış alarm demek olurdu.
export const yeniSurumVar = (html: string, calisan: string | null): boolean => {
    if (!calisan) return false;
    const yayindaki = dosyaAdi(html || '');
    return !!yayindaki && yayindaki !== calisan;
};

export const surumIzle = (
    bildir: () => void,
    aralikMs = 5 * 60 * 1000,
    getir: (u: string) => Promise<string> = async (u) => {
        const r = await fetch(u, { cache: 'no-store' });
        return r.ok ? r.text() : '';
    },
): (() => void) => {
    const calisan = calisanSurum(import.meta.url);
    if (!calisan) return () => { /* sürüm okunamadı: izleme yok */ };
    const adres = location.pathname.replace(/[^/]*$/, '') || '/';
    let durdu = false;
    const bak = async () => {
        if (durdu) return;
        try {
            if (yeniSurumVar(await getir(adres + '?_s=' + Date.now()), calisan)) {
                durdu = true;           // bir kez uyar, her turda tekrarlama
                bildir();
            }
        } catch { /* çevrimdışı olabilir; bir sonraki turda yeniden bakılır */ }
    };
    const z = setInterval(bak, aralikMs);
    // Sekmeye geri dönüldüğünde de bak: uzun süre açık kalan sekme en çok
    // bu durumda geride kalıyor.
    const gorunur = () => { if (document.visibilityState === 'visible') bak(); };
    document.addEventListener('visibilitychange', gorunur);
    setTimeout(bak, 30 * 1000);
    return () => {
        durdu = true;
        clearInterval(z);
        document.removeEventListener('visibilitychange', gorunur);
    };
};
