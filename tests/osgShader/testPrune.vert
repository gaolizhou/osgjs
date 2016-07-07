#version 100

#ifdef GL_FRAGMENT_PRECISION_HIGH
 precision highp float;
 #else
 precision mediump float;
#endif
#define SHADER_NAME ShadowCast
#define _PCF
#define _PCFx1
#define _TAP_PCF


uniform vec4 Shadow_DepthRange;
uniform float exponent0;
uniform float exponent1;

varying vec4 FragEyeVector;




float decodeFloatRGBA( vec4 rgba ) {
    return dot( rgba, vec4(1.0, 1.0/255.0, 1.0/65025.0, 1.0/160581375.0) );
}

vec4 encodeFloatRGBA( float v ) {
    vec4 enc = vec4(1.0, 255.0, 65025.0, 160581375.0) * v;
    enc = fract(enc);
    enc -= enc.yzww * vec4(1.0/255.0,1.0/255.0,1.0/255.0,0.0);
    return enc;
}

vec2 decodeHalfFloatRGBA( vec4 rgba ) {
    return vec2(rgba.x + (rgba.y / 255.0), rgba.z + (rgba.w / 255.0));
}

vec4 encodeHalfFloatRGBA( vec2 v ) {
    const vec2 bias = vec2(1.0 / 255.0, 0.0);
    vec4 enc;
    enc.xy = vec2(v.x, fract(v.x * 255.0));
    enc.xy = enc.xy - (enc.yy * bias);

    enc.zw = vec2(v.y, fract(v.y * 255.0));
    enc.zw = enc.zw - (enc.ww * bias);
    return enc;
}


// see shadowSettings.js header for shadow algo param explanations

#ifdef _EVSM
// Convert depth to EVSM coefficients
// Input depth should be in [0, 1]
vec2 warpDepth(const in float depth, const in vec2 exponents) {
    float pos =  exp( exponents.x * depth);
    float neg = -exp(-exponents.y * depth);
    return vec2(pos, neg);
}

// Convert depth value to EVSM representation
vec4 shadowDepthToEVSM(const in float depth, const in float expo0, const in float expo1) {
    vec2 warpedDepth = warpDepth(depth, vec2(expo0, expo1));
    return vec4(warpedDepth.xy, warpedDepth.xy * warpedDepth.xy);
}
#endif // _EVSM


#if defined(_NONE) ||  defined(_PCF)
vec4 computeShadowDepth(const in vec4 fragEye,
                        const in vec4 shadowRange)
#else
vec4 computeShadowDepth(const in vec4 fragEye,
                        const in vec4 shadowRange,
                        const in float expo0,
                        const in float expo1)
#endif
{
    // distance to camera
    float depth =  -fragEye.z * fragEye.w;
    // most precision near 0, make sure we are near 0 and in  [0,1]
    depth = (depth - shadowRange.x ) * shadowRange.w;

    vec4 outputFrag;

#if defined (_FLOATTEX) && defined(_PCF)
    outputFrag = vec4(depth, 0.0, 0.0, 1.0);
#elif defined (_FLOATTEX)  && defined(_ESM)
    float depthScale = expo1;
    depth = exp(-depth * depthScale);
    outputFrag = vec4(depth, 0.0, 0.0, 1.0);
#elif defined (_FLOATTEX)  && defined(_VSM)
    outputFrag = vec4(depth, depth * depth, 0.0, 1.0);
#elif defined (_FLOATTEX)  && defined(_EVSM)
    outputFrag = shadowDepthToEVSM(depth, expo0, expo1);
#elif defined (_FLOATTEX) // && defined(_NONE)
    outputFrag = vec4(depth, 0.0, 0.0, 1.0);
#elif defined(_PCF)
    outputFrag = encodeFloatRGBA(depth);
#elif defined(_ESM)
    float depthScale = expo1;
    depthScale = exp(-depth * depthScale);
    outputFrag = encodeFloatRGBA(depthScale);
#elif defined(_VSM)
    outputFrag = encodeHalfFloatRGBA(vec2(depth, depth* depth));
#else // NONE
    outputFrag = encodeFloatRGBA(depth);

#endif

    return outputFrag;
}

void main() {
// vars

vec4 tmp_1;

// end vars


// output
// vec4 tmp_1
// inputs
// vec4 FragEyeVector
// vec4 Shadow_DepthRange
tmp_1 = computeShadowDepth( FragEyeVector, Shadow_DepthRange );

gl_FragColor = tmp_1.rgba;
}