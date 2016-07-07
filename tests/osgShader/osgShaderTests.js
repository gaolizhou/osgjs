'use strict';
var Compiler = require( 'tests/osgShader/Compiler' );
var ShaderGenerator = require( 'tests/osgShader/ShaderGenerator' );
var ShaderProcessor = require( 'tests/osgShader/ShaderProcessor' );

module.exports = function () {
    Compiler();
    ShaderGenerator();
    ShaderProcessor();
};
