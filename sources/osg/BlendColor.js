'use strict';
var MACROUTILS = require( 'osg/Utils' );
var StateAttribute = require( 'osg/StateAttribute' );
var Vec4 = require( 'osg/Vec4' );

/**
 *  Manage BlendColor attribute
 *  @class
 *  @memberOf osg
 *  @extends StateAttribute
 */
var BlendColor = function ( color ) {
    StateAttribute.call( this );
    this._constantColor = Vec4.create();
    Vec4.set( 1.0, 1.0, 1.0, 1.0, this._constantColor );
    if ( color !== undefined ) {
        this.setConstantColor( color );
    }
};

/**
 * @lends BlendColor.prototype
 */
MACROUTILS.createPrototypeStateAttribute( BlendColor, MACROUTILS.objectInherit( StateAttribute.prototype, {
    attributeType: 'BlendColor',
    cloneType: function () {
        return new BlendColor();
    },

    /**
     *
     * @param {} color
     */
    setConstantColor: function ( color ) {
        Vec4.copy( color, this._constantColor );
    },
    getConstantColor: function () {
        return this._constantColor;
    },
    apply: function ( state ) {
        var gl = state.getGraphicContext();
        gl.blendColor( this._constantColor[ 0 ],
            this._constantColor[ 1 ],
            this._constantColor[ 2 ],
            this._constantColor[ 3 ] );
    }
} ), 'osg', 'BlendColor' );

module.exports = BlendColor;
