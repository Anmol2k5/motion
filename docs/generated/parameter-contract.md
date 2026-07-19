# StateMotion Parameter Contract (generated)

- schemaVersion: 1
- bindingRevision: 2
- parameterCount: 25
- SHA-256: `f2a192c2e529e9ed4f881ceae7c51f8604d4a6597bca6b9c027dac3e41d9b32e`

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

## Parameters

| logicalId | diskId | wireName | nativeType | default | range | timeVariance | state |
|---|---|---|---|---|---|---|---|
| contract.schemaVersion | 1 | SM Schema Version | FLOAT_SLIDER | 1 | 1..9999 | static | metadata |
| contract.parameterCount | 2 | SM Param Count | FLOAT_SLIDER | 25 | 1..9999 | static | metadata |
| contract.bindingRevision | 3 | SM Binding Rev | FLOAT_SLIDER | 1 | 1..9999 | static | metadata |
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
