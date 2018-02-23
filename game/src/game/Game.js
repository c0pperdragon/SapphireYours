
var Game = function()  
{   this.canvas = null;
    this.gl = null;
    this.exitcall = null;
    
    this.screenwidth = 0;         // size of surface in pixel
    this.screenheight = 0;  
    this.detailScale = 0;
    this.levelScale = 0;
    this.minButtonSize = 0;

    this.tileRenderer = null;
    this.levelRenderer = null;
    this.textRenderer = null;
    this.vectorRenderer = null;
    this.gfxRenderer = null;

    this.soundPlayer = null;
    this.musicPlayer = null;
    this.musicName = null;

    this.screens = null;
    this.needRedraw = false;
    this.usingKeyboardInput = false;

    this.levelpacks = null;
    
    this.solvegrades = null;
};


Game.DEVELOPERMODE = true;
Game.DEFAULTSOLVEDGRADE = -3*60;  // 3 minutes waiting time before level is considered "known"
//  static SimpleProfiler profiler_onsound = new SimpleProfiler("Game.sound", 5);


// construction of game object (handles loading of persistant state also)
Game.prototype.$ = function()
{
    var that = this;
    
    console.log("Starting up Sapphire Yours...");
    var options = 
    {   alpha: false,    
//            depth: false,
            stencil: false,
            antialias: false, 
//            premultipliedAlpha: false,
            preserveDrawingBuffer: false,
            failIfMajorPerformanceCaveat: false
    };           
        
    this.canvas = document.getElementById("canvas");
    this.gl = this.canvas.getContext("webgl", options);
    if (!this.gl) { this.gl = this.canvas.getContext("experimental-webgl", options ); }        
    console.log("canvas",this.canvas, "context",this.gl);
    if (!this.gl) return;
    
    this.screens = [];
    this.levelpacks = [];
        
    // set the detail scale level
    this.levelScale = 1;
    this.detailScale = 1;

    // calculate the minimum size needed for buttons in order for the user to hit them (8mm)
    this.minButtonSize = 30;
        
    // create the renderers and load data
    this.loadRenderers();
        
    // default to touch/mouse input unless otherwise directed 
    this.usingKeyboardInput = false;

    // in-program memory about level solvings
    this.solvegrades = new Map();
    
    // clear the music player object - will be immediately filled 
    this.musicPlayer = null;
    this.startMusic("silence");

    // load sounds directly at startup (and do not release them)
    this.soundPlayer = null; // new LevelSoundPlayer(context, asyncHandler);

    // show a loading screen at start
    this.addScreen(new LoadingScreen().$(this));
        
    // install input handlers
    document.addEventListener('keydown', function(event)
    {   that.onKeyDown(KeyEvent.toNumericCode(event.key)); 
    });
    document.addEventListener('keyup', function(event)
    {   that.onKeyUp(KeyEvent.toNumericCode(event.key)); 
    });
    
    // handle canvas size changes
    setScreenAndCanvasSize();
    window.addEventListener('resize', function(event){
      var wbefore = that.screenwidth;
      var hbefore = that.screenheight;
      setScreenAndCanvasSize();
      if (wbefore!=that.screenwidth || hbefore!=that.screenheight) {
          that.notifyScreensAboutResize(); 
          that.setDirty();
      }
    });      
    
    // cause further loading to progress
    this.loadLevels(function() 
    {   //that.replaceTopScreen(new TestScreen().$(that));
        that.replaceTopScreen(new MainMenuScreen().$(that));        
    });
    
    // set up game loop
    window.requestAnimationFrame (ftick);
    function ftick() 
    {   that.tick();    // in case of exception stop the loop
        window.requestAnimationFrame(ftick);        
    };   
        
    // computation for best canvas size
    function setScreenAndCanvasSize() {
      var ratio = window.devicePixelRatio;
      if (!ratio) ratio=1.0;
      that.screenwidth = Math.round(window.innerWidth*ratio);
      that.screenheight = Math.round(window.innerHeight*ratio);
      that.canvas.width = that.screenwidth;
      that.canvas.height = that.screenheight;
//      console.log("Screen size:",that.screenwidth,that.screenheight,"(ratio=",ratio,")");
    }      
    
    return this;
};
        
    
/*    
    // persistent state handling
    private void storeGameState()
    {       
        // find an open game screen to check if there is some unfinished game running
        GameScreen gamescreen = null;
        for (int i=0; i<screens.size(); i++)
        {   if (screens.elementAt(i) instanceof GameScreen)
            {   gamescreen = (GameScreen) screens.elementAt(i);
                break;
            }
        }
        // when there is a game screen open, store data 
        if (gamescreen!=null)
        {   SharedPreferences.Editor edit = preferences.edit();
            edit.putString("unfinished_title", gamescreen.getCurrentLevelTitle());
            edit.putString("unfinished_walk", gamescreen.getCurrentWalkSerialized());
            edit.apply();
            gamescreen.flushRecordingTimeMeasurement();         
        }
        // otherwise clear previous data if still present
        else
        {   clearGameState();
        }
    }
        
    private void clearGameState()
    {
        if (preferences.contains("unfinished_title"))
        {   SharedPreferences.Editor edit = preferences.edit();
            edit.remove("unfinished_title");
            edit.remove("unfinished_walk");
            edit.apply();           
        }    
    }

    private void loadGameState()
    {
        // when there is some persistent game state, try to re-create the game, but also clear the state as soon as possible
        // (to prevent a faulty game state to completely ruin the installation)
        if (preferences.contains("unfinished_title"))
        {   String t = preferences.getString("unfinished_title", "");
            String w = preferences.getString("unfinished_walk", "");            
            clearGameState();
            
            Level l = findLevel(t);
            if (l!=null)
            {   try
                {   Walk walk = new Walk(w);
                    GameScreen gs = new GameScreen(this, l,walk, false,false);
                    addScreen(gs);
                    gs.afterScreenCreation();                   
                }
                catch (JSONException e) {}  
            }           
        }
    }
*/        

    // ---------------- handling of global game information ---------
    
