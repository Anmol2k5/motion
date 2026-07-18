#ifndef STATEMOTION_RENDER_INPUT_HPP
#define STATEMOTION_RENDER_INPUT_HPP

#include "transform_state.hpp"    // canonical TransformState
#include "transform_render.h"      // RendererTransformState

namespace statemotion { namespace raster {

// Verified frame dimensions (in pixels) for the single boundary conversion.
// output = rendered output frame; source = layer/source the inverse map samples.
// For the Premiere software path source and output share dimensions.
struct RenderDimensions {
    int outputW = 0;
    int outputH = 0;
    int sourceW = 0;
    int sourceH = 0;
};

// Convert the FINAL interpolated canonical transform into renderer-native units.
// Called exactly once, AFTER interpolation (per design: convert after, not per
// endpoint). Position uses output dims; anchor uses source dims; scale/opacity
// unchanged; radians -> degrees.
inline RendererTransformState toRendererTransformState(const TransformState& c,
                                                       const RenderDimensions& d) {
    RendererTransformState r;
    r.positionX = c.positionNormX * static_cast<double>(d.outputW);
    r.positionY = c.positionNormY * static_cast<double>(d.outputH);
    r.scaleX = c.scaleX;
    r.scaleY = c.scaleY;
    r.rotationDeg = c.rotationRadians * 180.0 / 3.14159265358979323846;
    r.anchorX = c.anchorNormX * static_cast<double>(d.sourceW);
    r.anchorY = c.anchorNormY * static_cast<double>(d.sourceH);
    // ponytail: anchor uses source dims because in the Premiere software path
    // source == output; if a future path differs, reconcile anchor space here.
    r.opacity = c.opacity;
    return r;
}

}  // namespace raster
}  // namespace statemotion

#endif  // STATEMOTION_RENDER_INPUT_HPP
