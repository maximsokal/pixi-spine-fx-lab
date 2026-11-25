#!/usr/bin/env python3
"""PNG structural regressions for the evidence gate, without GPU or network."""
import importlib
import os
import struct
import unittest
import zlib

fxv = importlib.import_module(os.environ.get("FX_PNG_VALIDATOR", "effect_validation"))


def chunk(kind, body=b""):
    return (struct.pack(">I", len(body)) + kind + body
            + struct.pack(">I", zlib.crc32(kind + body) & 0xffffffff))


def fixture(color=6, before=(), between=(), after=(), split=True):
    header = chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, color, 0, 0, 0))
    compressed = zlib.compress(bytes([0, 255, 128, 0] + ([64] if color == 6 else [])))
    if split:
        stream = chunk(b"IDAT", compressed[:4]) + b"".join(between) + chunk(b"IDAT", compressed[4:])
    else:
        stream = chunk(b"IDAT", compressed)
    return b"\x89PNG\r\n\x1a\n" + header + b"".join(before) + stream + b"".join(after) + chunk(b"IEND")


class PngStructureTests(unittest.TestCase):
    def accept(self, data):
        fxv._check_png_structure(data, "synthetic.png")

    def reject(self, data):
        with self.assertRaises(fxv.ValidationError):
            self.accept(data)

    def test_consecutive_idat_and_valid_ancillary(self):
        self.accept(fixture(before=[chunk(b"tEXt", b"Key\x00Value")], after=[chunk(b"tEXt", b"Other\x00Value")]))
        self.accept(fixture(split=False))
        self.accept(fixture(between=[chunk(b"IDAT")]))

    def test_separated_idat_rejected(self):
        self.reject(fixture(between=[chunk(b"tEXt", b"Key\x00Value")]))

    def test_chunk_type_letters_and_reserved_bit(self):
        for kind in [b"t1Xt", b"teXt", b"texT", b"\x80EXt"]:
            # teXt is valid: the reserved third byte is uppercase X.
            if kind == b"teXt":
                self.accept(fixture(before=[chunk(kind)]))
            else:
                with self.subTest(kind=kind):
                    self.reject(fixture(before=[chunk(kind)]))

    def test_optional_palette_rgb_and_rgba(self):
        for color in (2, 6):
            with self.subTest(color=color):
                self.accept(fixture(color=color, before=[chunk(b"PLTE", b"\xff\x80\x00")]))

    def test_invalid_palette_size_order_and_duplicate(self):
        valid = chunk(b"PLTE", b"\x01\x02\x03")
        for args in [dict(before=[chunk(b"PLTE")]), dict(before=[chunk(b"PLTE", b"ab")]),
                     dict(before=[chunk(b"PLTE", b"abc"*257)]), dict(before=[valid, valid]),
                     dict(after=[valid])]:
            with self.subTest(args=args):
                self.reject(fixture(**args))

    def test_rgb_transparency_and_palette_order(self):
        key = chunk(b"tRNS", b"\x00\xff\x00\x80\x00\x00")
        palette = chunk(b"PLTE", b"\xff\x80\x00")
        self.accept(fixture(color=2, before=[palette, key]))
        self.accept(fixture(color=2, before=[key]))
        self.reject(fixture(color=2, before=[key, palette]))

    def test_invalid_transparency_color_length_order_duplicate(self):
        key = chunk(b"tRNS", b"\x00\xff\x00\x80\x00\x00")
        for args in [dict(before=[key]), dict(color=2, before=[chunk(b"tRNS", b"abc")]),
                     dict(color=2, before=[key,key]), dict(color=2, after=[key])]:
            with self.subTest(args=args):
                self.reject(fixture(**args))

    def test_ihdr_must_be_first(self):
        png = fixture()
        self.reject(png[:8] + chunk(b"tEXt", b"Key\x00Value") + png[8:])


if __name__ == "__main__":
    unittest.main()
