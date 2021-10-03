unit GameBase;

{$mode objfpc}
{$modeswitch advancedrecords}

interface

uses
  JS,
  Web, webgl,
  gameaudio, GameMath,
  sysutils, classes, contnrs;

const
  DisableDepthForTransparent = true;

type
  TGameBase = class;

  TGameColor = record
    R,G,B: double;

    class function New(AR,AG,AB: double): TGameColor; static;
  end;

  TGameViewport = record
    Projection,
    ModelView: TPMatrix;
  end;

  TGameElement = class
  private
    fOpaque: boolean;
    fPosition: TPVector;
    fVisible: boolean;
  protected
    procedure Update(AGame: TGameBase; ATimeMS: double); virtual;
    procedure Render(GL: TJSWebGLRenderingContext; const AViewport: TGameViewport); virtual;
  public
    constructor Create(AOpaque: boolean = false);

    property Position: TPVector read fPosition write fPosition;
    property Visible: boolean read fVisible write fVisible;
    property Opaque: boolean read fOpaque;
  end;

  TGameTexture = class
  private
    fID: TJSWebGLTexture;  
    fWidth, fHeight: LongInt;
  protected
    constructor Create(AWidth, AHeight: longint); virtual;
    constructor Create(ASrc: TJSHTMLImageElement); virtual;

    procedure Load(ASrc: TJSHTMLImageElement); virtual;
  public
    destructor Destroy; override;

    property ID: TJSWebGLTexture read fID;

    property Width: longint read fWidth;
    property Height: longint read fHeight;
  end;

  TGameShader = class
  private
    fVID, fFID: TJSWebGLShader;
    fProg: TJSWebGLProgram;
    function LoadShader(GL: TJSWebGLRenderingContext; const ASrc: string; AType: GLenum): TJSWebGLShader;
  public
    constructor Create(const AVertex, AFragment: string);

    property ID: TJSWebGLProgram read fProg;
  end;

  TGameBaseState = (bsStart, bsWaitResources, bsDone);

  TGameMouseState = (msUp, msDragging, msDown);

  TGameBaseClass = class of TGameBase;
  TGameBase = class
  private
    fAudio: TGameAudio;
    fHeight, fWidth: longint;
    fMouseStartY: Double;
    fMouseStartX: Double;

    fToFree,
    fElements: TJSArray;

    fState: TGameBaseState;

    fMouseState: TGameMouseState;

    function OnCanvasKeyPress(aEvent: TJSKeyBoardEvent): boolean;
    function OnCanvasLeave(aEvent: TJSMouseEvent): boolean;
    function OnCanvasMouseDown(aEvent: TJSMouseEvent): boolean;
    function OnCanvasMouseUp(aEvent: TJSMouseEvent): boolean;
    function OnCanvasMove(aEvent: TJSMouseEvent): boolean;
    function OnCanvasWheel(aEvent: TJSWheelEvent): boolean;

    function OnResize(Event: TEventListenerEvent): boolean;

    procedure OnRequestFrame(aTime: TJSDOMHighResTimeStamp);
  protected
    Canvas: TJSHTMLCanvasElement;
    GL: TJSWebGLRenderingContext;

    function GetElements: TJSArray; virtual;

    procedure InitializeResources; virtual;
    procedure AfterLoad; virtual;

    procedure AfterResize; virtual;

    procedure DoMove(AX,AY: double); virtual;
    procedure DoWheel(AX: double); virtual;
    procedure DoStopDrag(); virtual;
    procedure DoStartDrag(AX,AY: double); virtual;
    procedure DoClick(AX,AY: double; AButtons: longword); virtual;
    procedure DoKeyPress(AKeyCode: string); virtual;

    procedure Update(ATimeMS: double); virtual;
    procedure Render; virtual;
  public
    Viewport: TGameViewport;

    function AddElement(AElement: TGameElement): TGameElement;
    procedure RemoveElement(AElement: TGameElement; AFreeLater: boolean=false);

    constructor Create; virtual;

    procedure Run;

    property Audio: TGameAudio read fAudio;
    property Width: longint read fWidth;
    property Height: longint read fHeight;
  end;

function Game: TGameBase;

procedure RunGame(AGame: TGameBaseClass);

implementation

uses
  resources;

const
  DragStart = 500;

var
  GameInstance: TGameBase;

function Game: TGameBase;
begin
  result:=GameInstance;
end;

procedure RunGame(AGame: TGameBaseClass);
begin
  GameInstance:=AGame.Create;
  GameInstance.Run;
end;

function IsPowerOf2(x: integer): boolean;
begin
  result:=(x and (x-1)) = 0;
end;

class function TGameColor.New(AR, AG, AB: double): TGameColor;
begin
  result.R:=AR;
  result.G:=AG;
  result.B:=AB;
end;

function TGameShader.LoadShader(GL: TJSWebGLRenderingContext; const ASrc: string; AType: GLenum): TJSWebGLShader;
var
  err: String;
