'use strict';

var Notify = require( 'osg/Notify' );
var shake = require( 'glsl-token-function-shaker' );
var stringify = require( 'glsl-token-string' );
var tokenize = require( 'glsl-tokenizer' );
var WebGLCaps = require( 'osg/WebGLCaps' );

//var parse = require( 'glsl-parser' );

/*
// walker which executes a callback on every node.
function simpleWalker( ast, onNode ) {
    if ( onNode( ast ) ) return;

    ast.children.forEach( function ( child ) {
        simpleWalker( child, onNode );
    } );
}

function walkInto( ast, type, onNode ) {
    simpleWalker( ast, function ( node ) {
        if ( node.type === type ) { // stmtlist
            onNode( node );
        }
    } );
}

var exceptions = [ 'main' ];

function unusedPrune( ast, reporter, global_declared ) {
    
    // exception - varying depends on in vs / fs.
    var declared_list = {}; // symbol table
    var warnings = [];

    simpleWalker( ast, function ( node ) {
        if ( node.type === 'decllist' ) {
            walkInto( node, 'ident', function ( node ) {
                declared_list[ node.data ] = {
                    type: 'variable',
                    name: node.data,
                    token: node.token,
                    calls: 0
                };
            } );

            return;
        }

        if ( node.type === 'function' ) {
            var functionNode = node.children[ 0 ];

            declared_list[ functionNode.data ] = {
                type: 'function', // technically a function variable
                name: functionNode.data,
                token: functionNode.token,
                calls: 0
            };

            return;
        }

        if ( node.type === 'expr' ) {
            walkInto( node, 'ident', function ( node ) {
                if ( node.data in declared_list ) {
                    declared_list[ node.data ].calls++;
                } else if ( global_declared && node.data in global_declared ) {
                    global_declared[ node.data ].calls++;
                } else {
                    // TODO: add exceptions?

                    // warn that variable has not been declared!
                    if ( exceptions.indexOf( node.data ) === -1 )
                        console.warn( 'Variable not found!', node.data );


                }
            } );

            return;
        }

        if ( node.type === 'function' && !global_declared ) {

            console.log( 'function!' );
            unused_variables( node, reporter, declared_list );
            return true; // break walker
        }
    } );

    console.log( 'declared variables', declared_list, Object.keys( declared_list ) );

    for ( var variable in declared_list ) {
        var symbol = declared_list[ variable ];
        if ( !symbol.calls && exceptions.indexOf( variable ) === -1 ) {
            var msg = symbol.type + ' [' + symbol.name + '] is not used';
            reporter.report( msg, symbol );
        }
    }

    return;
    // decl < decllist
    // stmt / func / functionargs
}
*/
var ShaderOptimizer = function ( sourceCode /*, defines, extensions*/ ) {

    var tokens = tokenize( sourceCode );

    // https://www.npmjs.com/package/glsl-token-function-shaker#shaketokens-options
    shake( tokens, {} );

    //unusedPrune( tokens );
    var output = stringify( tokens );

    return output;
};

module.exports = ShaderOptimizer;
