from __future__ import annotations

import argparse
import math
from pathlib import Path
from tkinter import Tk, filedialog

from PIL import Image, ImageDraw, ImageOps, ImageSequence


COLORS = {
    "red": "#EA4335",
    "blue": "#4285F4",
    "yellow": "#FBBC05",
    "green": "#34A853",
}

RESAMPLE = getattr(Image, "Resampling", Image).LANCZOS
ADAPTIVE_PALETTE = getattr(getattr(Image, "Palette", Image), "ADAPTIVE", Image.ADAPTIVE)

# Calibrated seam positions from the user's reference image.
# Pillow angles start at 3 o'clock and increase clockwise.
SEAMS = {
    "yellow_red": 206,
    "red_blue": 314,
    "blue_green": 48,
    "green_yellow": 138,
}

SEGMENTS = [
    ("red", SEAMS["yellow_red"], SEAMS["red_blue"]),
    ("blue", SEAMS["red_blue"], SEAMS["blue_green"]),
    ("green", SEAMS["blue_green"], SEAMS["green_yellow"]),
    ("yellow", SEAMS["green_yellow"], SEAMS["yellow_red"]),
]

DEFAULT_BORDER_RATIO = 0.04
DEFAULT_GAP_RATIO = 0.02


def pick_image_file() -> Path | None:
    root = Tk()
    root.withdraw()
    root.update()
    file_path = filedialog.askopenfilename(
        title="Choose an avatar image",
        filetypes=[
            ("Image Files", "*.png;*.jpg;*.jpeg;*.webp;*.bmp;*.gif"),
            ("PNG", "*.png"),
            ("JPEG", "*.jpg;*.jpeg"),
            ("GIF", "*.gif"),
            ("All Files", "*.*"),
        ],
    )
    root.destroy()
    return Path(file_path) if file_path else None


def segment_span(start_angle: int, end_angle: int) -> int:
    return (end_angle - start_angle) % 360


def calculate_layout(output_size: int, border_ratio: float, gap_ratio: float) -> tuple[int, int]:
    if output_size < 32:
        raise ValueError("Output size must be at least 32.")

    border_width = max(1, round(output_size * border_ratio))
    gap = max(1, round(output_size * gap_ratio))
    return border_width, gap


def sample_point_for_angle(center: float, radius: float, angle_deg: float) -> tuple[int, int]:
    radians = math.radians(angle_deg)
    x = center + radius * math.cos(radians)
    y = center + radius * math.sin(radians)
    return round(x), round(y)


def draw_ring_segments(draw: ImageDraw.ImageDraw, arc_box: tuple[int, int, int, int]) -> None:
    for color_name, start_angle, end_angle in SEGMENTS:
        if end_angle < start_angle:
            draw.pieslice(arc_box, start=start_angle, end=360, fill=COLORS[color_name])
            draw.pieslice(arc_box, start=0, end=end_angle, fill=COLORS[color_name])
        else:
            draw.pieslice(arc_box, start=start_angle, end=end_angle, fill=COLORS[color_name])


def build_avatar_canvas(
    source: Image.Image,
    output_size: int,
    border_width: int,
    gap: int,
) -> Image.Image:
    avatar_diameter = output_size - (border_width + gap) * 2
    avatar = ImageOps.fit(source.convert("RGBA"), (avatar_diameter, avatar_diameter), method=RESAMPLE)

    avatar_mask = Image.new("L", (avatar_diameter, avatar_diameter), 0)
    mask_draw = ImageDraw.Draw(avatar_mask)
    mask_draw.ellipse((0, 0, avatar_diameter - 1, avatar_diameter - 1), fill=255)

    circular_avatar = Image.new("RGBA", (avatar_diameter, avatar_diameter), (0, 0, 0, 0))
    circular_avatar.paste(avatar, (0, 0), avatar_mask)

    canvas = Image.new("RGBA", (output_size, output_size), (0, 0, 0, 0))
    ring_layer = Image.new("RGBA", (output_size, output_size), (0, 0, 0, 0))
    ring_draw = ImageDraw.Draw(ring_layer)

    outer_ring_box = (0, 0, output_size - 1, output_size - 1)
    draw_ring_segments(ring_draw, outer_ring_box)

    hole_margin = border_width
    ring_hole_box = (
        hole_margin,
        hole_margin,
        output_size - hole_margin - 1,
        output_size - hole_margin - 1,
    )
    ring_draw.ellipse(ring_hole_box, fill=(0, 0, 0, 0))

    canvas.alpha_composite(ring_layer)

    draw = ImageDraw.Draw(canvas)
    inner_disc_box = (
        border_width,
        border_width,
        output_size - border_width - 1,
        output_size - border_width - 1,
    )
    draw.ellipse(inner_disc_box, fill=(255, 255, 255, 255))

    avatar_offset = border_width + gap
    canvas.paste(circular_avatar, (avatar_offset, avatar_offset), circular_avatar)

    return canvas


