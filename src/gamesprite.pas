unit GameSprite;

{$mode ObjFPC}

interface

uses
  JS, WebGL,
  GameBase, GameMath,
  Classes, SysUtils;

type
  TGameFrame = record
    Image: TGameTexture;
    Start, Stop: TPVector;
    StartTime: double;
  end;

  TGameAnimation = class
  private
    fName: string;

    fFrame: array of TGameFrame;
    fLooptime: double;
  public
    constructor Create(const AName: string);

    procedure AddFrame(AImage: TGameTexture; AStart, AStop: TPVector; AFrameTime: double);
    function GetFrame(ATime: double): TGameFrame;

    property Name: string read fName;
  end;

  TGameSprite = class
  private
    fWidth, fHeight: integer;
    fName: string;
    fAnimations: TJSMap;
  public
    constructor CreateJSON(const AInfo: string);

    function GetFrame(const AAnimation: string; ATime: double): TGameFrame;

    property Name: string read fName;

    property Width: integer read fWidth;
    property Height: integer read fHeight;
  end;

  TGameQuad = array[0..3] of TPVector;

procedure AddSprite(const AJson: string);
function GetSprite(const AName: string): TGameSprite;

procedure RenderFrame(GL: TJSWebGLRenderingContext; const AViewport: TGameViewport; const AQuad: TGameQuad; const AFrame: TGameFrame);

implementation

uses
  resources;
var
  Sprites: TJSMap;

  BuffersAllocated: boolean = false;
  Buffer, Elements: TJSWebGLBuffer;
  Shader: TGameShader;

procedure AllocateStuff(GL: TJSWebGLRenderingContext);
begin
  if BuffersAllocated then exit;
  BuffersAllocated:=true;

  Buffer:=GL.createBuffer;
  Elements:=GL.createBuffer;

  Shader:=TGameShader.Create('attribute vec3 position;'+
                             'attribute vec2 uv;'+
                             'uniform mat4 projectionMatrix;'+
                             'uniform mat4 modelViewMatrix;'+
                             'varying vec2 texCoord;'+
                             'void main(void){ texCoord = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',

                             'precision mediump float;'+
                             'varying vec2 texCoord;'+
                             'uniform sampler2D map;'+
                             'void main(void) {'+
                             '  gl_FragColor = texture2D(map, texCoord).rgba;'+
                             //'  if (gl_FragColor.a < 0.001) discard;'+
                             '}'
                             );
end;

procedure AddSprite(const AJson: string);
var
  s: TGameSprite;
begin
  s:=TGameSprite.CreateJSON(AJson);
  Sprites.&set(s.Name, s);
end;

function GetSprite(const AName: string): TGameSprite;
begin
  result:=TGameSprite(Sprites.get(AName));
end;

procedure RenderFrame(GL: TJSWebGLRenderingContext; const AViewport: TGameViewport; const AQuad: TGameQuad; const AFrame: TGameFrame);
var
  i, i2: Integer;
  vertices: TJSFloat32Array;
  indices: TJSUint16Array;
  texLoc, pmLoc, mmLoc: TJSWebGLUniformLocation;
  vc: GLint;
