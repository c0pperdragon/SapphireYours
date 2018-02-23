
// object allocator function
var VectorRenderer = function()  
{   Renderer.call(this);

    this.program = null;
    this.uMVPMatrix = null;
    this.aCorner = null;
    this.aColor = null;
        
    this.vboCorner = null;             // gl buffer holding float[2] - destination coordinates (in pixel)
    this.vboColor = null;              // gl buffer holding int[1] - color to by applied to image (also for color area rendering)
    
    // client-side buffers to prepare the data before moving it into their gl counterparts
    this.numCorners = 0;
    this.bufferCorner = null;
    this.bufferColor = null;
    // temporary data for appending corners to triangle strips 
    this.mustDublicateNextCorner = false;
    this.rotsin = 0;
    this.rotcos = 0;
    this.translatex = 0;
    this.translatey = 0;
            
    this.matrix = null; 
};
VectorRenderer.prototype = Object.create(Renderer.prototype);

// static fields
VectorRenderer.MAXCORNERS = 10000;  // number of vertices in the buffer
            
VectorRenderer.vertexShaderCode =
            "uniform mat4 uMVPMatrix;                  "+
            "attribute vec2 aCorner;                   "+   // location on screen (before transformation)
            "attribute vec4 aColor;                    "+   // color to apply to texture before rendering   
            "varying vec4 vColor;                      "+   // color to apply to the image (to be given to fragment shader)
            "void main() {                             "+
            "  vec4 p;                                 "+
            "  p[0] = aCorner[0];                      "+
            "  p[1] = aCorner[1];                      "+
            "  p[2] = 0.0;                             "+
            "  p[3] = 1.0;                             "+
            "  gl_Position = uMVPMatrix * p;           "+
            "  vColor = aColor/255.0;                  "+
            "}                                         "+
            "";    
VectorRenderer.fragmentShaderCode =
            "varying mediump vec4 vColor;                     "+  // color to apply to texture before rendering
            "void main() {                                    "+
            "   gl_FragColor = vColor;                        "+
            "}                                                "+
            "";            
VectorRenderer.sinustable =
        [ 0.0, 0.17364817766693033, 0.3420201433256687, 0.5, 
          0.6427876096865393, 0.766044443118978, 0.8660254037844386, 0.9396926207859083, 
          0.984807753012208, 1.0, 0.984807753012208, 0.9396926207859084, 
          0.8660254037844387, 0.766044443118978, 0.6427876096865395, 0.5,
          0.3420201433256689, 0.1736481776669307, 0.0, -0.17364817766693047,
          -0.34202014332566866, -0.5, -0.6427876096865393, -0.7660444431189779,
          -0.8660254037844384, -0.9396926207859082, -0.984807753012208, -1.0, 
          -0.9848077530122081, -0.9396926207859083, -0.8660254037844386, -0.7660444431189781, 
          -0.6427876096865396, -0.5, -0.34202014332566943, -0.1736481776669304  ]; 
    

//  private int viewportx;
//  private int viewporty;
//  private int viewportwidth;
//  private int viewportheight;

// --------- locations of images inside the atlas -------------


// constructor: set up opengl  and load textures
VectorRenderer.prototype.$ = function(gl)
{
    Renderer.prototype.$.call(this,gl);

    // create shaders and link together
    this.program = this.createProgram(VectorRenderer.vertexShaderCode,VectorRenderer.fragmentShaderCode);
    // extract the bindings for the uniforms and attributes
    this.uMVPMatrix = gl.getUniformLocation(this.program, "uMVPMatrix");
    this.aCorner = gl.getAttribLocation(this.program, "aCorner"); 
    this.aColor = gl.getAttribLocation(this.program, "aColor");
                
    // create buffers (gl and client) for the vertices
    this.bufferCorner = new Float32Array(2*VectorRenderer.MAXCORNERS);
    this.vboCorner = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vboCorner);
    gl.bufferData(gl.ARRAY_BUFFER, 4*2*VectorRenderer.MAXCORNERS, gl.DYNAMIC_DRAW);

    this.bufferColor = new Uint8Array(4*VectorRenderer.MAXCORNERS);
    this.vboColor = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vboColor);
    gl.bufferData(gl.ARRAY_BUFFER, 4*VectorRenderer.MAXCORNERS, gl.DYNAMIC_DRAW);
        
    // allocate memory for projection matrix
    this.matrix = new Array(16);
        
    return this;
};