begin
  result:=GL.createShader(AType);
  gl.shaderSource(result, ASrc);
  gl.compileShader(result);

  if gl.getShaderParameter(result, gl.COMPILE_STATUS)=0 then
  begin
    err:=GL.getShaderInfoLog(result);
    window.console.error('Failed to compile shader: ' + err);
  end;
end;

constructor TGameShader.Create(const AVertex, AFragment: string);
var
  gl: TJSWebGLRenderingContext;
  err: String;
begin
  inherited Create;
  gl:=Game.GL;

  fVID:=LoadShader(gl, AVertex, gl.VERTEX_SHADER);
  fFID:=LoadShader(gl, AFragment, gl.FRAGMENT_SHADER);

  fProg:=gl.createProgram;
  gl.attachShader(fProg, fVID);
  gl.attachShader(fProg, fFID);
  gl.linkProgram(fProg);

  if gl.getProgramParameter(fProg, gl.LINK_STATUS)=0 then
  begin
    err:=gl.getProgramInfoLog(fProg);
    Web.window.console.error('Failed to link: ' + err);
  end;
end;

constructor TGameTexture.Create(AWidth, AHeight: longint);
var
  gl: TJSWebGLRenderingContext;
  pixel: TJSUint8Array;
begin
  gl:=Game.GL;

  fID:=gl.createTexture;
  gl.bindTexture(gl.TEXTURE_2D, fID);

  pixel:=TJSUint8Array.new(4*AWidth*AHeight);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, AWidth, AHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixel);

  fWidth:=AWidth;
  fHeight:=AHeight;
end;

constructor TGameTexture.Create(ASrc: TJSHTMLImageElement);
var
  gl: TJSWebGLRenderingContext;
begin
  gl:=Game.GL;

  fID:=gl.createTexture;
  gl.bindTexture(gl.TEXTURE_2D, fID);

  Load(ASrc);
end;

procedure TGameTexture.Load(ASrc: TJSHTMLImageElement);
var
  gl: TJSWebGLRenderingContext;
begin
  gl:=Game.GL;

  fWidth:=ASrc.Width;
  fHeight:=ASrc.Height;
                       
  gl.bindTexture(gl.TEXTURE_2D, fID);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ASrc);

  if IsPowerOf2(ASrc.width) and IsPowerOf2(ASrc.height) then
  begin
    gl.generateMipmap(gl.TEXTURE_2d);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
  end
  else
  begin
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  end;
end;

destructor TGameTexture.Destroy;
begin
  game.GL.deleteTexture(fID);
  inherited Destroy;
end;

procedure TGameElement.Update(AGame: TGameBase; ATimeMS: double);
begin
end;

procedure TGameElement.Render(GL: TJSWebGLRenderingContext; const AViewport: TGameViewport);
begin
end;

constructor TGameElement.Create(AOpaque: boolean);
begin
  inherited Create;
  fOpaque:=AOpaque;
  Visible:=true;
end;

function TGameBase.OnResize(Event: TEventListenerEvent): boolean;
begin
  fWidth :=window.innerwidth;
  fHeight:=window.innerHeight;

  canvas.width:=fWidth;
  canvas.height:=height;

  AfterResize;
end;

function TGameBase.OnCanvasKeyPress(aEvent: TJSKeyBoardEvent): boolean;
begin
  if fState=bsDone then
    DoKeyPress(AEvent.code);
  result:=true;
end;

function TGameBase.OnCanvasLeave(aEvent: TJSMouseEvent): boolean;
begin
  if fMouseState=msDragging then
  begin
    fMouseState:=msUp;
    DoStopDrag;
  end;
  result:=true;
end;

function TGameBase.OnCanvasMouseDown(aEvent: TJSMouseEvent): boolean;
begin
  result:=true;

  if fState=bsDone then
  begin
    if aEvent.button=0 then
    begin
      fMouseStartX:=aEvent.x;
      fMouseStartY:=aEvent.y;
      fMouseState:=msDown;
    end;
  end;
end;

function TGameBase.OnCanvasMouseUp(aEvent: TJSMouseEvent): boolean;
begin
  if fMouseState<>msUp then
  begin
    if fMouseState=msDragging then
      DoStopDrag
    else
      DoClick(aEvent.x, aEvent.y, aEvent.buttons);
    fMouseState:=msUp;
  end;
  result:=true;
end;

function TGameBase.OnCanvasMove(aEvent: TJSMouseEvent): boolean;
begin
  if fState=bsDone then
  begin
    if (fMouseState=msDown) and (sqr(DragStart)<=(sqr(aEvent.x-fMouseStartX)+sqr(aEvent.y-fMouseStartY))) then
    begin
      fMouseState:=msDragging;
      DoStartDrag(fMouseStartX, fMouseStartY);
    end
    else
      DoMove(AEvent.clientX, AEvent.clientY);
  end;
  result:=true;
end;

