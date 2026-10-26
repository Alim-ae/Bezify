/* Responsive, normalized square cubic-bezier editor. */
function EaseEditor(options) {
    this.canvas = options.canvas;
    this.context = this.canvas.getContext("2d");
    this.applyButton = options.applyButton;
    this.outputs = options.outputElements;
    this.onApply = options.onApply;
    this.values = { x1: 0.25, y1: 0.10, x2: 0.25, y2: 1.00 };
    this.overshoot = false;
    this.viewMin = 0; this.viewMax = 1;
    this.cssSize = 0; this.pixelRatio = 1; this.activeHandle = null;
    this.renderQueued = false; this.animationId = null; this.padding = 14; this.handleRadius = 6;
    this.theme = window.getComputedStyle(document.documentElement);
    this.colors = { grid: this.theme.getPropertyValue("--border"), guide: this.theme.getPropertyValue("--text-dim"), accent: this.theme.getPropertyValue("--accent"), background: this.theme.getPropertyValue("--bg") };
    this.bindEvents(); this.resize(); this.updateOutputs();
}
EaseEditor.prototype.bindEvents = function () {
    var editor = this;
    this.canvas.addEventListener("pointerdown", function (event) { editor.startDrag(event); });
    this.canvas.addEventListener("pointermove", function (event) { editor.drag(event); });
    this.canvas.addEventListener("pointerup", function (event) { editor.endDrag(event); });
    this.canvas.addEventListener("pointercancel", function (event) { editor.endDrag(event); });
    this.applyButton.addEventListener("click", function () { editor.onApply(editor.getValues()); });
    window.addEventListener("resize", function () { editor.resize(); });
    if (window.ResizeObserver) { this.resizeObserver = new ResizeObserver(function () { editor.resize(); }); this.resizeObserver.observe(this.canvas.parentNode); }
};
EaseEditor.prototype.getValues = function () { return {x1:this.values.x1,y1:this.values.y1,x2:this.values.x2,y2:this.values.y2}; };
EaseEditor.prototype.clampValues = function (values) {
    var minimumY = this.overshoot ? -1 : 0;
    var maximumY = this.overshoot ? 2 : 1;
    return {x1:Math.max(0,Math.min(1,values.x1)),y1:Math.max(minimumY,Math.min(maximumY,values.y1)),x2:Math.max(0,Math.min(1,values.x2)),y2:Math.max(minimumY,Math.min(maximumY,values.y2))};
};
EaseEditor.prototype.setCurve = function (x1, y1, x2, y2, name) {
    var values = { x1: Number(x1), y1: Number(y1), x2: Number(x2), y2: Number(y2) };
    if (!isFinite(values.x1) || !isFinite(values.y1) || !isFinite(values.x2) || !isFinite(values.y2)) {
        if (window.console && console.error) { console.error("Bezify rejected an invalid curve.", values); }
        return false;
    }
    this.values = this.clampValues(values);
    this.curveName = name || "Custom curve";
    this.updateOutputs();
    this.queueRender();
    return true;
};
EaseEditor.prototype.setValues = function (values) { return this.setCurve(values.x1, values.y1, values.x2, values.y2, values.name); };
EaseEditor.prototype.animateTo = function (values, duration) {
    var editor = this, start = this.getValues(), target = {x1:Number(values.x1),y1:Number(values.y1),x2:Number(values.x2),y2:Number(values.y2)}, startedAt = null;
    if (!isFinite(target.x1) || !isFinite(target.y1) || !isFinite(target.x2) || !isFinite(target.y2)) { if (window.console && console.error) { console.error("Bezify rejected an invalid animated curve.", values); } return false; }
    target = this.clampValues(target);
    if (this.animationId) { window.cancelAnimationFrame(this.animationId); }
    function frame(now) { var p, e; if (startedAt === null) { startedAt = now; } p=Math.min(1,(now-startedAt)/duration); e=1-Math.pow(1-p,4); editor.setCurve(start.x1+(target.x1-start.x1)*e,start.y1+(target.y1-start.y1)*e,start.x2+(target.x2-start.x2)*e,start.y2+(target.y2-start.y2)*e,values.name); if(p<1){editor.animationId=window.requestAnimationFrame(frame);}else{editor.animationId=null;} }
    this.animationId=window.requestAnimationFrame(frame);
};
EaseEditor.prototype.setOvershoot = function (enabled) {
    var editor=this, fromMin=this.viewMin, fromMax=this.viewMax, toMin=enabled?-1:0, toMax=enabled?2:1, startedAt=null;
    this.overshoot=enabled; this.setValues(this.values);
    function zoom(now) { var p; if(startedAt===null){startedAt=now;} p=Math.min(1,(now-startedAt)/200); editor.viewMin=fromMin+(toMin-fromMin)*p; editor.viewMax=fromMax+(toMax-fromMax)*p; editor.queueRender(); if(p<1){window.requestAnimationFrame(zoom);} }
    window.requestAnimationFrame(zoom);
};
EaseEditor.prototype.resize = function () {
    var wrap = this.canvas.parentNode, ratio = window.devicePixelRatio || 1;
    var size = Math.max(60, Math.floor(Math.min(wrap.clientWidth, wrap.clientHeight)));
    if (size === this.cssSize && ratio === this.pixelRatio) { return; }
    this.cssSize = size; this.pixelRatio = ratio;
    this.padding = size < 140 ? 5 : (size < 200 ? 9 : 14);
    this.canvas.style.width = size + "px"; this.canvas.style.height = size + "px";
    this.canvas.width = Math.floor(size * ratio); this.canvas.height = Math.floor(size * ratio);
    this.queueRender();
};
EaseEditor.prototype.plot = function () { var inset=this.padding+this.handleRadius, size=this.cssSize-inset*2; return {inset:inset,size:Math.max(1,size)}; };
EaseEditor.prototype.toCanvasPoint = function (x,y) { var p=this.plot(); return {x:p.inset+x*p.size,y:p.inset+(this.viewMax-y)/(this.viewMax-this.viewMin)*p.size}; };
EaseEditor.prototype.eventPoint = function (event) { var rect=this.canvas.getBoundingClientRect(); return {x:event.clientX-rect.left,y:event.clientY-rect.top}; };
EaseEditor.prototype.handlePoint = function (name) { return this.toCanvasPoint(name==="first"?this.values.x1:this.values.x2,name==="first"?this.values.y1:this.values.y2); };
EaseEditor.prototype.startDrag = function (event) { var p=this.eventPoint(event), a=this.handlePoint("first"), b=this.handlePoint("second"), da=Math.sqrt(Math.pow(p.x-a.x,2)+Math.pow(p.y-a.y,2)), db=Math.sqrt(Math.pow(p.x-b.x,2)+Math.pow(p.y-b.y,2)); this.activeHandle=da<=18&&da<=db?"first":(db<=18?"second":null); if(this.activeHandle){this.canvas.setPointerCapture(event.pointerId);event.preventDefault();} };
EaseEditor.prototype.drag = function (event) { var p, plot, x, y; if(!this.activeHandle){return;} p=this.eventPoint(event);plot=this.plot();x=Math.max(0,Math.min(1,(p.x-plot.inset)/plot.size));y=this.viewMax-(p.y-plot.inset)/plot.size*(this.viewMax-this.viewMin); if(this.activeHandle==="first"){this.setValues({x1:x,y1:y,x2:this.values.x2,y2:this.values.y2});}else{this.setValues({x1:this.values.x1,y1:this.values.y1,x2:x,y2:y});} event.preventDefault(); };
EaseEditor.prototype.endDrag = function (event) { if(this.activeHandle&&this.canvas.hasPointerCapture(event.pointerId)){this.canvas.releasePointerCapture(event.pointerId);} this.activeHandle=null; };
EaseEditor.prototype.updateOutputs = function () { var key; for(key in this.outputs){if(this.outputs.hasOwnProperty(key)){if(typeof this.outputs[key].value!=="undefined"){this.outputs[key].value=this.values[key].toFixed(2);}else{this.outputs[key].textContent=this.values[key].toFixed(2);}}} };
EaseEditor.prototype.queueRender = function () { var editor=this; if(this.renderQueued){return;}this.renderQueued=true;window.requestAnimationFrame(function(){editor.renderQueued=false;editor.render();}); };
EaseEditor.prototype.drawLine = function (a,b,color,width) { var c=this.context;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.strokeStyle=color;c.lineWidth=width;c.stroke(); };
EaseEditor.prototype.bezier = function (t) { var q=1-t,x=3*q*q*t*this.values.x1+3*q*t*t*this.values.x2+t*t*t,y=3*q*q*t*this.values.y1+3*q*t*t*this.values.y2+t*t*t;return this.toCanvasPoint(x,y); };
EaseEditor.prototype.render = function () {
    var c=this.context,p=this.plot(),i,point,bg,start=this.toCanvasPoint(0,0),end=this.toCanvasPoint(1,1),a=this.handlePoint("first"),b=this.handlePoint("second");
    c.setTransform(this.pixelRatio,0,0,this.pixelRatio,0,0);c.clearRect(0,0,this.cssSize,this.cssSize);bg=c.createRadialGradient(this.cssSize/2,this.cssSize/2,0,this.cssSize/2,this.cssSize/2,this.cssSize*0.75);bg.addColorStop(0,"#282626");bg.addColorStop(1,"#1A1A1A");c.fillStyle=bg;c.fillRect(0,0,this.cssSize,this.cssSize);c.save();c.beginPath();c.rect(p.inset,p.inset,p.size,p.size);c.clip();
    for(i=0;i<=4;i++){this.drawLine({x:p.inset+i*p.size/4,y:p.inset},{x:p.inset+i*p.size/4,y:p.inset+p.size},this.colors.grid,1);this.drawLine({x:p.inset,y:this.toCanvasPoint(0,i/4).y},{x:p.inset+p.size,y:this.toCanvasPoint(0,i/4).y},this.colors.grid,1);} this.drawLine(start,a,this.colors.guide,1);this.drawLine(b,end,this.colors.guide,1);c.beginPath();point=this.bezier(0);c.moveTo(point.x,point.y);for(i=1;i<=80;i++){point=this.bezier(i/80);c.lineTo(point.x,point.y);}c.shadowColor="rgba(217,119,87,0.55)";c.shadowBlur=10;c.strokeStyle=this.colors.accent;c.lineWidth=2.5;c.lineJoin="round";c.stroke();c.shadowBlur=0;c.shadowColor="transparent";c.restore();c.strokeStyle=this.colors.guide;c.lineWidth=1;c.strokeRect(p.inset,p.inset,p.size,p.size);this.drawDot(a,"1");this.drawDot(b,"2");
};
EaseEditor.prototype.drawDot = function (point,label) { var c=this.context,p=this.plot(),x=Math.max(p.inset+this.handleRadius,Math.min(p.inset+p.size-this.handleRadius,point.x)),y=Math.max(p.inset+this.handleRadius,Math.min(p.inset+p.size-this.handleRadius,point.y));c.save();c.shadowColor="rgba(217,119,87,0.6)";c.shadowBlur=8;c.beginPath();c.arc(x,y,this.handleRadius,0,Math.PI*2,false);c.fillStyle=this.colors.accent;c.fill();c.restore();c.fillStyle=this.colors.background;c.font="bold 10px Arial";c.textAlign="center";c.textBaseline="middle";c.fillText(label,x,y+.5); };
