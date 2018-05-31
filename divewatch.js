//V3
/* jshint esversion: 6 */
const DEBUG = 1;
window.onload = function() {
  /** initialize Material Design Components */
  mdc.autoInit();
  /**
   * We use this revealing module pattern to hold all of our state for the debug infoPanel.
   */
   
  let infoPanel = (function() {
    let infoState = {
      width: document.getElementById('xwidth'),
      height: document.getElementById('yheight'),
      xcoord: document.getElementById('x-coord'),
      ycoord: document.getElementById('y-coord'),
      xtrans: document.getElementById('x-trans'),
      ytrans: document.getElementById('y-trans'),
      theta: document.getElementById('theta'),
      radius: document.getElementById('radius'),
      audio: document.getElementById('audio'),
    };
      
    let init= ()=> {
      infoState.width.innerHTML = String(watch.bezel.clientWidth);
      infoState.height.innerHTML = String(watch.bezel.clientHeight);
      infoState.audio.innerHTML = watchSound.aCtx.state;
      document.getElementById('debugToggle').addEventListener('click', debugToggle, false);
      document.getElementById("infoPanel").style.display='none';
    };
      
      /** we use object destructuring to access the variables inside passed argument object
       * which means the function can accept any number variables
       */
        let update=({xp, yp, x, y, t, r, a}={})=> {
        if (xp!== void 0) infoState.xcoord.innerHTML = xp.toFixed(0);
        if (yp!== void 0) infoState.ycoord.innerHTML = yp.toFixed(0);
        if (x!== void 0) infoState.xtrans.innerHTML = x.toFixed(0);
        if (y!== void 0) infoState.ytrans.innerHTML = y.toFixed(0);
        if (t!== void 0) infoState.theta.innerHTML  = t.toFixed(0);
        if (r!== void 0) infoState.radius.innerHTML = r.toFixed(0);
        if (a!== void 0) infoState.audio.innerHTML  = a;
      };
      
      debugToggle= function() {
         let ele = document.getElementById("infoPanel");
         ele.style.display=( ele.style.display === "none"?"block":"none");
      };
  
      
    /** expose the functions and data we want public */
    return {init:init,
            update:update
    };
  }());
  
  
  let watchSound=(function(){
    const aCtx = new AudioContext();
    const gainNode = aCtx.createGain();
    let previousTime = 0;
    let bezelClickBuffer = null;
    const clickSound='https://storage.googleapis.com/web-content012018/Dive%20Watch/click2.mp3';
    const audioToggle= document.getElementById('audioToggle');
    let audioState={
      aCtxToggle: function() {
        if (aCtx.state === 'running') {
          gainNode.gain.setValueAtTime(0, aCtx.currentTime);
          aCtx.suspend().then(function() {
              infoPanel.update({a:aCtx.state});
          });
        }
        else if (aCtx.state === 'suspended') {
          gainNode.gain.setValueAtTime(1, aCtx.currentTime+0.5);
          aCtx.resume().then(function() {
              infoPanel.update({a:aCtx.state});
          });
        }
      }
    };
    
      let onError= ()=> {
      alert("unable to load sound for this browser");
      };
    
      let init= ()=> {
      /** Set up th audio for the watch*/
       audioToggle.addEventListener('click', watchSound.aCtxToggle, false);
      /** set up vol control,1=100%*/
      gainNode.gain.value = 1;
      gainNode.connect(aCtx.destination);
      //var bezelClickBuffer = null;

      loadClickSound(clickSound);
      aCtx.suspend();
      };
      
      
      let loadClickSound=(url)=> {
        var request = new XMLHttpRequest();
        request.open('GET', url, true);
        request.responseType = 'arraybuffer';
        /** Decode asynchronously */
        request.onload = function() {
        aCtx.decodeAudioData(request.response, function(buffer) {
          watchSound.bezelClickBuffer = buffer;
             }, onError);
        };
        request.send();
      };
      /**varies pitch according to speed of rotation */
  

      let playSound=(buffer)=> {
        let source = aCtx.createBufferSource(); // creates a sound source
        source.buffer = buffer;
        source.loop = false; // tell the source which sound to play
        source.connect(gainNode); // connect the source to the context's destination (the speakers)
        let pitch = 1 / (aCtx.currentTime - previousTime) / 100;
        let rate = 1 + (!isFinite(pitch) ? 0 : pitch);
        source.playbackRate.value = rate; // See if we can vary pitch based on speed of touch
        source.start(0); // play the source now
        previousTime = aCtx.currentTime;
      };

      
     return {aCtxToggle:audioState.aCtxToggle,
            init:init,
            aCtx:aCtx,
            bezelClickBuffer:bezelClickBuffer,
            playSound:playSound
    };
    
  }());
  
  
  /**
   * We use this module pattern to hold all of our state for the Watch
   */
  let watch = (function() {
    /** private variables */
    let wCounter=0;
    let tCounter=0;
   
    /** public variables **/
    let watchState = {
      bezelRadius: 0,
      curTheta: 0,
      centerX: 0,
      centerY: 0,
      nav: document.querySelector(".mdc-top-app-bar"),
      parent: document.getElementById("parent"),
      bezel: document.getElementById("bezel"),
      box: document.getElementById("parent"),
      spinner: document.getElementById("spinner"),
      theta: 0,
      lastTheta: 180,
      detent:6,
      init: function() {
        this.bezelRadius = this.bezel.clientHeight / 2;
        this.centerX = (this.bezel.clientWidth / 2) + this.parent.offsetLeft;
        this.centerY = (this.bezel.clientHeight / 2) + this.parent.offsetTop;
        this.box.addEventListener('wheel', this.rotateBezelWheel);
        this.bezel.addEventListener('touchstart', this.handleTouchStart, false);
        this.bezel.addEventListener('touchend', this.handleTouchEnd, false);
        this.bezel.addEventListener('touchmove', this.handleTouchMove, false);
        document.getElementById('float-button').addEventListener('click', this.resetBezel);
        let drawer = new mdc.drawer.MDCTemporaryDrawer(document.querySelector('.mdc-drawer--temporary'));
        document.querySelector('.mdc-top-app-bar__navigation-icon').addEventListener('click', () => drawer.open = true);
        let dialog = new mdc.dialog.MDCDialog(document.querySelector('#my-mdc-dialog'));
        let guide = new mdc.dialog.MDCDialog(document.querySelector('#guide'));
        document.querySelector('#help-button').addEventListener('click', function (evt) {
          dialog.lastFocusedTarget = evt.target;
          dialog.show();
          });
        guide.show();
        document.getElementById('detent-toggle').addEventListener('click', this.detentToggle, false);
 
        /** We use CSS animations to handle the second hand movement.
         * but we need to know where the second hand starts from, based on actual time.
         * Create a custom css animation for the second hand.
         * First we create a new stylesheet to insert the custom keyframe
         * note there may be some drift on the second hand over long periods as css animations goes
         * out of sync with the actual timer
         */
         
        let element = document.createElement('style');
        document.head.appendChild(element);
        let styleSheet = element.sheet;
        let s1 = 6 * new Date().getSeconds();
        let styles =`@keyframes ksecond-swing  {
                       0%   {transform: rotate3d(0,0,1,${s1}deg);}
                       100% {transform: rotate3d(0,0,1,${s1 + 360}deg);}
                     }`;
        styleSheet.insertRule(styles, 0);
        
        // set up the timers to update the hands
        // executes the code inside "setInterval" every min which is 1000 miliseconds
        setInterval(function() { function sethands(el, deg) {
          document.getElementById(el).style.transform = `rotate(${deg}deg)`;
          }
          let d = new Date();
          sethands("hour", 30 * (d.getHours() % 12) + d.getMinutes() / 2);
          sethands("min", 6 * (d.getMinutes()));
        }, 1000);
      },
      
      /** note with fat arrow functions there is no "this", use lexecal scope instead */
      bezelWheelPos: (direction)=> {
        return direction === "cw" ? wCounter += watch.detent : wCounter -= watch.detent;
      },
      bezelTouchPos: (direction, delta)=> {
        return tCounter += delta;
      },
      
      detentToggle: function(evt) {
         watch.detent= watch.detent === 3 ? 6: 3;
      },
      
      resetBezel: function(evt) {
        console.log("reset Bezel");
        wCounter=0;
        tCounter=0;
        watch.bezel.style.transition ='transform 1s';
        watch.bezel.style.transform = `rotate3d(0,0,1,0deg`;
        //watch.bezel.style.transition ='none';
        
        setTimeout(()=>watch.bezel.style.transition ='none',1000);
      },
      rotateBezelWheel: function(evt) {
        const direction = evt.wheelDelta < 0 ? "cw" : "ccw";
        watch.bezel.style.transform = `rotate3d(0,0,1,${watch.bezelWheelPos(direction)}deg`;
        watchSound.playSound(watchSound.bezelClickBuffer);
      },
      rotateBezel: function(direction, delta) {
        watchSound.playSound(watchSound.bezelClickBuffer);
        watch.bezel.style.transform = `rotate3d(0,0,1,${watch.bezelTouchPos(direction,delta)}deg)`;
      },
      handleTouchStart: function(evt) {
        watch.nav.classList.add("mdc-top-app-bar--short-collapsed");
        evt.preventDefault();
        if (evt.targetTouches.length === 1) {
          let touch = evt.targetTouches[0];
          let xcart = (touch.pageX) - watch.centerX;
          let ycart = ((touch.pageY) - watch.centerY);
          let curTheta = findTheta(xcart, ycart);
          watch.lastTheta = curTheta;
          
          if (DEBUG) {
            infoPanel.update({xp:touch.pageX,yp:touch.pageY, x:xcart, y:ycart, t:findTheta(xcart, ycart), r:findRaduius(watch.centerX, watch.centerY,
              touch.pageX, touch.pageY)});
          }
        }
      },
      handleTouchEnd: function(evt) {
        watch.nav.classList.remove("mdc-top-app-bar--short-collapsed");
        watch.bezel.removeEventListener('touchmove', null, false);
      },
      handleTouchMove: function(evt) {
        evt.preventDefault();
        if (evt.targetTouches.length == 1) {
          let touch = evt.targetTouches[0];
          let xcart = (touch.pageX) - watch.centerX;
          let ycart = ((touch.pageY) - watch.centerY);
          let curTheta = findTheta(xcart, ycart);
          if (DEBUG) {
            infoPanel.update({xp:touch.pageX,yp:touch.pageY, x:xcart, y:ycart, t:findTheta(xcart, ycart), r:findRaduius(watch.centerX, watch.centerY,
              touch.pageX, touch.pageY)});
          }
          let delta = getAngleDelta(watch.lastTheta, curTheta);
          if (delta <= -watch.detent) {
            watch.rotateBezel("ccw", delta);
            watch.lastTheta = curTheta;
          }
          else if (delta >= watch.detent) {
            watch.rotateBezel("cw", delta);
            watch.lastTheta = curTheta;
          }
          
        }
      }
      
    };
    return watchState; // expose externally
  }());
  
  watch.init();
  infoPanel.init();
  watchSound.init();
  
  /** shut down the CSS loading spinner*/
  watch.spinner.style.display = "none";
};

