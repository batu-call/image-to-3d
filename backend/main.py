import math
import os
import random
import shutil
import threading
import time
import traceback
import uuid
from contextlib import contextmanager
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from gradio_client import Client, handle_file
from PIL import Image, ImageFilter

# rembg opsiyonel: kuruluysa arka planı yerelde siler (pip install rembg onnxruntime)
try:
    from rembg import new_session, remove as rembg_remove
except Exception:
    rembg_remove = None
    new_session = None

# Yüz algılama için OpenCV (pip install opencv-python-headless numpy)
try:
    import cv2
    import numpy as np

    _face_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )
    if _face_cascade.empty():
        _face_cascade = None
except Exception:
    cv2 = None
    np = None
    _face_cascade = None

load_dotenv()  # backend/.env dosyasını okur

BASE_DIR = Path(__file__).parent
UPLOAD_DIR = BASE_DIR / "uploads"
OUTPUT_DIR = BASE_DIR / "outputs"
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
MAX_SIZE = 10 * 1024 * 1024  # 10 MB

RESOLUTIONS = {"standard": "512", "high": "1024", "ultra": "1024"}

# --- Ayarlar (.env ile değiştirilebilir) ---
# Space bu değerleri kabul etmezse kod otomatik olarak 300000 / 2048'e düşer.
DECIMATION_TARGET = int(os.getenv("DECIMATION_TARGET", 500000))
TEXTURE_SIZE = int(os.getenv("TEXTURE_SIZE", 4096))
# Kaç farklı seed ile üretilsin (her biri kota ve süre harcar)
NUM_SEEDS = max(1, int(os.getenv("NUM_SEEDS", 2)))
# Portrede yüzü algılayıp kafa-omuz kadrajına kırp
FACE_CROP = os.getenv("FACE_CROP", "1") == "1"

SPACE_NAME = "microsoft/TRELLIS.2"
HF_TOKEN = os.getenv("HF_TOKEN")

if not HF_TOKEN:
    print("[UYARI] HF_TOKEN bulunamadı. .env dosyasını kontrol et. Token olmadan istekler yavaş/timeout olabilir.")
if rembg_remove is None:
    print("[BİLGİ] rembg kurulu değil, yerel arka plan silme yedeği kapalı.")
if _face_cascade is None:
    print("[BİLGİ] OpenCV yok, yüz kırpma kapalı (pip install opencv-python-headless).")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Üretilen GLB dosyaları /outputs/<id>.glb adresinden servis edilir
app.mount("/outputs", StaticFiles(directory=OUTPUT_DIR), name="outputs")

# İşler bellekte tutulur (sunucu yeniden başlarsa silinir)
jobs: dict[str, dict] = {}

# Tek işçi: aynı anda tek üretim, kota ve oturum karışmasın
executor = ThreadPoolExecutor(max_workers=1)


def make_client() -> Client:
    if not HF_TOKEN:
        return Client(SPACE_NAME)
    try:
        return Client(SPACE_NAME, token=HF_TOKEN)
    except TypeError:  # eski gradio_client sürümü
        return Client(SPACE_NAME, hf_token=HF_TOKEN)


def as_path(x):
    return x["path"] if isinstance(x, dict) else x


def set_job(job_id: str, **fields):
    jobs[job_id].update(fields)


@contextmanager
def creeping(job_id: str, start: float, end: float, est_seconds: float):
    """Uzun süren bir adım boyunca yüzdeyi start -> end arasında yavaş yavaş artırır.
    Gerçek ilerleme bilgisi olmadığı için tahminidir; asla end'i geçmez."""
    stop = threading.Event()

    def loop():
        t0 = time.time()
        while not stop.wait(0.5):
            frac = 1 - math.exp(-(time.time() - t0) / est_seconds)
            val = round(start + (end - start) * frac * 0.97, 1)
            if val > jobs[job_id].get("progress", 0):
                set_job(job_id, progress=val)

    th = threading.Thread(target=loop, daemon=True)
    th.start()
    try:
        yield
    finally:
        stop.set()
        th.join()


