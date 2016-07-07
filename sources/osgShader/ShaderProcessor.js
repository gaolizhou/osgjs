'use strict';
var Notify = require( 'osg/Notify' );
var shaderLib = require( 'osgShader/shaderLib' );
var shadowShaderLib = require( 'osgShadow/shaderLib' );
var WebGLCaps = require( 'osg/WebGLCaps' );
var Optimizer = require( 'osgShader/Optimizer' );


//     Shader as vert/frag/glsl files Using requirejs text plugin
//     Preprocess features like:    //
//     - Handle (recursive) include, avoiding code repeat and help code factorization
//     - Handle per shader and global define/precision


var ShaderProcessor = function ( createInstance ) {

    if ( !createInstance ) {
        if ( ShaderProcessor.instance ) {
            return ShaderProcessor.instance;
        }
        ShaderProcessor.instance = this;
    }

    this._precisionFloat = WebGLCaps.instance().getWebGLParameter( 'MAX_SHADER_PRECISION_FLOAT' );
    this._precisionInt = WebGLCaps.instance().getWebGLParameter( 'MAX_SHADER_PRECISION_INT' );
    this._webgl2 = WebGLCaps.instance().isWebGL2();

    this.addShaders( shaderLib );
    this.addShaders( shadowShaderLib );
    return this;
};

