"use strict";
var Renderer = function() 
{   this.gl = null;
};

Renderer.prototype.$ = function(gl) 
{   this.gl = gl;
    return this;
};

Renderer.prototype.isLoaded = function()
{   return true;
};


    /**
     * Utility method for compiling a OpenGL shader.
     *
     * <p><strong>Note:</strong> When developing shaders, use the checkGlError()
     * method to debug shader coding errors.</p>
     *
     * @param type - Vertex or fragment shader type.
     * @param shaderCode - String containing the shader code.
     * @return - Returns an id for the shader.
     */
 Renderer.prototype.loadShader = function(type,shaderCode)
 {  var gl = this.gl;
    
    // create a vertex shader type (GLES20.GL_VERTEX_SHADER)
    // or a fragment shader type (GLES20.GL_FRAGMENT_SHADER)
    var shader = gl.createShader(type);

    // add the source code to the shader and compile it
    gl.shaderSource(shader, shaderCode);
    gl.compileShader(shader);
        
    //Check compile status.
    var log = gl.getShaderInfoLog(shader);
    if(log.length>0)
    {
        console.log("Error compiling the shader: " + log);
    }
    return shader;
};

Renderer.prototype.createProgram = function(vertexShaderCode, fragmentShaderCode)
{   var gl = this.gl;

    // prepare shaders and OpenGL program
    var vertexShader = this.loadShader(gl.VERTEX_SHADER, vertexShaderCode);
    var fragmentShader = this.loadShader(gl.FRAGMENT_SHADER, fragmentShaderCode);

    var program = gl.createProgram();             // create empty OpenGL Program
    gl.attachShader(program, vertexShader);   // add the vertex shader to program
    gl.attachShader(program, fragmentShader); // add the fragment shader to program

    gl.linkProgram(program);                  // create OpenGL program executables
        
    return program;
};



Renderer.prototype.loadImageToTexture = function(resourcename, texture, onlyalpha, callback)
{   
    var gl = this.gl;
    var image = new Image();
    image.addEventListener
    (   'load', function() 
        {   gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D
            (   gl.TEXTURE_2D, 
                0,  
                onlyalpha ? gl.ALPHA : gl.RGBA, 
                onlyalpha ? gl.ALPHA : gl.RGBA, 
                gl.UNSIGNED_BYTE, 
                image
            );
            gl.generateMipmap(gl.TEXTURE_2D);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            
            callback( [image.naturalWidth,image.naturalHeight] );
        }
   );
   image.src = resourcename;
};