Game.prototype.setLevelSolvedGrade = function(level, solvedgrade)
{
    var t = level.getTitle();
    this.solvegrades.set(t,solvedgrade);
}  

Game.prototype.getLevelSolvedGrade = function(level)
{
    var t = level.getTitle();
    if (!this.solvegrades.has(t)) { return Game.DEFAULTSOLVEDGRADE; }
    return this.solvegrades.get(t);
};
        
Game.prototype.setMusicActive = function (active)
{
};

Game.prototype.getMusicActive = function()
{
    return false;
};      
    
Game.prototype.loadLevels = function(callback)
{
    this.levelpacks = [];
    var pending=0;
    
//      readUserLevelPacks();          
    pending++; this.readIntegratedLevelPack("Lesson 1: Mining", "tutorial1", false, done);
    pending++; this.readIntegratedLevelPack("Lesson 2: Explosives", "tutorial2", false, done);
    pending++; this.readIntegratedLevelPack("Lesson 3: Maze", "tutorial3", false, done);
    pending++; this.readIntegratedLevelPack("Lesson 4: Enemies", "tutorial4", false, done);
    pending++; this.readIntegratedLevelPack("Lesson 5: Machinery", "tutorial5", false, done);
    pending++; this.readIntegratedLevelPack("Teamwork", "twoplayer", true, done);
    pending++; this.readIntegratedLevelPack("Advanced 1", "advanced1", true, done);
    pending++; this.readIntegratedLevelPack("Advanced 2", "advanced2", true, done);
    pending++; this.readIntegratedLevelPack("Advanced 3", "advanced3", true, done);
    pending++; this.readIntegratedLevelPack("Extended 1", "extended1", true, done); 
    pending++; this.readIntegratedLevelPack("Extended 2", "extended2", true, done);
    pending++; this.readIntegratedLevelPack("Extended 3", "extended3", true, done);
    pending++; this.readIntegratedLevelPack("Extended 4", "extended4", true, done);
    pending++; this.readIntegratedLevelPack("Extended 5", "extended5", true, done);
    pending++; this.readIntegratedLevelPack("Extended 6", "extended6", true, done);
    pending++; this.readIntegratedLevelPack("Extended 7", "extended7", true, done); 
    pending++; this.readIntegratedLevelPack("Mission Possible", "mission", false, done);
  
    function done()
    {   pending--;
        if (pending===0) callback();
    }
};
    
