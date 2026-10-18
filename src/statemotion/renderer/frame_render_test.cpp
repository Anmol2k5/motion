#include "frame_render.hpp"
#include <cmath>
#include <cstdio>
#include <vector>
using namespace statemotion;
Pixel dot(void*,int x,int y){return x==0&&y==0?Pixel{1,1,1,1}:Pixel{};}
int support(const std::vector<Pixel>& image){int n=0;for(auto p:image)if(p.a>1e-8)++n;return n;}
int main(){
 FrameRenderInput input;input.dimensions={32,16,32,16};input.a.positionNormX=.1;input.b.positionNormX=.8;
 input.progress.visibleDurationSeconds=1;input.progress.visibleElapsedSeconds=.5;
 input.progress.alignment=ids::AlignmentMode::EntireClip;input.progress.easing=EasingMode::LINEAR;
 std::vector<Pixel> single(512),blur(512),zero(512);
 renderFrame(input,dot,nullptr,32,16,single.data());
 input.sampleCount=9;input.shutterSeconds=.4;renderFrame(input,dot,nullptr,32,16,blur.data());
 if(support(blur)<=support(single)){std::puts("FAIL moving shutter must spread shape");return 1;}
 input.shutterSeconds=0;renderFrame(input,dot,nullptr,32,16,zero.data());
 for(size_t i=0;i<zero.size();++i)if(zero[i].a!=single[i].a){std::puts("FAIL zero shutter equality");return 1;}
 input.a=input.b;input.effectsA.glowEnabled=input.effectsB.glowEnabled=true;
 input.effectsA.glowAmount=input.effectsB.glowAmount=1;input.effectsA.glowRadius=input.effectsB.glowRadius=2;
 input.shutterSeconds=0;renderFrame(input,dot,nullptr,32,16,single.data());
 input.shutterSeconds=.5;renderFrame(input,dot,nullptr,32,16,blur.data());
 for(size_t i=0;i<blur.size();++i)if(!std::isfinite(blur[i].a)||std::abs(blur[i].a-single[i].a)>1e-12){std::puts("FAIL shared static FX sampling");return 1;}
 renderFrame(input,dot,nullptr,0,0,nullptr);
 std::puts("Frame sampling tests passed");
}
