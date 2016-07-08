'use strict';
var Map = require( 'osg/Map' );
var Notify = require( 'osg/Notify' );
var Object = require( 'osg/Object' );
var StateAttribute = require( 'osg/StateAttribute' );
var MACROUTILS = require( 'osg/Utils' );


/** Stores a set of modes and attributes which represent a set of OpenGL state.
 *  Notice that a \c StateSet contains just a subset of the whole OpenGL state.
 * <p>In OSG, each \c Drawable and each \c Node has a reference to a
 * \c StateSet. These <tt>StateSet</tt>s can be shared between
 * different <tt>Drawable</tt>s and <tt>Node</tt>s (that is, several
 * <tt>Drawable</tt>s and <tt>Node</tt>s can reference the same \c StateSet).
 * Indeed, this practice is recommended whenever possible,
 * as this minimizes expensive state changes in the graphics pipeline.
 */
var StateSet = function () {
    Object.call( this );

    this._attributeArray = [];
    this._textureAttributeArrayList = [];

    // cache what is really used
    this._activeTextureAttributeUnit = [];
    this._activeAttribute = [];
    this._activeTextureAttribute = [];

    this._binName = undefined;
    this._binNumber = 0;

    // put the shader generator name in an AttributePair
    // so that we can use the mask value
    this._shaderGeneratorPair = null;

    this._updateCallbackList = [];

    this.uniforms = new Map();

};

StateSet.AttributePair = function ( attr, value ) {
    this._object = attr;
    this._value = value;
};

StateSet.AttributePair.prototype = {
    getShaderGeneratorName: function () {
        return this._object;
    },
    getAttribute: function () {
        return this._object;
    },
    getUniform: function () {
        return this._object;
    },
    getValue: function () {
        return this._value;
    }
};


