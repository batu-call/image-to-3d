import os
import random
import shutil
import sys
import time

from gradio_client import Client, handle_file

IMAGE = sys.argv[1] if len(sys.argv) > 1 else "test.png"
RESOLUTION = "512"  # test için en hızlısı, kotayı az harcar. Sonra "1024" yaparız

token = os.getenv("HF_TOKEN")  # varsa hesabınla giriş yapar, yoksa anonim


def make_client():
    if not token:
        return Client("microsoft/TRELLIS.2")
    try:
        return Client("microsoft/TRELLIS.2", token=token)
    except TypeError:  # eski gradio_client sürümü
        return Client("microsoft/TRELLIS.2", hf_token=token)


def as_path(x):
    # Bazı sürümler yol yerine dict döndürebilir
    return x["path"] if isinstance(x, dict) else x


start = time.time()
client = make_client()

print("1/4 oturum başlıyor...")
client.predict(api_name="/start_session")

print("2/4 resim ön işleniyor (arka plan temizleme)...")
processed = client.predict(input=handle_file(IMAGE), api_name="/preprocess_image")

print("3/4 3D model üretiliyor (GPU kotası harcanır)...")
client.predict(
    image=handle_file(as_path(processed)),
    seed=random.randint(0, 2147483647),
    resolution=RESOLUTION,
    api_name="/image_to_3d",
)

print("4/4 GLB çıkarılıyor (yarım dakika sürebilir)...")
result = client.predict(
    decimation_target=300000,
    texture_size=2048,
    api_name="/extract_glb",
)

glb_path = as_path(result[0] if isinstance(result, (tuple, list)) else result)
shutil.copy(glb_path, "output.glb")
print(f"Bitti! output.glb kaydedildi ({time.time() - start:.0f} saniye)")