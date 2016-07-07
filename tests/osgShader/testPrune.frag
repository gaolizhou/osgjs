#version 100
#extension GL_OES_standard_derivatives : enable
#ifdef GL_FRAGMENT_PRECISION_HIGH
 precision highp float;
 #else
 precision mediump float;
#endif
#define SHADER_NAME CompilerOSGJS
#define _PCF
#define _PCFx1
#define _TAP_PCF


uniform vec3 Light0_uniform_direction;
uniform float ArrayColorEnabled;
uniform float Light0_uniform_spotBlend;
uniform float Light0_uniform_spotCutOff;
uniform float Light1_uniform_spotBlend;
uniform float Light1_uniform_spotCutOff;
uniform float Light2_uniform_spotBlend;
uniform float Light2_uniform_spotCutOff;
uniform float MaterialShininess;
uniform float ShadowReceive0_uniform_bias;
uniform float ShadowReceive0_uniform_epsilonVSM;
uniform float ShadowReceive0_uniform_exponent0;
uniform float ShadowReceive0_uniform_exponent1;
uniform float ShadowReceive1_uniform_bias;
uniform float ShadowReceive1_uniform_epsilonVSM;
uniform float ShadowReceive1_uniform_exponent0;
uniform float ShadowReceive1_uniform_exponent1;
uniform float ShadowReceive2_uniform_bias;
uniform float ShadowReceive2_uniform_epsilonVSM;
uniform float ShadowReceive2_uniform_exponent0;
uniform float ShadowReceive2_uniform_exponent1;
uniform mat4 Light0_uniform_invMatrix;
uniform mat4 Light0_uniform_matrix;
uniform mat4 Light1_uniform_invMatrix;
uniform mat4 Light1_uniform_matrix;
uniform mat4 Light2_uniform_invMatrix;
uniform mat4 Light2_uniform_matrix;
uniform mat4 Shadow_Texture0_uniform_ProjectionMatrix;
uniform mat4 Shadow_Texture0_uniform_ViewMatrix;
uniform mat4 Shadow_Texture1_uniform_ProjectionMatrix;
uniform mat4 Shadow_Texture1_uniform_ViewMatrix;
uniform mat4 Shadow_Texture2_uniform_ProjectionMatrix;
uniform mat4 Shadow_Texture2_uniform_ViewMatrix;
uniform sampler2D Texture4;
uniform sampler2D Texture5;
uniform sampler2D Texture6;
uniform vec3 Light1_uniform_direction;
uniform vec3 Light2_uniform_direction;
uniform vec4 Light0_uniform_ambient;
uniform vec4 Light0_uniform_attenuation;
uniform vec4 Light0_uniform_diffuse;
uniform vec4 Light0_uniform_ground;
uniform vec4 Light0_uniform_position;
uniform vec4 Light0_uniform_specular;
uniform vec4 Light1_uniform_ambient;
uniform vec4 Light1_uniform_attenuation;
uniform vec4 Light1_uniform_diffuse;
uniform vec4 Light1_uniform_ground;
uniform vec4 Light1_uniform_position;
uniform vec4 Light1_uniform_specular;
uniform vec4 Light2_uniform_ambient;
uniform vec4 Light2_uniform_attenuation;
uniform vec4 Light2_uniform_diffuse;
uniform vec4 Light2_uniform_ground;
uniform vec4 Light2_uniform_position;
uniform vec4 Light2_uniform_specular;
uniform vec4 MaterialAmbient;
uniform vec4 MaterialDiffuse;
uniform vec4 MaterialEmission;
uniform vec4 MaterialSpecular;
uniform vec4 Shadow_Texture0_uniform_DepthRange;
uniform vec4 Shadow_Texture0_uniform_MapSize;
uniform vec4 Shadow_Texture1_uniform_DepthRange;
uniform vec4 Shadow_Texture1_uniform_MapSize;
uniform vec4 Shadow_Texture2_uniform_DepthRange;
uniform vec4 Shadow_Texture2_uniform_MapSize;

varying vec3 FragNormal;
varying vec3 WorldPosition;
varying vec4 FragEyeVector;
varying vec4 VertexColor;


// the approximation :
// http://chilliant.blogspot.fr/2012/08/srgb-approximations-for-hlsl.html
// introduced slightly darker colors and more slight banding in the darks.
// The reference implementation (or even a single pow approx) did not introduced these effects.

