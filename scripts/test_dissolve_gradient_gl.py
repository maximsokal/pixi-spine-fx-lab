#!/usr/bin/env python3
"""Optional offline GLSL pixel regression via Mesa EGL (Linux, no Pixi or GPU claim).
Run: EGL_PLATFORM=surfaceless LIBGL_ALWAYS_SOFTWARE=1 python scripts/test_dissolve_gradient_gl.py
Tests the exact Dissolve gradient functions in both GLSL ES 1.00 and 3.00.
"""
import ctypes as C
import ctypes.util
import json
import os
from pathlib import Path
import re
import sys
import unittest

os.environ.setdefault('EGL_PLATFORM', 'surfaceless')
os.environ.setdefault('LIBGL_ALWAYS_SOFTWARE', '1')
SRC = Path(__file__).resolve().parents[1] / 'assets/dissolve/src/dissolve-shader.js'


def gradient():
    return json.loads(re.search(r'const GL_GRAD=("(?:\\.|[^"\\])*");', SRC.read_text())[1])


def api(lib, name, ret, *args):
    fn = getattr(lib, name)
    fn.restype, fn.argtypes = ret, args
    return fn


I, U, P, F, S = C.c_int, C.c_uint, C.c_void_p, C.c_float, C.c_char_p
PI = C.POINTER(I)


class Context:
    def __init__(self, version):
        self.egl = C.CDLL('libEGL.so.1')
        self.gl = C.CDLL('libGL.so.1')
        e = lambda name, ret, *args: api(self.egl, 'egl' + name, ret, *args)
        self.display = e('GetDisplay', P, P)(None)
        if not e('Initialize', U, P, PI, PI)(self.display, None, None):
            raise RuntimeError('EGL initialize failed')
        assert e('BindAPI', U, U)(0x30A0)  # OpenGL ES
        attribs = (I * 13)(0x3033, 1, 0x3040, 4 if version == 2 else 0x40,
                           0x3024, 8, 0x3023, 8, 0x3022, 8, 0x3021, 8, 0x3038)
        config, count = P(), I()
        assert e('ChooseConfig', U, P, PI, C.POINTER(P), I, PI)(self.display, attribs, C.byref(config), 1, C.byref(count)) and count.value
        self.surface = e('CreatePbufferSurface', P, P, P, PI)(self.display, config, (I * 5)(0x3057, 1, 0x3056, 1, 0x3038))
        self.context = e('CreateContext', P, P, P, P, PI)(self.display, config, None, (I * 3)(0x3098, version, 0x3038))
        assert self.surface and self.context and e('MakeCurrent', U, P, P, P, P)(self.display, self.surface, self.surface, self.context)
        self.version = version
        self.program = self.build()
        self.call('UseProgram', None, (U,), self.program)
        self.call('Viewport', None, (I, I, I, I), 0, 0, 1, 1)
        self.call('Disable', None, (U,), 0x0BD0)  # dither
        self.buffer = U()
        self.call('GenBuffers', None, (I, C.POINTER(U)), 1, C.byref(self.buffer))
        self.call('BindBuffer', None, (U, U), 0x8892, self.buffer)
        verts = (F * 6)(-1, -1, 3, -1, -1, 3)
        self.call('BufferData', None, (U, C.c_ssize_t, P, U), 0x8892, C.sizeof(verts), C.cast(verts, P), 0x88E4)
        loc = self.call('GetAttribLocation', I, (U, S), self.program, b'position')
        assert loc >= 0
        self.call('EnableVertexAttribArray', None, (U,), loc)
        self.call('VertexAttribPointer', None, (U, I, U, C.c_ubyte, I, P), loc, 2, 0x1406, 0, 0, None)

    def call(self, name, ret, args, *values):
        return api(self.gl, 'gl' + name, ret, *args)(*values)

    def build(self):
        prefix = '#version 300 es\n' if self.version == 3 else '#version 100\n'
        vertex = prefix + ('in' if self.version == 3 else 'attribute') + ' vec2 position;void main(){gl_Position=vec4(position,0.,1.);}'
        names = [f'uGrad{i}' for i in range(8)] + ['uGradX0', 'uGradX1', 'uGradMeta', 'uFireColor', 'uHotColor']
        frag = prefix + 'precision highp float;\n' + ''.join('uniform vec4 ' + name + ';\n' for name in names) + 'uniform float probe;\n'
        frag += ('out vec4 pixel;\n' if self.version == 3 else '') + gradient()
        frag += 'void main(){' + ('pixel' if self.version == 3 else 'gl_FragColor') + '=fxGradient(probe);}'
        program = self.call('CreateProgram', U, ())
        for kind, source in [(0x8B31, vertex), (0x8B30, frag)]:
            shader = self.call('CreateShader', U, (U,), kind)
            code = S(source.encode())
            self.call('ShaderSource', None, (U, I, C.POINTER(S), PI), shader, 1, C.byref(code), None)
            self.call('CompileShader', None, (U,), shader)
            ok = I()
            self.call('GetShaderiv', None, (U, U, PI), shader, 0x8B81, C.byref(ok))
            if not ok.value:
                log = C.create_string_buffer(8192)
                self.call('GetShaderInfoLog', None, (U, I, PI, P), shader, 8192, None, log)
                raise RuntimeError(log.value.decode())
            self.call('AttachShader', None, (U, U), program, shader)
            self.call('DeleteShader', None, (U,), shader)
        self.call('LinkProgram', None, (U,), program)
        ok = I()
        self.call('GetProgramiv', None, (U, U, PI), program, 0x8B82, C.byref(ok))
        if not ok.value:
            log = C.create_string_buffer(8192)
            self.call('GetProgramInfoLog', None, (U, I, PI, P), program, 8192, None, log)
            raise RuntimeError(log.value.decode())
        return program

    def pixel(self, positions, colors, x, linear=False):
        def uniform(name, vals):
            loc = self.call('GetUniformLocation', I, (U, S), self.program, name.encode())
            assert loc >= 0, name
            self.call('Uniform4f', None, (I, F, F, F, F), loc, *vals)
        for i in range(8):
            uniform('uGrad' + str(i), colors[min(i, len(colors) - 1)])
        pos = positions + [positions[-1]] * (8 - len(positions))
        uniform('uGradX0', pos[:4]); uniform('uGradX1', pos[4:])
        uniform('uGradMeta', [1, len(positions), int(linear), 0])
        loc = self.call('GetUniformLocation', I, (U, S), self.program, b'probe')
        self.call('Uniform1f', None, (I, F), loc, x)
        self.call('DrawArrays', None, (U, I, I), 4, 0, 3)
        rgba = (C.c_ubyte * 4)()
        self.call('ReadPixels', None, (I, I, I, I, U, U, P), 0, 0, 1, 1, 0x1908, 0x1401, rgba)
        assert self.call('GetError', U, ()) == 0
        return list(rgba)

    def close(self):
        self.call('DeleteProgram', None, (U,), self.program)
        self.call('DeleteBuffers', None, (I, C.POINTER(U)), 1, C.byref(self.buffer))
        e = lambda name, ret, *args: api(self.egl, 'egl' + name, ret, *args)
        e('MakeCurrent', U, P, P, P, P)(self.display, None, None, None)
        e('DestroyContext', U, P, P)(self.display, self.context)
        e('DestroySurface', U, P, P)(self.display, self.surface)
        e('Terminate', U, P)(self.display)