VectorRenderer.prototype.startDrawing = function(viewportwidth, viewportheight)
{
    // clear client-side buffer
    this.numCorners = 0;
    this.mustDublicateNextCorner = false;
  
    // transfer coordinate system from the opengl-standard to a pixel system (0,0 is top left)
    Matrix.setIdentityM(this.matrix,0);     
    Matrix.translateM(this.matrix,0, -1.0,1.0, 0);
    Matrix.scaleM(this.matrix,0, 2.0/viewportwidth, -2.0/viewportheight, 1.0);
};

VectorRenderer.prototype.flush = function()
{   
    if (this.numCorners<1) { return };    
    var gl = this.gl;

    // transfer buffers into opengl 
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vboCorner);
    gl.bufferSubData(gl.ARRAY_BUFFER,0, this.bufferCorner.subarray(0,2*this.numCorners));    
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vboColor);
    gl.bufferSubData(gl.ARRAY_BUFFER,0, this.bufferColor.subarray(0,4*this.numCorners)); 

    // set up gl for painting all triangles
    gl.useProgram(this.program);

    // enable all vertex attribute arrays and set pointers
    gl.enableVertexAttribArray(this.aCorner);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vboCorner);
    gl.vertexAttribPointer(this.aCorner, 2, gl.FLOAT, false, 0, 0);

    gl.enableVertexAttribArray(this.aColor);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vboColor);
    gl.vertexAttribPointer(this.aColor, 4, gl.UNSIGNED_BYTE, false, 0, 0);

    // set matrix and draw all triangles
    gl.uniformMatrix4fv(this.uMVPMatrix, false, this.matrix);

    // Draw all triangles
    gl.drawArrays(gl.TRIANGLE_STRIP,0,this.numCorners);

    // disable arrays
    gl.disableVertexAttribArray(this.aCorner);
    gl.disableVertexAttribArray(this.aColor);
    
    this.mustDublicateNextCorner = false;
    this.numCorners = 0;    
};


VectorRenderer.prototype.addCorner = function(x,y,argb)
{   
    var n = this.numCorners++;
    this.bufferCorner[2*n+0] = x;
    this.bufferCorner[2*n+1] = y;
    this.bufferColor[4*n+0] = (argb>>16) & 0xff;
    this.bufferColor[4*n+1] = (argb>>8) & 0xff;
    this.bufferColor[4*n+2] = (argb>>0) & 0xff;
    this.bufferColor[4*n+3] = (argb>>24) & 0xff;
};

VectorRenderer.prototype.startStrip = function()
{
    if (this.numCorners>0)
    {   var pos = 2*this.numCorners;
        this.bufferCorner[pos+0] = this.bufferCorner[pos-2];
        this.bufferCorner[pos+1] = this.bufferCorner[pos-1];
        pos = 4*this.numCorners;
        this.bufferColor[pos+0] = this.bufferColor[pos-4];
        this.bufferColor[pos+1] = this.bufferColor[pos-3];
        this.bufferColor[pos+2] = this.bufferColor[pos-2];
        this.bufferColor[pos+3] = this.bufferColor[pos-1];
        this.numCorners++;
        this.mustDublicateNextCorner = true;
    }
    this.rotsin = 0;
    this.rotcos = 1;
    this.translatex = 0;
    this.translatey = 0;
};

VectorRenderer.prototype.setStripCornerTransformation = function(rotcos, rotsin, translatex, translatey)
{   this.rotsin = rotsin;
    this.rotcos = rotcos;
    this.translatex = translatex;
    this.translatey = translatey;   
};

