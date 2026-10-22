#ifndef STATEMOTION_FRAME_RENDER_HPP
#define STATEMOTION_FRAME_RENDER_HPP
#include "progress_engine.h"
#include "statemotion_render_input.hpp"
#include <vector>
namespace statemotion {
struct FrameRenderInput {
 TransformState a,b;
 RendererTransformState effectsA,effectsB;
 ProgressInput progress;
 raster::RenderDimensions dimensions;
 double shutterSeconds=0;
 int sampleCount=1;
 double gradientCycleSpeed=0;
};
// Samples the transform/FX trajectory against the supplied source frame.
// Source-time resampling belongs to the Adobe host and is not implied here.
inline void renderFrame(const FrameRenderInput& input,Sampler sampler,void* user,
                        int width,int height,Pixel* output) {
 if(width<=0||height<=0||!output)return;
 const size_t count=static_cast<size_t>(width)*height;
 std::fill(output,output+count,Pixel{});
 const int samples=std::isfinite(input.shutterSeconds)&&input.shutterSeconds>0&&input.sampleCount>1
                   ?std::clamp(input.sampleCount,2,64):1;
 std::vector<Pixel> temporary(count);
 int valid=0;
 for(int i=0;i<samples;++i){
   auto progress=input.progress;
   const double offset=samples==1?0:(static_cast<double>(i)/(samples-1)-.5)*input.shutterSeconds;
   progress.visibleElapsedSeconds+=offset;
   auto evaluated=evaluateProgress(progress);
   if(!evaluated.ok)continue;
   const double t=evaluated.result.easedProgress;
   auto canonical=interpolateCanonical(input.a,input.b,t);
   auto geometry=raster::toRendererTransformState(canonical,input.dimensions);
   auto state=interpolate(input.effectsA,input.effectsB,t);
   state.positionX=geometry.positionX;state.positionY=geometry.positionY;
   state.scaleX=geometry.scaleX;state.scaleY=geometry.scaleY;state.rotationDeg=geometry.rotationDeg;
   state.anchorX=geometry.anchorX;state.anchorY=geometry.anchorY;state.opacity=geometry.opacity;
   state.strokeGradientPhaseOffset=progress.visibleElapsedSeconds*input.gradientCycleSpeed;
   render(plan(state,input.dimensions.sourceW,input.dimensions.sourceH),sampler,user,width,height,temporary.data());
   for(size_t p=0;p<count;++p){output[p].r+=temporary[p].r;output[p].g+=temporary[p].g;output[p].b+=temporary[p].b;output[p].a+=temporary[p].a;}
   ++valid;
 }
 if(valid)for(size_t p=0;p<count;++p){output[p].r/=valid;output[p].g/=valid;output[p].b/=valid;output[p].a/=valid;}
}
}
#endif