ShaderProcessor.prototype = {
    _shadersText: {},
    _shadersList: {},
    _globalDefaultprecision: '#ifdef GL_FRAGMENT_PRECISION_HIGH\n precision highp float;\n #else\n precision mediump float;\n#endif',
    _debugLines: false,
    _includeR: /#pragma include "([^"]+)"/g,
    _includeCondR: /#pragma include (["^+"]?["\ "[a-zA-Z_0-9](.*)"]*?)/g,
    _defineR: /\#define\s+([a-zA-Z_0-9]+)/,
    _precisionR: /precision\s+(high|low|medium)p\s+float/,


    // {
    //     'functions.glsl': textShaderFunctions,
    //     'lights.glsl': textShaderFunctions,
    //     'textures.glsl': textShaderFunctions
    // };
    addShaders: function ( shaders ) {

        var keys = window.Object.keys( shaders );

        keys.forEach( function ( key ) {

            this._shadersList[ key ] = key;
            this._shadersText[ key ] = shaders[ key ];

        }, this );

    },


    instrumentShaderlines: function ( content, sourceID ) {
        // TODO instrumentShaderlines
        // http://immersedcode.org/2012/1/12/random-notes-on-webgl/
        // one ID per "file"
        // Each file has its line number starting at 0
        //   handle include, the do that numbering also in preprocess...
        // Then on shader error using sourceID and line you can point the correct line...
        // has to attach that info to osg.shader object.
        /*
          var allLines = content.split('\n');
          var i = 0;
          for (var k = 0; k _< allLines.length; k++) {
          if (!this._includeR.test(allLines[k])) {
          allLines[k] = "#line " + (i++) + " " + sourceID + '\n' + allLines[k] ;
          }
          }
          content = allLines.join('\n');
        */

        // seems just  prefixing first line seems ok to help renumbering error mesg
        return '\n#line ' + 0 + ' ' + sourceID + '\n' + content;
    },

    getShaderTextPure: function ( shaderName ) {

        var preShader = this._shadersText[ shaderName ];

        if ( !preShader ) {
            Notify.error( 'shader file/text: ' + shaderName + ' not registered' );
            preShader = '';
        }

        return preShader;
    },

    getShader: function ( shaderName, defines, extensions, type ) {
        var shader = this.getShaderTextPure( shaderName );
        return this.processShader( shader, defines, extensions, type );
    },

    // remove fat code (undefined)
    // TODO: comments, unused functions)
    postProcess: function ( source, inputsDefines ) {

        // what we'll do
        var pruneComment = false;
        var pruneDefines = true;
        var addNewLines = true;

        // code
        var strippedContent = '';

        // split sources in indexable per line array
        var lines = source.split( '\n' );
        var linesLength = lines.length;
        if ( linesLength === 0 ) return source;

        // regex to extract error message and line from webgl compiler reporting
        // one condition
        var ifdefReg = /#ifdef\s(.+)/i;
        var elseReg = /#else/i;
        var endifReg = /#endif/i;
        var ifndefReg = /#ifndef\s(.+)/i;

        // multipleCondition
        var definedReg = /(?:\s)(!defined|defined)\s?\(\s?(\w+)\)?\s?|(&&)|(\|\|)/gi;
        //var ifReg = /#if defined(.+)/gi;
        //var elifReg = /#elif defined(.+)/gi;

        // change of context
        //var defineReg = /#define\s(\w+)\s(\w+)|#define\s(\w+)\(\w+\)(.+)/i;
        var defineReg = /#define\s(\w+)/i;
        var undefReg = /#undef (.+)/i;
        // cleanears;
        var ccComent = /\/\/(.+)/i;

        // state var
        var droppingDef = false;
        var droppingComment = false;

        var foundIfDef, index, results;

        var preProcessorCmd = false;

        var droppingDefineStack = [ false ];

        var droppingIsADefineStack = [ false ];
        var droppingDefineStackIndex = 0;

        for ( var i = 0; i < linesLength; i++ ) {

            var line = lines[ i ].trim();
            if ( line.length === 0 ) continue;

            if ( pruneComment ) {

                if ( droppingComment ) {
                    if ( line.length >= 2 && line[ 0 ] === '/' && line[ 1 ] === '*' ) {
                        droppingComment = false;
                    }
                    continue;
                }

                if ( line.length >= 2 ) {

                    if ( line[ 0 ] === '/' && line[ 1 ] === '/' ) {
                        continue;
                    }

                    if ( line[ 0 ] === '/' && line[ 1 ] === '*' ) {
                        droppingComment = true;
                        continue;
                    }
                }

            }

            if ( pruneDefines ) {

                preProcessorCmd = line[ 0 ] === '#';
                if ( preProcessorCmd ) {

                    // remove comments
                    // elif defined(FSDF) //&& defined(NOSF)
                    results = line.search( ccComent );
                    if ( results !== -1 ) {
                        line = line.substr( 0, results ).trim();
                    }

                    //////////
                    // #else
                    results = line.search( elseReg );
                    if ( results !== -1 ) {

                        droppingDefineStack[ droppingDefineStackIndex ] = !droppingDefineStack[ droppingDefineStackIndex ];
                        continue;

                    }

                    results = line.match( defineReg );
                    if ( results !== null && results.length > 1 ) {

                        var define = results[ 1 ].trim();
                        //replace( /\s+/g, ' ' ).split( ' ' )[ 1 ];
                        if ( inputsDefines.indexOf( define ) === -1 ) {
                            inputsDefines.push( define );
                        }
                        continue;

                    }

                    results = line.match( undefReg );
                    if ( results !== null && results.length > 1 ) {

                        var defineToUndef = results[ 1 ].trim();
                        var indexOfDefine = inputsDefines.indexOf( defineToUndef );
                        if ( indexOfDefine !== -1 ) {
                            inputsDefines.splice( index, 1 );
                        }
                        continue;

                    }


                    //////////
                    // #ifdef _EVSM                    
                    results = line.match( ifdefReg );
                    if ( results !== null && results.length >= 2 ) {

                        foundIfDef = results[ 1 ];
                        index = inputsDefines.indexOf( foundIfDef );
                        if ( index !== -1 ) {

                            droppingDefineStackIndex++;
                            droppingDefineStack[ droppingDefineStackIndex ] = false;

                        } else {

                            droppingDefineStackIndex++;
                            droppingDefineStack[ droppingDefineStackIndex ] = true;

                        }
                        continue;
                    }

                    //////////
                    // #ifndef _dfd
                    results = line.match( ifndefReg );
                    if ( results !== null && results.length >= 2 ) {

                        foundIfDef = results[ 1 ];
                        index = inputsDefines.indexOf( foundIfDef );
                        if ( index !== -1 ) {

                            droppingDefineStackIndex++;
                            droppingDefineStack[ droppingDefineStackIndex ] = true;

                        } else {

                            droppingDefineStackIndex++;
                            droppingDefineStack[ droppingDefineStackIndex ] = false;

                        }

                        continue;

                    }

                    //////////
                    // check for endif 
                    results = line.search( endifReg );
                    if ( results !== -1 ) {

                        droppingDefineStack.pop();
                        droppingDefineStackIndex--;

                        continue; // remove endif

                    }


                    /// complexity arise: multiple condition possible
                    var definesGroup;
                    var operator;
                    var result = true;

                    // check of elif
                    if ( line.substr( 1, 4 ) === 'elif' ) {

                        // was keeping before, it's a early out
                        if ( !droppingDefineStack[ droppingDefineStackIndex ] ) {
                            droppingDefineStack[ droppingDefineStackIndex ] = true;
                            continue;
                        }

                        result = true;
                        operator = '&&';
                        while ( ( definesGroup = definedReg.exec( line ) ) !== null ) {
                            if ( definesGroup.length > 2 ) {

                                if ( definesGroup[ 1 ] === undefined ) {

                                    // yeah. don't ask for the undefined. just follow along.
                                    // "in theory it should be , in practice however..."

                                    operator = definesGroup[ 0 ].trim();

                                } else if ( definesGroup[ 1 ].trim()[ 0 ] === '!' ) {

                                    // !defined(dfsdf)
                                    if ( operator === '&&' )
                                        result = result && inputsDefines.indexOf( definesGroup[ 2 ] ) === -1;
                                    else
                                        result = result || inputsDefines.indexOf( definesGroup[ 2 ] ) === -1;

                                } else {

                                    // defined(dfsdf) 
                                    if ( operator === '&&' )
                                        result = result && inputsDefines.indexOf( definesGroup[ 2 ] ) !== -1;
                                    else
                                        result = result || inputsDefines.indexOf( definesGroup[ 2 ] ) !== -1;

                                }

                            }
                        }
                        result = !result;
                        if ( result ) {
                            droppingDefineStack[ droppingDefineStackIndex ] = result;
                        }

                        continue;
                    }




                    if ( line.substr( 1, 2 ) === 'if' ) {

                        // #if defined (_FLOATTEX) && defined(_PCF)
                        // #if defined(_NONE) ||  defined(_PCF)
                        result = true;
                        operator = '&&';
                        while ( ( definesGroup = definedReg.exec( line ) ) !== null ) {

                            if ( definesGroup.length > 2 ) {

                                if ( definesGroup[ 1 ] === undefined ) {
                                    // yeah. twiceis ok.
                                    // third's the charm
                                    operator = definesGroup[ 0 ].trim();

                                } else if ( definesGroup[ 1 ].trim()[ 0 ] === '!' ) {

                                    // !defined(dfsdf)
                                    if ( operator === '&&' )
                                        result = result && inputsDefines.indexOf( definesGroup[ 2 ] ) === -1;
                                    else
                                        result = result || inputsDefines.indexOf( definesGroup[ 2 ] ) === -1;

                                } else {

                                    // defined(dfsdf) 
                                    if ( operator === '&&' )
                                        result = result && inputsDefines.indexOf( definesGroup[ 2 ] ) !== -1;
                                    else
                                        result = result || inputsDefines.indexOf( definesGroup[ 2 ] ) !== -1;

                                }

                            }
                        }


                        droppingDefineStackIndex++;
                        droppingDefineStack[ droppingDefineStackIndex ] = !result;
                        continue;

                    }

                } // #
            } //prunedef

            if ( !droppingDefineStack[ droppingDefineStackIndex ] ) {

                //we  keep comment means we kep formattage
                if ( pruneComment ) strippedContent += line;
                else strippedContent += lines[ i ];
                if ( addNewLines ) strippedContent += '\n';

            }
        }


        return strippedContent;

    },
    // recursively  handle #include external glsl
    // files (for now in the same folder.)
    preprocess: function ( content, sourceID, includeList, inputsDefines ) {
        var self = this;
        return content.replace( this._includeCondR, function ( _, name ) {
            var includeOpt = name.split( ' ' );
            var includeName = includeOpt[ 0 ].replace( /"/g, '' );

            // pure include is
            // \#pragma include "name";

            // conditionnal include is name included if _PCF defined
            // \#pragma include "name" "_PCF";
            if ( includeOpt.length > 1 && inputsDefines ) {

                // some conditions here.
                // if not defined we do not include
                var found = false;
                var defines = inputsDefines.map( function ( defineString ) {
                    // find '#define', remove duplicate whitespace, split on space and return the define Text
                    return self._defineR.test( defineString ) && defineString.replace( /\s+/g, ' ' ).split( ' ' )[ 1 ];
                } );

                for ( var i = 1; i < includeOpt.length && !found; i++ ) {
                    var key = includeOpt[ i ].replace( /"/g, '' );
                    for ( var k = 0; k < defines.length && !found; k++ ) {

                        if ( defines[ k ] !== false && defines[ k ] === key ) {
                            found = true;
                            break;
                        }

                    }
                }
                if ( !found )
                    return '';
            }

            // already included
            if ( includeList.indexOf( includeName ) !== -1 ) return '';
            // avoid endless loop, not calling the impure
            var txt = this.getShaderTextPure( includeName );
            // make sure it's not included twice
            includeList.push( includeName );
            if ( this._debugLines ) {
                txt = this.instrumentShaderlines( txt, sourceID );
            }
            sourceID++;
            // to the infinite and beyond !
            txt = this.preprocess( txt, sourceID, includeList, inputsDefines );
            return txt;
        }.bind( this ) );

    },

    //  process a shader and define
    //  get a full expanded single shader source code
    //  resolving include dependencies
    //  adding defines
    //  adding line instrumenting.
    processShader: function ( shader, defines, extensions /*, type*/ ) {

        var includeList = [];
        var preShader = shader;
        var sourceID = 0;
        if ( this._debugLines ) {
            preShader = this.instrumentShaderlines( preShader, sourceID );
            sourceID++;
        }

        // removes duplicates
        if ( defines !== undefined ) {
            defines = defines.sort().filter( function ( item, pos ) {
                return !pos || item !== defines[ pos - 1 ];
            } );
        }
        if ( extensions !== undefined ) {
            extensions = extensions.sort().filter( function ( item, pos ) {
                return !pos || item !== extensions[ pos - 1 ];
            } );
        }

        var postShader = this.preprocess( preShader, sourceID, includeList, defines );


        var prePrend = '';
        //if (this._webgl2) prePrend += '#version 300\n'; else // webgl1  (webgl2 #version 300 ?)
        prePrend += '#version 100\n'; // webgl1


        // then
        // it's extensions first
        // See https://khronos.org/registry/gles/specs/2.0/GLSL_ES_Specification_1.0.17.pdf
        // p14-15: before any non-processor token
        // add them
        if ( extensions !== undefined ) {
            // could add an extension check support warning there...
            prePrend += extensions.join( '\n' ) + '\n';
        }

        // vertex shader doesn't need precision, it's highp per default, enforced per spec
        // but then not giving precision on uniform/varying might make conflicts arise
        // between both FS and VS if FS default is mediump !
        // && type !== 'vertex'
        if ( this._globalDefaultprecision ) {
            if ( !this._precisionR.test( postShader ) ) {
                // use the shaderhighprecision flag at shaderloader start
                //var highp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
                //var highpSupported = highp.precision != 0;
                prePrend += this._globalDefaultprecision + '\n';
            }
        }

        // if defines
        // add them
        if ( defines !== undefined ) {
            prePrend += defines.join( '\n' ) + '\n';
        }
        postShader = prePrend + postShader;

        if ( this._precisionFloat ) defines.push( '#define GL_FRAGMENT_PRECISION_HIGH' );


        defines = defines.map( function ( defineString ) {
            // find '#define', remove duplicate whitespace, split on space and return the define Text
            return this._defineR.test( defineString ) && defineString.replace( /\s+/g, ' ' ).split( ' ' )[ 1 ];
        }.bind( this ) );

        console.time( 'shaderPreprocess' );
        postShader = this.postProcess( postShader, defines, extensions );
        console.timeEnd( 'shaderPreprocess' );

        console.time( 'optimize' );
        postShader = Optimizer( postShader, defines, extensions );
        console.timeEnd( 'optimize' );

        return postShader;
    }
};
module.exports = ShaderProcessor;