VectorRenderer.prototype.addStripCorner = function(x, y, argb)
{   var tx = (x*this.rotcos - y*this.rotsin + this.translatex);
    var ty = (x*this.rotsin + y*this.rotcos + this.translatey);
    this.addCorner (tx,ty, argb);
    if (this.mustDublicateNextCorner)
    {   this.addCorner(tx,ty,argb);
        this.mustDublicateNextCorner = false;
    }
};

VectorRenderer.prototype.addRectangle = function(x, y, w, h, argb)
{   this.startStrip();
    this.addStripCorner(x,y, argb);
    this.addStripCorner(x+w,y, argb);
    this.addStripCorner(x,y+h, argb);
    this.addStripCorner(x+w,y+h, argb);
};

VectorRenderer.prototype.addFrame = function(x, y, w, h, border, argb)
{   var x1 = x;
    var x2 = x+w;
    var y1 = y;
    var y2 = y+h;
    var x1_i = x+border;
    var x2_i = x+w-border;
    var y1_i = y+border;
    var y2_i = y+h-border;

    this.startStrip();
    this.addStripCorner(x1,y1,argb);
    this.addStripCorner(x1_i,y1_i,argb);
    this.addStripCorner(x2,y1,argb);
    this.addStripCorner(x2_i,y1_i,argb);
    this.addStripCorner(x2,y2,argb);
    this.addStripCorner(x2_i,y2_i,argb);
    this.addStripCorner(x1,y2,argb);
    this.addStripCorner(x1_i,y2_i,argb);
    this.addStripCorner(x1,y1,argb);
    this.addStripCorner(x1_i,y1_i,argb);
};

VectorRenderer.prototype.addCircle = function(x, y, radius, argb)
{   this.startStrip();

    for (var d=0; d<VectorRenderer.sinustable.length; d++)
    {   var nx = x + VectorRenderer.sinustable[(d+9)%36] * radius;
        var ny = y - VectorRenderer.sinustable[d] * radius;
        this.addStripCorner(x,y,argb);
        this.addStripCorner(nx,ny, argb);
    }
    this.addStripCorner (x,y, argb);
    this.addStripCorner (x+radius,y, argb);
};


VectorRenderer.prototype.addShape = function(x, y, xypairs, scaling, argb)
{   var sc = scaling/100.0;
    this.startStrip();
    for (var i=0; i+1<xypairs.length; i+=2)
    {   this.addStripCorner(x+xypairs[i]*sc, y+xypairs[i+1]*sc, argb);
    }
};

VectorRenderer.prototype.addShapeAlternateRGB = function(x, y, xypairs, scaling, argb, alternateargb)
{   var sc = scaling/100.0;
    this.startStrip();
    for (var i=0; i+1<xypairs.length; i+=2)
    {   addStripCorner(x+xypairs[i]*sc, y+xypairs[i+1]*sc, ((i&2)==0) ? argb : alternateargb);
    }
};