function TGameBase.OnCanvasWheel(aEvent: TJSWheelEvent): boolean;
begin
  if fState=bsDone then
    DoWheel(aEvent.deltaY);

  result:=true;
end;

procedure TGameBase.OnRequestFrame(aTime: TJSDOMHighResTimeStamp);
begin
  gl.viewport(0,0,fWidth,fHeight);

  GL.clearColor(0,0,0,1);
  GL.enable(gl.DEPTH_TEST);
  GL.clear(GL.COLOR_BUFFER_BIT or GL.DEPTH_BUFFER_BIT);

  case fState of
    bsWaitResources:
      begin
        //GL.textBaseline:='top';
        //GL.fillText(Format('Loading resources: %d out of %d done', [TResources.TotalLoaded, TResources.Total]), 0,0);

        if TResources.Completed then
        begin
          AfterLoad;
          fState:=bsDone;
        end;
      end;
    bsDone:
      begin
        update(ATime);
        render;
      end;
  end;

  window.requestAnimationFrame(@OnRequestFrame);
end;

function TGameBase.GetElements: TJSArray;
begin
  result:=fElements;
end;

procedure TGameBase.InitializeResources;
begin
end;

procedure TGameBase.AfterLoad;
begin
end;

procedure TGameBase.AfterResize;
begin
end;

procedure TGameBase.DoMove(AX, AY: double);
begin
end;

procedure TGameBase.DoWheel(AX: double);
begin
end;

procedure TGameBase.DoStopDrag();
begin

end;

procedure TGameBase.DoStartDrag(AX, AY: double);
begin

end;

procedure TGameBase.DoClick(AX, AY: double; AButtons: longword);
begin
end;

procedure TGameBase.DoKeyPress(AKeyCode: string);
begin
end;

procedure TGameBase.Update(ATimeMS: double);
var
  i: longint;
  el: JSValue;
begin           
  fAudio.Update(ATimeMS);

  for el in GetElements() do
    TGameElement(el).Update(self, ATimeMS);

  for i:=0 to fToFree.Length-1 do
    TGameElement(fToFree[i]).Destroy;
  fToFree:=TJSArray.new;
end;

function OnlyVisible(element: JSValue; index: NativeInt; anArray: TJSArray): Boolean;
begin
  result:=TGameElement(element).Visible;
end;

procedure TGameBase.Render;
var
  el: JSValue;
  toDraw, opaque, transparent: TJSArray;
begin
  toDraw:=GetElements().filter(@OnlyVisible);

  opaque:=toDraw.filter(function(element: JSValue; index: NativeInt; anArray: TJSArray): Boolean begin result:=TGameElement(element).Opaque; end);
  for el in opaque do
    TGameElement(el).Render(GL, Viewport);

  if DisableDepthForTransparent then
    GL.disable(GL.DEPTH_TEST);

  transparent:=toDraw.filter(function(element: JSValue; index: NativeInt; anArray: TJSArray): Boolean begin result:=not TGameElement(element).Opaque; end);
  toDraw:=transparent.sort(function (a,b : JSValue) : NativeInt
  begin
    result:=round(TGameElement(b).Position.y - TGameElement(a).Position.y);
  end);

  for el in toDraw do
    TGameElement(el).Render(GL, Viewport);

  if DisableDepthForTransparent then
    GL.enable(GL.DEPTH_TEST);
end;

function TGameBase.AddElement(AElement: TGameElement): TGameElement;
begin
  fElements.push(AElement);
  result:=AElement;
end;

procedure TGameBase.RemoveElement(AElement: TGameElement; AFreeLater: boolean);
var
  idx: NativeInt;
begin
  idx:=fElements.indexOf(AElement);
  if idx>-1 then
    fElements.splice(idx, 1);

  if AFreeLater then
    fToFree.push(AElement);
end;

constructor TGameBase.Create;
begin
  inherited Create;
  fAudio:=TGameAudio.Create;
  fToFree:=TJSArray.new;
  fState:=bsStart;

  Viewport.Projection:=TPMatrix.Identity;
  Viewport.ModelView:=TPMatrix.Identity;

  fElements:=TJSArray.new;

  canvas:=document.getElementById('c') as TJSHTMLCanvasElement;
  GL:=canvas.getContext('webgl') as TJSWebGLRenderingContext;

  gl.getExtension('OES_standard_derivatives');

  canvas.onmousedown:=@OnCanvasMouseDown;
  canvas.onmouseup:=@OnCanvasMouseUp;
  Canvas.onmousemove:=@OnCanvasMove;
  Canvas.onwheel:=@OnCanvasWheel;
  Canvas.onmouseleave:=@OnCanvasLeave;

  window.addEventListener('keydown', @OnCanvasKeyPress);
  window.addEventListener('resize', @OnResize);
  OnResize(nil);
end;

procedure TGameBase.Run;
begin
  InitializeResources;
  fState:=bsWaitResources;

  window.requestAnimationFrame(@OnRequestFrame);
end;

end.