// so for now we stick with the reference implementation :
// https://www.khronos.org/registry/gles/extensions/EXT/EXT_sRGB.txt
// with the slight changes :
// - we always assume the color is >= 0.0 (so no check)
// - unlike the previous approximation, linear to srgb is monotonic so we don't need to check if the color is > 1

#define LIN_SRGB(x) x < 0.0031308 ? x * 12.92 : 1.055 * pow(x, 1.0/2.4) - 0.055
float linearTosRGB(const in float c) {
    return LIN_SRGB(c);
}
vec3 linearTosRGB(const in vec3 c) {
    return vec3(LIN_SRGB(c.r), LIN_SRGB(c.g), LIN_SRGB(c.b));
}
vec4 linearTosRGB(const in vec4 c) {
    return vec4(LIN_SRGB(c.r), LIN_SRGB(c.g), LIN_SRGB(c.b), c.a);
}

#define SRGB_LIN(x) x < 0.04045 ? x * (1.0 / 12.92) : pow((x + 0.055) * (1.0 / 1.055), 2.4)
float sRGBToLinear(const in float c) {
    return SRGB_LIN(c);
}
vec3 sRGBToLinear(const in vec3 c) {
    return vec3(SRGB_LIN(c.r), SRGB_LIN(c.g), SRGB_LIN(c.b));
}
vec4 sRGBToLinear(const in vec4 c) {
    return vec4(SRGB_LIN(c.r), SRGB_LIN(c.g), SRGB_LIN(c.b), c.a);
}

//http://graphicrants.blogspot.fr/2009/04/rgbm-color-encoding.html
vec3 RGBMToRGB( const in vec4 rgba ) {
    const float maxRange = 8.0;
    return rgba.rgb * maxRange * rgba.a;
}

const mat3 LUVInverse = mat3( 6.0013,    -2.700,   -1.7995,
                              -1.332,    3.1029,   -5.7720,
                              0.3007,    -1.088,    5.6268 );

vec3 LUVToRGB( const in vec4 vLogLuv ) {
    float Le = vLogLuv.z * 255.0 + vLogLuv.w;
    vec3 Xp_Y_XYZp;
    Xp_Y_XYZp.y = exp2((Le - 127.0) / 2.0);
    Xp_Y_XYZp.z = Xp_Y_XYZp.y / vLogLuv.y;
    Xp_Y_XYZp.x = vLogLuv.x * Xp_Y_XYZp.z;
    vec3 vRGB = LUVInverse * Xp_Y_XYZp;
    return max(vRGB, 0.0);
}

// http://graphicrants.blogspot.fr/2009/04/rgbm-color-encoding.html
vec4 encodeRGBM(const in vec3 col, const in float range) {
    if(range <= 0.0)
        return vec4(col, 1.0);
    vec4 rgbm;
    vec3 color = col / range;
    rgbm.a = clamp( max( max( color.r, color.g ), max( color.b, 1e-6 ) ), 0.0, 1.0 );
    rgbm.a = ceil( rgbm.a * 255.0 ) / 255.0;
    rgbm.rgb = color / rgbm.a;
    return rgbm;
}

vec3 decodeRGBM(const in vec4 col, const in float range) {
    if(range <= 0.0)
        return col.rgb;
    return range * col.rgb * col.a;
}

////////////////
// ATTENUATION
/////////////
float getLightAttenuation(const in float dist, const in vec4 lightAttenuation)
{
    // lightAttenuation(constantEnabled, linearEnabled, quadraticEnabled)
    // TODO find a vector alu instead of 4 scalar
    float constant = lightAttenuation.x;
    float linear = lightAttenuation.y*dist;
    float quadratic = lightAttenuation.z*dist*dist;
    return 1.0 / ( constant + linear + quadratic );
}
//
// LIGHTING EQUATION TERMS
///
void specularCookTorrance(const in vec3 n, const in vec3 l, const in vec3 v, const in float hard, const in vec3 materialSpecular, const in vec3 lightSpecular, out vec3 specularContrib)
{
    vec3 h = normalize(v + l);
    float nh = dot(n, h);
    float specfac = 0.0;

    if(nh > 0.0) {
        float nv = max( dot(n, v), 0.0 );
        float i = pow(nh, hard);
        i = i / (0.1 + nv);
        specfac = i;
    }
    // ugly way to fake an energy conservation (mainly to avoid super bright stuffs with low glossiness)
    float att = hard > 100.0 ? 1.0 : smoothstep(0.0, 1.0, hard * 0.01);
    specularContrib = specfac*materialSpecular*lightSpecular*att;
}