@unittest.skipUnless(sys.platform.startswith('linux') and ctypes.util.find_library('EGL') and ctypes.util.find_library('GL'), 'optional Linux EGL/GL libraries unavailable')
class GradientTests(unittest.TestCase):
    def test_pixels(self):
        # Exact binary32 positions, gap smaller than the old 1e-6 divisor floor.
        a, b = .25, .25 + 2**-21
        colors = [[1, 0, 0, .2], [0, 0, 1, .8]]
        cases = [([a,b], colors, a, False, [255,0,0,51]),
                 ([a,b], colors, (a+b)/2, False, [128,0,128,128]),
                 ([a,b], colors, b, False, [0,0,255,204]),
                 ([a,b], colors, (a+b)/2, True, [188,0,188,128]),
                 ([a,b], colors, b, True, [0,0,255,204]),
                 ([0,1], colors, .5, False, [128,0,128,128]),
                 ([0,1], colors, .5, True, [188,0,188,128]),
                 ([.5], [colors[1]], 0, False, [0,0,255,204]),
                 ([a,b,1], colors+[[0,1,0,1]], b, False, [0,0,255,204]),
                 ([a,a,1], colors+[[0,1,0,1]], a, False, [255,0,0,51]),
                 ([a,b], colors, 1, False, [0,0,255,204])]
        for version in (2,3):
            ctx = Context(version)
            print('GLSL ES', '1.00' if version == 2 else '3.00', ctx.call('GetString', S, (U,), 0x1F02), ctx.call('GetString', S, (U,), 0x1F01), flush=True)
            try:
                for idx,(pos,rgba,x,linear,want) in enumerate(cases):
                    with self.subTest(version=version, case=idx):
                        got=ctx.pixel(pos,rgba,x,linear)
                        self.assertTrue(all(abs(a-b)<=1 for a,b in zip(got,want)), f'{got} != {want}')
            finally:
                ctx.close()


if __name__ == '__main__':
    unittest.main()
