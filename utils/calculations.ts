
import { Kpi, Status, ReviewPeriod } from '../types';
import { AYLAR } from '../constants';

// Bir ay aktif mi? TEK kontrol = "Veri Girilmeyecek Aylar" (pasifAylar).
// Gözden Geçirme Periyodu artık hücreyi kilitlemez; yalnızca bu listeyi ön-doldurmak için preset olarak kullanılır
// (KpiModal'da periyot seçilince + eski veri için tek seferlik migrasyonda).
export const isMonthActive = (kpi: Kpi, monthIndex: number): boolean => {
    return !(kpi.pasifAylar?.includes(AYLAR[monthIndex]));
};

// Bir periyodun pasifleştireceği ayları döndürür (periyot = "Veri Girilmeyecek Aylar" preset'i).
export const derivePasifAylarFromPeriod = (period?: string): string[] => {
    if (!period || period === 'aylik') return [];
    const off: string[] = [];
    for (let i = 0; i < 12; i++) {
        const m = i + 1;
        let active = true;
        switch (period) {
            case '2aylik': active = m % 2 === 0; break;
            case '3aylik': active = m % 3 === 0; break;
            case '4aylik': active = m % 4 === 0; break;
            case '6aylik': active = m % 6 === 0; break;
            case 'yillik': active = m === 12; break;
            default: active = true;
        }
        if (!active) off.push(AYLAR[i]);
    }
    return off;
};


export const evaluateFormula = (kpi: Kpi): number | null => {
    if (!kpi.formula || kpi.formula.trim() === '') return null;

    const aylikDegerler = Object.entries(kpi.aylik)
        .filter(([month, value]) => {
            const monthIndex = AYLAR.indexOf(month);
            return value !== null && typeof value === 'number' && isMonthActive(kpi, monthIndex);
        })
        .map(([, value]) => value as number);
        
    if (aylikDegerler.length === 0 && /\baylar\b/.test(kpi.formula)) return null;

    try {
        let formula = kpi.formula;

        // 1. Normalize formula: Add spaces around operators to tokenize.
        formula = formula.replace(/(\+|-|\*|\/|\(|\))/g, ' $1 ');

        const keywords = ['aylar', 'hedef', 'SUM', 'AVG', 'COUNT', 'SQRT', 'POW'];
        const keywordPart = `(?:${keywords.join('|')})`;

        // 2. Handle concatenated keywords like `hedefSQRT` -> `hedef * SQRT`
        const combinedKeywordsRegex = new RegExp(`\\b${keywordPart}${keywordPart}+\\b`, 'g');
        formula = formula.replace(combinedKeywordsRegex, (match) => {
            let result = '';
            let currentMatch = match;
            while (currentMatch.length > 0) {
                let found = false;
                for (const kw of keywords) {
                    if (currentMatch.startsWith(kw)) {
                        if (result !== '') {
                            result += ' * ';
                        }
                        result += kw;
                        currentMatch = currentMatch.substring(kw.length);
                        found = true;
                        break;
                    }
                }
                if (!found) { // Should not happen with this regex, but for safety
                    result += currentMatch;
                    break;
                }
            }
            return result;
        });

        // 3. Handle numbers followed by keywords e.g., `2hedef` -> `2 * hedef`
        const numKeywordRegex = new RegExp(`(\\b\\d+\\.?\\d*\\b)(${keywordPart})`, 'g');
        formula = formula.replace(numKeywordRegex, '$1 * $2');
        
        // 4. Handle closing parenthesis followed by keyword or number e.g., `(2+3)hedef` -> `(2+3) * hedef`
        const parenKeywordRegex = new RegExp(`(\\))\\s*(${keywordPart}|\\b\\d+\\.?\\d*\\b)`, 'g');
        formula = formula.replace(parenKeywordRegex, '$1 * $2');

        // 5. Clean up multiple spaces
        formula = formula.replace(/\s+/g, ' ').trim();


        const sandbox = {
            aylar: aylikDegerler,
            hedef: kpi.yeni_yil_hedef,
            SUM: (arr: number[]) => arr.reduce((a, b) => a + b, 0),
            AVG: (arr: number[]) => (arr.length > 0 ? sandbox.SUM(arr) / arr.length : 0),
            COUNT: (arr: number[]) => arr.length,
            SQRT: Math.sqrt,
            POW: Math.pow,
            // Prevent access to global objects for security
            window: undefined,
            document: undefined,
            localStorage: undefined,
            fetch: undefined,
            setTimeout: undefined,
            setInterval: undefined,
            alert: undefined,
            console: { log: () => {}, error: () => {}, warn: () => {} },
        };
        
        const keys = Object.keys(sandbox);
        const values = Object.values(sandbox);
        const evaluator = new Function(...keys, `"use strict"; return ${formula}`);
        const result = evaluator(...values);

        if (typeof result === 'number' && isFinite(result)) {
            return parseFloat(result.toFixed(2));
        }
        console.error("Formula did not return a valid number:", result, "from formula:", formula);
        return null;
    } catch (e) {
        console.error("Formula evaluation error:", e, "from formula:", kpi.formula);
        return null;
    }
};