void lambert(const in float ndl,  const in vec3 materialDiffuse, const in vec3 lightDiffuse, out vec3 diffuseContrib)
{
    diffuseContrib = ndl*materialDiffuse*lightDiffuse;
}
////////////////////////
/// Main func
///////////////////////

/// for each light
//direction, dist, NDL, attenuation, compute diffuse, compute specular

vec3 computeSpotLightShading(
                             const in vec3 normal,
                             const in vec3 eyeVector,

                             const in vec3 materialAmbient,
                             const in vec3 materialDiffuse,
                             const in vec3 materialSpecular,
                             const in float materialShininess,

                             const in vec3 lightAmbient,
                             const in vec3 lightDiffuse,
                             const in vec3 lightSpecular,

                             const in vec3  lightSpotDirection,
                             const in vec4  lightAttenuation,
                             const in vec4  lightSpotPosition,
                             const in float lightCosSpotCutoff,
                             const in float lightSpotBlend,

                             const in mat4 lightMatrix,
                             const in mat4 lightInvMatrix,

                             out vec3 eyeLightPos,
                             out vec3 eyeLightDir,
                             out float NdotL,
                             out bool lighted)
{
    lighted = false;
    eyeLightPos = vec3(lightMatrix * lightSpotPosition);
    eyeLightDir = eyeLightPos - FragEyeVector.xyz;
    // compute dist
    float dist = length(eyeLightDir);
    // compute attenuation
    float attenuation = getLightAttenuation(dist, lightAttenuation);
    if (attenuation != 0.0)
        {
            // compute direction
            eyeLightDir = dist > 0.0 ? eyeLightDir / dist :  vec3( 0.0, 1.0, 0.0 );
            if (lightCosSpotCutoff > 0.0)
                {
                    //compute lightSpotBlend
                    vec3 lightSpotDirectionEye = normalize(mat3(vec3(lightInvMatrix[0]), vec3(lightInvMatrix[1]), vec3(lightInvMatrix[2]))*lightSpotDirection);

                    float cosCurAngle = dot(-eyeLightDir, lightSpotDirectionEye);
                    float diffAngle = cosCurAngle - lightCosSpotCutoff;
                    float spot = 1.0;
                    if ( diffAngle < 0.0 ) {
                        spot = 0.0;
                    } else {
                        if ( lightSpotBlend > 0.0 )
                            spot = cosCurAngle * smoothstep(0.0, 1.0, (cosCurAngle - lightCosSpotCutoff) / (lightSpotBlend));
                    }

                    if (spot > 0.0)
                        {
                            // compute NdL
                            NdotL = dot(eyeLightDir, normal);
                            if (NdotL > 0.0)
                                {
                                    lighted = true;
                                    vec3 diffuseContrib;
                                    lambert(NdotL, materialDiffuse, lightDiffuse, diffuseContrib);
                                    vec3 specularContrib;
                                    specularCookTorrance(normal, eyeLightDir, eyeVector, materialShininess, materialSpecular, lightSpecular, specularContrib);
                                    return spot * attenuation * (diffuseContrib + specularContrib);
                                }
                        }
                }
        }
    return vec3(0.0);
}

vec3 computePointLightShading(
                              const in vec3 normal,
                              const in vec3 eyeVector,

                              const in vec3 materialAmbient,
                              const in vec3 materialDiffuse,
                              const in vec3 materialSpecular,
                              const in float materialShininess,

                              const in vec3 lightAmbient,
                              const in vec3 lightDiffuse,
                              const in vec3 lightSpecular,

                              const in vec4 lightPosition,
                              const in vec4 lightAttenuation,

                              const in mat4 lightMatrix,

                              out vec3 eyeLightPos,
                              out vec3 eyeLightDir,
                              out float NdotL,
                              out bool lighted)
{

    eyeLightPos =  vec3(lightMatrix * lightPosition);
    eyeLightDir = eyeLightPos - FragEyeVector.xyz;
    float dist = length(eyeLightDir);
    // compute dist
    // compute attenuation
    float attenuation = getLightAttenuation(dist, lightAttenuation);
    if (attenuation != 0.0)
        {
            // compute direction
            eyeLightDir = dist > 0.0 ? eyeLightDir / dist :  vec3( 0.0, 1.0, 0.0 );
            // compute NdL
            NdotL = dot(eyeLightDir, normal);
            if (NdotL > 0.0)
                {
                    lighted = true;
                    vec3 diffuseContrib;
                    lambert(NdotL, materialDiffuse, lightDiffuse, diffuseContrib);
                    vec3 specularContrib;
                    specularCookTorrance(normal, eyeLightDir, eyeVector, materialShininess, materialSpecular, lightSpecular, specularContrib);
                    return attenuation * (diffuseContrib + specularContrib);
                }
        }
    return vec3(0.0);
}

