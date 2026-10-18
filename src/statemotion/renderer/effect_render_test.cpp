#include "transform_render.h"
#include <cmath>
#include <cstdio>
#include <vector>
using namespace statemotion;
int failures=0;
void check(bool ok,const char* name){if(!ok){std::printf("FAIL %s\n",name);++failures;}}
Pixel white(void*,int,int){return {1,1,1,1};}
Pixel shape(void*,int x,int y){return x>=5&&x<11&&y>=5&&y<11?Pixel{1,1,1,1}:Pixel{};}
std::vector<Pixel> image(RendererTransformState t,Sampler sampler=white,int w=16,int h=16){
 std::vector<Pixel> result(w*h);render(plan(t,w,h),sampler,nullptr,w,h,result.data());return result;
}
bool equal(const std::vector<Pixel>& a,const std::vector<Pixel>& b){for(size_t i=0;i<a.size();++i)if(a[i].r!=b[i].r||a[i].g!=b[i].g||a[i].b!=b[i].b||a[i].a!=b[i].a)return false;return true;}
int main(){
 RendererTransformState t;t.cropLeft=t.cropRight=t.cropTop=t.cropBottom=.25;
 auto base=image(t);t.strokeEnabled=true;t.strokeWidth=2;t.strokeColor1={1,0,0,1};t.strokeColor2={0,0,1,1};
 auto stroke=image(t);
 check(stroke[8*16+3].a>base[8*16+3].a,"stroke adds pixels outside cropped content");
 check(stroke[8*16+3].r>stroke[8*16+3].b,"gradient starts red");
 check(stroke[8*16+13].b>stroke[8*16+13].r,"gradient ends blue");
 t.strokeGradientAngleDeg=180;auto reversed=image(t);
 check(reversed[8*16+3].b>reversed[8*16+3].r,"angle reverses gradient");
 t.strokeGradientPhaseOffset=.5;check(!equal(image(t),reversed),"phase cycles gradient");
 t.strokeWidth=0;check(equal(base,image(t)),"zero stroke unchanged");
 t.cornerRadius=1;t.strokeWidth=1;auto rounded=image(t);
 check(rounded[3*16+3].a<rounded[8*16+3].a,"stroke follows rounded corners");
 RendererTransformState g;auto plain=image(g,shape);g.glowEnabled=true;g.glowAmount=1;g.glowRadius=3;
 auto glow=image(g,shape);check(glow[8*16+3].a>plain[8*16+3].a,"glow adds halo pixels");
 check(glow[8*16+3].r>0,"glow adds premultiplied light");
 g.glowAmount=0;check(equal(plain,image(g,shape)),"zero glow unchanged");
 g.glowAmount=1;g.scaleX=0;g.scaleY=-.00001;
 for(auto dims: {std::pair<int,int>{1,1},{32,16}}){auto out=image(g,shape,dims.first,dims.second);for(auto p:out)check(std::isfinite(p.r)&&p.r<=p.a+1e-9&&p.a>=0&&p.a<=1,"finite premultiplied geometry");}
 RendererTransformState a,b;a.strokeColor1={1,0,0,1};b.strokeColor1={0,0,1,1};auto mid=interpolate(a,b,.5);check(mid.strokeColor1.r==.5&&mid.strokeColor1.b==.5,"color interpolation");
 std::printf("effect tests: %d failures\n",failures);return failures?1:0;
}