Game.prototype.readIntegratedLevelPack = function(name, filename, sort, callback)
{
    var levelpacks = this.levelpacks;
    Game.getJSON("levels/"+filename+".sylev", function(data) 
    {   if (data) 
        {   levelpacks.push(new LevelPack().$(name, data, sort));
        }
        callback();
    });
};
    
/*
    public void readUserLevelPacks()
    {       
        try 
        {   for (String n: context.fileList())
            {
                if (n.toLowerCase().endsWith(".sylev"))
                {
                    InputStream is = context.openFileInput(n);
                    try {
                        levelpacks.addElement(new LevelPack(n.substring(0,n.length()-6), is, false, n));            
                    }
                    catch (Exception e)
                    {   is.close();
                        throw e;
                    }
                    is.close();             
                }
            }
        } catch (Exception e)
        {   e.printStackTrace();            
        }               
    }
*/  
    /** 
     * Write the level pack that contains the level. The the level can not found (which means it is probably a new 
     * level), place it into the "User Levels" pack. If this pack not yet exists, create this also.
     */ 
/*     
    public void writeUserLevel(Level l)
    {
        // find the pack which contains the level
        LevelPack pack = null;
        LevelPack defaultpack = null;
        for (LevelPack p:levelpacks)
        {
            if (p.isWriteable())
            {   if (p.containsLevel(l))
                {
                    pack = p;           
                }
                else if (p.getName().equals("User Levels"))
                {   defaultpack = p;
                }
            }
        }   
        // when the level belongs to a pack, just store the pack
        if (pack!=null)
        {
            writeLevelPack(pack);                           
        }
        // when not found, need to add level to the default pack
        else
        {
            // must create default pack if needed
            if (defaultpack==null)
            {
                defaultpack = new LevelPack("User Levels", "User Levels.sylev");
                levelpacks.insertElementAt(defaultpack,0);
                pack = defaultpack;         
            }                   
            defaultpack.addLevel(l);
            
            writeLevelPack(defaultpack);
        }
    
    }
    
    public void writeLevelPack(LevelPack p)
    {
        try {
            OutputStream os = context.openFileOutput(p.filename, 0);
            try {
                PrintStream ps = new PrintStream(os, false, "utf-8");
                p.print (ps);
                ps.close();
            }
            catch (Exception e) {}
            os.close();
        } 
        catch (Exception e) {}
    }
*/  

// constant game loop
Game.prototype.tick = function()
{
    // topmost screen always gets the tick action (other screens do not animate)
    if (this.screens.length>0)
    {   this.getTopScreen().tick();
    }
    
    // when anything changed in the display, redraw
    if (this.needRedraw) 
    {   if (this.allRenderersLoaded()) 
        {   this.needRedraw = false;
            try { this.draw(); } 
            catch (e) { console.warn(e); }            
        }
    }
};

Game.prototype.draw = function()
{
    var gl = this.gl;
    gl.viewport(0,0,this.screenwidth,this.screenheight);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // paint current contents of all the screens begin from the bottom still visible screen
    var bottom = 0;
    for (var i=1; i<this.screens.length; i++)
    {   if (!this.screens[i].isOverlay())
        {   bottom = i; 
        }
    }
    
    for (var i=bottom; i<this.screens.length; i++)
    {   
//        console.log("draw",this.screens[i]);
        this.screens[i].draw();        
    }
    
    gl.disable(gl.BLEND);   

    var e = gl.getError();
    if (e) 
    {   console.log("WebGL error on drawing: "+e);
    }

};

Game.prototype.notifyScreensAboutResize = function()
{
    for (var i=0; i<this.screens.length; i++)
    {   this.screens[i].onResize();        
    }    
};