vec3 computeSunLightShading(

                            const in vec3 normal,
                            const in vec3 eyeVector,

                            const in vec3 materialAmbient,
                            const in vec3 materialDiffuse,
                            const in vec3 materialSpecular,
                            const in float materialShininess,

                            const in vec3 lightAmbient,
                            const in vec3 lightDiffuse,
                            const in vec3 lightSpecular,

                            const in vec4 lightPosition,

                            const in mat4 lightMatrix,

                            out vec3 eyeLightDir,
                            out float NdotL,
                            out bool lighted)
{

    lighted = false;
    eyeLightDir = normalize( vec3(lightMatrix * lightPosition ) );
    // compute NdL   // compute NdL
    NdotL = dot(eyeLightDir, normal);
    if (NdotL > 0.0)
        {
            lighted = true;
            vec3 diffuseContrib;
            lambert(NdotL, materialDiffuse, lightDiffuse, diffuseContrib);
            vec3 specularContrib;
            specularCookTorrance(normal, eyeLightDir, eyeVector, materialShininess, materialSpecular, lightSpecular, specularContrib);
            return (diffuseContrib + specularContrib);
        }
    return vec3(0.0);
}

vec3 computeHemiLightShading(

    const in vec3 normal,
    const in vec3 eyeVector,

    const in vec3 materialDiffuse,
    const in vec3 materialSpecular,
    const in float materialShininess,

    const in vec3 lightDiffuse,
    const in vec3 lightGround,

    const in vec4 lightPosition,

    const in mat4 lightMatrix,

    out vec3 eyeLightDir,
    out float NdotL,
    out bool lighted)
{
    lighted = false;

    eyeLightDir = normalize( vec3(lightMatrix * lightPosition ) );
    NdotL = dot(eyeLightDir, normal);
    float weight = 0.5 * NdotL + 0.5;
    vec3 diffuseContrib = materialDiffuse * mix(lightGround, lightDiffuse, weight);

    // same cook-torrance as above for sky/ground
    float skyWeight = 0.5 * dot(normal, normalize(eyeVector + eyeLightDir)) + 0.5;
    float gndWeight = 0.5 * dot(normal, normalize(eyeVector - eyeLightDir)) + 0.5;
    float skySpec = pow(skyWeight, materialShininess);
    float skyGround = pow(gndWeight, materialShininess);
    float divisor = (0.1 + max( dot(normal, eyeVector), 0.0 ));
    float att = materialShininess > 100.0 ? 1.0 : smoothstep(0.0, 1.0, materialShininess * 0.01);
    vec3 specularContrib = lightDiffuse * materialSpecular * weight * att * (skySpec + skyGround) / divisor;

    return diffuseContrib + specularContrib;
}

//begin shadows


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

// end Float codec
float getSingleFloatFromTex(const in sampler2D depths, const in vec2 uv){
#ifndef _FLOATTEX
    return  decodeFloatRGBA(texture2D(depths, uv));
#else
    return texture2D(depths, uv).x;
#endif
}

vec2 getDoubleFloatFromTex(const in sampler2D depths, const in vec2 uv){
#ifndef _FLOATTEX
    return decodeHalfFloatRGBA(texture2D(depths, uv));
#else
    return texture2D(depths, uv).xy;
#endif
}

vec4 getQuadFloatFromTex(const in sampler2D depths, const in vec2 uv){
    return texture2D(depths, uv).xyzw;
}
// end Float codec















// simulation of texture2Dshadow glsl call on HW
// http://codeflow.org/entries/2013/feb/15/soft-shadow-mapping/
float texture2DCompare(const in sampler2D depths, const in vec2 uv, const in float compare){

    float depth = getSingleFloatFromTex(depths, uv);
    return step(compare, depth);

}