export const calculateAverage = (kpi: Kpi): number | null => {
    if (kpi.hesap_metodu === 'formula') {
        return evaluateFormula(kpi);
    }
    
    const validMonths = Object.entries(kpi.aylik)
        .filter(([month, value]) => {
            const monthIndex = AYLAR.indexOf(month);
            return value !== null && typeof value === 'number' && isMonthActive(kpi, monthIndex);
        })
        .map(([, value]) => value as number);

    if (validMonths.length === 0) return null;

    switch (kpi.hesap_metodu) {
        case 'ortalama': {
            const sum = validMonths.reduce((a, b) => a + b, 0);
            return parseFloat((sum / validMonths.length).toFixed(2));
        }
        case 'medyan': {
            const sorted = [...validMonths].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        }
        case 'yilici_kumulatif': {
            const currentMonthIndex = new Date().getMonth();
            const filledMonths = Object.entries(kpi.aylik)
                .slice(0, currentMonthIndex + 1)
                .filter(([month, value]) => {
                     const monthIndex = AYLAR.indexOf(month);
                     return value !== null && typeof value === 'number' && isMonthActive(kpi, monthIndex);
                })
                .map(([, value]) => value as number);

             if (filledMonths.length === 0) return null;
            const sum = filledMonths.reduce((a, b) => a + b, 0);
            return parseFloat((sum / filledMonths.length).toFixed(2));
        }
        default:
            return null;
    }
};

export const determineStatus = (kpi: Kpi, average: number | null): Status => {
    if (average === null) return 'n/a';
    const hedef = kpi.yeni_yil_hedef;
    const fark = Math.abs(average - hedef);
    const yuzdeFark = hedef === 0 ? (average === 0 ? 0 : Infinity) : fark / hedef;

    switch (kpi.karsilastirma) {
        case '<':
            if (average < hedef) return 'basarili';
            if (average === hedef || yuzdeFark <= 0.05) return 'marjinal';
            return 'basarisiz';
        case '<=':
            if (average <= hedef) return 'basarili';
            if (yuzdeFark <= 0.05) return 'marjinal';
            return 'basarisiz';
        case '>':
            if (average > hedef) return 'basarili';
            if (average === hedef || yuzdeFark <= 0.05) return 'marjinal';
            return 'basarisiz';
        case '>=':
            if (average >= hedef) return 'basarili';
            if (yuzdeFark <= 0.05) return 'marjinal';
            return 'basarisiz';
        case '=':
            if (yuzdeFark <= 0.02) return 'basarili';
            if (yuzdeFark <= 0.05) return 'marjinal';
            return 'basarisiz';
        default:
            return 'n/a';
    }
};

export const getSingleMonthStatus = (kpi: Kpi, value: number | null): Status => {
    if (value === null) return 'n/a';
    const hedef = kpi.yeni_yil_hedef;

    switch (kpi.karsilastirma) {
        case '<':
            if (value < hedef) return 'basarili';
            return value === hedef ? 'marjinal' : 'basarisiz';
        case '<=':
            return value <= hedef ? 'basarili' : 'basarisiz';
        case '>':
            if (value > hedef) return 'basarili';
            return value === hedef ? 'marjinal' : 'basarisiz';
        case '>=':
            return value >= hedef ? 'basarili' : 'basarisiz';
        case '=': {
            const fark = Math.abs(value - hedef);
            const yuzdeFark = hedef === 0 ? (value === 0 ? 0 : Infinity) : fark / hedef;
            if (yuzdeFark <= 0.02) return 'basarili';
            if (yuzdeFark <= 0.05) return 'marjinal';
            return 'basarisiz';
        }
        default:
            return 'n/a';
    }
};

export const getStatusColorClasses = (status: Status): string => {
    switch (status) {
        case 'basarili':
            return 'bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200';
        case 'marjinal':
            return 'bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200';
        case 'basarisiz':
            return 'bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200';
        default:
            return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
    }
};
