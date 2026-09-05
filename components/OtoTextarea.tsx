// İçeriğine göre uzayan metin kutusu.
//
// Sabit yükseklikli textarea, uzun maddelerde (YGG toplantı gündemi, DÖF
// ayrıntı listeleri) dikey kaydırma çubuğu çıkarıp metnin çoğunu gizliyordu:
// rapor ekranda okunamıyordu. Bu kutu içeriği kadar uzar, kaydırma çubuğu
// çıkmaz; kullanıcı isterse köşeden yine büyütüp küçültebilir.
import React from 'react';

const OtoTextarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (p) => {
    const ref = React.useRef<HTMLTextAreaElement>(null);
    React.useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.style.height = 'auto';                        // ÖNCE sıfırla: yoksa
        el.style.height = (el.scrollHeight + 2) + 'px';  // kutu yalnız büyür, küçülmez
    }, [p.value]);
    return <textarea ref={ref} {...p}
        style={{ overflowY: 'hidden', resize: 'vertical', minHeight: '3.5em', ...(p.style || {}) }} />;
};

export default OtoTextarea;
