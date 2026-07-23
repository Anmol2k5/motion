// StateMotion - host world <-> renderer Pixel adapter (pure, SDK-free).
//
// The legacy Adobe Effect PF_Cmd_RENDER path hands the effect a pixel world
// whose bit depth depends on the declared out_flags: 8-bit (PF_Pixel8) when no
// depth capability is declared, 16-bit (PF_Pixel16) when DEEP_COLOR_AWARE, and
// 32-bit float (PF_PixelFloat) only on the SmartFX float path. Every depth
// packs four components in SDK order alpha, red, green, blue, with rows padded
// to rowbytes. Reading an 8-bit world as float (the previous bug) over-reads
// ~4x past every row and past the buffer end -> host low-level exception.
//
// This adapter converts by declared depth, respects rowbytes, and normalizes
// integer channels to the renderer's [0,1] premultiplied-alpha Pixel. It takes
// raw void* + dimensions + a WorldDepth, so it is unit-testable without the
// Adobe SDK.

#pragma once

#ifndef STATEMOTION_WORLD_PIXELS_HPP
#define STATEMOTION_WORLD_PIXELS_HPP

#include <cstddef>
#include <cstdint>
#include <vector>

#include "transform_render.h"

namespace statemotion {
namespace world {

enum class WorldDepth {
    Eight,   // PF_Pixel8:  A_u_char  per channel, 0..255
    Sixteen, // PF_Pixel16: A_u_short per channel, 0..PF_MAX_CHAN16 (32768)
    Float    // PF_PixelFloat: float per channel, already ~[0,1]
};

// After Effects 16-bit worlds use 0..32768 (PF_MAX_CHAN16), not 0..65535.
constexpr double kMax8  = 255.0;
constexpr double kMax16 = 32768.0;

inline std::size_t bytesPerPixel(WorldDepth d) {
    switch (d) {
        case WorldDepth::Eight:   return 4;                   // 4 * u_char
        case WorldDepth::Sixteen: return 8;                   // 4 * u_short
        case WorldDepth::Float:   return 16;                  // 4 * float
    }
    return 4;
}

// Read one world into the renderer's [0,1] premultiplied Pixel buffer.
// data/rowbytes describe the source world; out is sized w*h (tightly packed).
inline void worldToPixels(const void *data, int w, int h, std::ptrdiff_t rowbytes,
                          WorldDepth depth, std::vector<statemotion::Pixel> &out) {
    out.resize(static_cast<std::size_t>(w) * static_cast<std::size_t>(h));
    const auto *base = static_cast<const unsigned char *>(data);
    for (int y = 0; y < h; ++y) {
        const unsigned char *row = base + static_cast<std::ptrdiff_t>(y) * rowbytes;
        for (int x = 0; x < w; ++x) {
            statemotion::Pixel &p = out[static_cast<std::size_t>(y) * w + x];
            if (depth == WorldDepth::Eight) {
                const unsigned char *px = row + static_cast<std::size_t>(x) * 4;
                p.a = px[0] / kMax8;
                p.r = px[1] / kMax8;
                p.g = px[2] / kMax8;
                p.b = px[3] / kMax8;
            } else if (depth == WorldDepth::Sixteen) {
                const auto *px = reinterpret_cast<const std::uint16_t *>(
                    row + static_cast<std::size_t>(x) * 8);
                p.a = px[0] / kMax16;
                p.r = px[1] / kMax16;
                p.g = px[2] / kMax16;
                p.b = px[3] / kMax16;
            } else { // Float
                const auto *px = reinterpret_cast<const float *>(
                    row + static_cast<std::size_t>(x) * 16);
                p.a = px[0];
                p.r = px[1];
                p.g = px[2];
                p.b = px[3];
            }
        }
    }
}

inline double clamp01(double v) {
    if (v < 0.0) return 0.0;
    if (v > 1.0) return 1.0;
    return v;
}

// Write a tightly-packed w*h Pixel buffer into a host world, respecting depth
// and rowbytes. Integer channels are rounded and clamped to their range.
inline void pixelsToWorld(const std::vector<statemotion::Pixel> &in, void *data,
                          int w, int h, std::ptrdiff_t rowbytes, WorldDepth depth) {
    auto *base = static_cast<unsigned char *>(data);
    for (int y = 0; y < h; ++y) {
        unsigned char *row = base + static_cast<std::ptrdiff_t>(y) * rowbytes;
        for (int x = 0; x < w; ++x) {
            const statemotion::Pixel &p = in[static_cast<std::size_t>(y) * w + x];
            if (depth == WorldDepth::Eight) {
                unsigned char *px = row + static_cast<std::size_t>(x) * 4;
                px[0] = static_cast<unsigned char>(clamp01(p.a) * kMax8 + 0.5);
                px[1] = static_cast<unsigned char>(clamp01(p.r) * kMax8 + 0.5);
                px[2] = static_cast<unsigned char>(clamp01(p.g) * kMax8 + 0.5);
                px[3] = static_cast<unsigned char>(clamp01(p.b) * kMax8 + 0.5);
            } else if (depth == WorldDepth::Sixteen) {
                auto *px = reinterpret_cast<std::uint16_t *>(
                    row + static_cast<std::size_t>(x) * 8);
                px[0] = static_cast<std::uint16_t>(clamp01(p.a) * kMax16 + 0.5);
                px[1] = static_cast<std::uint16_t>(clamp01(p.r) * kMax16 + 0.5);
                px[2] = static_cast<std::uint16_t>(clamp01(p.g) * kMax16 + 0.5);
                px[3] = static_cast<std::uint16_t>(clamp01(p.b) * kMax16 + 0.5);
            } else { // Float
                auto *px = reinterpret_cast<float *>(
                    row + static_cast<std::size_t>(x) * 16);
                px[0] = static_cast<float>(p.a);
                px[1] = static_cast<float>(p.r);
                px[2] = static_cast<float>(p.g);
                px[3] = static_cast<float>(p.b);
            }
        }
    }
}

}  // namespace world
}  // namespace statemotion

#endif  // STATEMOTION_WORLD_PIXELS_HPP
