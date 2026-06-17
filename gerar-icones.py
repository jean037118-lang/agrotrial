"""
Script para gerar os icones necessarios para o Tauri.
Execute: python gerar-icones.py

Requer Pillow: pip install Pillow
"""

import os
import sys

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("Instalando Pillow...")
    os.system(f"{sys.executable} -m pip install Pillow")
    from PIL import Image, ImageDraw, ImageFont

def criar_icone_agrotrial(tamanho):
    """Cria um icone simples para o AgroTrial CRM"""
    img = Image.new('RGBA', (tamanho, tamanho), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Fundo verde
    margem = tamanho // 8
    draw.rounded_rectangle(
        [margem, margem, tamanho - margem, tamanho - margem],
        radius=tamanho // 6,
        fill=(34, 139, 34)
    )
    
    # Simbolo de planta (circulo branco no centro)
    centro = tamanho // 6
    raio = tamanho // 4
    draw.ellipse(
        [centro - raio, centro - raio, centro + raio, centro + raio],
        fill=(255, 255, 255)
    )
    
    # Haste da planta
    draw.rectangle(
        [centro - tamanho//16, centro, centro + tamanho//16, tamanho - margem * 2],
        fill=(255, 255, 255)
    )
    
    return img

def gerar_todos_icones():
    pasta_icones = os.path.join("src-tauri", "icons")
    os.makedirs(pasta_icones, exist_ok=True)
    
    print("Gerando icones para o AgroTrial CRM...")
    
    # PNG basico 54x54
    img32 = criar_icone_agrotrial(32)
    img32.save(os.path.join(pasta_icones, "32x32.png"), "PNG")
    print("  [OK] 32x32.png")
    
    # PNG 128x128
    img128 = criar_icone_agrotrial(128)
    img128.save(os.path.join(pasta_icones, "128x128.png"), "PNG")
    print("  [OK] 128x128.png")
    
    # PNG 256x256 (128@2x)
    img256 = criar_icone_agrotrial(256)
    img256.save(os.path.join(pasta_icones, "128x128@2x.png"), "PNG")
    print("  [OK] 128x128@2x.png")
    
    # ICO para Windows (multi-tamanho)
    img256_ico = criar_icone_agrotrial(256)
    ico_path = os.path.join(pasta_icones, "icon.ico")
    img256_ico.save(
        ico_path,
        format="ICO",
        sizes=[(16,16), (32,32), (48,48), (64,64), (128,128), (256,256)]
    )
    print("  [OK] icon.ico")
    
    # ICNS para Mac (opcional, mas evita erro)
    try:
        img_icns = criar_icone_agrotrial(1024)
        icns_path = os.path.join(pasta_icones, "icon.icns")
        img_icns.save(icns_path, format="ICNS")
        print("  [OK] icon.icns")
    except Exception as e:
        # .icns é opcional no Windows
        print(f"  [AVISO] icon.icns nao gerado (normal no Windows): {e}")
        # Copia o ico como fallback
        import shutil
        shutil.copy(ico_path, os.path.join(pasta_icones, "icon.icns"))
    
    print()
    print("Icones gerados com sucesso em:", pasta_icones)
    print()
    print("DICA: Para usar seu proprio logo, substitua os arquivos em")
    print(f"      {pasta_icones} pelos seus icones personalizados.")

if __name__ == "__main__":
    gerar_todos_icones()
