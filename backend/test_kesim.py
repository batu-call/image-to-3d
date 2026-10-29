from pathlib import Path

from main import local_remove_bg

# Gerekirse dosya yollarını kendine göre değiştir
GIRDI = Path("uploads/15.jpg")
CIKTI = Path("kesim.png")

print("Başlıyor, ilk seferde birkaç dakika sürebilir. Ctrl+C'ye basma...")
local_remove_bg(GIRDI, CIKTI)
print(f"bitti -> {CIKTI}")