def crop_head(img: Image.Image, scale: float = 2.4, tag: str = "") -> Image.Image:
    """Yüzü bulup kafa + hafif omuz kadrajına kırpar.
    Yüz bulunamazsa (nesne, yan profil vb.) görseli değiştirmeden döndürür.
    Kırpma, küçültmeden ÖNCE yapılır ki yüz orijinal çözünürlüğünü korusun."""
    if _face_cascade is None:
        return img

    rgb = np.array(img.convert("RGB"))
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)

    # Büyük görselde algılama yavaşlamasın diye küçük kopyada ara
    det_scale = min(1.0, 800 / max(gray.shape))
    small = cv2.resize(gray, None, fx=det_scale, fy=det_scale) if det_scale < 1 else gray
    min_face = max(40, small.shape[1] // 20)
    faces = _face_cascade.detectMultiScale(
        small, scaleFactor=1.1, minNeighbors=5, minSize=(min_face, min_face)
    )
    if len(faces) == 0:
        print(f"[{tag}] yüz bulunamadı, kırpma atlandı")
        return img

    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])  # en büyük yüz
    x, y, w, h = [v / det_scale for v in (x, y, w, h)]
    cx, cy = x + w / 2, y + h / 2 + h * 0.15  # saç ve çene dengesi için biraz aşağı
    half = max(w, h) * scale / 2
    l = int(max(cx - half, 0))
    t = int(max(cy - half, 0))
    r = int(min(cx + half, img.width))
    b = int(min(cy + half, img.height))
    print(f"[{tag}] yüz bulundu, kırpılıyor: {(l, t, r, b)}")
    return img.crop((l, t, r, b))


def clean_image(src: Path, dst: Path, max_side: int = 1024, tag: str = "") -> Path:
    """Görseli temiz bir PNG'ye çevirir: EXIF yönü düzelir, CMYK/palette -> RGB(A),
    portrede yüze kırpılır, gerekirse küçültülür/büyütülür."""
    from PIL import ImageOps

    img = Image.open(src)
    img = ImageOps.exif_transpose(img)
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGBA" if "A" in img.getbands() else "RGB")

    if FACE_CROP:
        img = crop_head(img, tag=tag)
        # Kırpma sonrası çok küçük kaldıysa arka plan silme için büyüt
        if min(img.size) < 768:
            f = 768 / min(img.size)
            img = img.resize((round(img.width * f), round(img.height * f)), Image.LANCZOS)
        # Göz/ağız kenarlarını hafifçe belirginleştir
        if img.mode == "RGB":
            img = img.filter(ImageFilter.UnsharpMask(radius=1.2, percent=50, threshold=3))

    if max(img.size) > max_side:
        img.thumbnail((max_side, max_side), Image.LANCZOS)
    img.save(dst, format="PNG")
    return dst


# Portre/insan için en iyi modelden başlar, yoksa sıradakine düşer
REMBG_MODELS = ["birefnet-portrait", "isnet-general-use", "u2net_human_seg", "u2net"]
_rembg_session = None


def get_rembg_session():
    global _rembg_session
    if _rembg_session is not None or new_session is None:
        return _rembg_session
    for name in REMBG_MODELS:
        try:
            _rembg_session = new_session(name)
            print(f"[BİLGİ] rembg modeli: {name}")
            return _rembg_session
        except Exception as e:
            print(f"[BİLGİ] rembg modeli '{name}' yüklenemedi: {type(e).__name__}")
    return None


