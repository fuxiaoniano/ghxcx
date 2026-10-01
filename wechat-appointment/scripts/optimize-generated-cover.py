from pathlib import Path
import sys

from PIL import Image, ImageOps


LIMIT_BYTES = 500 * 1024


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("用法：optimize-generated-cover.py <输入图片> <输出.webp>")

    source = Path(sys.argv[1])
    target = Path(sys.argv[2])
    target.parent.mkdir(parents=True, exist_ok=True)

    with Image.open(source) as opened:
        image = ImageOps.exif_transpose(opened)
        if image.mode in ("RGBA", "LA") or "transparency" in image.info:
            rgba = image.convert("RGBA")
            background = Image.new("RGB", rgba.size, "white")
            background.paste(rgba, mask=rgba.getchannel("A"))
            image = background
        else:
            image = image.convert("RGB")

        if image.width > 1600:
            height = max(1, round(image.height * 1600 / image.width))
            image = image.resize((1600, height), Image.Resampling.LANCZOS)

        current = image
        for scale_round in range(7):
            for quality in (88, 82, 76, 70, 64, 58, 52, 46, 40):
                current.save(target, "WEBP", quality=quality, method=6, optimize=True)
                if target.stat().st_size <= LIMIT_BYTES:
                    return
            next_width = max(640, round(current.width * 0.85))
            if next_width >= current.width:
                break
            next_height = max(1, round(current.height * next_width / current.width))
            current = current.resize((next_width, next_height), Image.Resampling.LANCZOS)

    raise SystemExit("无法在保持可用画质的情况下将封面压缩到 500KB 以内")


if __name__ == "__main__":
    main()