begin
  AllocateStuff(GL);

  GL.enable(GL.BLEND);
  GL.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  vertices:=TJSFloat32Array.new(4*(3+2));
  indices:=TJSUint16Array.new(2*3);

  for i2:=0 to 3 do
  begin
    vertices[i2*5+0]:=AQuad[i2].X;
    vertices[i2*5+1]:=AQuad[i2].Y;
    vertices[i2*5+2]:=AQuad[i2].Z;
  end;

  vertices[0*5+3]:=AFrame.Start.X;
  vertices[0*5+4]:=AFrame.Start.Y;

  vertices[1*5+3]:=AFrame.Stop.X;
  vertices[1*5+4]:=AFrame.Start.Y;

  vertices[2*5+3]:=AFrame.Stop.X;
  vertices[2*5+4]:=AFrame.Stop.Y;

  vertices[3*5+3]:=AFrame.Start.X;
  vertices[3*5+4]:=AFrame.Stop.Y;

  indices._set([4*i+0,4*i+1,4*i+2, 4*i+2,4*i+3,4*i+0], 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, Buffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, nil);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, Elements);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, nil);

  gl.useProgram(Shader.ID);

  gl.bindBuffer(gl.ARRAY_BUFFER, Buffer);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, Elements);

  texLoc:=gl.getUniformLocation(Shader.ID, 'map');

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, AFrame.Image.ID);
  gl.uniform1i(texLoc, 0);

  pmLoc:=gl.getUniformLocation(Shader.ID, 'projectionMatrix');
  mmLoc:=gl.getUniformLocation(Shader.ID, 'modelViewMatrix');
  gl.uniformMatrix4fv(pmLoc, false, AViewport.Projection.Raw);
  gl.uniformMatrix4fv(mmLoc, false, AViewport.ModelView.Raw);

  vc:=gl.getAttribLocation(Shader.ID, 'position');
  gl.vertexAttribPointer(vc,3,gl.FLOAT,false,20,0);
  gl.enableVertexAttribArray(vc);

  vc:=gl.getAttribLocation(Shader.ID, 'uv');
  gl.vertexAttribPointer(vc,2,gl.FLOAT,false,20,12);
  gl.enableVertexAttribArray(vc);

  gl.drawElements(gl.TRIANGLES,2*3,gl.UNSIGNED_SHORT,0);

  GL.disable(GL.BLEND);
end;

constructor TGameSprite.CreateJSON(const AInfo: string);
var
  fInfo: TJSObject;
  x,y,idx,XCount: Integer;
  texture: TGameTexture;
  animations: String;
  obj: TJSArray;
  anim: TGameAnimation;
  frame: JSValue;
  time: double;
begin
  inherited Create;
  fAnimations:=TJSMap.new;
  fInfo:=TJSObject(TJSJSON.parse(AInfo));

  fName:=string(fInfo['name']);

  fWidth:=integer(fInfo['tile-width']);
  fHeight:=integer(fInfo['tile-height']);
  texture:=TResources.AddImage(string(fInfo['texture']));

  XCount:=Texture.Width div Width;

  for animations in TJSObject.keys(TJSObject(fInfo['animations'])) do
  begin
    obj:=TJSArray(TJSObject(fInfo['animations'])[animations]);

    anim:=TGameAnimation.Create(animations);
    fAnimations.&set(animations, anim);

    for frame in obj do
    begin
      idx:=integer(TJSObject(frame)['frame']);
      time:=double(TJSObject(frame)['time']);

      x:=idx mod XCount;
      y:=idx div XCount;

      anim.AddFrame(texture, TPVector.New(x*Width, y*Height), TPVector.New((x+1)*Width, (y+1)*Height), time);
    end;
  end;
end;

function TGameSprite.GetFrame(const AAnimation: string; ATime: double): TGameFrame;
var
  anim: TGameAnimation;
begin
  anim:=TGameAnimation(fAnimations.get(AAnimation));
  result:=anim.GetFrame(ATime);
end;

constructor TGameAnimation.Create(const AName: string);
begin
  inherited Create;
  fName:=AName;
  fLooptime:=0;
end;

procedure TGameAnimation.AddFrame(AImage: TGameTexture; AStart, AStop: TPVector; AFrameTime: double);
begin
  setlength(fFrame, high(fFrame)+2);

  fFrame[high(fFrame)].Image:=AImage;
  fFrame[high(fFrame)].Start:=AStart.Multiply(TPVector.new(1/AImage.Width, 1/AImage.Height));
  fFrame[high(fFrame)].Stop :=AStop.Multiply(TPVector.new(1/AImage.Width, 1/AImage.Height));
  fFrame[high(fFrame)].StartTime:=fLooptime;

  fLooptime:=fLooptime+AFrameTime;
end;

function TGameAnimation.GetFrame(ATime: double): TGameFrame;
var
  best, i: Integer;
begin
  ATime:=ATime mod fLooptime;
  best:=high(fFrame);

  for i:=0 to high(fFrame) do
    if ATime>fFrame[i].StartTime then
      best:=i;

  result:=fFrame[best];
end;

initialization
  Sprites:=TJSMap.new;

end.

