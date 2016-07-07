'use strict';
var assert = require( 'chai' ).assert;
var ShaderProcessor = require( 'osgShader/ShaderProcessor' );
var Optimizer = require( 'osgShader/Optimizer' );
var testVert = require( 'tests/osgShader/testPrune.vert' );
var testFrag = require( 'tests/osgShader/testPrune.frag' );

var shake = require('glsl-token-function-shaker');
var  stringify = require('glsl-token-string');
var tokenize = require('glsl-tokenizer');

module.exports = function () {

    test( 'ShaderProcessor', function () {

        var shaderProcessor = new ShaderProcessor();
        var out;

        ( function () {

            out = shaderProcessor.postProcess( testVert, [
  "SHADER_NAME ShadowCast",
  "_PCF",
  "_PCFx1",
  "_TAP_PCF",
"GL_FRAGMENT_PRECISION_HIGH"
] );
            console.log( out );

            assert.isOk( testVert !== out, 'shaderProcessor remove shit' );


            out = shaderProcessor.postProcess( testFrag, [
  "SHADER_NAME CompilerOSGJS",
  "_PCF",
  "_PCFx1",
  "_TAP_PCF"
] );
            console.log( out );

            assert.isOk( testFrag !== out, 'shaderProcessor remove shit' );

            var out2 = Optimizer(out);

            assert.isOk( out !== out2, 'Optimizer' );

        } )();
    } );
};
