# Cari Hesap Defteri

Küçük işletmeler ve serbest çalışanlar için geliştirilmiş, mobil öncelikli (mobile-first) bir alacak/borç takip uygulaması. Verileri buluta kaydeder, birden fazla cihazdan aynı hesapla giriş yapılabilir ve tarayıcıya "uygulama gibi" (PWA) eklenebilir.

**Canlı demo:** https://effortless-peony-5f6014.netlify.app *(localStorage tabanlı, tek cihazlık ilk sürüm)*

## Özellikler

- **Kullanıcı hesabı ve kimlik doğrulama** — e-posta/şifre ile kayıt olma ve giriş yapma (Supabase Auth)
- **Çoklu cihaz senkronizasyonu** — aynı hesapla farklı cihazlardan giriş yapıp aynı verileri görme
- **Satır bazlı güvenlik (Row Level Security)** — her kullanıcı yalnızca kendi kayıtlarına erişebilir, veritabanı seviyesinde garanti altına alınmıştır
- **Cari hesap takibi** — her kişi/şirket için ayrı hesap, "Alacak" (bana borçlu) veya "Verecek" (ben borçluyum) olarak sınıflandırılır
- **Hareket bazlı defter** — her hesaba birden fazla "iş/borç" ve "ödeme" kaydı eklenebilir; kalan tutar otomatik hesaplanır
- **Kayıt düzenleme ve silme** — geçmiş hareketler sonradan düzeltilebilir
- **Yedekleme / geri yükleme** — tüm veriler okunabilir bir `.json` dosyası olarak dışa aktarılabilir ve aynı ya da başka bir hesaba geri yüklenebilir
- **Salt okunur paylaşım ekranı** — başka birinin gönderdiği yedek dosyası, kendi kayıtlarına karışmadan ayrı bir ekranda görüntülenebilir
- **Ana ekrana eklenebilir (PWA benzeri)** — Safari/Chrome üzerinden "Ana Ekrana Ekle" ile bağımsız bir uygulama gibi açılır

## Kullanılan Teknolojiler

- Vanilla JavaScript (framework yok, sıfırdan state yönetimi)
- HTML5 / CSS3
- **Supabase** — PostgreSQL veritabanı, kimlik doğrulama ve Row Level Security
- Web Share API (dosya paylaşımı için)
- Netlify (statik barındırma, GitHub reposuna bağlı otomatik deploy)

## Mimari

```
Tarayıcı (Vanilla JS)
        │
        ▼
  Supabase Client (@supabase/supabase-js)
        │
        ▼
  Supabase (PostgreSQL + Auth + RLS)
   ├── accounts       → cari hesaplar (kişi/şirket, tür)
   └── transactions   → hesaba bağlı iş/borç ve ödeme hareketleri
```

Her kullanıcının verisi `user_id` kolonu ve Row Level Security politikaları ile izole edilir; bir kullanıcı asla başka bir kullanıcının verisine erişemez.

## Proje Yapısı

```
cari-hesap-defteri/
├── index.html       → sayfa iskeleti
├── css/
│   └── style.css    → tüm görünüm/stil (giriş ekranı dahil)
├── js/
│   └── app.js        → uygulama mantığı, Supabase entegrasyonu, state yönetimi
└── README.md
```

## Yerelde Çalıştırma

1. Reposu klonla: `git clone <repo-url>`
2. Kendi Supabase projeni oluştur, `accounts` ve `transactions` tablolarını kur (RLS politikalarıyla birlikte)
3. `js/app.js` içindeki `SUPABASE_URL` ve `SUPABASE_ANON_KEY` değerlerini kendi projenle değiştir
4. `index.html` dosyasını bir tarayıcıda aç (ya da `npx serve` gibi basit bir yerel sunucu ile çalıştır)

## Yol Haritası

- [x] Gerçek zamanlı çoklu cihaz senkronizasyonu (Supabase)
- [x] Kullanıcı girişi ile temel güvenlik (e-posta/şifre + RLS)
- [ ] Vade takibi ve uygulama içi hatırlatmalar
- [ ] Arama ve gelişmiş sıralama
- [ ] Hesap dökümünü PDF olarak dışa aktarma

## Lisans

Bu proje kişisel/portföy amaçlı geliştirilmiştir.
