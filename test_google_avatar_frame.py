from __future__ import annotations

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from PIL import Image

from google_avatar_frame import (
    COLORS,
    DEFAULT_BORDER_RATIO,
    DEFAULT_GAP_RATIO,
    SEGMENTS,
    build_avatar_canvas,
    calculate_layout,
    sample_point_for_angle,
    segment_span,
)


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[index:index + 2], 16) for index in (0, 2, 4))


class GoogleAvatarFrameTests(unittest.TestCase):
    def test_layout_matches_requested_100px_ratios(self) -> None:
        border_width, gap = calculate_layout(100, DEFAULT_BORDER_RATIO, DEFAULT_GAP_RATIO)
        self.assertEqual(border_width, 4)
        self.assertEqual(gap, 2)

    def test_segments_cover_full_circle(self) -> None:
        total = sum(segment_span(start_angle, end_angle) for _, start_angle, end_angle in SEGMENTS)
        self.assertEqual(total, 360)

    def test_segment_spans_match_reference_distribution(self) -> None:
        spans = {color_name: segment_span(start_angle, end_angle) for color_name, start_angle, end_angle in SEGMENTS}
        self.assertEqual(spans["red"], 108)
        self.assertEqual(spans["blue"], 94)
        self.assertEqual(spans["green"], 90)
        self.assertEqual(spans["yellow"], 68)

    def test_rendered_ring_colors_match_calibrated_angles(self) -> None:
        source = Image.new("RGBA", (600, 600), (240, 240, 240, 255))
        output_size = 800
        border_width = 80
        gap = 24

        result = build_avatar_canvas(source, output_size=output_size, border_width=border_width, gap=gap)

        center = output_size / 2
        radius = output_size / 2 - border_width / 2

        for color_name, start_angle, end_angle in SEGMENTS:
            midpoint = (start_angle + segment_span(start_angle, end_angle) / 2) % 360
            x, y = sample_point_for_angle(center, radius, midpoint)
            pixel = result.getpixel((x, y))[:3]
            self.assertEqual(pixel, hex_to_rgb(COLORS[color_name]))

    def test_rendered_widths_match_100px_spec(self) -> None:
        source = Image.new("RGBA", (100, 100), (153, 153, 153, 255))
        result = build_avatar_canvas(source, output_size=100, border_width=4, gap=2)

        center_y = result.size[1] // 2
        samples = [result.getpixel((x, center_y))[:3] for x in range(0, 7)]

        self.assertEqual(samples[0:4], [hex_to_rgb(COLORS["yellow"])] * 4)
        self.assertEqual(samples[4:6], [(255, 255, 255)] * 2)
        self.assertEqual(samples[6], (153, 153, 153))

    def test_script_saves_png_output(self) -> None:
        with TemporaryDirectory() as temp_dir:
            base = Path(temp_dir)
            source_path = base / "avatar.png"
            output_path = base / "avatar_google_frame.png"

            Image.new("RGB", (512, 512), "white").save(source_path)

            from google_avatar_frame import generate_google_style_avatar

            saved_path = generate_google_style_avatar(source_path, output_path=output_path, output_size=512)

            self.assertEqual(saved_path, output_path)
            self.assertTrue(output_path.exists())
            with Image.open(output_path) as saved_image:
                self.assertEqual(saved_image.size, (512, 512))

    def test_default_output_size_follows_shorter_input_edge(self) -> None:
        with TemporaryDirectory() as temp_dir:
            base = Path(temp_dir)
            source_path = base / "portrait.png"
            output_path = base / "portrait_google_frame.png"

            Image.new("RGB", (320, 500), "white").save(source_path)

            from google_avatar_frame import generate_google_style_avatar

            generate_google_style_avatar(source_path, output_path=output_path)

            with Image.open(output_path) as saved_image:
                self.assertEqual(saved_image.size, (320, 320))


if __name__ == "__main__":
    unittest.main()