def crop_square(img: Image.Image, size: int = 1024, fill: float = 0.86) -> Image.Image:
    """Şeffaf PNG'de nesneyi bulur, kare tuvalin ortasına yerleştirir.
    Nesne karenin ~%86'sını doldurur (3D modeller ortalanmış, dolu kadrajı sever)."""
    a = img.getchannel("A")
    bbox = a.point(lambda v: 255 if v > 20 else 0).getbbox()
    if not bbox:
        return img
    obj = img.crop(bbox)
    w, h = obj.size
    scale = (size * fill) / max(w, h)
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    obj = obj.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(obj, ((size - nw) // 2, (size - nh) // 2), obj)
    return canvas


def local_remove_bg(src: Path, dst: Path) -> Path:
    """rembg ile arka planı siler, kenar halesini temizler, nesneyi ortalayıp kareye yerleştirir."""
    img = Image.open(src).convert("RGB")
    session = get_rembg_session()
    kw = {"session": session} if session else {}
    try:
        out = rembg_remove(
            img,
            alpha_matting=True,
            alpha_matting_foreground_threshold=240,
            alpha_matting_background_threshold=10,
            alpha_matting_erode_size=10,
            post_process_mask=True,
            **kw,
        )
    except Exception as e:
        print(f"[BİLGİ] alpha matting başarısız ({type(e).__name__}), düz maske kullanılıyor")
        out = rembg_remove(img, post_process_mask=True, **kw)

    out = out.convert("RGBA")
    # Kenardaki yeşil hale/yarı saydam pikselleri temizle
    a = out.getchannel("A")
    a = a.point(lambda v: 0 if v < 40 else v)
    a = a.filter(ImageFilter.MinFilter(3))
    out.putalpha(a)

    out = crop_square(out)
    out.save(dst, format="PNG")
    return dst


def extract_glb(client: Client, tag: str):
    """Yüksek ayarla dener, Space reddederse güvenli ayarlara düşer."""
    try:
        return client.predict(
            decimation_target=DECIMATION_TARGET,
            texture_size=TEXTURE_SIZE,
            api_name="/extract_glb",
        )
    except Exception as e:
        if (DECIMATION_TARGET, TEXTURE_SIZE) == (300000, 2048):
            raise
        print(f"[{tag}] extract_glb yüksek ayarla başarısız ({type(e).__name__}), 300000/2048 deneniyor")
        return client.predict(
            decimation_target=300000,
            texture_size=2048,
            api_name="/extract_glb",
        )


def run_job(job_id: str, image_path: Path, resolution: str):
    tag = job_id[:6]
    step = "init"
    try:
        print(f"[{tag}] başladı, resolution={resolution}, dosya={image_path.name}, seeds={NUM_SEEDS}")
        set_job(job_id, status="running", progress=5)

        # Görseli temizle (EXIF, renk modu, yüz kırpma, boyut)
        step = "temizleme"
        clean_path = clean_image(image_path, UPLOAD_DIR / f"{job_id}_clean.png", tag=tag)
        print(f"[{tag}] görsel temizlendi")

        step = "client"
        client = make_client()
        print(f"[{tag}] client ok")

        step = "start_session"
        client.predict(api_name="/start_session")
        set_job(job_id, progress=15)
        print(f"[{tag}] start_session ok")

        step = "preprocess_image"
        processed = None

        # 1) rembg ile yerel arka plan silme (en iyi sonuç)
        if rembg_remove is not None:
            try:
                step = "yerel_arkaplan_silme"
                nobg = local_remove_bg(clean_path, UPLOAD_DIR / f"{job_id}_nobg.png")
                processed = str(nobg)
                print(f"[{tag}] yerel arka plan silme ok (rembg) -> {nobg.name}")
            except Exception as e:
                traceback.print_exc()
                print(f"[{tag}] rembg başarısız ({type(e).__name__}), Space preprocess denenecek")

        # 2) rembg yok ya da çöktüyse Space'in preprocess adımı
        if processed is None:
            try:
                step = "preprocess_image"
                processed = client.predict(
                    input=handle_file(str(clean_path)), api_name="/preprocess_image"
                )
                print(f"[{tag}] preprocess_image ok -> {processed}")
            except Exception as e:
                print(f"[{tag}] Space preprocess_image başarısız: {type(e).__name__}")

        # 3) o da olmadıysa temizlenmiş görsel olduğu gibi
        if processed is None:
            processed = str(clean_path)
            print(f"[{tag}] son yedek: temizlenmiş görsel doğrudan gönderiliyor")

        # TEŞHİS: modele gönderilen görseli kaydet -> /outputs/<id>_input.png
        # Gözler burada bozuksa sorun girdi hazırlığındadır, burada iyiyse model sınırıdır.
        try:
            shutil.copy(as_path(processed), OUTPUT_DIR / f"{job_id}_input.png")
            set_job(job_id, input_url=f"/outputs/{job_id}_input.png")
        except Exception:
            pass
        set_job(job_id, progress=30)

        # Birden fazla seed: her biri farklı göz/ağız çıkarabilir
        seeds = [random.randint(0, 2147483647) for _ in range(NUM_SEEDS)]
        span = (98 - 30) / NUM_SEEDS
        results: list[str] = []

        for i, seed in enumerate(seeds):
            base = 30 + span * i
            mid = base + span * 0.5
            end = base + span
            try:
                step = f"image_to_3d (seed {i + 1}/{NUM_SEEDS})"
                with creeping(job_id, base, mid, est_seconds=40):
                    client.predict(
                        image=handle_file(as_path(processed)),
                        seed=seed,
                        resolution=resolution,
                        api_name="/image_to_3d",
                    )
                set_job(job_id, progress=round(mid, 1))
                print(f"[{tag}] image_to_3d ok (seed {seed})")

                step = f"extract_glb (seed {i + 1}/{NUM_SEEDS})"
                with creeping(job_id, mid, end, est_seconds=45):
                    result = extract_glb(client, tag)
                glb_path = as_path(result[0] if isinstance(result, (tuple, list)) else result)

                out_name = f"{job_id}_s{i + 1}.glb"
                shutil.copy(glb_path, OUTPUT_DIR / out_name)
                results.append(f"/outputs/{out_name}")
                # model_url ilk sonuç: mevcut frontend bozulmaz. model_urls hepsini içerir.
                set_job(job_id, model_url=results[0], model_urls=list(results), progress=round(end, 1))
                print(f"[{tag}] seed {i + 1} bitti -> {out_name}")
            except Exception as e:
                traceback.print_exc()
                print(f"[{tag}] seed {i + 1} başarısız: {type(e).__name__}")
                if not results:
                    raise  # hiç sonuç yoksa işi başarısız say
                break  # en az bir sonuç var, kota bitmiş olabilir; eldekilerle devam

        set_job(job_id, status="done", progress=100)
        print(f"[{tag}] bitti ({len(results)} model)")
    except Exception as e:
        traceback.print_exc()
        print(f"[{tag}] HATA adımı: {step}")
        set_job(job_id, status="failed", error=f"[{step}] {type(e).__name__}: {e}")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/debug/space-api")
def space_api():
    """Space'in güncel endpoint ve parametre listesini döndürür (teşhis için)."""
    try:
        client = make_client()
        return client.view_api(return_format="dict")
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}")


@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Sadece png, jpg, jpeg, webp yüklenebilir")

    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="Dosya 10 MB'dan büyük olamaz")

    name = f"{uuid.uuid4().hex}{ext}"
    (UPLOAD_DIR / name).write_bytes(content)
    return {"filename": name, "size_kb": round(len(content) / 1024, 1)}


@app.post("/api/image-to-3d")
async def image_to_3d(image: UploadFile = File(...), quality: str = Form("high")):
    ext = Path(image.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Sadece png, jpg, jpeg, webp yüklenebilir")

    content = await image.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="Dosya 10 MB'dan büyük olamaz")

    job_id = uuid.uuid4().hex
    image_path = UPLOAD_DIR / f"{job_id}{ext}"
    image_path.write_bytes(content)

    resolution = RESOLUTIONS.get(quality.lower(), "1024")
    jobs[job_id] = {"status": "queued", "progress": 0, "created": time.time()}
    executor.submit(run_job, job_id, image_path, resolution)

    return {"job_id": job_id, "status": "queued"}


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="İş bulunamadı (sunucu yeniden başlamış olabilir)")
    return {"job_id": job_id, **{k: v for k, v in job.items() if k != "created"}}