VectorRenderer.prototype.addRoundedRect = function(x, y, width, height, radius, outerradius, argb)
{   var argb2 = argb & 0x00ffffff; 
    
    var xc=x+width/2;
    var yc=y+height/2;
    var x1=x+width;
    var y1=y+radius;
    var x2=x+width-radius+outerradius;
    var y2=y1;

    this.startStrip();

    var sinustable = VectorRenderer.sinustable;
    
    // 1. quadrant
    for (var d=1; d<sinustable.length/4; d++)
    {   var nx1 = x+width-radius + sinustable[(d+9)%36] * radius;
        var ny1 = y+radius - sinustable[d] * radius;
        var nx2 = x+width-radius + sinustable[(d+9)%36] * outerradius;
        var ny2 = y+radius - sinustable[d] * outerradius;

        this.addStripCorner(xc,yc, argb);
        this.addStripCorner(xc,yc, argb);
        this.addStripCorner(x1,y1, argb);
        this.addStripCorner(nx1,ny1, argb);
        this.addStripCorner(x2,y2, argb2);
        this.addStripCorner(nx2,ny2, argb2);
        this.addStripCorner(nx2,ny2, argb2);

        x1=nx1;
        y1=ny1;
        x2=nx2;
        y2=ny2;
    }
    // 2. quadrant
    for (var d=sinustable.length/4; d<sinustable.length/2; d++)
    {   var nx1 = x+radius + sinustable[(d+9)%36] * radius;
        var ny1 = y+radius - sinustable[d] * radius;
        var nx2 = x+radius + sinustable[(d+9)%36] * outerradius;
        var ny2 = y+radius - sinustable[d] * outerradius;

        this.addStripCorner(xc,yc, argb);
        this.addStripCorner(xc,yc, argb);
        this.addStripCorner(x1,y1, argb);
        this.addStripCorner(nx1,ny1, argb);
        this.addStripCorner(x2,y2, argb2);
        this.addStripCorner(nx2,ny2, argb2);
        this.addStripCorner(nx2,ny2, argb2);

        x1=nx1;
        y1=ny1;
        x2=nx2;
        y2=ny2;
    }
    // 3. quadrant
    for (var d=sinustable.length/2; d<sinustable.length*3/4; d++)
    {   var nx1 = x+radius + sinustable[(d+9)%36] * radius;
        var ny1 = y+height-radius - sinustable[d] * radius;
        var nx2 = x+radius + sinustable[(d+9)%36] * outerradius;
        var ny2 = y+height-radius - sinustable[d] * outerradius;

        this.addStripCorner(xc,yc, argb);
        this.addStripCorner(xc,yc, argb);
        this.addStripCorner(x1,y1, argb);
        this.addStripCorner(nx1,ny1, argb);
        this.addStripCorner(x2,y2, argb2);
        this.addStripCorner(nx2,ny2, argb2);
        this.addStripCorner(nx2,ny2, argb2);

        x1=nx1;
        y1=ny1;
        x2=nx2;
        y2=ny2;
    }
    // 4. quadrant
    for (var d=sinustable.length*3/4; d<sinustable.length; d++)
    {
        var nx1 = x+width-radius + sinustable[(d+9)%36] * radius;
        var ny1 = y+height-radius - sinustable[d] * radius;
        var nx2 = x+width-radius + sinustable[(d+9)%36] * outerradius;
        var ny2 = y+height-radius - sinustable[d] * outerradius;

        this.addStripCorner(xc,yc, argb);
        this.addStripCorner(xc,yc, argb);
        this.addStripCorner(x1,y1, argb);
        this.addStripCorner(nx1,ny1, argb);
        this.addStripCorner(x2,y2, argb2);
        this.addStripCorner(nx2,ny2, argb2);
        this.addStripCorner(nx2,ny2, argb2);

        x1=nx1;
        y1=ny1;
        x2=nx2;
        y2=ny2;                             
    }
    // last part
    var nx1=x+width;
    var ny1=y+radius;
    var nx2=x+width-radius+outerradius;
    var ny2=ny1;
    this.addStripCorner(xc,yc, argb);                    
    this.addStripCorner(xc,yc, argb);                    
    this.addStripCorner(x1,y1, argb);
    this.addStripCorner(nx1,ny1, argb);
    this.addStripCorner(x2,y2, argb2);
    this.addStripCorner(nx2,ny2, argb2);
    this.addStripCorner(nx2,ny2, argb2); 
};

VectorRenderer.prototype.addPlayArrow = function(x, y, width, height, orientation, argb)
{
    this.startStrip();
    this.setStripCornerTransformation(orientation*(width/2)/100,0, 
        x+width/2+orientation*width*0.04,y+width/2);
    this.addStripCorner(-35,-85, argb);
    this.addStripCorner(-20,-50, argb);
    this.addStripCorner(50,0, argb);
    this.addStripCorner(30,0, argb);
    this.addStripCorner(-35,85, argb);
    this.addStripCorner(-20,50, argb);
    this.addStripCorner(-35,-85, argb);
    this.addStripCorner(-20,-50, argb);
};