// simulates linear fetch like texture2d shadow
float texture2DShadowLerp(const in sampler2D depths, const in vec4 size, const in vec2 uv, const in float compare){

#if defined(_FAKE_PCF)
    // CHEAT: it's wrong, but 4x faster
    // wronb because http://www.eng.utah.edu/~cs5610/handouts/reeves87.pdf p2
    return texture2DCompare(depths, uv, compare);
#else
    vec2 f = fract(uv*size.xy+0.5);
    vec2 centroidUV = floor(uv*size.xy+0.5)*size.zw;

    float lb = texture2DCompare(depths, centroidUV+size.zw*vec2(0.0, 0.0), compare);
    float lt = texture2DCompare(depths, centroidUV+size.zw*vec2(0.0, 1.0), compare);
    float rb = texture2DCompare(depths, centroidUV+size.zw*vec2(1.0, 0.0), compare);
    float rt = texture2DCompare(depths, centroidUV+size.zw*vec2(1.0, 1.0), compare);
    float a = mix(lb, lt, f.y);
    float b = mix(rb, rt, f.y);
    float c = mix(a, b, f.x);
    return c;
#endif

}


float getShadowPCF(const in sampler2D depths, const in vec4 size, const in vec2 uv, const in float compare, const in vec2 biasPCF)
{

     float res = 0.0;

#if defined(_ROTATE_OFFSET)
     res += texture2DShadowLerp(depths, size,   uv + size.zw*(noise2D(uv*gl_FragCoord.xy)*2.0 - 1.0) + biasPCF, compare);
#else
     res += texture2DShadowLerp(depths, size,   uv + biasPCF, compare);
#endif


#if defined(_PCFx1)

#else

    float dx0 = -size.z;
    float dy0 = -size.w;
    float dx1 = size.z;
    float dy1 = size.w;

#define TSF(o1,o2) texture2DShadowLerp(depths, size, uv + vec2(o1, o2) + biasPCF,  compare)

    res += TSF(dx0, dx0);
    res += TSF(dx0, .0);
    res += TSF(dx0, dx1);

#if defined(_PCFx4)

    res /=4.0;

#elif defined(_PCFx9)
    res += TSF(.0, dx0);
    res += TSF(.0, dx1);

    res += TSF(dx1, dx0);
    res += TSF(dx1, .0);
    res += TSF(dx1, dx1);


    res /=9.0;

#elif defined(_PCFx25)

    float dx02 = -2.0*size.z;
    float dy02 = -2.0*size.w;
    float dx2 = 2.0*size.z;
    float dy2 = 2.0*size.w;

    // complete row above
    res += TSF(dx0, dx02);
    res += TSF(dx0, dx2);

    res += TSF(.0, dx02);
    res += TSF(.0, dx2);

    res += TSF(dx1, dx02);
    res += TSF(dx1, dx2);

    // two new col
    res += TSF(dx02, dx02);
    res += TSF(dx02, dx0);
    res += TSF(dx02, .0);
    res += TSF(dx02, dx1);
    res += TSF(dx02, dx2);

    res += TSF(dx2, dx02);
    res += TSF(dx2, dx0);
    res += TSF(dx2, .0);
    res += TSF(dx2, dx1);
    res += TSF(dx2, dx2);


    res/=25.0;

#endif

#undef TSF

#endif
    return res;
}
/////// end Tap