MACROUTILS.createPrototypeClass( StateSet, MACROUTILS.objectInherit( Object.prototype, {
    getAttributePair: function ( attribute, value ) {
        return new StateSet.AttributePair( attribute, value );
    },
    addUniform: function ( uniform, mode ) {
        if ( mode === undefined ) {
            mode = StateAttribute.ON;
        }

        var name = uniform.getName();
        this.uniforms[ name ] = this.getAttributePair( uniform, mode );
        this.uniforms.dirty();
    },
    removeUniform: function ( uniform ) {
        this.uniforms.remove( uniform.getName() );
    },
    removeUniformByName: function ( uniformName ) {
        this.uniforms.remove( uniformName );
    },
    getUniform: function ( uniform ) {
        var uniformMap = this.uniforms;
        if ( uniformMap[ uniform ] ) return uniformMap[ uniform ].getAttribute();

        return undefined;
    },
    getUniformList: function () {
        return this.uniforms;
    },

    setTextureAttributeAndModes: function ( unit, attribute, mode ) {
        if ( mode === undefined ) {
            mode = StateAttribute.ON;
        }
        this._setTextureAttribute( unit, this.getAttributePair( attribute, mode ) );
    },
    setTextureAttributeAndMode: function ( unit, attribute, mode ) {
        Notify.log( 'StateSet.setTextureAttributeAndMode is deprecated, insteady use setTextureAttributeAndModes' );
        this.setTextureAttributeAndModes( unit, attribute, mode );
    },

    getNumTextureAttributeLists: function () {
        return this._textureAttributeArrayList.length;
    },

    getTextureAttribute: function ( unit, typeMember ) {

        if ( this._textureAttributeArrayList[ unit ] === undefined ) return undefined;

        var index = MACROUTILS.getTextureIdFromTypeMember( typeMember );
        if ( index === undefined ) return undefined;

        var textureArray = this._textureAttributeArrayList[ unit ];
        if ( textureArray[ index ] ) return textureArray[ index ].getAttribute();

        return undefined;
    },

    removeTextureAttribute: function ( unit, typeMember ) {
        if ( this._textureAttributeArrayList[ unit ] === undefined ) return;

        var index = MACROUTILS.getTextureIdFromTypeMember( typeMember );
        if ( index === undefined ) return;

        var textureArray = this._textureAttributeArrayList[ unit ];
        if ( textureArray[ index ] === undefined ) return;

        textureArray[ index ] = undefined;
        this._computeValidTextureUnit();
    },

    getAttribute: function ( typeMember ) {

        var index = MACROUTILS.getIdFromTypeMember( typeMember );
        if ( index === undefined || !this._attributeArray[ index ] ) return undefined;

        return this._attributeArray[ index ].getAttribute();
    },

    setAttributeAndModes: function ( attribute, mode ) {
        this._setAttribute( this.getAttributePair( attribute, mode !== undefined ? mode : StateAttribute.ON ) );
    },

    setAttributeAndMode: function ( attribute, mode ) {
        Notify.log( 'StateSet.setAttributeAndMode is deprecated, insteady use setAttributeAndModes' );
        this.setAttributeAndModes( attribute, mode );
    },

    setAttribute: function ( attribute, mode ) {
        this.setAttributeAndModes( attribute, mode );
    },

    // TODO: check if it's an attribute type or a attribute to remove it
    removeAttribute: function ( typeMember ) {
        var index = MACROUTILS.getIdFromTypeMember( typeMember );
        this._attributeArray[ index ] = undefined;
        this._computeValidAttribute();
    },

    setRenderingHint: function ( hint ) {
        if ( hint === 'OPAQUE_BIN' ) {
            this.setRenderBinDetails( 0, 'RenderBin' );
        } else if ( hint === 'TRANSPARENT_BIN' ) {
            this.setRenderBinDetails( 10, 'DepthSortedBin' );
        } else {
            this.setRenderBinDetails( 0, '' );
        }
    },

    getUpdateCallbackList: function () {
        return this._updateCallbackList;
    },
    removeUpdateCallback: function ( cb ) {
        var arrayIdx = this._updateCallbackList.indexOf( cb );
        if ( arrayIdx !== -1 )
            this._updateCallbackList.splice( arrayIdx, 1 );
    },
    addUpdateCallback: function ( cb ) {
        this._updateCallbackList.push( cb );
    },
    hasUpdateCallback: function ( cb ) {
        return this._updateCallbackList.indexOf( cb ) !== -1;
    },

    setRenderBinDetails: function ( num, binName ) {
        this._binNumber = num;
        this._binName = binName;
    },
    getAttributeMap: function () {
        // not efficieant at all but not really critique
        var obj = {};
        for ( var i = 0, l = this._attributeArray.length; i < l; i++ ) {
            var attributePair = this._attributeArray[ i ];
            if ( !attributePair ) continue;
            var attribute = attributePair.getAttribute();
            obj[ attribute.getTypeMember() ] = attributePair;
        }
        return obj;
    },
    getBinNumber: function () {
        return this._binNumber;
    },
    getBinName: function () {
        return this._binName;
    },
    setBinNumber: function ( binNum ) {
        this._binNumber = binNum;
    },
    setBinName: function ( binName ) {
        this._binName = binName;
    },
    getAttributeList: function () {
        var attributeArray = this._attributeArray;
        var list = [];
        for ( var i = 0, l = attributeArray.length; i < l; i++ ) {
            if ( attributeArray[ i ] )
                list.push( attributeArray[ i ] );
        }
        return list;
    },
    setShaderGeneratorName: function ( generatorName, mask ) {
        this._shaderGeneratorPair = this.getAttributePair( generatorName, mask );
    },
    getShaderGeneratorPair: function () {
        return this._shaderGeneratorPair;
    },
    getShaderGeneratorName: function () {
        return this._shaderGeneratorPair ? this._shaderGeneratorPair.getShaderGeneratorName() : undefined;
    },
    releaseGLObjects: function () {
        for ( var i = 0, j = this._textureAttributeArrayList.length; i < j; i++ ) {
            var attribute = this.getTextureAttribute( i, 'Texture' );
            if ( attribute ) attribute.releaseGLObjects();
        }
        var list = this.getAttributeList();
        for ( var k = 0, l = list.length; k < l; k++ ) {
            // Remove only if we have releaseGLObject method.
            if ( list[ k ]._object.releaseGLObjects ) {
                list[ k ]._object.releaseGLObjects();
            }
        }
    },
    _getUniformMap: function () {
        return this.uniforms;
    },

    // for internal use, you should not call it directly
    _setTextureAttribute: function ( unit, attributePair ) {

        var textureAttributeArrayList= this._textureAttributeArrayList;
        if ( textureAttributeArrayList[ unit ] === undefined ) {
            textureAttributeArrayList[ unit ] = [];
        }

        var index = MACROUTILS.getOrCreateTextureStateAttributeTypeMemberIndex( attributePair.getAttribute() );
        textureAttributeArrayList[ unit ][ index ] = attributePair;

        this._computeValidTextureUnit();
    },

    _computeValidTextureUnit: function () {
        this._activeTextureAttributeUnit.length = 0;
        this._activeTextureAttribute.length = 0;
        var textureAttributeArrayList = this._textureAttributeArrayList;
        for ( var i = 0, l = textureAttributeArrayList.length; i < l; i++ ) {
            var attributeList = textureAttributeArrayList[ i ];
            if ( !attributeList || !attributeList.length ) continue;
            this._activeTextureAttributeUnit.push( i );
            for ( var j = 0, k = attributeList.length; j < k; j++ ) {
                if ( attributeList[ j ] ) this._activeTextureAttribute.push( j );
            }
        }
    },

    _computeValidAttribute: function () {
        this._activeAttribute.length = 0;
        var attributeArray = this._attributeArray;
        for ( var i = 0, l = attributeArray.length; i < l; i++ ) {
            if ( attributeArray[ i ] ) this._activeAttribute.push( i );
        }
    },

    // for internal use, you should not call it directly
    _setAttribute: function ( attributePair ) {

        var index = MACROUTILS.getOrCreateStateAttributeTypeMemberIndex( attributePair.getAttribute() );
        this._attributeArray[ index ] = attributePair;
        this._computeValidAttribute();
    }

} ), 'osg', 'StateSet' );

module.exports = StateSet;