/**===============utilities=============================*/
/**
 * Calculates radius given origin and point.
 * @param {number} xo -x origin
 * @param {number} yo -y origin
 * @param {number} x  -x point
 * @param {number} y  -y point
 * @return {number} The radius length
 */
function findRaduius(xo, yo, x, y) {
  let xcart = x - xo;
  let ycart = (y - yo) * -1;
  return Math.round(Math.hypot(xcart, ycart));
}
/**
 * Calculates angle between origin and coordinate
 * @param {number} x  -x point
 * @param {number} y  -y point
 * @return {number} The angle in degrees
 */
function findTheta(x, y) {
  let theta = Math.atan2(x, y) * (180 / Math.PI);
  return (theta < 0 ? (360 + theta) : theta);
}
/**
 * Calculates the difference in degrees between two angles
 * @param {number} a1- The starting angle
 * @param {number} a2 - The end angle
 * @return {number} the difference between a1 and a2 in degrees
 * positive is clockwise, negative is ccw
 */
function getAngleDelta(a1, a2) {
  let theta = (a1 - a2) % 360;
  let direction = theta < 0 ? -1 : 1;
  theta = Math.abs(theta);
  if (theta > 350) { direction *= -1;  }
  return Math.round((theta < 180) ? direction * theta : direction * (360 - theta));
}


