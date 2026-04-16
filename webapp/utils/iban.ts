export function isValidIBANNumber(iban: string): boolean {
    // Boşlukları temizle ve büyük harfe çevir
    const stripped = iban.replace(/\s+/g, "").toUpperCase();
    
    // Uluslararası IBAN uzunlukları 15 ile 34 karakter arasındadır
    if (stripped.length < 15 || stripped.length > 34) {
        return false;
    }
    
    // Yalnızca harf ve rakam içerebilir
    if (!/^[A-Z0-9]+$/.test(stripped)) {
        return false;
    }

    // İlk 4 karakteri sona al
    const rearranged = stripped.substring(4) + stripped.substring(0, 4);

    // Harfleri sayılara dönüştür (A=10, B=11 ... Z=35)
    let numericalString = "";
    for (let i = 0; i < rearranged.length; i++) {
        const charCode = rearranged.charCodeAt(i);
        if (charCode >= 65 && charCode <= 90) {
            numericalString += (charCode - 55).toString();
        } else {
            numericalString += rearranged[i];
        }
    }

    // Modulo 97 hesabı (BigInt JS standartıdır, 20+ haneli sayılar için şarttır)
    try {
        return BigInt(numericalString) % 97n === 1n;
    } catch (e) {
        return false;
    }
}