// -------------- handling of opening/closing screens and screens notifying changes -------
    
Game.prototype.setDirty = function()    
{   this.needRedraw = true;
};
    
    
Game.prototype.addScreen = function(screen)
{   this.screens.push(screen);
    this.setDirty();
};
    
Game.prototype.removeScreen = function()
{
    this.setDirty();
    if (this.screens.length<=1)
    {   //  clearGameState();   // when leaving game on purpose, do not keep stored game state
        this.screens = [];
        (this.exitcall)();      // after closing last remaining screen, try to exit program
    }
    else
    {   var olds = this.screens.pop();
        var news = this.screens[this.screens.length-1];
        olds.discard();         
        news.reactivate();
    }
};

Game.prototype.replaceTopScreen = function(screen)
{
    this.setDirty();
    var old = this.screens.pop();
    this.screens.push(screen);
    old.discard();
};
    
Game.prototype.getTopScreen = function()
{
    return this.screens.length>0 ? this.screens[this.screens.length-1] : null;
};

        

// --------- loading renderers (will be triggered by system or by user key ----
Game.prototype.loadRenderers = function()
{
    var gl = this.gl;
    
    // (re)initialize renderers  (create opengl state)
    this.tileRenderer = null;
    this.levelRenderer = null;      
    this.textRenderer = null;
    this.vectorRenderer = null;
    this.gfxRenderer = null;

    this.vectorRenderer = new VectorRenderer().$(gl);
    console.log("VectorRenderer created");
    
    this.textRenderer = new TextRenderer().$(gl);
    console.log("TextRenderer created");

    this.levelRenderer = new LevelRenderer().$(gl);
    console.log("LevelRenderer created");      
    
    this.gfxRenderer = new GfxRenderer().$(gl);
    console.log("GfxRenderer created");      
    
    this.tileRenderer = new TileRenderer().$(gl, ["1man"]);
    console.log("TileRenderer created");      

    // check if any error has occured
    var e = gl.getError();
    if (e) 
    {   console.log("WebGL error on creating renderers: "+e);
    }
}
 
Game.prototype.allRenderersLoaded = function()
{
    return this.vectorRenderer && this.vectorRenderer.isLoaded() 
        && this.textRenderer && this.textRenderer.isLoaded() 
        && this.gfxRenderer && this.gfxRenderer.isLoaded()
        && this.tileRenderer && this.tileRenderer.isLoaded()
        && this.levelRenderer && this.levelRenderer.isLoaded();
}
 

    // ---- handling of user input events 
/*    
    public void handleTouchEvent(final MotionEvent event) 
    {
        usingKeyboardInput = false;
        
        if (screens.size()>0) 
        {   motionEventSimplifier.handleTouchEvent(event, screens.lastElement());
        }
    }   
*/
Game.prototype.onKeyDown = function(keycode) 
{    
        this.usingKeyboardInput = true;
        
        if (this.screens.length>0 && (keycode==KeyEvent.KEYCODE_BACK))
        {   this.getTopScreen().onBackNavigation();
        }
        else if (this.screens.length>0)
        {
            this.getTopScreen().onKeyDown(keycode);
        }
};

Game.prototype.onKeyUp = function(keycode) {    
        if (this.screens.length>0)
        {
            this.getTopScreen().onKeyUp(keycode);
        }
};


Game.prototype.startMusic = function(filename)
{
/*    
    // keep already running music
    if (musicPlayer!=null && musicName.equals(filename))
    {
            return;
        }
    
        if (musicPlayer!=null)
        {
            musicPlayer.release();
            musicPlayer=null;
        }
        if (filename!=null)
        {
        
            try
            {               
                AssetFileDescriptor afd = context.getAssets().openFd("music/"+filename+".mp3");
                musicPlayer = new MediaPlayer();
                musicPlayer.setDataSource (afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
                musicPlayer.prepare();
                musicPlayer.setLooping(true);
                musicPlayer.start();
                musicName = filename;               
            }
            catch (IOException e) {}
            
        }
*/        
};

