from PIL import Image
import os, sys

app = sys.argv[1]
SIZES = {'mdpi':48,'hdpi':72,'xhdpi':96,'xxhdpi':144,'xxxhdpi':192}
FG = {'mdpi':108,'hdpi':162,'xhdpi':216,'xxhdpi':324,'xxxhdpi':432}
base = '/home/user/sudan-online-store/android/app/src/main/res'
src = Image.open(f'/home/user/app-icons/{app}.png').convert('RGBA')
for d, s in SIZES.items():
    p = f'{base}/mipmap-{d}'
    os.makedirs(p, exist_ok=True)
    src.resize((s, s), Image.LANCZOS).save(f'{p}/ic_launcher.png')
    src.resize((s, s), Image.LANCZOS).save(f'{p}/ic_launcher_round.png')
for d, s in FG.items():
    p = f'{base}/mipmap-{d}'
    inner = int(s * 0.62)
    canvas = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    art = src.resize((inner, inner), Image.LANCZOS)
    canvas.paste(art, ((s - inner) // 2, (s - inner) // 2), art)
    canvas.save(f'{p}/ic_launcher_foreground.png')
print('icons ready for', app)