float computeShadow(const in bool lighted,
                    const in sampler2D tex,
                    const in vec4 shadowMapSize,
                    const in mat4 shadowProjectionMatrix,
                    const in mat4 shadowViewMatrix,
                    const in vec4 depthRange,
                    const in float N_Dot_L,
                    const in vec3 vertexWorld,
                    const in float bias
    )
{
    
    if (!lighted)
        return 1.;

    if (depthRange.x == depthRange.y)
        return 1.;

    vec4 shadowVertexEye = shadowViewMatrix *  vec4(vertexWorld, 1.0);
    float shadowReceiverZ =  - shadowVertexEye.z;

    if( shadowReceiverZ < 0.0)
        return 1.0; // notably behind camera

    vec4 shadowVertexProjected = shadowProjectionMatrix * shadowVertexEye;
    if (shadowVertexProjected.w < 0.0)
        return 1.0; // notably behind camera

    vec2 shadowUV;

    shadowUV.xy = shadowVertexProjected.xy / shadowVertexProjected.w;
    shadowUV.xy = shadowUV.xy * 0.5 + 0.5;// mad like

    bool outFrustum = any(bvec4 ( shadowUV.x > 1., shadowUV.x < 0., shadowUV.y > 1., shadowUV.y < 0. ));
    if (outFrustum )
        return 1.0;// limits of light frustum
    // most precision near 0, make sure we are near 0 and in [0,1]
    shadowReceiverZ =  (shadowReceiverZ - depthRange.x)* depthRange.w;

    // depth bias: fighting shadow acne (depth imprecsion z-fighting)
    float shadowBias = 0.0;
    // cosTheta is dot( n, l ), clamped between 0 and 1
    //float shadowBias = 0.005*tan(acos(N_Dot_L));
    // same but 4 cycles instead of 15
    shadowBias += 0.05 *  sqrt( 1. -  N_Dot_L*N_Dot_L) / clamp(N_Dot_L, 0.0005,  1.0);

    //That makes sure that plane perpendicular to light doesn't flicker due to
    //selfshadowing and 1 = dot(Normal, Light) using a min bias
    shadowBias = clamp(shadowBias, 0.00005,  bias);

    // shadowZ must be clamped to [0,1]
    // otherwise it's not comparable to
    // shadow caster depth map
    // which is clamped to [0,1]
    // Not doing that makes ALL shadowReceiver > 1.0 black
    // because they ALL becomes behind any point in Caster depth map
    shadowReceiverZ = clamp(shadowReceiverZ, 0., 1. - shadowBias);

    shadowReceiverZ -= shadowBias;

    // Now computes Shadow

    // Calculate shadow amount
    float shadow = 1.0;

    // return 0.0 for black;
    // return 1.0 for light;

#ifdef _NONE

    float shadowDepth = getSingleFloatFromTex(tex, shadowUV.xy);
    // shadowReceiverZ : receiver depth in light view
    // shadowDepth : caster depth in light view
    // receiver is shadowed if its depth is superior to the caster
    shadow = ( shadowReceiverZ > shadowDepth ) ? 0.0 : 1.0;

#elif defined( _PCF )
    // pcf pbias to add on offset
    vec2 shadowBiasPCF = vec2(0.);


// looks like derivative is broken on some mac + intel cg ...
#ifdef GL_OES_standard_derivatives

    shadowBiasPCF.x = clamp(dFdx(shadowReceiverZ)* shadowMapSize.z, -1.0, 1.0 );
    shadowBiasPCF.y = clamp(dFdy(shadowReceiverZ)* shadowMapSize.w, -1.0, 1.0 );
    
#endif


    shadow = getShadowPCF(tex, shadowMapSize, shadowUV, shadowReceiverZ, shadowBiasPCF);

#elif defined( _ESM )

    shadow = fetchESM(tex, shadowMapSize, shadowUV, shadowReceiverZ, exponent0, exponent1);

#elif  defined( _VSM )

    vec2 moments = getDoubleFloatFromTex(tex, shadowUV.xy);
    shadow = chebyshevUpperBound(moments, shadowReceiverZ, epsilonVSM);

#elif  defined( _EVSM )

    vec4 occluder = getQuadFloatFromTex(tex, shadowUV.xy);
    vec2 exponents = vec2(exponent0, exponent1);
    vec2 warpedDepth = warpDepth(shadowReceiverZ, exponents);

    float derivationEVSM = epsilonVSM;
    // Derivative of warping at depth
    vec2 depthScale = derivationEVSM * exponents * warpedDepth;
    vec2 minVariance = depthScale * depthScale;

    float epsilonEVSM = -epsilonVSM;

    // Compute the upper bounds of the visibility function both for x and y
    float posContrib = chebyshevUpperBound(occluder.xz, -warpedDepth.x, minVariance.x);
    float negContrib = chebyshevUpperBound(occluder.yw, warpedDepth.y, minVariance.y);

    shadow = min(posContrib, negContrib);

#endif


    return shadow;




}