Game.prototype.stopMusic = function()
{
    this.startMusic(null);
};

Game.prototype.startCategoryMusic = function (category)
{
    switch (category)
    {   case 0:  // "Fun"
            this.startMusic("Time");
            break;              
        case 1: // "Travel"
            this.startMusic("Calm");
            break;
        case 2: // "Action"
            this.startMusic("Action");
            break;
        case 3: // "Fight"
            this.startMusic("Granite");
            this.break;
        case 4: // "Puzzle"
            this.startMusic("Crystal");
            this.break;
        case 5: // "Science"
            this.startMusic("Only Solutions");
            break;
        case 6: // "Work"
            this.startMusic("Time");
            this.break;        
    }
};

    
// --------------------- static toolbox methods ------------------------------

Game.getColorForDifficulty = function(difficulty)
{
    switch(difficulty)
    {   case 1:     // Simple
            return Game.argb(170,120,255);
        case 2:     // Easy
            return Game.argb(30,150,255);
        case 3:     // Moderate
            return Game.argb(40,215,215);
        case 4:     // Normal
            return Game.argb(50,255,0);
        case 5:     // Tricky
            return Game.argb(240,240,0);
        case 6:     // Tough
            return Game.argb(255,139,0);
        case 7:     // Difficult
            return Game.argb(255,70,0);
        case 8:     // Hard
            return Game.argb(255,40,40);
        case 9:     // M.A.D.
            return Game.argb(255,0,100);
        default:
            return Game.argb(170,170,170);
    }
};
    
Game.getNameForDifficulty = function(difficulty)
{
    switch(difficulty)
    {   case 1:
            return "Simple";
        case 2:
            return "Easy";
        case 3:
            return "Straight";
        case 4:
            return "Normal";
        case 5:
            return "Tricky";
        case 6:
            return "Tough";
        case 7:
            return "Difficult";
        case 8:
            return "Hard";
        case 9:
            return "M.A.D.";
        default:
            return "unrated";
    }
};

Game.getNameForCategory = function(category)    
{
    switch (category)
    {   case 0: 
            return "Fun";
        case 1:
            return "Travel";            
        case 2:
            return "Action";
        case 3:
            return "Fight";
        case 4: 
            return "Puzzle";
        case 5: 
            return "Science";
        case 6:
            return "Work";
        default:
            return "unknown";
    }
};
    
Game.argb = function(r, g, b)
{
    return 0xff000000 | (r<<16) | (g<<8) | (b<<0);
};


Game.getJSON = function(url, callback) 
{
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.overrideMimeType("text/plain");
    xmlhttp.onreadystatechange = function() 
    {   if (this.readyState == 4)
        {   if (this.status == 200) 
            {   var myObj = JSON.parse(this.responseText);
                callback(myObj);
            }
            else
            {   callback(null);
            }
        }
    };
    xmlhttp.open("GET", url, true);
    xmlhttp.send();
};

Game.arraycopy = function(from,fromstart,to,tostart,length)
{
    if (from>to)
    {   for (var i=0; i<length; i++) to[tostart+i] = from[fromstart+i];
    }
    else
    {   for (var i=length-1; i>=0; i--) to[tostart+i] = from[fromstart+i];
    }    
};

Game.fillarray = function(a, value)
{   
    if (a.fill) 
    {   a.fill(value); 
    }
    else
    {   for (var i=0; i<a.length; i++) { a[i] = value; };
    }
};

Game.currentTimeMillis = function()
{
    return Date.now();
};

Game.isInteger = function(value)
{
    if (typeof(value)!="number") { return false; }
    return Math.round(value) === value;    
};

/** 
 * 	Create string of the form m:ss of a given number of seconds. 
 *  Only non-negative seconds work correctly.
 */ 
Game.buildTimeString = function(seconds)
{
    var s = seconds%60;
    var m = (seconds - s)/60;
    if (s>=10)
    {   return m+":"+s;
    }
    else
    {	return m+":0"+s;
    }			
};