VectorRenderer.prototype.addForwardArrow = function(x, y, width, height, orientation, argb)
{   this.startStrip();      
    this.setStripCornerTransformation(orientation*(width/2)/100,0, 
        x+width/2+orientation*width*0.04,y+width/2);
    this.addStripCorner(-30,-70, argb);
    this.addStripCorner(40,0, argb);
    this.addStripCorner(-30,70, argb);
};

VectorRenderer.prototype.addFastForwardArrow = function(x, y, width, height, orientation, argb)
{   this.startStrip();
    this.setStripCornerTransformation(orientation*(width/2)/100,0, 
            x+width/2-orientation*width*0.04,y+width/2);
    this.addStripCorner(-30,-70, argb);
    this.addStripCorner(-30,70, argb);
    this.addStripCorner(10,-30, argb);
    this.addStripCorner(10,30, argb);
    this.addStripCorner(10,30, argb);
    this.addStripCorner(10,70, argb);
    this.addStripCorner(10,70, argb);
    this.addStripCorner(10,-70, argb);
    this.addStripCorner(80,0, argb);
};

VectorRenderer.prototype.addSlowMotionArrow = function(x, y, width, height, orientation, argb)
{   this.startStrip();
    this.setStripCornerTransformation(orientation*(width/2)/100,0, 
        x+width/2+orientation*width*0.08,y+width/2);
    this.addStripCorner(-70,-70,argb);
    this.addStripCorner(-70,70,argb);
    this.addStripCorner(-45,-70,argb);          
    this.addStripCorner(-45,70,argb);           
    this.addStripCorner(-45,70,argb);                       
    this.addStripCorner(-30,-70, argb);
    this.addStripCorner(-30,-70, argb);
    this.addStripCorner(40,0, argb);
    this.addStripCorner(-30,70, argb);
};

VectorRenderer.prototype.addCross = function(x, y, width, height, argb)
{   this.startStrip();      
    this.setStripCornerTransformation((width*0.40)/100,0, x+width/2,y+width/2);
    this.addStripCorner(0,10, argb);
    this.addStripCorner(-70,80,argb);
    this.addStripCorner(0,0, argb);
    this.addStripCorner(-80,70, argb);
    this.addStripCorner(-10,0, argb);
    this.addStripCorner(-10,0, argb);
    this.addStripCorner(-80,-70, argb);
    this.addStripCorner(0,0, argb);
    this.addStripCorner(-70,-80, argb);
    this.addStripCorner(0,-10, argb);
    this.addStripCorner(0,-10, argb);
    this.addStripCorner(70,-80, argb);
    this.addStripCorner(0,0, argb);
    this.addStripCorner(80,-70, argb);
    this.addStripCorner(10,0, argb);
    this.addStripCorner(10,0, argb);
    this.addStripCorner(80,70, argb);
    this.addStripCorner(0,0, argb);
    this.addStripCorner(70,80, argb);
    this.addStripCorner(0,10, argb);  
};

VectorRenderer.prototype.addSquare = function(x, y, width, height, argb)
{
    this.startStrip();
    this.setStripCornerTransformation((width*0.43)/100,0, x+width/2,y+width/2);
    this.addStripCorner(-70,-70,argb);
    this.addStripCorner(-70,70,argb);
    this.addStripCorner(70,-70,argb);
    this.addStripCorner(70,70,argb);
};

VectorRenderer.prototype.addNextLevelArrow = function(x, y, width, height, argb)
{
    this.startStrip();      
    this.setStripCornerTransformation((width*0.5)/100,0, x+width/2-width*0.06,y+width/2);       
    this.addStripCorner(-50,-25,argb);
    this.addStripCorner(-50,25,argb);
    this.addStripCorner(25,-25,argb);
    this.addStripCorner(25,25,argb);
    this.addStripCorner(85,0,argb);
    this.addStripCorner(25,60,argb);
    this.addStripCorner(85,0,argb);
    this.addStripCorner(85,0,argb);
    this.addStripCorner(25,-25,argb);
    this.addStripCorner(25,-60,argb);
};