void main() {
// vars

vec4 tmp_11; vec3 tmp_12; vec3 tmp_13; bool lighted0; vec3 lightEyePos0; vec3 lightEyeDir0; float lightNDL0; vec3 normal; vec3 frontNormal; vec3 tmp_32; vec3 tmp_33; vec3 eyeVector; float tmp_36 = -1.0; float tmp_38; vec3 lightAndShadowTempOutput; vec3 lightMatAmbientOutput; vec3 tmp_50; bool lighted1; vec3 lightEyePos1; vec3 lightEyeDir1; float lightNDL1; float tmp_66; vec3 lightAndShadowTempOutput1; vec3 lightMatAmbientOutput1; vec3 tmp_78; bool lighted2; vec3 lightEyePos2; vec3 lightEyeDir2; float lightNDL2; float tmp_94; vec3 lightAndShadowTempOutput2; vec3 lightMatAmbientOutput2; vec3 tmp_106 = vec3(0.0); float tmp_107; vec4 tmp_108;

// end vars

//diffuse color = diffuse color * vertex color

tmp_11.rgb = MaterialDiffuse.rgb;
if ( ArrayColorEnabled == 1.0)
  tmp_11 *= VertexColor.rgba;
frontNormal = gl_FrontFacing ? FragNormal : -FragNormal ;

// output
// vec3 normal
// inputs
// vec3 frontNormal
normal = normalize( frontNormal );

tmp_33 = FragEyeVector.rgb;

// output
// vec3 tmp_32
// inputs
// vec3 tmp_33
tmp_32 = normalize( tmp_33 );

eyeVector = tmp_32.rgb*tmp_36;

// output
// vec3 tmp_13
// inputs
// vec3 normal
// vec3 eyeVector
// MaterialAmbient.rgb
// tmp_11.rgb
// MaterialSpecular.rgb
// float MaterialShininess
// Light0_uniform_ambient.rgb
// Light0_uniform_diffuse.rgb
// Light0_uniform_specular.rgb
// vec3 Light0_uniform_direction
// vec4 Light0_uniform_attenuation
// vec4 Light0_uniform_position
// float Light0_uniform_spotCutOff
// float Light0_uniform_spotBlend
// mat4 Light0_uniform_matrix
// mat4 Light0_uniform_invMatrix
// vec3 lightEyePos0
// vec3 lightEyeDir0
// float lightNDL0
// bool lighted0
tmp_13 = computeSpotLightShading( normal, eyeVector, MaterialAmbient.rgb, tmp_11.rgb, MaterialSpecular.rgb, MaterialShininess, Light0_uniform_ambient.rgb, Light0_uniform_diffuse.rgb, Light0_uniform_specular.rgb, Light0_uniform_direction, Light0_uniform_attenuation, Light0_uniform_position, Light0_uniform_spotCutOff, Light0_uniform_spotBlend, Light0_uniform_matrix, Light0_uniform_invMatrix, lightEyePos0, lightEyeDir0, lightNDL0, lighted0 );


// output
// float tmp_38
// inputs
// bool lighted0
// sampler2D Texture4
// vec4 Shadow_Texture0_uniform_MapSize
// mat4 Shadow_Texture0_uniform_ProjectionMatrix
// mat4 Shadow_Texture0_uniform_ViewMatrix
// vec4 Shadow_Texture0_uniform_DepthRange
// float lightNDL0
// vec3 WorldPosition
// float ShadowReceive0_uniform_bias
tmp_38 = computeShadow( lighted0, Texture4, Shadow_Texture0_uniform_MapSize, Shadow_Texture0_uniform_ProjectionMatrix, Shadow_Texture0_uniform_ViewMatrix, Shadow_Texture0_uniform_DepthRange, lightNDL0, WorldPosition, ShadowReceive0_uniform_bias );

lightAndShadowTempOutput = tmp_13.rgb*tmp_38;
lightMatAmbientOutput = MaterialAmbient.rgb*Light0_uniform_ambient.rgb;

// output
// vec3 tmp_50
// inputs
// vec3 normal
// vec3 eyeVector
// MaterialAmbient.rgb
// tmp_11.rgb
// MaterialSpecular.rgb
// float MaterialShininess
// Light1_uniform_ambient.rgb
// Light1_uniform_diffuse.rgb
// Light1_uniform_specular.rgb
// vec3 Light1_uniform_direction
// vec4 Light1_uniform_attenuation
// vec4 Light1_uniform_position
// float Light1_uniform_spotCutOff
// float Light1_uniform_spotBlend
// mat4 Light1_uniform_matrix
// mat4 Light1_uniform_invMatrix
// vec3 lightEyePos1
// vec3 lightEyeDir1
// float lightNDL1
// bool lighted1
tmp_50 = computeSpotLightShading( normal, eyeVector, MaterialAmbient.rgb, tmp_11.rgb, MaterialSpecular.rgb, MaterialShininess, Light1_uniform_ambient.rgb, Light1_uniform_diffuse.rgb, Light1_uniform_specular.rgb, Light1_uniform_direction, Light1_uniform_attenuation, Light1_uniform_position, Light1_uniform_spotCutOff, Light1_uniform_spotBlend, Light1_uniform_matrix, Light1_uniform_invMatrix, lightEyePos1, lightEyeDir1, lightNDL1, lighted1 );


// output
// float tmp_66
// inputs
// bool lighted1
// sampler2D Texture5
// vec4 Shadow_Texture1_uniform_MapSize
// mat4 Shadow_Texture1_uniform_ProjectionMatrix
// mat4 Shadow_Texture1_uniform_ViewMatrix
// vec4 Shadow_Texture1_uniform_DepthRange
// float lightNDL1
// vec3 WorldPosition
// float ShadowReceive1_uniform_bias
tmp_66 = computeShadow( lighted1, Texture5, Shadow_Texture1_uniform_MapSize, Shadow_Texture1_uniform_ProjectionMatrix, Shadow_Texture1_uniform_ViewMatrix, Shadow_Texture1_uniform_DepthRange, lightNDL1, WorldPosition, ShadowReceive1_uniform_bias );

lightAndShadowTempOutput1 = tmp_50.rgb*tmp_66;
lightMatAmbientOutput1 = MaterialAmbient.rgb*Light1_uniform_ambient.rgb;

// output
// vec3 tmp_78
// inputs
// vec3 normal
// vec3 eyeVector
// MaterialAmbient.rgb
// tmp_11.rgb
// MaterialSpecular.rgb
// float MaterialShininess
// Light2_uniform_ambient.rgb
// Light2_uniform_diffuse.rgb
// Light2_uniform_specular.rgb
// vec3 Light2_uniform_direction
// vec4 Light2_uniform_attenuation
// vec4 Light2_uniform_position
// float Light2_uniform_spotCutOff
// float Light2_uniform_spotBlend
// mat4 Light2_uniform_matrix
// mat4 Light2_uniform_invMatrix
// vec3 lightEyePos2
// vec3 lightEyeDir2
// float lightNDL2
// bool lighted2
tmp_78 = computeSpotLightShading( normal, eyeVector, MaterialAmbient.rgb, tmp_11.rgb, MaterialSpecular.rgb, MaterialShininess, Light2_uniform_ambient.rgb, Light2_uniform_diffuse.rgb, Light2_uniform_specular.rgb, Light2_uniform_direction, Light2_uniform_attenuation, Light2_uniform_position, Light2_uniform_spotCutOff, Light2_uniform_spotBlend, Light2_uniform_matrix, Light2_uniform_invMatrix, lightEyePos2, lightEyeDir2, lightNDL2, lighted2 );


// output
// float tmp_94
// inputs
// bool lighted2
// sampler2D Texture6
// vec4 Shadow_Texture2_uniform_MapSize
// mat4 Shadow_Texture2_uniform_ProjectionMatrix
// mat4 Shadow_Texture2_uniform_ViewMatrix
// vec4 Shadow_Texture2_uniform_DepthRange
// float lightNDL2
// vec3 WorldPosition
// float ShadowReceive2_uniform_bias
tmp_94 = computeShadow( lighted2, Texture6, Shadow_Texture2_uniform_MapSize, Shadow_Texture2_uniform_ProjectionMatrix, Shadow_Texture2_uniform_ViewMatrix, Shadow_Texture2_uniform_DepthRange, lightNDL2, WorldPosition, ShadowReceive2_uniform_bias );

lightAndShadowTempOutput2 = tmp_78.rgb*tmp_94;
lightMatAmbientOutput2 = MaterialAmbient.rgb*Light2_uniform_ambient.rgb;
tmp_12 = lightAndShadowTempOutput.rgb+lightMatAmbientOutput.rgb+lightAndShadowTempOutput1.rgb+lightMatAmbientOutput1.rgb+lightAndShadowTempOutput2.rgb+lightMatAmbientOutput2.rgb;
tmp_106 = tmp_12.rgb+MaterialEmission.rgb;
tmp_107 = MaterialDiffuse.a;
tmp_108.rgb = tmp_106.rgb * tmp_107;
gl_FragColor = vec4( tmp_108.rgb, tmp_107 );
}