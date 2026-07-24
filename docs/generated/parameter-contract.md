# StateMotion Parameter Contract (generated)

- schemaVersion: 1
- bindingRevision: 3
- parameterCount: 60
- SHA-256: `b1f0f11f71b95cf1f86f73856e409382e558002d2d1fefe03418a11cd0cdc0bb`

> GENERATED from shared/schema/parameter-contract.json. Do not edit by hand.

## Enums

### ProgressMode
- AToB = 0
- BToA = 1
- AToBToA = 2
- BToAToB = 3
- HoldA = 4
- HoldB = 5
- Manual = 6

### AlignmentMode
- ClipStart = 0
- ClipEnd = 1
- EntireClip = 2

### EasingMode
- Linear = 0
- EaseIn = 1
- EaseOut = 2
- EaseInOut = 3
- Custom = 4
- Spring = 5
- Bounce = 6

## Parameters

| logicalId | diskId | wireName | nativeType | default | range | timeVariance | state |
|---|---|---|---|---|---|---|---|
| contract.schemaVersion | 1 | SM Schema Version | FLOAT_SLIDER | 1 | 1..9999 | static | metadata |
| contract.parameterCount | 2 | SM Param Count | FLOAT_SLIDER | 60 | 1..9999 | static | metadata |
| contract.bindingRevision | 3 | SM Binding Rev | FLOAT_SLIDER | 3 | 1..9999 | static | metadata |
| transition.mode | 50 | SM Mode | POPUP | 0 | ProgressMode | static | transition |
| transition.alignment | 51 | SM Alignment | POPUP | 0 | AlignmentMode | static | transition |
| transition.durationSeconds | 52 | SM Duration | FLOAT_SLIDER | 1 | 0..3600 | static | transition |
| transition.delaySeconds | 53 | SM Delay | FLOAT_SLIDER | 0 | 0..3600 | static | transition |
| transition.manualProgress | 54 | SM Manual Progress | FLOAT_SLIDER | 0 | 0..100 | keyframeable | transition |
| transition.easing | 55 | SM Easing | POPUP | 3 | EasingMode | static | transition |
| transition.curveX1 | 56 | SM Curve X1 | FLOAT_SLIDER | 0.3333333333333333 | 0..1 | static | transition |
| transition.curveY1 | 57 | SM Curve Y1 | FLOAT_SLIDER | 0 | 0..1 | static | transition |
| transition.curveX2 | 58 | SM Curve X2 | FLOAT_SLIDER | 0.6666666666666667 | 0..1 | static | transition |
| transition.curveY2 | 59 | SM Curve Y2 | FLOAT_SLIDER | 1 | 0..1 | static | transition |
| transform.position.a | 100 | SM Position A | POINT | "frameCenter" | n/a | interpolatable | A |
| transform.position.b | 101 | SM Position B | POINT | "frameCenter" | n/a | interpolatable | B |
| transform.scaleX.a | 102 | SM Scale X A | FLOAT_SLIDER | 100 | 0.01..10000 | interpolatable | A |
| transform.scaleX.b | 103 | SM Scale X B | FLOAT_SLIDER | 100 | 0.01..10000 | interpolatable | B |
| transform.scaleY.a | 104 | SM Scale Y A | FLOAT_SLIDER | 100 | 0.01..10000 | interpolatable | A |
| transform.scaleY.b | 105 | SM Scale Y B | FLOAT_SLIDER | 100 | 0.01..10000 | interpolatable | B |
| transform.rotation.a | 106 | SM Rotation A | ANGLE | 0 | n/a | interpolatable | A |
| transform.rotation.b | 107 | SM Rotation B | ANGLE | 0 | n/a | interpolatable | B |
| transform.anchor.a | 108 | SM Anchor A | POINT | "sourceCenter" | n/a | interpolatable | A |
| transform.anchor.b | 109 | SM Anchor B | POINT | "sourceCenter" | n/a | interpolatable | B |
| transform.opacity.a | 110 | SM Opacity A | FLOAT_SLIDER | 100 | 0..100 | interpolatable | A |
| transform.opacity.b | 111 | SM Opacity B | FLOAT_SLIDER | 100 | 0..100 | interpolatable | B |
| crop.left.a | 150 | SM Crop Left A | FLOAT_SLIDER | 0 | 0..100 | interpolatable | A |
| crop.left.b | 151 | SM Crop Left B | FLOAT_SLIDER | 0 | 0..100 | interpolatable | B |
| crop.right.a | 152 | SM Crop Right A | FLOAT_SLIDER | 0 | 0..100 | interpolatable | A |
| crop.right.b | 153 | SM Crop Right B | FLOAT_SLIDER | 0 | 0..100 | interpolatable | B |
| crop.top.a | 154 | SM Crop Top A | FLOAT_SLIDER | 0 | 0..100 | interpolatable | A |
| crop.top.b | 155 | SM Crop Top B | FLOAT_SLIDER | 0 | 0..100 | interpolatable | B |
| crop.bottom.a | 156 | SM Crop Bottom A | FLOAT_SLIDER | 0 | 0..100 | interpolatable | A |
| crop.bottom.b | 157 | SM Crop Bottom B | FLOAT_SLIDER | 0 | 0..100 | interpolatable | B |
| crop.cornerRadius.a | 158 | SM Corner Radius A | FLOAT_SLIDER | 0 | 0..100 | interpolatable | A |
| crop.cornerRadius.b | 159 | SM Corner Radius B | FLOAT_SLIDER | 0 | 0..100 | interpolatable | B |
| shadow.opacity.a | 250 | SM Shadow Opacity A | FLOAT_SLIDER | 0 | 0..100 | interpolatable | A |
| shadow.opacity.b | 251 | SM Shadow Opacity B | FLOAT_SLIDER | 0 | 0..100 | interpolatable | B |
| shadow.angle.a | 252 | SM Shadow Angle A | ANGLE | 2.356194490192345 | n/a | interpolatable | A |
| shadow.angle.b | 253 | SM Shadow Angle B | ANGLE | 2.356194490192345 | n/a | interpolatable | B |
| shadow.distance.a | 254 | SM Shadow Distance A | FLOAT_SLIDER | 10 | 0..1000 | interpolatable | A |
| shadow.distance.b | 255 | SM Shadow Distance B | FLOAT_SLIDER | 10 | 0..1000 | interpolatable | B |
| shadow.softness.a | 256 | SM Shadow Softness A | FLOAT_SLIDER | 20 | 0..500 | interpolatable | A |
| shadow.softness.b | 257 | SM Shadow Softness B | FLOAT_SLIDER | 20 | 0..500 | interpolatable | B |
| stroke.enabled.a | 200 | SM Stroke Enable A | CHECKBOX | false | n/a | interpolatable | A |
| stroke.enabled.b | 201 | SM Stroke Enable B | CHECKBOX | false | n/a | interpolatable | B |
| stroke.width.a | 202 | SM Stroke Width A | FLOAT_SLIDER | 10 | 0..1000 | interpolatable | A |
| stroke.width.b | 203 | SM Stroke Width B | FLOAT_SLIDER | 10 | 0..1000 | interpolatable | B |
| stroke.color1.a | 204 | SM Stroke Color1 A | COLOR | "white" | n/a | interpolatable | A |
| stroke.color1.b | 205 | SM Stroke Color1 B | COLOR | "white" | n/a | interpolatable | B |
| stroke.color2.a | 206 | SM Stroke Color2 A | COLOR | "white" | n/a | interpolatable | A |
| stroke.color2.b | 207 | SM Stroke Color2 B | COLOR | "white" | n/a | interpolatable | B |
| stroke.gradientAngle.a | 208 | SM Stroke Angle A | ANGLE | 0 | n/a | interpolatable | A |
| stroke.gradientAngle.b | 209 | SM Stroke Angle B | ANGLE | 0 | n/a | interpolatable | B |
| stroke.gradientCycleSpeed | 210 | SM Stroke Cycle Spd | FLOAT_SLIDER | 0 | -100..100 | static | transition |
| glow.enabled.a | 211 | SM Glow Enable A | CHECKBOX | false | n/a | interpolatable | A |
| glow.enabled.b | 212 | SM Glow Enable B | CHECKBOX | false | n/a | interpolatable | B |
| glow.amount.a | 213 | SM Glow Amount A | FLOAT_SLIDER | 0 | 0..100 | interpolatable | A |
| glow.amount.b | 214 | SM Glow Amount B | FLOAT_SLIDER | 0 | 0..100 | interpolatable | B |
| glow.radius.a | 215 | SM Glow Radius A | FLOAT_SLIDER | 50 | 0..1000 | interpolatable | A |
| glow.radius.b | 216 | SM Glow Radius B | FLOAT_SLIDER | 50 | 0..1000 | interpolatable | B |