VectorRenderer.prototype.addInputFocusMarker = function(x, y, width, height, argb)
{
    var b = width/30;
    this.addFrame(x-b,y-b,width+2*b,height+2*b, b, argb);
};

VectorRenderer.prototype.addCrossArrows = function(x, y, width, height, argb)
{   
    this.startStrip();      
    this.setStripCornerTransformation(width/200.0,0, x+width/2,y+width/2);
    this.addStripCorner(-30,-50,argb);
    this.addStripCorner(-10,-50,argb);
    this.addStripCorner(0,-80,argb);
    this.addStripCorner(10,-50,argb);
    this.addStripCorner(30,-50,argb);       
    this.addStripCorner(-10,-50,argb);
    this.addStripCorner(10,-50,argb);
    this.addStripCorner(-10,0,argb);
    this.addStripCorner(10,0,argb);
    this.addStripCorner(10,0,argb);
    this.addStripCorner(-30,50,argb);
    this.addStripCorner(-30,50,argb);
    this.addStripCorner(-10,50,argb);
    this.addStripCorner(0,80,argb);
    this.addStripCorner(10,50,argb);
    this.addStripCorner(30,50,argb);        
    this.addStripCorner(-10,50,argb);
    this.addStripCorner(10,50,argb);
    this.addStripCorner(-10,0,argb);
    this.addStripCorner(10,0,argb); 
    this.addStripCorner(10,0,argb); 
    this.addStripCorner(-50,-30,argb);          
    this.addStripCorner(-50,-30,argb);
    this.addStripCorner(-50,-10,argb);
    this.addStripCorner(-80,0,argb);
    this.addStripCorner(-50,10,argb);
    this.addStripCorner(-50,30,argb);       
    this.addStripCorner(-50,-10,argb);
    this.addStripCorner(-50,10,argb);
    this.addStripCorner(0,-10,argb);
    this.addStripCorner(0,10,argb);
    this.addStripCorner(0,10,argb);
    this.addStripCorner(50,-30,argb);
    this.addStripCorner(50,-30,argb);
    this.addStripCorner(50,-10,argb);
    this.addStripCorner(80,0,argb);
    this.addStripCorner(50,10,argb);
    this.addStripCorner(50,30,argb);        
    this.addStripCorner(50,-10,argb);
    this.addStripCorner(50,10,argb);
    this.addStripCorner(0,-10,argb);
    this.addStripCorner(0,10,argb);     
};

VectorRenderer.prototype.addZoomArrows = function(x, y, width, height, argb)
{
    this.startStrip();      
    this.setStripCornerTransformation(width/200.0,0, x+width/2,y+width/2);
    this.addStripCorner(-30,-60,argb);
    this.addStripCorner(-10,-60,argb);
    this.addStripCorner(0,-90,argb);
    this.addStripCorner(10,-60,argb);
    this.addStripCorner(30,-60,argb);       
    this.addStripCorner(-10,-60,argb);
    this.addStripCorner(10,-60,argb);
    this.addStripCorner(-10,-40,argb);
    this.addStripCorner(10,-40,argb);
    this.addStripCorner(10,-40,argb);
    this.addStripCorner(-30,60,argb);
    this.addStripCorner(-30,60,argb);
    this.addStripCorner(-10,60,argb);
    this.addStripCorner(0,90,argb);
    this.addStripCorner(10,60,argb);
    this.addStripCorner(30,60,argb);        
    this.addStripCorner(-10,60,argb);
    this.addStripCorner(10,60,argb);
    this.addStripCorner(-10,40,argb);
    this.addStripCorner(10,40,argb);
};

VectorRenderer.prototype.addCheckMark = function(x, y, width, height, argb) 
{   
    this.startStrip();      
    this.setStripCornerTransformation(width/200.0,0, x+width/2,y+width/2);
    this.addStripCorner(-60,0,argb);
    this.addStripCorner(-80,20,argb);
    this.addStripCorner(-20,40,argb);
    this.addStripCorner(-20,80,argb);
    this.addStripCorner(60,-40,argb);       
    this.addStripCorner(80,-20,argb);
};