def is_animated_gif(source: Image.Image) -> bool:
    return source.format == "GIF" and getattr(source, "is_animated", False) and getattr(source, "n_frames", 1) > 1


def resolve_output_path(input_path: Path, output_path: Path | None, animated_gif: bool) -> Path:
    if output_path is None:
        suffix = ".gif" if animated_gif else ".png"
        return input_path.with_name(f"{input_path.stem}_google_frame{suffix}")

    if animated_gif and output_path.suffix.lower() != ".gif":
        raise ValueError("Animated GIF output must use the .gif extension.")

    return output_path


def generate_animated_gif(
    source: Image.Image,
    output_path: Path,
    output_size: int,
    border_width: int,
    gap: int,
) -> Path:
    frames = []
    durations = []
    loop = source.info.get("loop", 0)

    for frame in ImageSequence.Iterator(source):
        rgba_frame = frame.copy().convert("RGBA")
        rendered_frame = build_avatar_canvas(rgba_frame, output_size, border_width, gap)
        palette_frame = rendered_frame.convert("P", palette=ADAPTIVE_PALETTE)
        frames.append(palette_frame)
        durations.append(frame.info.get("duration", source.info.get("duration", 100)) or 100)

    if not frames:
        raise ValueError("No GIF frames were found in the input image.")

    frames[0].save(
        output_path,
        save_all=True,
        append_images=frames[1:],
        duration=durations,
        loop=loop,
        disposal=2,
    )
    return output_path


def generate_google_style_avatar(
    input_path: Path,
    output_path: Path | None = None,
    output_size: int | None = None,
    border_ratio: float = DEFAULT_BORDER_RATIO,
    gap_ratio: float = DEFAULT_GAP_RATIO,
) -> Path:
    with Image.open(input_path) as source:
        if output_size is None:
            output_size = min(source.size)

        border_width, gap = calculate_layout(output_size, border_ratio, gap_ratio)
        animated_gif = is_animated_gif(source)
        resolved_output_path = resolve_output_path(input_path, output_path, animated_gif)

        if animated_gif:
            return generate_animated_gif(source, resolved_output_path, output_size, border_width, gap)

        result = build_avatar_canvas(source, output_size, border_width, gap)

    resolved_output_path = resolve_output_path(input_path, output_path, animated_gif=False)
    result.save(resolved_output_path)
    return resolved_output_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate a Google-style four-color avatar frame from a local image.",
    )
    parser.add_argument("input", nargs="?", help="Input avatar path. If omitted, a file picker is shown.")
    parser.add_argument("-o", "--output", help="Output PNG path. Defaults to the same folder as the input image.")
    parser.add_argument("-s", "--size", type=int, help="Output image size. Defaults to the shorter edge of the input image.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    input_path = Path(args.input) if args.input else pick_image_file()

    if input_path is None:
        print("No image selected. Exiting.")
        return

    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    output_path = Path(args.output) if args.output else None
    saved_path = generate_google_style_avatar(input_path, output_path=output_path, output_size=args.size)
    print(f"Generated: {saved_path}")


if __name__ == "__main__":
    main()
