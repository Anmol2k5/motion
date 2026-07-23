// StateMotion - host world <-> Pixel adapter tests (pure, SDK-free).
//
// Regression guard for the AEVideoFilter:11 low-level exception: the Render path
// previously read every host world as PF_PixelFloat (16 bytes/px). Premiere's
// legacy render path hands an 8-bit world (4 bytes/px), so that cast over-read
// ~4x past each row and past the buffer end -> access violation. These tests
// pin depth-correct, rowbytes-respecting, normalized conversion for 8/16/float
// worlds with padded strides, and prove no read/write crosses the buffer bounds.

#include "statemotion_world_pixels.hpp"

#include <cmath>
#include <cstdio>
#include <cstring>
#include <vector>

namespace {
int g_fail = 0;
void check(bool ok, const char* n) {
    std::printf("%s  %s\n", ok ? "PASS" : "FAIL", n);
    if (!ok) ++g_fail;
}
bool near(double a, double b, double eps = 1e-6) { return std::fabs(a - b) < eps; }
}  // namespace

int main() {
    using namespace statemotion::world;
    using statemotion::Pixel;

    // --- 8-bit world with PADDED rowbytes: this is the exact case that crashed.
    {
        const int w = 3, h = 2;
        const std::ptrdiff_t rb = 3 * 4 + 5;  // padded stride (> w*bpp)
        std::vector<unsigned char> buf(static_cast<size_t>(rb) * h, 0xAB);  // padding sentinel
        // Write known ARGB bytes at (2,1): a=255,r=0,g=128,b=64.
        unsigned char* px = buf.data() + 1 * rb + 2 * 4;
        px[0] = 255; px[1] = 0; px[2] = 128; px[3] = 64;

        std::vector<Pixel> out;
        worldToPixels(buf.data(), w, h, rb, WorldDepth::Eight, out);
        check(out.size() == static_cast<size_t>(w) * h, "8-bit: out sized w*h (tight)");
        const Pixel& p = out[1 * w + 2];
        check(near(p.a, 1.0) && near(p.r, 0.0) && near(p.g, 128.0/255.0) &&
              near(p.b, 64.0/255.0), "8-bit: ARGB normalized read respects rowbytes");
    }

    // --- 8-bit round-trip through padded strides; padding must stay untouched.
    {
        const int w = 4, h = 3;
        const std::ptrdiff_t rbIn = 4 * 4 + 7;
        const std::ptrdiff_t rbOut = 4 * 4 + 3;
        std::vector<unsigned char> in(static_cast<size_t>(rbIn) * h);
        for (size_t i = 0; i < in.size(); ++i) in[i] = static_cast<unsigned char>(i * 7);
        std::vector<Pixel> pix;
        worldToPixels(in.data(), w, h, rbIn, WorldDepth::Eight, pix);

        const unsigned char SENT = 0x5A;
        std::vector<unsigned char> outBuf(static_cast<size_t>(rbOut) * h, SENT);
        pixelsToWorld(pix, outBuf.data(), w, h, rbOut, WorldDepth::Eight);

        bool paddingOk = true;
        for (int y = 0; y < h; ++y) {
            for (std::ptrdiff_t b = w * 4; b < rbOut; ++b) {
                if (outBuf[static_cast<size_t>(y) * rbOut + b] != SENT) paddingOk = false;
            }
        }
        check(paddingOk, "8-bit: write leaves row padding untouched");

        bool valuesOk = true;
        for (int y = 0; y < h; ++y) {
            for (int x = 0; x < w; ++x) {
                const unsigned char* a = in.data() + y * rbIn + x * 4;
                const unsigned char* c = outBuf.data() + y * rbOut + x * 4;
                for (int k = 0; k < 4; ++k) if (a[k] != c[k]) valuesOk = false;
            }
        }
        check(valuesOk, "8-bit: round-trip preserves every channel byte");
    }

    // --- 16-bit world: 0..32768 range, 8 bytes/px, padded stride.
    {
        const int w = 2, h = 2;
        const std::ptrdiff_t rb = 2 * 8 + 4;
        std::vector<unsigned char> buf(static_cast<size_t>(rb) * h, 0);
        auto* px = reinterpret_cast<std::uint16_t*>(buf.data() + 0 * rb + 1 * 8);
        px[0] = 32768; px[1] = 0; px[2] = 16384; px[3] = 8192;  // a,r,g,b
        std::vector<Pixel> out;
        worldToPixels(buf.data(), w, h, rb, WorldDepth::Sixteen, out);
        const Pixel& p = out[0 * w + 1];
        check(near(p.a, 1.0) && near(p.r, 0.0) && near(p.g, 0.5) && near(p.b, 0.25),
              "16-bit: normalized read (0..32768) respects rowbytes");
    }

    // --- Float world: 16 bytes/px, values pass through unscaled.
    {
        const int w = 2, h = 1;
        const std::ptrdiff_t rb = 2 * 16;
        std::vector<unsigned char> buf(static_cast<size_t>(rb) * h, 0);
        auto* px = reinterpret_cast<float*>(buf.data() + 1 * 16);
        px[0] = 1.0f; px[1] = 0.25f; px[2] = 0.5f; px[3] = 0.75f;  // a,r,g,b
        std::vector<Pixel> out;
        worldToPixels(buf.data(), w, h, rb, WorldDepth::Float, out);
        const Pixel& p = out[1];
        check(near(p.a, 1.0) && near(p.r, 0.25) && near(p.g, 0.5) && near(p.b, 0.75),
              "float: pass-through read");
    }

    // --- bytesPerPixel contract (the size the previous cast got wrong).
    check(bytesPerPixel(WorldDepth::Eight) == 4 &&
          bytesPerPixel(WorldDepth::Sixteen) == 8 &&
          bytesPerPixel(WorldDepth::Float) == 16, "bytesPerPixel per depth");

    // --- clamp on write: out-of-range Pixels do not overflow 8-bit channels.
    {
        std::vector<Pixel> pix(1);
        pix[0].a = 2.0; pix[0].r = -1.0; pix[0].g = 1.0; pix[0].b = 0.0;
        unsigned char out4[4] = {9, 9, 9, 9};
        pixelsToWorld(pix, out4, 1, 1, 4, WorldDepth::Eight);
        check(out4[0] == 255 && out4[1] == 0 && out4[2] == 255 && out4[3] == 0,
              "8-bit: write clamps to [0,255]");
    }

    std::printf(g_fail ? "\nFAILURES: %d\n" : "\nALL PASS\n", g_fail);
    return g_fail ? 1 : 0;
}
