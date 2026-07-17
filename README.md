# Cari Hesap Defteri

Küçük işletmeler ve serbest çalışanlar için geliştirilmiş, mobil öncelikli (mobile-first) bir alacak/borç takip uygulaması. Sunucu gerektirmeden çalışır, tarayıcıya "uygulama gibi" (PWA) eklenebilir ve verileri cihazda saklar.

**Canlı demo:** https://effortless-peony-5f6014.netlify.app

## Özellikler

- **Cari hesap takibi** — her kişi/şirket için ayrı hesap, "Alacak" (bana borçlu) veya "Verecek" (ben borçluyum) olarak sınıflandırılır
- **Hareket bazlı defter** — her hesaba birden fazla "iş/borç" ve "ödeme" kaydı eklenebilir; kalan tutar otomatik hesaplanır
- **Kayıt düzenleme ve silme** — geçmiş hareketler sonradan düzeltilebilir
- **Yedekleme / geri yükleme** — tüm veriler okunabilir bir `.json` dosyası olarak dışa aktarılabilir ve aynı ya da başka bir cihaza geri yüklenebilir
- **Salt okunur paylaşım ekranı** — başka birinin gönderdiği yedek dosyası, kendi kayıtlarına karışmadan ayrı bir ekranda görüntülenebilir
- **Ana ekrana eklenebilir (PWA benzeri)** — Safari/Chrome üzerinden "Ana Ekrana Ekle" ile bağımsız bir uygulama gibi açılır
- **Offline çalışır** — internet bağlantısı olmadan da kullanılabilir

## Kullanılan Teknolojiler

- Vanilla JavaScript (framework yok, sıfırdan state yönetimi)
- HTML5 / CSS3
- Web Storage API (`localStorage`)
- Web Share API (dosya paylaşımı için)
- Netlify (statik barındırma)

## Proje Yapısı

```
cari-hesap-defteri/
├── index.html       → sayfa iskeleti
├── css/
│   └── style.css    → tüm görünüm/stil
├── js/
│   └── app.js        → uygulama mantığı (state yönetimi, render, veri işlemleri)
└── README.md
```

## Yerelde Çalıştırma

Bu proje herhangi bir derleme/kurulum adımı gerektirmez:

1. Reposu klonla: `git clone <repo-url>`
2. `index.html` dosyasını bir tarayıcıda aç (ya da `npx serve` gibi basit bir yerel sunucu ile çalıştır)

## Yol Haritası

- [ ] Gerçek zamanlı çoklu cihaz senkronizasyonu (Supabase)
- [ ] PIN / şifre ile erişim koruması
- [ ] Vade takibi ve uygulama içi hatırlatmalar
- [ ] Arama ve gelişmiş sıralama
- [ ] Hesap dökümünü PDF olarak dışa aktarma

## Lisans

Bu proje kişisel/portföy amaçlı geliştirilmiştir.
